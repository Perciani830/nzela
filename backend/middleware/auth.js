const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET = process.env.JWT_SECRET || 'secret';

const auth = (roles = []) => (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    if (roles.length && !roles.includes(decoded.role))
      return res.status(403).json({ error: 'Accès non autorisé' });
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};
// backend/middleware/auth.js
function requireAgency(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Non autorisé' });
  }
}

// backend/routes/agency.js — GET /agency/trips
router.get('/trips', requireAgency, (req, res) => {
  const { agency_id, city, role } = req.user;

  let query = `SELECT * FROM trips WHERE agency_id = ?`;
  const params = [agency_id];

  // Si le gestionnaire a une ville assignée → filtre côté serveur
  if (city && role !== 'owner') {
    query += ` AND departure_city = ?`;
    params.push(city);
  }

  query += ` ORDER BY departure_date DESC`;
  const trips = db.prepare(query).all(...params);
  res.json(trips);
});
module.exports = auth;
