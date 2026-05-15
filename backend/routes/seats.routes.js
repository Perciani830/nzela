/**
 * seats.routes.js — Endpoints de gestion des sièges Nzela RDC
 *
 * Monter dans app.js / index.js :
 *   const seatsRouter = require('./routes/seats.routes');
 *   app.use('/api', seatsRouter);
 *
 * Endpoints :
 *   GET    /api/trips/:tripId/seats           → plan complet + statuts
 *   POST   /api/trips/:tripId/seats/reserve   → réservation temporaire 15 min (public)
 *   DELETE /api/trips/:tripId/seats/reserve   → libérer une réservation temporaire
 *   POST   /api/trips/:tripId/seats/assign    → assigner définitivement (agence)
 *   GET    /api/buses/:busId/layout           → layout + total_seats d'un bus
 *   PATCH  /api/agency/buses/:busId/layout    → modifier le layout (agence)
 *   PATCH  /api/admin/buses/:busId/layout     → modifier le layout (admin)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  getDb,
  runTransaction,
  ensureSeatsExist,      // ← depuis database.js, pas redéfini ici
  releaseExpiredSeats,   // ← idem
} = require('../db/database');

const router = express.Router();

/* ── Middleware auth ─────────────────────────────────────────────
 * ⚠️  Si tu as déjà des middlewares auth dans ton projet
 *     (ex: middleware/auth.js), remplace requireAgency / requireAdmin
 *     par tes fonctions existantes pour ne pas dupliquer la logique.
 * ──────────────────────────────────────────────────────────────── */
const jwt = require('jsonwebtoken');

