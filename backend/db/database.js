const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;
function getDb() {
  if (!db) {
    db = new DatabaseSync(path.join(DATA_DIR, 'busconnect.db'));
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function runTransaction(db, fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

function exportDatabase() {
  const db = getDb();
  const data = {};
  const tables = ['admins','agencies','agency_users','buses','trips','bookings','gallery','settings','contributions'];
  for (const t of tables) {
    try { data[t] = db.prepare(`SELECT * FROM ${t}`).all(); }
    catch(e) { data[t] = []; }
  }
  data._exported_at = new Date().toISOString();
  data._version = '2.1';
  return data;
}

function importDatabase(data) {
  const db = getDb();
  runTransaction(db, () => {
    const order = ['admins','settings','agencies','agency_users','buses','trips','bookings','gallery','contributions'];
    for (const table of order) {
      if (!data[table] || !data[table].length) continue;
      db.exec(`DELETE FROM ${table}`);
      const rows = data[table];
      const cols = Object.keys(rows[0]).join(',');
      const placeholders = Object.keys(rows[0]).map(() => '?').join(',');
      const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`);
      for (const row of rows) stmt.run(...Object.values(row));
    }
  });
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY, agency_name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, logo_url TEXT,
      commission_rate REAL DEFAULT 10, cancel_rate REAL DEFAULT 20,
      home_city TEXT,
      is_active INTEGER DEFAULT 1,
      premium INTEGER DEFAULT 0, premium_order INTEGER DEFAULT 999,
      premium_photo_url TEXT, premium_caption TEXT,
      note INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sous-comptes gestionnaires par ville
    -- city = NULL  → propriétaire : voit toutes les villes
    -- city = TEXT  → gestionnaire : ne voit que les départs de sa ville
    CREATE TABLE IF NOT EXISTS agency_users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id   TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
      username    TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      full_name   TEXT,
      city        TEXT,
      role        TEXT NOT NULL DEFAULT 'manager',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

  CREATE TABLE IF NOT EXISTS buses (
  id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_name TEXT NOT NULL,
  total_seats INTEGER DEFAULT 50, description TEXT, is_active INTEGER DEFAULT 1,
  layout TEXT DEFAULT '2+3',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_id TEXT, bus_name TEXT,
      departure_city TEXT NOT NULL, arrival_city TEXT NOT NULL,
      departure_date TEXT NOT NULL, departure_time TEXT NOT NULL,
      price REAL NOT NULL, total_seats INTEGER DEFAULT 50, available_seats INTEGER DEFAULT 50,
      description TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
      trip_id TEXT NOT NULL, agency_id TEXT NOT NULL,
      passenger_name TEXT NOT NULL, passenger_phone TEXT NOT NULL,
      passenger_email TEXT, passengers INTEGER DEFAULT 1,
      total_price REAL NOT NULL, commission_rate REAL DEFAULT 10,
      commission_amount REAL DEFAULT 0, status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending', payment_method TEXT,
      transaction_id TEXT, boarding_status TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY, title TEXT, description TEXT,
      image_url TEXT NOT NULL, category TEXT DEFAULT 'general',
      sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      contributor_name TEXT DEFAULT 'Anonyme',
      phone TEXT, operator TEXT, amount REAL NOT NULL,
      currency TEXT DEFAULT 'CDF', transaction_id TEXT, message TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS seats (
  id           TEXT PRIMARY KEY,
  trip_id      TEXT NOT NULL,
  seat_number  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'available',
  booking_id   TEXT,
  expires_at   TEXT,
  UNIQUE(trip_id, seat_number)
);
  `);

  // Migrations pour les bases existantes (ignorées si la colonne existe déjà)
  [
    "ALTER TABLE bookings ADD COLUMN commission_rate REAL DEFAULT 10",
    "ALTER TABLE bookings ADD COLUMN commission_amount REAL DEFAULT 0",
    "ALTER TABLE bookings ADD COLUMN boarding_status TEXT DEFAULT NULL",
    "ALTER TABLE agencies ADD COLUMN cancel_rate REAL DEFAULT 20",
    "ALTER TABLE agencies ADD COLUMN logo_url TEXT",
    "ALTER TABLE agencies ADD COLUMN home_city TEXT",
    "ALTER TABLE agencies ADD COLUMN premium INTEGER DEFAULT 0",
    "ALTER TABLE agencies ADD COLUMN premium_order INTEGER DEFAULT 999",
    "ALTER TABLE agencies ADD COLUMN premium_photo_url TEXT",
    "ALTER TABLE agencies ADD COLUMN premium_caption TEXT",
    "ALTER TABLE agencies ADD COLUMN note INTEGER DEFAULT 3",
  ].forEach(sql => { try { db.exec(sql); } catch(e) {} });

  // ── Migration : ajouter ON DELETE CASCADE sur les tables existantes ──────────
  // SQLite ne supporte pas ALTER TABLE … DROP/ADD CONSTRAINT, donc on recrée
  // les tables si elles n'ont pas encore CASCADE dans leur définition.
  const needsCascade = (table) => {
    const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    return row && !row.sql.toUpperCase().includes('ON DELETE CASCADE');
  };

  if (needsCascade('buses') || needsCascade('trips') || needsCascade('bookings')) {
    runTransaction(db, () => {
      // bookings dépend de trips → supprimer bookings en premier
      db.exec(`
        -- Recréer bookings avec CASCADE
        CREATE TABLE IF NOT EXISTS bookings_new (
          id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
          trip_id TEXT NOT NULL, agency_id TEXT NOT NULL,
          passenger_name TEXT NOT NULL, passenger_phone TEXT NOT NULL,
          passenger_email TEXT, passengers INTEGER DEFAULT 1,
          total_price REAL NOT NULL, commission_rate REAL DEFAULT 10,
          commission_amount REAL DEFAULT 0, status TEXT DEFAULT 'pending',
          payment_status TEXT DEFAULT 'pending', payment_method TEXT,
          transaction_id TEXT, boarding_status TEXT DEFAULT NULL,
          seat_numbers TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
        );
        INSERT INTO bookings_new SELECT * FROM bookings;
        DROP TABLE bookings;
        ALTER TABLE bookings_new RENAME TO bookings;

        -- Recréer trips avec CASCADE
        CREATE TABLE IF NOT EXISTS trips_new (
          id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_id TEXT, bus_name TEXT,
          departure_city TEXT NOT NULL, arrival_city TEXT NOT NULL,
          departure_date TEXT NOT NULL, departure_time TEXT NOT NULL,
          price REAL NOT NULL, total_seats INTEGER DEFAULT 50, available_seats INTEGER DEFAULT 50,
          description TEXT, is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
        );
        INSERT INTO trips_new SELECT * FROM trips;
        DROP TABLE trips;
        ALTER TABLE trips_new RENAME TO trips;

        -- Recréer buses avec CASCADE
        CREATE TABLE IF NOT EXISTS buses_new (
          id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_name TEXT NOT NULL,
          total_seats INTEGER DEFAULT 50, description TEXT, is_active INTEGER DEFAULT 1,
          layout TEXT DEFAULT '2+3',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
        );
        INSERT INTO buses_new SELECT * FROM buses;
        DROP TABLE buses;
        ALTER TABLE buses_new RENAME TO buses;
      `);
    });
    console.log('✅ Migration CASCADE appliquée sur buses / trips / bookings');
  }

  // Super admin par défaut
  if (!db.prepare('SELECT id FROM admins WHERE username=?').get('superadmin')) {
    db.prepare('INSERT INTO admins (id,username,password) VALUES (?,?,?)')
      .run(uuidv4(), 'superadmin', bcrypt.hashSync('Admin@2024!', 10));
    console.log('✅ Super Admin créé : superadmin / Admin@2024!');
  }

  if (!db.prepare("SELECT key FROM settings WHERE key='commission_rate'").get())
    db.prepare("INSERT INTO settings (key,value) VALUES ('commission_rate','10')").run();

  console.log('✅ Base de données Nzela prête');
}

/**
 * Supprime une agence et toutes ses données liées.
 * Grâce au CASCADE sur les FK, un simple DELETE suffit —
 * mais on garde l'ordre explicite pour les DBs sans CASCADE.
 */
function deleteAgency(agencyId) {
  const db = getDb();
  runTransaction(db, () => {
    // Récupérer les IDs des voyages avant suppression
    const tripIds = db.prepare('SELECT id FROM trips WHERE agency_id = ?')
      .all(agencyId).map(r => r.id);

    // 1. Réservations liées aux voyages (si CASCADE non encore actif)
    if (tripIds.length) {
      const placeholders = tripIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM bookings WHERE trip_id IN (${placeholders})`).run(...tripIds);
    }
    // 2. Réservations liées directement à l'agence
    db.prepare('DELETE FROM bookings WHERE agency_id = ?').run(agencyId);
    // 3. Voyages
    db.prepare('DELETE FROM trips WHERE agency_id = ?').run(agencyId);
    // 4. Bus
    db.prepare('DELETE FROM buses WHERE agency_id = ?').run(agencyId);
    // 5. Sous-comptes gestionnaires
    db.prepare('DELETE FROM agency_users WHERE agency_id = ?').run(agencyId);
    // 6. Agence elle-même
    db.prepare('DELETE FROM agencies WHERE id = ?').run(agencyId);
  });
}

/**
 * Libère les sièges "pending" dont l'expiration est dépassée.
 */
function releaseExpiredSeats(db) {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  db.prepare(`
    UPDATE seats
    SET status = 'available', booking_id = NULL, expires_at = NULL
    WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?
  `).run(now);
}

/**
 * Initialise les lignes de sièges pour un voyage si elles n'existent pas encore.
 * Le numérotage est simplement 1, 2, 3 … total_seats.
 */
function ensureSeatsExist(db, tripId) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM seats WHERE trip_id = ?').get(tripId);
  if (existing.n > 0) return;

  const trip = db.prepare('SELECT total_seats FROM trips WHERE id = ?').get(tripId);
  if (!trip) return;

  const bus = db.prepare('SELECT layout FROM buses WHERE id = (SELECT bus_id FROM trips WHERE id = ?)').get(tripId);
  const layout = bus?.layout || '2+3';

  const configs = {
    '2+2': { left: ['A','B'], right: ['C','D'] },
    '2+3': { left: ['A','B'], right: ['C','D','E'] },
    '2':   { left: ['A'],     right: ['B'] },
  };
  const cfg = configs[layout] || configs['2+3'];
  const seatsPerRow = cfg.left.length + cfg.right.length;
  const lastRowLetters = ['A','B','C','D','E'];

  const regularSeats = trip.total_seats - 5;
  const regularRows  = Math.ceil(regularSeats / seatsPerRow);

  const seatIds = [];
  for (let r = 1; r <= regularRows; r++) {
    for (const col of [...cfg.left, ...cfg.right]) {
      seatIds.push(`${r}${col}`);
    }
  }
  // Dernière rangée banquette
  const lastRow = regularRows + 1;
  for (const col of lastRowLetters) {
    seatIds.push(`${lastRow}${col}`);
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO seats (id, trip_id, seat_number, status)
    VALUES (?, ?, ?, 'available')
  `);
  runTransaction(db, () => {
    for (const seatId of seatIds) {
      stmt.run(uuidv4(), tripId, seatId);
    }
  });
}
module.exports = { getDb, initDatabase, runTransaction, exportDatabase, importDatabase, deleteAgency, ensureSeatsExist, releaseExpiredSeats, };