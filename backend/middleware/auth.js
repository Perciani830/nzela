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

module.exports = auth;
