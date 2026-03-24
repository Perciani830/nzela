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

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      agency_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      commission_rate REAL DEFAULT 10,
      cancel_rate REAL DEFAULT 20,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS buses (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL,
      bus_name TEXT NOT NULL,
      total_seats INTEGER DEFAULT 50,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      agency_id TEXT NOT NULL,
      bus_id TEXT,
      bus_name TEXT,
      departure_city TEXT NOT NULL,
      arrival_city TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      price REAL NOT NULL,
      total_seats INTEGER DEFAULT 50,
      available_seats INTEGER DEFAULT 50,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      trip_id TEXT NOT NULL,
      agency_id TEXT NOT NULL,
      passenger_name TEXT NOT NULL,
      passenger_phone TEXT NOT NULL,
      passenger_email TEXT,
      passengers INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      commission_rate REAL DEFAULT 10,
      commission_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT,
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips(id),
      FOREIGN KEY (agency_id) REFERENCES agencies(id)
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      image_url TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── MIGRATIONS ── ajout colonnes si absentes
  const migrations = [
    "ALTER TABLE bookings ADD COLUMN commission_rate REAL DEFAULT 10",
    "ALTER TABLE bookings ADD COLUMN commission_amount REAL DEFAULT 0",
    "ALTER TABLE agencies ADD COLUMN cancel_rate REAL DEFAULT 20",
    "ALTER TABLE agencies ADD COLUMN logo_url TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch(e) { /* colonne existe déjà */ }
  }

  // Super Admin
  if (!db.prepare('SELECT id FROM admins WHERE username=?').get('superadmin')) {
    db.prepare('INSERT INTO admins (id,username,password) VALUES (?,?,?)')
      .run(uuidv4(), 'superadmin', bcrypt.hashSync('Admin@2024!', 10));
    console.log('✅ Super Admin: superadmin / Admin@2024!');
  }

  // Paramètres
  if (!db.prepare("SELECT key FROM settings WHERE key='commission_rate'").get()) {
    db.prepare("INSERT INTO settings (key,value) VALUES ('commission_rate','10')").run();
  }

  // Galerie par défaut
  if (!db.prepare('SELECT id FROM gallery LIMIT 1').get()) {
    const imgs = [
      { title:'Bus moderne', desc:'Notre flotte', url:'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800', cat:'bus' },
      { title:'Terminal Kinshasa', desc:'Gare routière', url:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800', cat:'terminal' },
      { title:'Route vers Boma', desc:'Paysage congolais', url:'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=800', cat:'route' },
      { title:'Confort à bord', desc:'Sièges climatisés', url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', cat:'interieur' },
    ];
    imgs.forEach((img, i) => {
      db.prepare('INSERT INTO gallery (id,title,description,image_url,category,sort_order) VALUES (?,?,?,?,?,?)')
        .run(uuidv4(), img.title, img.desc, img.url, img.cat, i);
    });
  }

  // Agences par défaut
  const agences = [
    { agency_name:'Trans David',  username:'transdavid',  password:'david123',  phone:'+243 81 000 0001', cancel_rate:20,
      buses:[{name:'Bus 1',seats:55},{name:'Bus 2',seats:55}],
      trips:[['Kinshasa','Boma',45000,'05:00'],['Kinshasa','Matadi',40000,'05:30']] },
    { agency_name:'Trans Renové', username:'transrenove', password:'renove123', phone:'+243 81 000 0002', cancel_rate:20,
      buses:[{name:'Bus 1',seats:50},{name:'Bus 2',seats:50}],
      trips:[['Kinshasa','Boma',45000,'05:30'],['Kinshasa','Matadi',40000,'06:00']] },
    { agency_name:'Transco',      username:'transco',     password:'transco123',phone:'+243 81 000 0003', cancel_rate:20,
      buses:[{name:'Bus 1',seats:60},{name:'Bus 2',seats:60},{name:'Bus 3',seats:60}],
      trips:[['Kinshasa','Boma',40000,'06:00'],['Kinshasa','Matadi',35000,'06:30']] },
  ];

  const dates = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  for (const ag of agences) {
    if (!db.prepare('SELECT id FROM agencies WHERE username=?').get(ag.username)) {
      const agId = uuidv4();
      db.prepare('INSERT INTO agencies (id,agency_name,username,password,phone,cancel_rate) VALUES (?,?,?,?,?,?)')
        .run(agId, ag.agency_name, ag.username, bcrypt.hashSync(ag.password,10), ag.phone, ag.cancel_rate);
      const busIds = [];
      for (const bus of ag.buses) {
        const busId = uuidv4();
        db.prepare('INSERT INTO buses (id,agency_id,bus_name,total_seats) VALUES (?,?,?,?)').run(busId, agId, bus.name, bus.seats);
        busIds.push({ id:busId, name:bus.name, seats:bus.seats });
      }
      for (const [dep,arr,price,dtime] of ag.trips) {
        for (const bus of busIds) {
          for (const date of dates) {
            db.prepare('INSERT INTO trips (id,agency_id,bus_id,bus_name,departure_city,arrival_city,departure_date,departure_time,price,total_seats,available_seats) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
              .run(uuidv4(), agId, bus.id, bus.name, dep, arr, date, dtime, price, bus.seats, bus.seats);
          }
        }
      }
      console.log('✅ Agence: ' + ag.agency_name);
    }
  }

  console.log('✅ Base de données prête');
}

module.exports = { getDb, initDatabase, runTransaction };
