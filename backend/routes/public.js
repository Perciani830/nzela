const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

router.get('/trips', (req, res) => {
  const { from, to, date } = req.query;
  const db = getDb();
  let q = `
    SELECT t.*,
           a.agency_name, a.logo_url agency_logo, a.phone agency_phone,
           a.note agency_note, a.cancel_rate agency_cancel_rate
    FROM trips t JOIN agencies a ON t.agency_id = a.id
    WHERE t.available_seats > 0 AND t.is_active = 1 AND a.is_active = 1
  `;
  const p = [];
  if (from) { q += ' AND LOWER(t.departure_city) LIKE ?'; p.push('%' + from.toLowerCase() + '%'); }
  if (to)   { q += ' AND LOWER(t.arrival_city) LIKE ?';   p.push('%' + to.toLowerCase() + '%'); }
  if (date) { q += ' AND t.departure_date = ?';            p.push(date); }
  q += ' ORDER BY a.note DESC, t.price ASC, t.departure_time ASC';
  try { res.json(db.prepare(q).all(...p)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/gallery', (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM gallery WHERE is_active=1 ORDER BY sort_order ASC').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/book', (req, res) => {
  const { trip_id, name, phone, email, passengers } = req.body;
  if (!trip_id || !name || !phone) return res.status(400).json({ error: 'Nom, téléphone et trajet requis' });
  const seats = Math.max(1, Math.min(10, parseInt(passengers)||1));
  const db = getDb();
  const trip = db.prepare('SELECT t.*, a.agency_name, a.commission_rate, a.cancel_rate FROM trips t JOIN agencies a ON t.agency_id=a.id WHERE t.id=? AND t.available_seats>=? AND a.is_active=1').get(trip_id, seats);
  if (!trip) return res.status(404).json({ error: 'Trajet indisponible ou places insuffisantes' });
  const total = trip.price * seats;
  const ref = genRef();
  const id = uuidv4();
  try {
    runTransaction(db, () => {
      db.prepare('INSERT INTO bookings (id,reference,trip_id,agency_id,passenger_name,passenger_phone,passenger_email,passengers,total_price,commission_rate,status,payment_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, ref, trip_id, trip.agency_id, name, phone, email||null, seats, total, trip.commission_rate||10, 'pending', 'pending');
      db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(seats, trip_id);
    });
    res.status(201).json({ booking_id: id, reference: ref, total_price: total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/pay', async (req, res) => {
  const { booking_id, payment_method, operator, phone_number } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'ID réservation requis' });
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(booking_id);
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });
  if (booking.payment_status === 'completed') return res.status(400).json({ error: 'Déjà payée' });

  const rate = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);
  const net_agency = booking.total_price - commission_amount;
  let txId = null;

  if (payment_method === 'cash') {
    txId = 'CASH-' + Date.now();
  } else {
    if (!operator || !phone_number) return res.status(400).json({ error: 'Opérateur et numéro requis' });
    const isLive = process.env.MAISHAPAY_MODE === 'live';
    const payload = {
      gatewayMode: isLive ? 1 : 0,
      publicApiKey:  isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
      secretApiKey:  isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
      transactionReference: booking.reference,
      amount: booking.total_price,
      currency: 'CDF',
      chanel: 'MOBILEMONEY',
      provider: operator.toUpperCase(),
      walletID: phone_number,
    };
    try {
      const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      const orig = (d && d.original) ? d.original : d;
      if (orig && orig.data && ['202','200'].includes(String(orig.data.statusCode))) {
        txId = orig.data.transactionId || booking.reference;
      } else {
        return res.status(402).json({ error: (orig?.data?.statusDescription) || 'Paiement refusé' });
      }
    } catch(e) {
      return res.status(503).json({ error: 'Service de paiement indisponible. Choisissez paiement espèces.' });
    }
  }

  try {
    runTransaction(db, () => {
      db.prepare(`UPDATE bookings SET status='confirmed', payment_status='completed', payment_method=?, transaction_id=?, commission_rate=?, commission_amount=? WHERE id=?`)
        .run(payment_method, txId, rate, commission_amount, booking_id);
    });
    res.json({ success: true, transaction_id: txId, reference: booking.reference, commission: commission_amount, net_agency });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;