function requireAgency(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.agency = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Accès refusé' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/trips/:tripId/seats
   Retourne le plan complet du voyage avec statut de chaque siège.
   Initialise les sièges automatiquement si c'est le premier appel.
   ═══════════════════════════════════════════════════════════════ */
router.get('/trips/:tripId/seats', (req, res) => {
  try {
    const db = getDb();
    const { tripId } = req.params;

    releaseExpiredSeats(db);

    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });

    ensureSeatsExist(db, tripId);

    const bus = trip.bus_id
      ? db.prepare('SELECT layout, total_seats FROM buses WHERE id = ?').get(trip.bus_id)
      : null;

    const seats = db.prepare(`
      SELECT s.seat_number, s.status, s.booking_id, s.expires_at,
             b.reference     AS booking_ref,
             b.passenger_name
      FROM   seats s
      LEFT JOIN bookings b ON s.booking_id = b.id
      WHERE  s.trip_id = ?
      ORDER  BY s.seat_number
    `).all(tripId);

    res.json({
      trip_id:     tripId,
      layout:      bus?.layout      || '2+3',
      total_seats: trip.total_seats || bus?.total_seats || 50,
      seats: seats.map(s => ({
        seat_number:    s.seat_number,
        status:         s.status,
        booking_id:     s.booking_id,
        booking_ref:    s.booking_ref,
        passenger_name: s.passenger_name,
        expires_at:     s.expires_at,
      })),
      summary: {
        available: seats.filter(s => s.status === 'available').length,
        pending:   seats.filter(s => s.status === 'pending').length,
        reserved:  seats.filter(s => s.status === 'reserved').length,
        confirmed: seats.filter(s => s.status === 'confirmed').length,
      },
    });
  } catch(e) {
    console.error('GET /seats error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/trips/:tripId/seats/reserve  (public — site client)
   Bloque les sièges 15 minutes pour un session_token donné.
   Si le client quitte sans payer → les sièges se libèrent seuls.
   ═══════════════════════════════════════════════════════════════ */
router.post('/trips/:tripId/seats/reserve', (req, res) => {
  const db = getDb();
  const { tripId } = req.params;
  const { seat_numbers, session_token } = req.body;

  if (!Array.isArray(seat_numbers) || seat_numbers.length === 0)
    return res.status(400).json({ error: 'seat_numbers requis (tableau non vide)' });
  if (!session_token)
    return res.status(400).json({ error: 'session_token requis' });

  releaseExpiredSeats(db);
  ensureSeatsExist(db, tripId);

  const ph = seat_numbers.map(() => '?').join(',');
  const current = db.prepare(
    `SELECT seat_number, status FROM seats WHERE trip_id = ? AND seat_number IN (${ph})`
  ).all(tripId, ...seat_numbers);

  const unavailable = current.filter(s => s.status !== 'available');
  if (unavailable.length > 0) {
    return res.status(409).json({
      error:       'Certains sièges ne sont plus disponibles',
      unavailable: unavailable.map(s => s.seat_number),
    });
  }

  // Libérer les anciens pending de cette même session sur ce voyage
  db.prepare(`
    UPDATE seats
    SET    status = 'available', booking_id = NULL, expires_at = NULL
    WHERE  trip_id = ? AND status = 'pending' AND booking_id = ?
  `).run(tripId, session_token);

  // Expiration dans 15 minutes (format SQLite datetime)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    .toISOString().replace('T', ' ').split('.')[0];

  const stmtPending = db.prepare(`
    UPDATE seats
    SET    status = 'pending', booking_id = ?, expires_at = ?
    WHERE  trip_id = ? AND seat_number = ? AND status = 'available'
  `);

  const results = [];
  runTransaction(db, () => {
    seat_numbers.forEach(sn => {
      const r = stmtPending.run(session_token, expiresAt, tripId, sn);
      results.push({ seat_number: sn, ok: r.changes > 0 });
    });
  });

  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    return res.status(409).json({
      error:  'Conflit — certains sièges ont été pris entre-temps',
      failed: failed.map(r => r.seat_number),
    });
  }

  res.json({
    success:    true,
    reserved:   seat_numbers,
    expires_at: expiresAt,
    message:    `${seat_numbers.length} siège(s) bloqué(s) 15 min. Finalisez votre réservation.`,
  });
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/trips/:tripId/seats/reserve
   Libère immédiatement les sièges pending d'une session.
   Appeler si le client annule ou ferme l'étape de paiement.
   ═══════════════════════════════════════════════════════════════ */
router.delete('/trips/:tripId/seats/reserve', (req, res) => {
  const db = getDb();
  const { tripId } = req.params;
  const { session_token } = req.body;

  if (!session_token)
    return res.status(400).json({ error: 'session_token requis' });

  db.prepare(`
    UPDATE seats
    SET    status = 'available', booking_id = NULL, expires_at = NULL
    WHERE  trip_id = ? AND status = 'pending' AND booking_id = ?
  `).run(tripId, session_token);

  res.json({ success: true, message: 'Sièges libérés' });
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/trips/:tripId/seats/assign  (agence authentifiée)
   Assigne définitivement des sièges à une réservation existante.
   Appelé après doCreateBooking dans l'AgencyDashboard.
   ═══════════════════════════════════════════════════════════════ */
router.post('/trips/:tripId/seats/assign', requireAgency, (req, res) => {
  const db = getDb();
  const { tripId } = req.params;
  const { seat_numbers, booking_id, status = 'confirmed' } = req.body;

  if (!Array.isArray(seat_numbers) || seat_numbers.length === 0)
    return res.status(400).json({ error: 'seat_numbers requis (tableau non vide)' });
  if (!booking_id)
    return res.status(400).json({ error: 'booking_id requis' });
  if (!['reserved', 'confirmed'].includes(status))
    return res.status(400).json({ error: 'status invalide — "reserved" ou "confirmed"' });

  releaseExpiredSeats(db);
  ensureSeatsExist(db, tripId);

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });

  const ph = seat_numbers.map(() => '?').join(',');
  const current = db.prepare(
    `SELECT seat_number, status, booking_id FROM seats WHERE trip_id = ? AND seat_number IN (${ph})`
  ).all(tripId, ...seat_numbers);

  // Un siège occupé par une AUTRE réservation = conflit
  const conflicts = current.filter(s =>
    s.status !== 'available' && s.booking_id !== booking_id
  );
  if (conflicts.length > 0) {
    return res.status(409).json({
      error:     'Certains sièges sont déjà occupés par une autre réservation',
      conflicts: conflicts.map(s => ({ seat: s.seat_number, status: s.status })),
    });
  }

  runTransaction(db, () => {
    // Libérer les anciens sièges de cette réservation qui ne sont plus sélectionnés
    db.prepare(`
      UPDATE seats
      SET    status = 'available', booking_id = NULL, expires_at = NULL
      WHERE  trip_id = ? AND booking_id = ? AND seat_number NOT IN (${ph})
    `).run(tripId, booking_id, ...seat_numbers);

    // Upsert : crée ou met à jour chaque siège sélectionné
    const stmtUpsert = db.prepare(`
      INSERT INTO seats (id, trip_id, seat_number, status, booking_id, expires_at)
      VALUES (?, ?, ?, ?, ?, NULL)
      ON CONFLICT(trip_id, seat_number) DO UPDATE SET
        status     = excluded.status,
        booking_id = excluded.booking_id,
        expires_at = NULL
    `);
    seat_numbers.forEach(sn =>
      stmtUpsert.run(uuidv4(), tripId, sn, status, booking_id)
    );

    // Sauvegarder les numéros de sièges sur la réservation (ex: "1A,1B,2C")
    db.prepare('UPDATE bookings SET seat_numbers = ? WHERE id = ?')
      .run(seat_numbers.join(','), booking_id);
  });

  res.json({
    success:        true,
    booking_id,
    assigned_seats: seat_numbers,
    status,
  });
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/buses/:busId/layout
   ═══════════════════════════════════════════════════════════════ */
router.get('/buses/:busId/layout', (req, res) => {
  const db = getDb();
  const bus = db.prepare(
    'SELECT id, bus_name, layout, total_seats FROM buses WHERE id = ?'
  ).get(req.params.busId);

  if (!bus) return res.status(404).json({ error: 'Bus introuvable' });
  res.json({ ...bus, layout: bus.layout || '2+3' });
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/agency/buses/:busId/layout  (agence)
   ═══════════════════════════════════════════════════════════════ */
router.patch('/agency/buses/:busId/layout', requireAgency, (req, res) => {
  const db = getDb();
  const { layout } = req.body;
  const VALID = ['2+2', '2+3', '2'];

  if (!VALID.includes(layout))
    return res.status(400).json({ error: `Layout invalide. Valeurs : ${VALID.join(', ')}` });

  const bus = db.prepare('SELECT * FROM buses WHERE id = ?').get(req.params.busId);
  if (!bus) return res.status(404).json({ error: 'Bus introuvable' });
  if (bus.agency_id !== req.agency.agency_id)
    return res.status(403).json({ error: 'Accès refusé — ce bus ne vous appartient pas' });

  db.prepare('UPDATE buses SET layout = ? WHERE id = ?').run(layout, req.params.busId);

  // Supprimer les sièges 'available' des voyages futurs de ce bus
  // → ils seront régénérés avec le bon layout au prochain GET /seats
  db.prepare(`
    DELETE FROM seats
    WHERE  trip_id IN (SELECT id FROM trips WHERE bus_id = ?)
    AND    status = 'available'
  `).run(req.params.busId);

  res.json({ success: true, bus_id: req.params.busId, layout });
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/admin/buses/:busId/layout  (super admin)
   ═══════════════════════════════════════════════════════════════ */
router.patch('/admin/buses/:busId/layout', requireAdmin, (req, res) => {
  const db = getDb();
  const { layout } = req.body;
  const VALID = ['2+2', '2+3', '2'];

  if (!VALID.includes(layout))
    return res.status(400).json({ error: `Layout invalide. Valeurs : ${VALID.join(', ')}` });

  const result = db.prepare('UPDATE buses SET layout = ? WHERE id = ?')
    .run(layout, req.params.busId);

  if (result.changes === 0)
    return res.status(404).json({ error: 'Bus introuvable' });

  db.prepare(`
    DELETE FROM seats
    WHERE  trip_id IN (SELECT id FROM trips WHERE bus_id = ?)
    AND    status = 'available'
  `).run(req.params.busId);

  res.json({ success: true, bus_id: req.params.busId, layout });
});

module.exports = router;