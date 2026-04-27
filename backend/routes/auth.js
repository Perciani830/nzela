const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('LOGIN ATTEMPT:', { username, bodyKeys: Object.keys(req.body) });
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });
  const db = getDb();

  // ── 1. Super admin ────────────────────────────────────────────
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (admin && bcrypt.compareSync(password, admin.password)) {
    const token = jwt.sign(
      { id: admin.id, role: 'admin', username: admin.username },
      SECRET, { expiresIn: '24h' }
    );
    return res.json({ token, user: { id: admin.id, username: admin.username, role: 'admin' } });
  }

  // ── 2. Compte principal d'agence (propriétaire) ───────────────
  // Ce compte voit toutes les villes (city = null dans le JWT)
  const agency = db.prepare('SELECT * FROM agencies WHERE username=? AND is_active=1').get(username);
  if (agency && bcrypt.compareSync(password, agency.password)) {
    const token = jwt.sign({
      id:          agency.id,
      agency_id:   agency.id,       // ← toujours agency_id pour la cohérence
      role:        'agency',
      city:        null,             // null = voit toutes les villes
      is_owner:    true,
      username:    agency.username,
      agency_name: agency.agency_name,
    }, SECRET, { expiresIn: '24h' });
    return res.json({
      token,
      user: {
        id:          agency.id,
        agency_id:   agency.id,
        username:    agency.username,
        agency_name: agency.agency_name,
        role:        'agency',
        city:        null,
        is_owner:    true,
      }
    });
  }

  // ── 3. Sous-compte gestionnaire (agency_users) ────────────────
  // Ce compte est lié à une agence et filtré par ville (city peut être null = propriétaire de ville)
  const agUser = db.prepare(`
    SELECT au.*, a.agency_name, a.commission_rate, a.is_active AS agency_active
    FROM agency_users au
    JOIN agencies a ON a.id = au.agency_id
    WHERE au.username = ? AND au.is_active = 1
  `).get(username);

  if (agUser) {
    if (!agUser.agency_active) {
      return res.status(403).json({ error: 'Agence désactivée — contactez l\'administrateur' });
    }
    if (!bcrypt.compareSync(password, agUser.password)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    // city = null → le gestionnaire voit toutes les villes de l'agence (rôle owner)
    // city = TEXT → le gestionnaire ne voit que les départs de cette ville
    const token = jwt.sign({
      id:          agUser.id,
      agency_id:   agUser.agency_id,  // ← UUID de l'agence parente
      role:        'agency',
      city:        agUser.city || null,
      is_owner:    agUser.role === 'owner',
      username:    agUser.username,
      agency_name: agUser.agency_name,
      sub_account: true,              // pour distinguer si nécessaire
    }, SECRET, { expiresIn: '24h' });
    return res.json({
      token,
      user: {
        id:          agUser.id,
        agency_id:   agUser.agency_id,
        username:    agUser.username,
        full_name:   agUser.full_name,
        agency_name: agUser.agency_name,
        role:        'agency',
        city:        agUser.city || null,
        is_owner:    agUser.role === 'owner',
        sub_account: true,
      }
    });
  }

  res.status(401).json({ error: 'Identifiants incorrects' });
});

// ── Debug admin (garder pendant les tests) ────────────────────
router.get('/debug-admin', (req, res) => {
  const db = getDb();
  const admin = db.prepare('SELECT id, username, password FROM admins WHERE username=?').get('superadmin');
  if (!admin) return res.json({ found: false });
  const compareOk = bcrypt.compareSync('Admin@2024!', admin.password);
  res.json({ found: true, username: admin.username, compare_result: compareOk });
});

module.exports = router;