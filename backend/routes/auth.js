const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'busconnect-secret';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('LOGIN ATTEMPT:', { username, password, bodyKeys: Object.keys(req.body) });
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });
  const db = getDb();

  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  console.log('ADMIN FOUND:', admin ? 'oui' : 'non');
  if (admin) {
    const ok = bcrypt.compareSync(password, admin.password);
    console.log('BCRYPT RESULT:', ok);
    if (ok) {
      const token = jwt.sign({ id: admin.id, role: 'admin', username: admin.username }, SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { id: admin.id, username: admin.username, role: 'admin' } });
    }
  }

  const agency = db.prepare('SELECT * FROM agencies WHERE username=? AND is_active=1').get(username);
  if (agency && bcrypt.compareSync(password, agency.password)) {
    const token = jwt.sign({ id: agency.id, role: 'agency', username: agency.username, agency_name: agency.agency_name }, SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: agency.id, username: agency.username, agency_name: agency.agency_name, role: 'agency' } });
  }

  res.status(401).json({ error: 'Identifiants incorrects' });
});

router.get('/debug-admin', (req, res) => {
  const bcrypt = require('bcryptjs');
  const db = getDb();
  const admin = db.prepare('SELECT id, username, password FROM admins WHERE username=?').get('superadmin');
  if (!admin) return res.json({ found: false });
  const testHash = bcrypt.hashSync('Admin@2024!', 10);
  const compareOk = bcrypt.compareSync('Admin@2024!', admin.password);
  res.json({
    found: true,
    username: admin.username,
    hash_stored: admin.password,
    compare_result: compareOk
  });
});

module.exports = router;
