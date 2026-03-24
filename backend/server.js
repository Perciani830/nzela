require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase, getDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();

app.use('/api/auth',   require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/agency', require('./routes/agency'));
app.use('/api/admin',  require('./routes/admin'));

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Route inconnue', path: req.path }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

// ── AUTO-DÉSACTIVATION VOYAGES PASSÉS ──────────────────────────
function desactiverVoyagesPassés() {
  try {
    const db = getDb();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const time  = now.toTimeString().slice(0, 5);
    const r = db.prepare(`
      UPDATE trips SET is_active = 0
      WHERE is_active = 1 AND (
        departure_date < ? OR
        (departure_date = ? AND departure_time <= ?)
      )
    `).run(today, today, time);
    if (r.changes > 0) console.log(`🕐 ${r.changes} voyage(s) désactivé(s) automatiquement`);
  } catch(e) { console.error('Auto-désactivation:', e.message); }
}

desactiverVoyagesPassés();
setInterval(desactiverVoyagesPassés, 5 * 60 * 1000); // toutes les 5 min

app.listen(PORT, () => {
  console.log(`\n🚌 Nzela API → http://localhost:${PORT}`);
  console.log('Routes: /api/auth | /api/public | /api/agency | /api/admin\n');
});
