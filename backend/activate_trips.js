const { getDb } = require('./db/database');
const db = getDb();

// Active tous les trips pour le test local avec une date future
const r = db.prepare("UPDATE trips SET is_active = 1, departure_date = '2026-12-31'").run();
console.log('Trips activés:', r.changes);

const trips = db.prepare('SELECT id, is_active, departure_date, departure_city, arrival_city FROM trips LIMIT 5').all();
console.log(JSON.stringify(trips, null, 2));