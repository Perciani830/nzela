require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, getDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS — accepte le domaine Vercel + domaine custom ──────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://nzela.cd',
  'https://www.nzela.cd',
  // Vercel génère une URL dynamique — on l'accepte toutes
  /\.vercel\.app$/,
  /\.nzela\.cd$/,
];

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.options('*', cors());

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

initDatabase();

// ── ROUTES API ─────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/agency', require('./routes/agency'));
app.use('/api/admin',  require('./routes/admin'));

app.get('/api/health', (_, res) => res.json({
  ok: true,
  ts: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
  maishapay: process.env.MAISHAPAY_MODE || 'sandbox',
}));

// ── SERVIR LE FRONTEND BUILDÉ (optionnel si même serveur) ──────
// Si tu veux tout sur Railway sans Vercel :
// const DIST = path.join(__dirname, '../frontend/dist');
// app.use(express.static(DIST));
// app.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'Route inconnue', path: req.path }));
app.use((err, req, res, next) => {
  console.error('Erreur:', err.message);
  res.status(500).json({ error: 'Erreur serveur' });
});

// ── AUTO-DÉSACTIVATION VOYAGES PASSÉS ─────────────────────────
function desactiverVoyagesPassés() {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const time  = new Date().toTimeString().slice(0, 5);

    // 1. Trouve les voyages expirés encore actifs
    const expirés = db.prepare(`
      SELECT id FROM trips
      WHERE is_active = 1 AND (
        departure_date < ? OR
        (departure_date = ? AND departure_time <= ?)
      )
    `).all(today, today, time);

    if (expirés.length === 0) return;

    for (const trip of expirés) {
      // 2. Auto-annule les réservations pending sur ces voyages
      db.prepare(`
        UPDATE bookings SET status='cancelled', payment_status='refunded', commission_amount=0
        WHERE trip_id=? AND status='pending'
      `).run(trip.id);

      // 3. Désactive le voyage
      db.prepare(`UPDATE trips SET is_active=0 WHERE id=?`).run(trip.id);
    }

    console.log(`🕐 ${expirés.length} voyage(s) désactivé(s) — réservations pending annulées`);
  } catch(e) { console.error('Auto-désactivation:', e.message); }
}

desactiverVoyagesPassés();
setInterval(desactiverVoyagesPassés, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`\n🚌 Nzela API → http://localhost:${PORT}`);
  console.log(`🌍 Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 MaishaPay     : ${process.env.MAISHAPAY_MODE || 'sandbox'}\n`);
});
