const { getDb } = require('./db/database');
const db = getDb();
const r = db.prepare("UPDATE buses SET layout = '2+3' WHERE layout NOT IN ('2+2', '2+3', '2')").run();
console.log('Corrigé:', r.changes, 'bus(es)');
const buses = db.prepare('SELECT id, bus_name, layout FROM buses').all();
console.log(JSON.stringify(buses, null, 2));