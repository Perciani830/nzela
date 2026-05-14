const { getDb } = require('./db/database');

console.log('Connexion DB...');
const db = getDb();
console.log('OK');

// Schema actuel
try {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='seats'").get();
  console.log('Schema actuel:', row ? row.sql : 'TABLE INEXISTANTE');
} catch(e) {
  console.error('Erreur lecture schema:', e.message);
}

// Recréation sans FK
try {
  db.prepare('PRAGMA foreign_keys = OFF').run();
  db.prepare('DROP TABLE IF EXISTS seats').run();
  db.prepare(`CREATE TABLE seats (
    id           TEXT PRIMARY KEY,
    trip_id      TEXT NOT NULL,
    seat_number  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'available',
    booking_id   TEXT,
    expires_at   TEXT,
    UNIQUE(trip_id, seat_number)
  )`).run();
  db.prepare('PRAGMA foreign_keys = ON').run();

  const after = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='seats'").get();
  console.log('Nouveau schema:', after ? after.sql : 'NON CRÉÉE');
  console.log('✅ Done');
} catch(e) {
  console.error('Erreur fix:', e.message);
  console.error(e.stack);
}