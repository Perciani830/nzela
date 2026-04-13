const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), SECRET);
    if (decoded.role !== 'agency') return res.status(403).json({ error: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// ── STATS ──────────────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  try {
    const db = getDb();
    const id = req.user.id;
    const agency = db.prepare('SELECT commission_rate FROM agencies WHERE id=?').get(id);
    const rate = agency ? (agency.commission_rate || 10) : 10;
    const total_bookings    = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status!='cancelled'").get(id).c;
    const total_revenue_raw = db.prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE agency_id=? AND status='confirmed'").get(id).s;
    const total_commission  = db.prepare("SELECT COALESCE(SUM(commission_amount),0) s FROM bookings WHERE agency_id=? AND status='confirmed'").get(id).s;
    const total_revenue     = total_revenue_raw - total_commission;
    const active_trips      = db.prepare("SELECT COUNT(*) c FROM trips WHERE agency_id=? AND is_active=1 AND available_seats>0").get(id).c;
    const pending_bookings  = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='pending'").get(id).c;
    const total_buses       = db.prepare("SELECT COUNT(*) c FROM buses WHERE agency_id=? AND is_active=1").get(id).c;
    res.json({ total_bookings, total_revenue, total_commission, active_trips, pending_bookings, total_buses });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SETTINGS ───────────────────────────────────────────────────
router.get('/settings', auth, (req, res) => {
  try {
    const ag = getDb().prepare('SELECT agency_name, email, phone, address, cancel_rate, commission_rate, logo_url FROM agencies WHERE id=?').get(req.user.id);
    if (!ag) return res.status(404).json({ error: 'Introuvable' });
    res.json(ag);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings', auth, (req, res) => {
  try {
    const { email, phone, address, cancel_rate, logo_url } = req.body;
    const rate = parseFloat(cancel_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) return res.status(400).json({ error: 'Taux invalide (0-100)' });
    getDb().prepare('UPDATE agencies SET email=COALESCE(?,email), phone=COALESCE(?,phone), address=COALESCE(?,address), cancel_rate=?, logo_url=COALESCE(?,logo_url) WHERE id=?')
      .run(email||null, phone||null, address||null, rate, logo_url||null, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BUSES ──────────────────────────────────────────────────────
router.get('/buses', auth, (req, res) => {
  try {
    res.json(getDb().prepare('SELECT * FROM buses WHERE agency_id=? ORDER BY bus_name ASC').all(req.user.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/buses', auth, (req, res) => {
  try {
    const { bus_name, total_seats, description } = req.body;
    if (!bus_name) return res.status(400).json({ error: 'Nom du bus requis' });
    const id = uuidv4();
    getDb().prepare('INSERT INTO buses (id,agency_id,bus_name,total_seats,description) VALUES (?,?,?,?,?)')
      .run(id, req.user.id, bus_name, parseInt(total_seats)||50, description||null);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/buses/:id', auth, (req, res) => {
  try {
    const { bus_name, total_seats, description, is_active } = req.body;
    getDb().prepare('UPDATE buses SET bus_name=COALESCE(?,bus_name), total_seats=COALESCE(?,total_seats), description=COALESCE(?,description), is_active=COALESCE(?,is_active) WHERE id=? AND agency_id=?')
      .run(bus_name||null, total_seats?parseInt(total_seats):null, description||null, is_active!==undefined?(is_active?1:0):null, req.params.id, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/buses/:id', auth, (req, res) => {
  try {
    getDb().prepare('UPDATE buses SET is_active=0 WHERE id=? AND agency_id=?').run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TRIPS ──────────────────────────────────────────────────────
router.get('/trips', auth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    res.json(getDb().prepare(
      'SELECT * FROM trips WHERE agency_id=? AND departure_date >= ? ORDER BY departure_date ASC, departure_time ASC'
    ).all(req.user.id, today));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/trips', auth, (req, res) => {
  try {
    const { bus_id, departure_city, arrival_city, departure_date, departure_time, price, description } = req.body;
    if (!departure_city||!arrival_city||!departure_date||!departure_time||!price)
      return res.status(400).json({ error: 'Champs manquants' });
    const db = getDb();
    let busName = null, seats = 50;
    if (bus_id) {
      const bus = db.prepare('SELECT * FROM buses WHERE id=? AND agency_id=?').get(bus_id, req.user.id);
      if (bus) { busName = bus.bus_name; seats = bus.total_seats; }
    }
    const id = uuidv4();
    db.prepare('INSERT INTO trips (id,agency_id,bus_id,bus_name,departure_city,arrival_city,departure_date,departure_time,price,total_seats,available_seats,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, req.user.id, bus_id||null, busName, departure_city, arrival_city, departure_date, departure_time, parseFloat(price), seats, seats, description||null);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GÉNÉRATION EN MASSE ────────────────────────────────────────
router.post('/trips/bulk', auth, (req, res) => {
  try {
    const { bus_id, departure_city, arrival_city, departure_time, price, description, dates } = req.body;
    if (!departure_city || !arrival_city) return res.status(400).json({ error: 'Départ et arrivée requis' });
    if (departure_city === arrival_city)  return res.status(400).json({ error: 'Départ et arrivée doivent être différents' });
    if (!departure_time || !price)        return res.status(400).json({ error: 'Heure et prix requis' });
    if (!Array.isArray(dates) || dates.length === 0) return res.status(400).json({ error: 'Aucune date fournie' });
    if (dates.length > 90)                return res.status(400).json({ error: 'Maximum 90 dates à la fois' });
    const db = getDb();
    let busName = null, seats = 50;
    if (bus_id) {
      const bus = db.prepare('SELECT * FROM buses WHERE id=? AND agency_id=?').get(bus_id, req.user.id);
      if (bus) { busName = bus.bus_name; seats = bus.total_seats; }
    }
    let created = 0;
    const stmt = db.prepare(`INSERT INTO trips (id,agency_id,bus_id,bus_name,departure_city,arrival_city,departure_date,departure_time,price,total_seats,available_seats,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    runTransaction(db, () => {
      for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        stmt.run(uuidv4(), req.user.id, bus_id||null, busName, departure_city, arrival_city, date, departure_time, parseFloat(price), seats, seats, description||null);
        created++;
      }
    });
    res.status(201).json({ created });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/trips/:id', auth, (req, res) => {
  try {
    const { departure_city, arrival_city, departure_date, departure_time, price, available_seats, total_seats, description } = req.body;
    getDb().prepare(`UPDATE trips SET departure_city=COALESCE(?,departure_city), arrival_city=COALESCE(?,arrival_city), departure_date=COALESCE(?,departure_date), departure_time=COALESCE(?,departure_time), price=COALESCE(?,price), available_seats=COALESCE(?,available_seats), total_seats=COALESCE(?,total_seats), description=COALESCE(?,description) WHERE id=? AND agency_id=?`)
      .run(departure_city||null, arrival_city||null, departure_date||null, departure_time||null, price?parseFloat(price):null, available_seats!==undefined?parseInt(available_seats):null, total_seats!==undefined?parseInt(total_seats):null, description||null, req.params.id, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/trips/:id', auth, (req, res) => {
  try {
    const db = getDb();
    const trip = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(req.params.id, req.user.id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });
    if (trip.is_active) {
      const booked = db.prepare("SELECT COUNT(*) c FROM bookings WHERE trip_id=? AND status='confirmed'").get(req.params.id).c;
      if (booked > 0) return res.status(400).json({ error: `Impossible : ${booked} réservation(s) confirmée(s) sur ce voyage` });
    }
    db.prepare("UPDATE bookings SET status='cancelled', payment_status='refunded', commission_amount=0 WHERE trip_id=? AND status='pending'").run(req.params.id);
    db.prepare('DELETE FROM trips WHERE id=? AND agency_id=?').run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BOOKINGS ───────────────────────────────────────────────────
router.get('/bookings', auth, (req, res) => {
  try {
    res.json(getDb().prepare(`
      SELECT b.*, t.departure_city, t.arrival_city, t.departure_date, t.departure_time, t.bus_name, a.agency_name
      FROM bookings b JOIN trips t ON b.trip_id=t.id JOIN agencies a ON b.agency_id=a.id
      WHERE b.agency_id=? ORDER BY b.created_at DESC
    `).all(req.user.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/bookings/:id/confirm', auth, (req, res) => {
  try {
    const db = getDb();
    const b = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    const agency = db.prepare('SELECT commission_rate FROM agencies WHERE id=?').get(req.user.id);
    const rate = agency ? (agency.commission_rate || 10) : 10;
    const commission_amount = Math.round(b.total_price * rate / 100);
    db.prepare("UPDATE bookings SET status='confirmed', payment_status='completed', commission_rate=?, commission_amount=? WHERE id=? AND agency_id=?")
      .run(rate, commission_amount, req.params.id, req.user.id);
    res.json({ ok: true, commission_amount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/bookings/:id/cancel', auth, (req, res) => {
  try {
    const db = getDb();
    const b = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    runTransaction(db, () => {
      db.prepare("UPDATE bookings SET status='cancelled', payment_status='refunded', commission_amount=0 WHERE id=?").run(req.params.id);
      db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(b.passengers||1, b.trip_id);
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MANIFESTE — voyages du jour ────────────────────────────────
router.get('/manifest/trips', auth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const trips = getDb().prepare(`
      SELECT t.*, COUNT(b.id) as booked_count
      FROM trips t
      LEFT JOIN bookings b ON b.trip_id = t.id AND b.status = 'confirmed'
      WHERE t.agency_id = ? AND t.departure_date = ?
      GROUP BY t.id
      ORDER BY t.departure_time ASC
    `).all(req.user.id, today);
    res.json(trips);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/manifest/:trip_id', auth, (req, res) => {
  try {
    const db = getDb();
    const trip = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(req.params.trip_id, req.user.id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });
    const bookings = db.prepare(`
      SELECT b.*, COALESCE(b.boarding_status, 'pending') as boarding_status
      FROM bookings b
      WHERE b.trip_id=? AND b.agency_id=? AND b.status='confirmed'
      ORDER BY b.created_at ASC
    `).all(req.params.trip_id, req.user.id);
    res.json({ trip, bookings });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MANIFESTE — marquer présence ───────────────────────────────
router.patch('/bookings/:id/board', auth, (req, res) => {
  try {
    const { boarding_status } = req.body; // 'present' | 'absent' | 'pending'
    if (!['present','absent','pending'].includes(boarding_status))
      return res.status(400).json({ error: 'Statut invalide' });
    const db = getDb();
    const b = db.prepare('SELECT * FROM bookings WHERE id=? AND agency_id=?').get(req.params.id, req.user.id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    try {
      db.exec('ALTER TABLE bookings ADD COLUMN boarding_status TEXT DEFAULT NULL');
    } catch(e) {}
    db.prepare('UPDATE bookings SET boarding_status=? WHERE id=? AND agency_id=?')
      .run(boarding_status, req.params.id, req.user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── MANIFESTE — enregistrement sur place (walk-in) ─────────────
router.post('/bookings/walkin', auth, (req, res) => {
  try {
    const { trip_id, passenger_name, passenger_phone, passengers, payment_method } = req.body;
    if (!trip_id || !passenger_name || !passenger_phone)
      return res.status(400).json({ error: 'Nom, téléphone et voyage requis' });
    const seats = Math.max(1, parseInt(passengers)||1);
    const db = getDb();
    const trip = db.prepare('SELECT * FROM trips WHERE id=? AND agency_id=?').get(trip_id, req.user.id);
    if (!trip) return res.status(404).json({ error: 'Voyage introuvable' });
    if (trip.available_seats < seats) return res.status(400).json({ error: 'Places insuffisantes' });
    const agency = db.prepare('SELECT commission_rate FROM agencies WHERE id=?').get(req.user.id);
    const rate = agency ? (agency.commission_rate || 10) : 10;
    const total = trip.price * seats;
    const commission_amount = Math.round(total * rate / 100);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const ref = 'WLK-' + Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    const id = uuidv4();
    runTransaction(db, () => {
      db.prepare(`INSERT INTO bookings (id,reference,trip_id,agency_id,passenger_name,passenger_phone,passengers,total_price,commission_rate,commission_amount,status,payment_status,payment_method,boarding_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, ref, trip_id, req.user.id, passenger_name, passenger_phone, seats, total, rate, commission_amount, 'confirmed', 'completed', payment_method||'cash', 'present');
      db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(seats, trip_id);
    });
    res.status(201).json({ ok: true, reference: ref, total_price: total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;