const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, exportDatabase, importDatabase } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ',''), SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

router.get('/stats', auth, (req, res) => {
  try {
    const db = getDb();
    const total_agencies = db.prepare("SELECT COUNT(*) c FROM agencies WHERE is_active=1").get().c;
    const confirmed      = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='confirmed'").get().c;
    const pending        = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='pending'").get().c;
    const cancelled      = db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='cancelled'").get().c;
    const revenue_raw    = db.prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE payment_status='completed' AND status='confirmed'").get().s;
    const commission     = db.prepare("SELECT COALESCE(SUM(commission_amount),0) s FROM bookings WHERE status='confirmed'").get().s;
    res.json({ total_agencies, confirmed, pending, cancelled, revenue_raw, commission });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/agencies-stats', auth, (req, res) => {
  try {
    const db = getDb();
    const agencies = db.prepare('SELECT * FROM agencies ORDER BY agency_name ASC').all();
    const result = agencies.map(ag => {
      const confirmed  = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='confirmed'").get(ag.id).c;
      const pending    = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='pending'").get(ag.id).c;
      const cancelled  = db.prepare("SELECT COUNT(*) c FROM bookings WHERE agency_id=? AND status='cancelled'").get(ag.id).c;
      const revenue    = db.prepare("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE agency_id=? AND status='confirmed'").get(ag.id).s;
      const commission = db.prepare("SELECT COALESCE(SUM(commission_amount),0) s FROM bookings WHERE agency_id=? AND status='confirmed'").get(ag.id).s;
      const buses      = db.prepare("SELECT COUNT(*) c FROM buses WHERE agency_id=? AND is_active=1").get(ag.id).c;
      return { ...ag, confirmed, pending, cancelled, revenue, commission, buses };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/bookings', auth, (req, res) => {
  try {
    res.json(getDb().prepare(`
      SELECT b.*, t.departure_city, t.arrival_city, t.departure_date, t.bus_name, a.agency_name
      FROM bookings b JOIN trips t ON b.trip_id=t.id JOIN agencies a ON b.agency_id=a.id
      ORDER BY b.created_at DESC LIMIT 300
    `).all());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/reversements', auth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    const now = new Date(); const day = now.getDay();
    const diffLun = day===0?-6:1-day;
    const lundi = new Date(now); lundi.setDate(now.getDate()+diffLun);
    const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate()+6);
    const dateFrom = from || lundi.toISOString().split('T')[0];
    const dateTo   = to   || dimanche.toISOString().split('T')[0];
    const agencies = db.prepare('SELECT * FROM agencies WHERE is_active=1 ORDER BY agency_name ASC').all();
    const result = agencies.map(ag => {
      const bookings = db.prepare(`SELECT b.*, t.departure_city, t.arrival_city, t.departure_date FROM bookings b JOIN trips t ON b.trip_id=t.id WHERE b.agency_id=? AND b.status='confirmed' AND b.payment_status='completed' AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ? ORDER BY b.created_at DESC`).all(ag.id, dateFrom, dateTo);
      const confirmed=bookings.length, revenue_brut=bookings.reduce((s,b)=>s+b.total_price,0), commission=bookings.reduce((s,b)=>s+(b.commission_amount||0),0), a_reverser=revenue_brut-commission;
      return { ...ag, confirmed, revenue_brut, commission, a_reverser, bookings };
    });
    const total_brut=result.reduce((s,a)=>s+a.revenue_brut,0), total_commission=result.reduce((s,a)=>s+a.commission,0), total_a_reverser=result.reduce((s,a)=>s+a.a_reverser,0);
    res.json({ period:{from:dateFrom,to:dateTo}, agencies:result, totaux:{total_brut,total_commission,total_a_reverser} });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/export-month', auth, (req, res) => {
  try {
    const db = getDb();
    const { year, month } = req.query;
    const now = new Date();
    const y = parseInt(year) || now.getFullYear();
    const m = parseInt(month) || now.getMonth() + 1;
    const dateFrom = `${y}-${String(m).padStart(2,'0')}-01`;
    const dateTo   = new Date(y, m, 0).toISOString().split('T')[0];
    const bookings = db.prepare(`
      SELECT b.reference, b.passenger_name, b.passenger_phone, b.passenger_email,
             b.passengers, b.total_price, b.commission_rate, b.commission_amount,
             b.status, b.payment_method, b.payment_status, b.transaction_id, b.created_at,
             t.departure_city, t.arrival_city, t.departure_date, t.departure_time, t.bus_name,
             a.agency_name
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN agencies a ON b.agency_id = a.id
      WHERE DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
      ORDER BY a.agency_name ASC, b.created_at ASC
    `).all(dateFrom, dateTo);
    const agencies = db.prepare('SELECT * FROM agencies WHERE is_active=1 ORDER BY agency_name ASC').all();
    const summary = agencies.map(ag => {
      const agBookings = bookings.filter(b => b.agency_name === ag.agency_name);
      const confirmed  = agBookings.filter(b => b.status === 'confirmed').length;
      const cancelled  = agBookings.filter(b => b.status === 'cancelled').length;
      const revenue    = agBookings.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total_price,0);
      const commission = agBookings.filter(b=>b.status==='confirmed').reduce((s,b)=>s+(b.commission_amount||0),0);
      return { agency_name: ag.agency_name, confirmed, cancelled, revenue, commission, a_reverser: revenue - commission };
    });
    res.json({ period: { year: y, month: m, from: dateFrom, to: dateTo }, bookings, summary, total: { bookings: bookings.length, confirmed: bookings.filter(b=>b.status==='confirmed').length, revenue: bookings.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total_price,0), commission: bookings.filter(b=>b.status==='confirmed').reduce((s,b)=>s+(b.commission_amount||0),0) } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/reset-stats', auth, (req, res) => {
  try {
    const db = getDb();
    const { year, month, confirm_reset } = req.body;
    if (!confirm_reset) return res.status(400).json({ error: 'Confirmation requise' });
    const y = parseInt(year); const m = parseInt(month);
    if (!y || !m) return res.status(400).json({ error: 'Année et mois requis' });
    const dateFrom = `${y}-${String(m).padStart(2,'0')}-01`;
    const dateTo   = new Date(y, m, 0).toISOString().split('T')[0];
    const countBefore = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND status IN ('confirmed','cancelled')`).get(dateFrom, dateTo).c;
    db.exec('BEGIN');
    try {
      db.prepare(`DELETE FROM bookings WHERE DATE(created_at) >= ? AND DATE(created_at) <= ? AND status IN ('confirmed','cancelled','refunded')`).run(dateFrom, dateTo);
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    res.json({ ok: true, deleted: countBefore, period: `${y}-${String(m).padStart(2,'0')}`, message: `${countBefore} réservations archivées.` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── AGENCES — supporte le champ note (1-5) ────────────────────
router.get('/agencies', auth, (req, res) => {
  try { res.json(getDb().prepare('SELECT id,agency_name,username,email,phone,logo_url,commission_rate,cancel_rate,is_active,premium,premium_order,premium_photo_url,premium_caption,note,created_at FROM agencies ORDER BY created_at DESC').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/agencies', auth, (req, res) => {
  try {
    const { agency_name, username, password, email, phone, logo_url, commission_rate, cancel_rate, note } = req.body;
    if (!agency_name||!username||!password) return res.status(400).json({ error: 'Nom, identifiant et mot de passe requis' });
    const db = getDb();
    if (db.prepare('SELECT id FROM agencies WHERE username=?').get(username)) return res.status(409).json({ error: 'Identifiant déjà utilisé' });
    const id = uuidv4();
    db.prepare('INSERT INTO agencies (id,agency_name,username,password,email,phone,logo_url,commission_rate,cancel_rate,note) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id,agency_name,username,bcrypt.hashSync(password,10),email||null,phone||null,logo_url||null,commission_rate||10,cancel_rate||20,note||3);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/agencies/:id', auth, (req, res) => {
  try {
    const { is_active, commission_rate, cancel_rate, logo_url, agency_name, email, phone, premium, premium_order, premium_photo_url, premium_caption, note } = req.body;
    getDb().prepare(`UPDATE agencies SET
      is_active=COALESCE(?,is_active),
      commission_rate=COALESCE(?,commission_rate),
      cancel_rate=COALESCE(?,cancel_rate),
      logo_url=COALESCE(?,logo_url),
      agency_name=COALESCE(?,agency_name),
      email=COALESCE(?,email),
      phone=COALESCE(?,phone),
      premium=COALESCE(?,premium),
      premium_order=COALESCE(?,premium_order),
      premium_photo_url=COALESCE(?,premium_photo_url),
      premium_caption=COALESCE(?,premium_caption),
      note=COALESCE(?,note)
      WHERE id=?`)
    .run(
      is_active!==undefined?(is_active?1:0):null,
      commission_rate||null, cancel_rate||null, logo_url||null,
      agency_name||null, email||null, phone||null,
      premium!==undefined?(premium?1:0):null,
      premium_order!==undefined?premium_order:null,
      premium_photo_url||null, premium_caption||null,
      note!==undefined?parseInt(note):null,
      req.params.id
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GALERIE — accepte base64 ou URL ──────────────────────────
router.get('/gallery', auth, (req, res) => {
  try { res.json(getDb().prepare('SELECT id,title,description,category,sort_order,is_active,created_at,CASE WHEN LENGTH(image_url)>200 THEN substr(image_url,1,100)||\'...[base64]\' ELSE image_url END as image_preview, image_url FROM gallery ORDER BY sort_order ASC').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/gallery', auth, (req, res) => {
  try {
    const { title, description, image_url, category, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image requise' });
    const id = uuidv4();
    getDb().prepare('INSERT INTO gallery (id,title,description,image_url,category,sort_order) VALUES (?,?,?,?,?,?)')
      .run(id,title||null,description||null,image_url,category||'general',sort_order||0);
    res.status(201).json({ id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/gallery/:id', auth, (req, res) => {
  try {
    const { title, description, image_url, category, sort_order, is_active } = req.body;
    getDb().prepare('UPDATE gallery SET title=COALESCE(?,title), description=COALESCE(?,description), image_url=COALESCE(?,image_url), category=COALESCE(?,category), sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?')
      .run(title||null,description||null,image_url||null,category||null,sort_order!==undefined?sort_order:null,is_active!==undefined?(is_active?1:0):null,req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gallery/:id', auth, (req, res) => {
  try { getDb().prepare('DELETE FROM gallery WHERE id=?').run(req.params.id); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/backup', auth, (req, res) => {
  try {
    const data = exportDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nzela-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/restore', auth, (req, res) => {
  try {
    const data = req.body;
    if (!data._version || !data.agencies) return res.status(400).json({ error: 'Fichier de backup invalide' });
    importDatabase(data);
    res.json({ ok: true, message: 'Base de données restaurée' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/premium-agencies', (req, res) => {
  try {
    res.json(getDb().prepare('SELECT id,agency_name,logo_url,premium_photo_url,premium_caption,premium_order,phone FROM agencies WHERE is_active=1 AND premium=1 ORDER BY premium_order ASC').all());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;