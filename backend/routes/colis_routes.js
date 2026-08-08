/**
 * ROUTES COLIS — /api/agency/colis
 *
 * À ajouter dans server.js :
 *   const colisRoutes = require('./routes/colis_routes');
 *   app.use('/api/agency/colis', colisRoutes);
 *
 * Migration SQL à exécuter une seule fois :
 *   CREATE TABLE IF NOT EXISTS colis (
 *     id          TEXT PRIMARY KEY,
 *     agency_id   TEXT NOT NULL,
 *     trip_id     TEXT NOT NULL,
 *     recipient_name TEXT NOT NULL,
 *     description TEXT NOT NULL,
 *     total_amount   REAL NOT NULL DEFAULT 0,
 *     advance_paid   REAL NOT NULL DEFAULT 0,
 *     remaining      REAL GENERATED ALWAYS AS (total_amount - advance_paid) STORED,
 *     payment_status TEXT NOT NULL DEFAULT 'partial',  -- 'ok' | 'partial'
 *     created_at  TEXT NOT NULL DEFAULT (datetime('now')),
 *     FOREIGN KEY (agency_id) REFERENCES agencies(id),
 *     FOREIGN KEY (trip_id)   REFERENCES trips(id)
 *   );
 */

const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

// ── Middleware auth ────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), SECRET);
    if (decoded.role !== 'agency') return res.status(403).json({ error: 'Accès refusé' });
    decoded.agency_id = decoded.agency_id || decoded.id;
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// ── Helper : s'assurer que la table colis existe ───────────────────────────────
function ensureTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS colis (
      id             TEXT PRIMARY KEY,
      agency_id      TEXT NOT NULL,
      trip_id        TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      description    TEXT NOT NULL,
      total_amount   REAL NOT NULL DEFAULT 0,
      advance_paid   REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'partial',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

// ── GET /api/agency/colis?trip_id=&date= ──────────────────────────────────────
// Retourne les colis filtrés par voyage OU par date de départ
router.get('/', auth, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);

    const { trip_id, date } = req.query;
    const aid = req.user.agency_id;

    let sql = `
      SELECT c.*, t.departure_city, t.arrival_city, t.departure_date, t.departure_time, t.bus_name
      FROM colis c
      JOIN trips t ON c.trip_id = t.id
      WHERE c.agency_id = ?
    `;
    const params = [aid];

    if (trip_id) {
      sql += ` AND c.trip_id = ?`;
      params.push(trip_id);
    } else if (date) {
      sql += ` AND t.departure_date = ?`;
      params.push(date);
    } else {
      // Défaut : aujourd'hui
      sql += ` AND t.departure_date = ?`;
      params.push(new Date().toISOString().split('T')[0]);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const rows = db.prepare(sql).all(...params);
    // Calculer remaining à la volée (compatibilité SQLite sans colonnes générées)
    const result = rows.map(r => ({
      ...r,
      remaining: parseFloat((r.total_amount - r.advance_paid).toFixed(2)),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agency/colis ─────────────────────────────────────────────────────
// Créer un nouveau colis
router.post('/', auth, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);

    const { trip_id, recipient_name, description, total_amount, advance_paid } = req.body;

    if (!trip_id)         return res.status(400).json({ error: 'trip_id requis' });
    if (!recipient_name)  return res.status(400).json({ error: 'Nom du destinataire requis' });
    if (!description)     return res.status(400).json({ error: 'Description requise' });

    const total   = parseFloat(total_amount)  || 0;
    const advance = parseFloat(advance_paid)  || 0;

    if (advance < 0 || advance > total)
      return res.status(400).json({ error: 'Avance invalide (doit être entre 0 et le montant total)' });

    // Vérifier que le voyage appartient à l'agence
    const trip = db.prepare('SELECT id FROM trips WHERE id=? AND agency_id=?').get(trip_id, req.user.agency_id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });

    const payment_status = advance >= total ? 'ok' : 'partial';
    const id = uuidv4();

    db.prepare(`
      INSERT INTO colis (id, agency_id, trip_id, recipient_name, description, total_amount, advance_paid, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.agency_id, trip_id, recipient_name.trim(), description.trim(), total, advance, payment_status);

    res.status(201).json({
      id,
      remaining: parseFloat((total - advance).toFixed(2)),
      payment_status,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/agency/colis/:id ───────────────────────────────────────────────
// Modifier un colis existant
router.patch('/:id', auth, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);

    const colis = db.prepare('SELECT * FROM colis WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!colis) return res.status(404).json({ error: 'Colis introuvable' });

    const { recipient_name, description, total_amount, advance_paid } = req.body;
    const total   = total_amount  !== undefined ? parseFloat(total_amount)  : colis.total_amount;
    const advance = advance_paid  !== undefined ? parseFloat(advance_paid)  : colis.advance_paid;

    if (advance < 0 || advance > total)
      return res.status(400).json({ error: 'Avance invalide' });

    const payment_status = advance >= total ? 'ok' : 'partial';

    db.prepare(`
      UPDATE colis
      SET recipient_name = COALESCE(?, recipient_name),
          description    = COALESCE(?, description),
          total_amount   = ?,
          advance_paid   = ?,
          payment_status = ?
      WHERE id = ? AND agency_id = ?
    `).run(
      recipient_name ? recipient_name.trim() : null,
      description    ? description.trim()    : null,
      total, advance, payment_status,
      req.params.id, req.user.agency_id,
    );

    res.json({ ok: true, remaining: parseFloat((total - advance).toFixed(2)), payment_status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/agency/colis/:id ──────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const info = db.prepare('DELETE FROM colis WHERE id=? AND agency_id=?').run(req.params.id, req.user.agency_id);
    if (info.changes === 0) return res.status(404).json({ error: 'Colis introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;