const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

// ── Middlewares auth ────────────────────────────────────────────────────────
function authAgency(req, res, next) {
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

function authAdmin(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(h.replace('Bearer ', ''), SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// ── Helper : s'assurer que la table withdrawals existe ─────────────────────
function ensureTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id           TEXT PRIMARY KEY,
      agency_id    TEXT NOT NULL,
      amount       REAL NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      note         TEXT,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    )
  `).run();
}

// ── Helper : solde disponible = revenus nets confirmés - retraits déjà faits ─
// IMPORTANT : uniquement les réservations "online" (encaissées par Nzela via
// MaishaPay). Les réservations "onsite" sont payées cash directement à
// l'agence — cet argent ne transite jamais par Nzela et ne doit donc jamais
// être retirable ici (sinon double encaissement pour l'agence).
function computeBalance(db, agency_id) {
  const revenue = db.prepare(`
    SELECT COALESCE(SUM(total_price - commission_amount), 0) s
    FROM bookings WHERE agency_id=? AND status='confirmed' AND channel != 'onsite'
  `).get(agency_id).s;

  const withdrawn = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) s
    FROM withdrawals WHERE agency_id=? AND status IN ('pending','paid')
  `).get(agency_id).s;

  return Math.max(0, Math.round((revenue - withdrawn) * 100) / 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// CÔTÉ AGENCE
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/agency/withdrawals/balance ─────────────────────────────────────
router.get('/agency/withdrawals/balance', authAgency, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    res.json({ balance: computeBalance(db, req.user.agency_id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/agency/withdrawals ──────────────────────────────────────────────
// Historique des retraits de l'agence connectée
router.get('/agency/withdrawals', authAgency, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const rows = db.prepare('SELECT * FROM withdrawals WHERE agency_id=? ORDER BY requested_at DESC').all(req.user.agency_id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/agency/withdrawals ─────────────────────────────────────────────
// L'agence lance directement un retrait — aucune validation préalable requise
// pour le créer. Il apparaît immédiatement côté admin pour exécution du virement.
router.post('/agency/withdrawals', authAgency, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);

    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const balance = computeBalance(db, req.user.agency_id);
    if (amount > balance)
      return res.status(400).json({ error: `Solde insuffisant (disponible : ${balance.toLocaleString('fr-FR')} FC)` });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO withdrawals (id, agency_id, amount, status)
      VALUES (?, ?, ?, 'pending')
    `).run(id, req.user.agency_id, amount);

    res.status(201).json({ id, amount, status: 'pending', balance: balance - amount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CÔTÉ ADMIN
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/withdrawals ───────────────────────────────────────────────
router.get('/admin/withdrawals', authAdmin, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const rows = db.prepare(`
      SELECT w.*, a.agency_name, a.phone agency_phone
      FROM withdrawals w JOIN agencies a ON w.agency_id = a.id
      ORDER BY w.requested_at DESC
    `).all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/admin/withdrawals/:id/pay ─────────────────────────────────────
// Marque le retrait comme effectivement payé (virement/mobile money exécuté manuellement par l'admin)
router.patch('/admin/withdrawals/:id/pay', authAdmin, (req, res) => {
  try {
    const db = getDb();
    ensureTable(db);
    const w = db.prepare('SELECT * FROM withdrawals WHERE id=?').get(req.params.id);
    if (!w) return res.status(404).json({ error: 'Retrait introuvable' });
    if (w.status === 'paid') return res.status(400).json({ error: 'Déjà payé' });

    db.prepare("UPDATE withdrawals SET status='paid', processed_at=datetime('now') WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;