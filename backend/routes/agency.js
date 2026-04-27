const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

// ── Middleware d'authentification ─────────────────────────────────────────────
// Lit agency_id depuis le token (présent pour les comptes principaux ET les sous-comptes)
// Définit req.user.agency_id  → ID de l'agence parente (toujours TEXT UUID)
// Définit req.user.city       → ville filtrée (null = voit tout)
// Définit req.user.is_owner   → true si propriétaire (pas de filtre ville)
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), SECRET);
    if (decoded.role !== 'agency') return res.status(403).json({ error: 'Accès refusé' });
    // Rétrocompatibilité : anciens tokens sans agency_id utilisent id
    decoded.agency_id = decoded.agency_id || decoded.id;
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// Helper : renvoie les conditions SQL de filtre ville + params
// city = null → propriétaire → aucun filtre ville
function cityFilter(user, tableAlias = '') {
  const col = tableAlias ? `${tableAlias}.departure_city` : 'departure_city';
  if (user.city && !user.is_owner) {
    return { sql: ` AND ${col} = ?`, params: [user.city] };
  }
  return { sql: '', params: [] };
}

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  try {
    const db  = getDb();
    const aid = req.user.agency_id;
    const agency = db.prepare('SELECT commission_rate FROM agencies WHERE id=?').get(aid);
    const rate   = agency ? (agency.commission_rate || 10) : 10;

    // Pour les stats, on filtre aussi par ville si le gestionnaire en a une
    const cf = cityFilter(req.user, 't');
    const joinTrip = `JOIN trips t ON b.trip_id = t.id`;

    const total_bookings = db.prepare(
      `SELECT COUNT(*) c FROM bookings b ${joinTrip} WHERE b.agency_id=? AND b.status!='cancelled'${cf.sql}`
    ).get(aid, ...cf.params).c;

    const total_revenue_raw = db.prepare(
      `SELECT COALESCE(SUM(b.total_price),0) s FROM bookings b ${joinTrip} WHERE b.agency_id=? AND b.status='confirmed'${cf.sql}`
    ).get(aid, ...cf.params).s;

    const total_commission = db.prepare(
      `SELECT COALESCE(SUM(b.commission_amount),0) s FROM bookings b ${joinTrip} WHERE b.agency_id=? AND b.status='confirmed'${cf.sql}`
    ).get(aid, ...cf.params).s;

    const total_revenue = total_revenue_raw - total_commission;

    // Trips et buses : pas de filtre ville pour les stats globales d'infra
    const active_trips     = db.prepare("SELECT COUNT(*) c FROM trips WHERE agency_id=? AND is_active=1 AND available_seats>0").get(aid).c;
    const pending_bookings = db.prepare(
      `SELECT COUNT(*) c FROM bookings b ${joinTrip} WHERE b.agency_id=? AND b.status='pending'${cf.sql}`
    ).get(aid, ...cf.params).c;
    const total_buses      = db.prepare("SELECT COUNT(*) c FROM buses WHERE agency_id=? AND is_active=1").get(aid).c;

    res.json({ total_bookings, total_revenue, total_commission, active_trips, pending_bookings, total_buses });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
router.get('/settings', auth, (req, res) => {
  try {
    const ag = getDb().prepare(
      'SELECT agency_name, email, phone, address, cancel_rate, commission_rate, logo_url, home_city FROM agencies WHERE id=?'
    ).get(req.user.agency_id);
    if (!ag) return res.status(404).json({ error: 'Introuvable' });
    res.json(ag);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings', auth, (req, res) => {
  try {
    // Seul le propriétaire peut modifier les settings globaux
    // Un gestionnaire de ville peut mettre à jour home_city uniquement si son token n'a pas city
    const { email, phone, address, cancel_rate, logo_url, home_city } = req.body;
    const rate = parseFloat(cancel_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) return res.status(400).json({ error: 'Taux invalide (0-100)' });
    getDb().prepare(
      'UPDATE agencies SET email=COALESCE(?,email), phone=COALESCE(?,phone), address=COALESCE(?,address), cancel_rate=?, logo_url=COALESCE(?,logo_url), home_city=? WHERE id=?'
    ).run(email||null, phone||null, address||null, rate, logo_url||null, home_city||null, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BUSES ─────────────────────────────────────────────────────────────────────
router.get('/buses', auth, (req, res) => {
  try {
    res.json(getDb().prepare('SELECT * FROM buses WHERE agency_id=? ORDER BY bus_name ASC').all(req.user.agency_id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/buses', auth, (req, res) => {
  try {
    const { bus_name, total_seats, description } = req.body;
    if (!bus_name) return res.status(400).json({ error: 'Nom du bus requis' });
    const id = uuidv4();
    getDb().prepare('INSERT INTO buses (id,agency_id,bus_name,total_seats,description) VALUES (?,?,?,?,?)')
      .run(id, req.user.agency_id, bus_name, parseInt(total_seats)||50, description||null);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/buses/:id', auth, (req, res) => {
  try {
    const { bus_name, total_seats, description, is_active } = req.body;
    getDb().prepare(
      'UPDATE buses SET bus_name=COALESCE(?,bus_name), total_seats=COALESCE(?,total_seats), description=COALESCE(?,description), is_active=COALESCE(?,is_active) WHERE id=? AND agency_id=?'
    ).run(bus_name||null, total_seats?parseInt(total_seats):null, description||null, is_active!==undefined?(is_active?1:0):null, req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/buses/:id', auth, (req, res) => {
  try {
    getDb().prepare('UPDATE buses SET is_active=0 WHERE id=? AND agency_id=?').run(req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TRIPS ─────────────────────────────────────────────────────────────────────
router.get('/trips', auth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cf    = cityFilter(req.user);
    res.json(getDb().prepare(
      `SELECT * FROM trips WHERE agency_id=? AND departure_date >= ?${cf.sql} ORDER BY departure_date ASC, departure_time ASC`
    ).all(req.user.agency_id, today, ...cf.params));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/trips', auth, (req, res) => {
  try {
    const { bus_id, departure_city, arrival_city, departure_date, departure_time, price, description } = req.body;
    if (!departure_city||!arrival_city||!departure_date||!departure_time||!price)
      return res.status(400).json({ error: 'Champs manquants' });

    // Sécurité : un gestionnaire de ville ne peut créer que des voyages depuis sa ville
    if (req.user.city && !req.user.is_owner && departure_city !== req.user.city)
      return res.status(403).json({ error: `Vous ne pouvez créer des voyages que depuis ${req.user.city}` });

    const db = getDb();
    let busName = null, seats = 50;
    if (bus_id) {
      const bus = db.prepare('SELECT * FROM buses WHERE id=? AND agency_id=?').get(bus_id, req.user.agency_id);
      if (bus) { busName = bus.bus_name; seats = bus.total_seats; }
    }
    const id = uuidv4();
    db.prepare(
      'INSERT INTO trips (id,agency_id,bus_id,bus_name,departure_city,arrival_city,departure_date,departure_time,price,total_seats,available_seats,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(id, req.user.agency_id, bus_id||null, busName, departure_city, arrival_city, departure_date, departure_time, parseFloat(price), seats, seats, description||null);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GÉNÉRATION EN MASSE ───────────────────────────────────────────────────────
router.post('/trips/bulk', auth, (req, res) => {
  try {
    const { bus_id, departure_city, arrival_city, departure_time, price, description, dates } = req.body;
    if (!departure_city || !arrival_city) return res.status(400).json({ error: 'Départ et arrivée requis' });
    if (departure_city === arrival_city)  return res.status(400).json({ error: 'Départ et arrivée doivent être différents' });
    if (!departure_time || !price)        return res.status(400).json({ error: 'Heure et prix requis' });
    if (!Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'Aucune date fournie' });
    if (dates.length > 90)                return res.status(400).json({ error: 'Maximum 90 dates à la fois' });

    // Sécurité ville
    if (req.user.city && !req.user.is_owner && departure_city !== req.user.city)
      return res.status(403).json({ error: `Vous ne pouvez créer des voyages que depuis ${req.user.city}` });

    const db = getDb();
    let busName = null, seats = 50;
    if (bus_id) {
      const bus = db.prepare('SELECT * FROM buses WHERE id=? AND agency_id=?').get(bus_id, req.user.agency_id);
      if (bus) { busName = bus.bus_name; seats = bus.total_seats; }
    }
    let created = 0;
    const stmt = db.prepare(
      `INSERT INTO trips (id,agency_id,bus_id,bus_name,departure_city,arrival_city,departure_date,departure_time,price,total_seats,available_seats,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    runTransaction(db, () => {
      for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        stmt.run(uuidv4(), req.user.agency_id, bus_id||null, busName, departure_city, arrival_city, date, departure_time, parseFloat(price), seats, seats, description||null);
        created++;
      }
    });
    res.status(201).json({ created });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/trips/:id', auth, (req, res) => {
  try {
    const { departure_city, arrival_city, departure_date, departure_time, price, available_seats, total_seats, description } = req.body;
    getDb().prepare(
      `UPDATE trips SET departure_city=COALESCE(?,departure_city), arrival_city=COALESCE(?,arrival_city), departure_date=COALESCE(?,departure_date), departure_time=COALESCE(?,departure_time), price=COALESCE(?,price), available_seats=COALESCE(?,available_seats), total_seats=COALESCE(?,total_seats), description=COALESCE(?,description) WHERE id=? AND agency_id=?`
    ).run(departure_city||null, arrival_city||null, departure_date||null, departure_time||null, price?parseFloat(price):null, available_seats!==undefined?parseInt(available_seats):null, total_seats!==undefined?parseInt(total_seats):null, description||null, req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/trips/:id', auth, (req, res) => {
  try {
    const db   = getDb();
    const trip = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });
    if (trip.is_active) {
      const booked = db.prepare("SELECT COUNT(*) c FROM bookings WHERE trip_id=? AND status='confirmed'").get(req.params.id).c;
      if (booked > 0) return res.status(400).json({ error: `Impossible : ${booked} réservation(s) confirmée(s) sur ce voyage` });
    }
    db.prepare("UPDATE bookings SET status='cancelled', payment_status='refunded', commission_amount=0 WHERE trip_id=? AND status='pending'").run(req.params.id);
    db.prepare('DELETE FROM trips WHERE id=? AND agency_id=?').run(req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
router.get('/bookings', auth, (req, res) => {
  try {
    const cf = cityFilter(req.user, 't');
    res.json(getDb().prepare(`
      SELECT b.*, t.departure_city, t.arrival_city, t.departure_date, t.departure_time, t.bus_name, a.agency_name
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN agencies a ON b.agency_id = a.id
      WHERE b.agency_id=?${cf.sql}
      ORDER BY b.created_at DESC
    `).all(req.user.agency_id, ...cf.params));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/bookings/:id/confirm', auth, (req, res) => {
  try {
    const db = getDb();
    const b  = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    const agency = db.prepare('SELECT commission_rate FROM agencies WHERE id=?').get(req.user.agency_id);
    const rate   = agency ? (agency.commission_rate || 10) : 10;
    const commission_amount = Math.round(b.total_price * rate / 100);
    db.prepare("UPDATE bookings SET status='confirmed', payment_status='completed', commission_rate=?, commission_amount=? WHERE id=? AND agency_id=?")
      .run(rate, commission_amount, req.params.id, req.user.agency_id);
    res.json({ ok: true, commission_amount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/bookings/:id/cancel', auth, (req, res) => {
  try {
    const db = getDb();
    const b  = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    runTransaction(db, () => {
      db.prepare("UPDATE bookings SET status='cancelled', payment_status='refunded', commission_amount=0 WHERE id=?").run(req.params.id);
      db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(b.passengers||1, b.trip_id);
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MANIFESTE ─────────────────────────────────────────────────────────────────
// GET /manifest/trips?all=1          → tous les voyages
// GET /manifest/trips?date=YYYY-MM-DD → voyages d'une date précise
// GET /manifest/trips                 → voyages d'aujourd'hui (défaut)
router.get('/manifest/trips', auth, (req, res) => {
  try {
    const { date, all } = req.query;
    const cf = cityFilter(req.user, 't');

    let dateCondition = '';
    const dateParams = [];
    if (all === '1') {
      // Pas de filtre date — tous les voyages
    } else if (date) {
      dateCondition = ` AND t.departure_date = ?`;
      dateParams.push(date);
    } else {
      // Défaut : aujourd'hui
      dateCondition = ` AND t.departure_date = ?`;
      dateParams.push(new Date().toISOString().split('T')[0]);
    }

    const trips = getDb().prepare(`
      SELECT t.*, COUNT(b.id) as booked_count
      FROM trips t
      LEFT JOIN bookings b ON b.trip_id = t.id AND b.status = 'confirmed'
      WHERE t.agency_id = ?${dateCondition}${cf.sql}
      GROUP BY t.id
      ORDER BY t.departure_date ASC, t.departure_time ASC
    `).all(req.user.agency_id, ...dateParams, ...cf.params);
    res.json(trips);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/manifest/:trip_id', auth, (req, res) => {
  try {
    const db   = getDb();
    const trip = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(req.params.trip_id, req.user.agency_id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });

    // Vérification ville pour les gestionnaires
    if (req.user.city && !req.user.is_owner && trip.departure_city !== req.user.city)
      return res.status(403).json({ error: 'Ce voyage ne concerne pas votre ville' });

    const bookings = db.prepare(`
      SELECT b.*, COALESCE(b.boarding_status, 'pending') as boarding_status
      FROM bookings b
      WHERE b.trip_id=? AND b.agency_id=? AND b.status='confirmed'
      ORDER BY b.created_at ASC
    `).all(req.params.trip_id, req.user.agency_id);
    res.json({ trip, bookings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/bookings/:id/board', auth, (req, res) => {
  try {
    const { boarding_status } = req.body;
    if (!['present','absent','pending'].includes(boarding_status))
      return res.status(400).json({ error: 'Statut invalide' });
    const db = getDb();
    const b  = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    db.prepare('UPDATE bookings SET boarding_status=? WHERE id=? AND agency_id=?')
      .run(boarding_status, req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/bookings/walkin', auth, (req, res) => {
  try {
    const { trip_id, passenger_name, passenger_phone, passengers, payment_method } = req.body;
    if (!trip_id || !passenger_name || !passenger_phone)
      return res.status(400).json({ error: 'Nom, téléphone et voyage requis' });
    const seats = Math.max(1, parseInt(passengers)||1);
    const db    = getDb();
    const trip  = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(trip_id, req.user.agency_id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });
    if (trip.available_seats < seats) return res.status(400).json({ error: 'Places insuffisantes' });
    const total = trip.price * seats;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const ref   = 'WLK-' + Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    const id    = uuidv4();
    runTransaction(db, () => {
      db.prepare(
        `INSERT INTO bookings (id,reference,trip_id,agency_id,passenger_name,passenger_phone,passengers,total_price,commission_rate,commission_amount,status,payment_status,payment_method,boarding_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, ref, trip_id, req.user.agency_id, passenger_name, passenger_phone, seats, total, 0, 0, 'confirmed', 'completed', payment_method||'cash', 'present');
      db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(seats, trip_id);
    });
    res.status(201).json({ ok: true, reference: ref, total_price: total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GESTION DES SOUS-COMPTES (agency_users) ───────────────────────────────────
// Seul le propriétaire (is_owner = true dans le JWT) peut gérer les sous-comptes

function requireOwner(req, res, next) {
  if (!req.user.is_owner) return res.status(403).json({ error: 'Réservé au propriétaire de l\'agence' });
  next();
}

// Liste des gestionnaires de l'agence
router.get('/users', auth, requireOwner, (req, res) => {
  try {
    const users = getDb().prepare(
      `SELECT id, username, full_name, city, role, is_active, created_at FROM agency_users WHERE agency_id=? ORDER BY created_at ASC`
    ).all(req.user.agency_id);
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Créer un gestionnaire
router.post('/users', auth, requireOwner, (req, res) => {
  try {
    const { username, password, full_name, city, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    if (password.length < 6)   return res.status(400).json({ error: 'Mot de passe trop court (minimum 6 caractères)' });

    const validRoles = ['manager', 'owner'];
    const userRole   = validRoles.includes(role) ? role : 'manager';

    const hash = bcrypt.hashSync(password, 10);
    const db   = getDb();

    // Vérifier unicité du username
    const existing = db.prepare('SELECT id FROM agency_users WHERE username=?').get(username)
                  || db.prepare('SELECT id FROM agencies WHERE username=?').get(username);
    if (existing) return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });

    const stmt = db.prepare(
      `INSERT INTO agency_users (agency_id, username, password, full_name, city, role) VALUES (?,?,?,?,?,?)`
    );
    const result = stmt.run(req.user.agency_id, username, hash, full_name||null, city||null, userRole);
    res.status(201).json({ id: result.lastInsertRowid, username, city, role: userRole });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Modifier un gestionnaire
router.patch('/users/:id', auth, requireOwner, (req, res) => {
  try {
    const { full_name, city, role, is_active, password } = req.body;
    const db   = getDb();
    const user = db.prepare('SELECT * FROM agency_users WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!user) return res.status(404).json({ error: 'Gestionnaire introuvable' });

    const validRoles = ['manager', 'owner'];
    const newRole    = role && validRoles.includes(role) ? role : user.role;
    const newActive  = is_active !== undefined ? (is_active ? 1 : 0) : user.is_active;
    const newHash    = password && password.length >= 6 ? bcrypt.hashSync(password, 10) : user.password;

    db.prepare(
      `UPDATE agency_users SET full_name=COALESCE(?,full_name), city=?, role=?, is_active=?, password=? WHERE id=? AND agency_id=?`
    ).run(full_name||null, city!==undefined ? (city||null) : user.city, newRole, newActive, newHash, req.params.id, req.user.agency_id);

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un gestionnaire
router.delete('/users/:id', auth, requireOwner, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM agency_users WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!user) return res.status(404).json({ error: 'Gestionnaire introuvable' });
    db.prepare('DELETE FROM agency_users WHERE id=? AND agency_id=?').run(req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Réinitialiser le mot de passe d'un gestionnaire
router.post('/users/:id/reset-password', auth, requireOwner, (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (minimum 6 caractères)' });
    const db = getDb();
    const user = db.prepare('SELECT * FROM agency_users WHERE id=? AND agency_id=?').get(req.params.id, req.user.agency_id);
    if (!user) return res.status(404).json({ error: 'Gestionnaire introuvable' });
    db.prepare('UPDATE agency_users SET password=? WHERE id=? AND agency_id=?')
      .run(bcrypt.hashSync(password, 10), req.params.id, req.user.agency_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;