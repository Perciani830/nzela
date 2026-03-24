const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// ── STATS GLOBALES ────────────────────────────────────────────
router.get('/stats', auth, (req, res) => {
  try {
    const db = getDb();
    const total_agencies  = db.prepare("SELECT COUNT(*) c FROM agencies WHERE is_active=1").get().c;
    const confirmed       = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='confirmed'").get().c;
    const pending         = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='pending'").get().c;
    const cancelled       = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='cancelled'").get().c;
    const revenue_raw     = db.prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE payment_status='completed' AND status!='cancelled'").get().s;
    const commission      = db.prepare("SELECT COALESCE(SUM(commission_amount),0) s FROM bookings WHERE status='confirmed'").get().s;
    res.json({ total_agencies, confirmed, pending, cancelled, revenue_raw, commission });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── STATS PAR AGENCE ─────────────────────────────────────────
router.get('/agencies-stats', auth, (req, res) => {
  try {
    const db = getDb();
    const agencies = db.prepare('SELECT * FROM agencies ORDER BY agency_name ASC').all();
    const result = agencies.map(ag => {
      const confirmed  = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='confirmed'").get(ag.id).c;
      const pending    = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='pending'").get(ag.id).c;
      const cancelled  = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='cancelled'").get(ag.id).c;
      const revenue    = db.prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE agency_id=? AND payment_status='completed' AND status!='cancelled'").get(ag.id).s;
      const commission = db.prepare("SELECT COALESCE(SUM(commission_amount),0) s FROM bookings WHERE agency_id=? AND status='confirmed'").get(ag.id).s;
      const buses      = db.prepare("SELECT COUNT(*) c FROM buses WHERE agency_id=? AND is_active=1").get(ag.id).c;
      return { ...ag, confirmed, pending, cancelled, revenue, commission, buses };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RÉSERVATIONS ──────────────────────────────────────────────
router.get('/bookings', auth, (req, res) => {
  try {
    res.json(getDb().prepare(`
      SELECT b.*, t.departure_city, t.arrival_city, t.departure_date, t.bus_name, a.agency_name
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN agencies a ON b.agency_id = a.id
      ORDER BY b.created_at DESC LIMIT 300
    `).all());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── AGENCES ───────────────────────────────────────────────────
router.get('/agencies', auth, (req, res) => {
  try {
    res.json(getDb().prepare('SELECT id, agency_name, username, email, phone, commission_rate, cancel_rate, is_active, created_at FROM agencies ORDER BY created_at DESC').all());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/agencies', auth, (req, res) => {
  try {
    const { agency_name, username, password, email, phone, commission_rate, cancel_rate } = req.body;
    if (!agency_name || !username || !password) return res.status(400).json({ error: 'Nom, identifiant et mot de passe requis' });
    const db = getDb();
    if (db.prepare('SELECT id FROM agencies WHERE username=?').get(username)) return res.status(409).json({ error: 'Identifiant déjà utilisé' });
    const id = uuidv4();
    db.prepare('INSERT INTO agencies (id,agency_name,username,password,email,phone,commission_rate,cancel_rate) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, agency_name, username, bcrypt.hashSync(password,10), email||null, phone||null, commission_rate||10, cancel_rate||20);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/agencies/:id', auth, (req, res) => {
  try {
    const { is_active, commission_rate, cancel_rate } = req.body;
    getDb().prepare('UPDATE agencies SET is_active=COALESCE(?,is_active), commission_rate=COALESCE(?,commission_rate), cancel_rate=COALESCE(?,cancel_rate) WHERE id=?')
      .run(is_active!==undefined?(is_active?1:0):null, commission_rate||null, cancel_rate||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GALERIE ───────────────────────────────────────────────────
router.get('/gallery', auth, (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM gallery ORDER BY sort_order ASC').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/gallery', auth, (req, res) => {
  try {
    const { title, description, image_url, category, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'URL requise' });
    const id = uuidv4();
    getDb().prepare('INSERT INTO gallery (id,title,description,image_url,category,sort_order) VALUES (?,?,?,?,?,?)')
      .run(id, title||null, description||null, image_url, category||'general', sort_order||0);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/gallery/:id', auth, (req, res) => {
  try {
    const { title, description, image_url, category, sort_order, is_active } = req.body;
    getDb().prepare('UPDATE gallery SET title=COALESCE(?,title), description=COALESCE(?,description), image_url=COALESCE(?,image_url), category=COALESCE(?,category), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(title||null, description||null, image_url||null, category||null, sort_order!==undefined?sort_order:null, is_active!==undefined?(is_active?1:0):null, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gallery/:id', auth, (req, res) => {
  try { getDb().prepare('DELETE FROM gallery WHERE id=?').run(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// ── REVERSEMENTS PAR PÉRIODE ──────────────────────────────────
// GET /api/admin/reversements?from=2026-03-17&to=2026-03-23
router.get('/reversements', auth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;

    // Dates par défaut : semaine en cours (lundi → dimanche)
    const now = new Date();
    const day = now.getDay(); // 0=dim, 1=lun...
    const diffLun = (day === 0 ? -6 : 1 - day);
    const lundi = new Date(now); lundi.setDate(now.getDate() + diffLun);
    const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);

    const dateFrom = from || lundi.toISOString().split('T')[0];
    const dateTo   = to   || dimanche.toISOString().split('T')[0];

    const agencies = db.prepare('SELECT * FROM agencies WHERE is_active=1 ORDER BY agency_name ASC').all();

    const result = agencies.map(ag => {
      // Réservations confirmées sur la période
      const bookings = db.prepare(`
        SELECT b.*, t.departure_city, t.arrival_city, t.departure_date
        FROM bookings b
        JOIN trips t ON b.trip_id = t.id
        WHERE b.agency_id = ?
          AND b.status = 'confirmed'
          AND b.payment_status = 'completed'
          AND DATE(b.created_at) >= ?
          AND DATE(b.created_at) <= ?
        ORDER BY b.created_at DESC
      `).all(ag.id, dateFrom, dateTo);

      const confirmed       = bookings.length;
      const revenue_brut    = bookings.reduce((s, b) => s + b.total_price, 0);
      const commission      = bookings.reduce((s, b) => s + (b.commission_amount || 0), 0);
      const a_reverser      = revenue_brut - commission;

      return {
        id: ag.id,
        agency_name: ag.agency_name,
        username: ag.username,
        logo_url: ag.logo_url,
        phone: ag.phone,
        commission_rate: ag.commission_rate || 10,
        confirmed,
        revenue_brut,
        commission,
        a_reverser,
        bookings,
      };
    });

    // Totaux globaux
    const total_brut       = result.reduce((s, a) => s + a.revenue_brut, 0);
    const total_commission = result.reduce((s, a) => s + a.commission, 0);
    const total_a_reverser = result.reduce((s, a) => s + a.a_reverser, 0);

    res.json({
      period: { from: dateFrom, to: dateTo },
      agencies: result,
      totaux: { total_brut, total_commission, total_a_reverser },
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});