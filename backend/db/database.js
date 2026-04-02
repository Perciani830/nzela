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
  const tables = ['admins','agencies','buses','trips','bookings','gallery','settings'];
  for (const t of tables) {
    try { data[t] = db.prepare(`SELECT * FROM ${t}`).all(); }
    catch(e) { data[t] = []; }
  }
  data._exported_at = new Date().toISOString();
  data._version = '2.0';
  return data;
}

function importDatabase(data) {
  const db = getDb();
  runTransaction(db, () => {
    const order = ['admins','settings','agencies','buses','trips','bookings','gallery'];
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
      is_active INTEGER DEFAULT 1,
      premium INTEGER DEFAULT 0, premium_order INTEGER DEFAULT 999,
      premium_photo_url TEXT, premium_caption TEXT,
      note INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS buses (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_name TEXT NOT NULL,
      total_seats INTEGER DEFAULT 50, description TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
    );
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY, agency_id TEXT NOT NULL, bus_id TEXT, bus_name TEXT,
      departure_city TEXT NOT NULL, arrival_city TEXT NOT NULL,
      departure_date TEXT NOT NULL, departure_time TEXT NOT NULL,
      price REAL NOT NULL, total_seats INTEGER DEFAULT 50, available_seats INTEGER DEFAULT 50,
      description TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
      trip_id TEXT NOT NULL, agency_id TEXT NOT NULL,
      passenger_name TEXT NOT NULL, passenger_phone TEXT NOT NULL,
      passenger_email TEXT, passengers INTEGER DEFAULT 1,
      total_price REAL NOT NULL, commission_rate REAL DEFAULT 10,
      commission_amount REAL DEFAULT 0, status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending', payment_method TEXT,
      transaction_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id),
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
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
  `);

  [
    "ALTER TABLE bookings ADD COLUMN commission_rate REAL DEFAULT 10",
    "ALTER TABLE bookings ADD COLUMN commission_amount REAL DEFAULT 0",
    "ALTER TABLE agencies ADD COLUMN cancel_rate REAL DEFAULT 20",
    "ALTER TABLE agencies ADD COLUMN logo_url TEXT",
    "ALTER TABLE agencies ADD COLUMN premium INTEGER DEFAULT 0",
    "ALTER TABLE agencies ADD COLUMN premium_order INTEGER DEFAULT 999",
    "ALTER TABLE agencies ADD COLUMN premium_photo_url TEXT",
    "ALTER TABLE agencies ADD COLUMN premium_caption TEXT",
    "ALTER TABLE agencies ADD COLUMN note INTEGER DEFAULT 3",
  ].forEach(sql => { try { db.exec(sql); } catch(e) {} });

  if (!db.prepare('SELECT id FROM admins WHERE username=?').get('superadmin')) {
    db.prepare('INSERT INTO admins (id,username,password) VALUES (?,?,?)')
      .run(uuidv4(), 'superadmin', bcrypt.hashSync('Admin@2024!', 10));
    console.log('✅ Super Admin créé : superadmin / Admin@2024!');
  }

  if (!db.prepare("SELECT key FROM settings WHERE key='commission_rate'").get())
    db.prepare("INSERT INTO settings (key,value) VALUES ('commission_rate','10')").run();

  console.log('✅ Base de données Nzela prête');
}

module.exports = { getDb, initDatabase, runTransaction, exportDatabase, importDatabase };