const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');
const { notifyNewBooking, notifyPaymentConfirmed } = require('../mailer');

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

// ── Vérifie le vrai statut d'un paiement MaishaPay ────────────
// 202 = demande envoyée au téléphone, PAS encore confirmé
// On poll toutes les 3s jusqu'à obtenir 200 (succès) ou échec
async function checkPaymentStatus(txId, keys, isLive, maxAttempts = 10, intervalMs = 3000) {
  const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayMode:  isLive ? 1 : 0,
          publicApiKey: keys.public,
          secretApiKey: keys.secret,
          transactionId: txId,
        }),
      });
      const d    = await r.json();
      const orig = (d && d.original) ? d.original : d;
      const code = String(orig?.data?.statusCode || orig?.statusCode || '');
      const desc = orig?.data?.statusDescription || orig?.statusDescription || '';
      if (code === '200') return { success: true,  txId, description: desc };
      if (['400','401','402','403','500'].includes(code)) {
        return { success: false, txId, description: desc || 'Paiement refusé ou solde insuffisant.' };
      }
      // 202 ou autre → continuer à attendre
    } catch (e) {
      console.error(`Polling attempt ${i+1} error:`, e.message);
    }
  }
  return { success: false, txId, description: 'Délai dépassé. Vérifiez votre téléphone et réessayez.' };
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
    AND (t.departure_date > date('now','localtime') OR (t.departure_date = date('now','localtime') AND t.departure_time > time('now','localtime')))
    AND (t.departure_date > date('now','localtime') OR (t.departure_date = date('now','localtime') AND t.departure_time > time('now','localtime')))
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
  console.log('📥 /book appelé — trip_id:', req.body.trip_id);
  const { trip_id, name, phone, email, passengers } = req.body;
  if (!trip_id || !name || !phone) return res.status(400).json({ error: 'Nom, téléphone et trajet requis' });
  const seats = Math.max(1, Math.min(10, parseInt(passengers)||1));
  const db = getDb();
  const trip = db.prepare(`
    SELECT t.*, a.agency_name, a.email agency_email, a.commission_rate, a.cancel_rate
    FROM trips t JOIN agencies a ON t.agency_id=a.id
    WHERE t.id=? AND t.available_seats>=? AND a.is_active=1
  `).get(trip_id, seats);
  if (!trip) return res.status(404).json({ error: 'Trajet indisponible ou places insuffisantes' });

  const total = trip.price * seats;
  const ref   = genRef();
  const id    = uuidv4();

  try {
    runTransaction(db, () => {
      db.prepare(`
        INSERT INTO bookings
          (id,reference,trip_id,agency_id,passenger_name,passenger_phone,passenger_email,passengers,total_price,commission_rate,status,payment_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, ref, trip_id, trip.agency_id, name, phone, email||null, seats, total, trip.commission_rate||10, 'pending', 'pending');
      db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(seats, trip_id);
    });

    console.log('📤 Envoi email à:', trip.agency_email, '— agence:', trip.agency_name);
    notifyNewBooking({
      agencyEmail: trip.agency_email,
      agencyName:  trip.agency_name,
      booking: { reference:ref, passenger_name:name, passenger_phone:phone, passengers:seats, total_price:total },
      trip,
    }).catch(e => console.error('❌ notifyNewBooking error:', e.message));

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

  const rate              = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);
  const net_agency        = booking.total_price - commission_amount;
  let txId = null;

  if (payment_method === 'cash') {
    txId = 'CASH-' + Date.now();
  } else {
    if (!operator || !phone_number) return res.status(400).json({ error: 'Opérateur et numéro requis' });
    const isLive = process.env.MAISHAPAY_MODE === 'live';
    const keys   = {
      public: isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
      secret: isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
    };
    const payload = {
      gatewayMode:          isLive ? 1 : 0,
      publicApiKey:         keys.public,
      secretApiKey:         keys.secret,
      transactionReference: booking.reference,
      amount:               booking.total_price,
      currency:             'CDF',
      chanel:               'MOBILEMONEY',
      provider:             operator.toUpperCase(),
      walletID:             phone_number,
    };
    try {
      const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d    = await r.json();
      const orig = (d && d.original) ? d.original : d;
      const initCode = String(orig?.data?.statusCode || '');

      if (!orig || !orig.data || !['202','200'].includes(initCode)) {
        return res.status(402).json({ error: orig?.data?.statusDescription || 'Paiement refusé.' });
      }

      const pendingTxId = orig.data.transactionId || booking.reference;

      if (initCode === '200') {
        // Confirmé immédiatement
        txId = pendingTxId;
      } else {
        // 202 → attendre la vraie confirmation
        const check = await checkPaymentStatus(pendingTxId, keys, isLive);
        if (!check.success) {
          return res.status(402).json({ error: check.description });
        }
        txId = check.txId;
      }
    } catch(e) {
      return res.status(503).json({ error: 'Service de paiement indisponible. Choisissez paiement espèces.' });
    }
  }

  try {
    runTransaction(db, () => {
      db.prepare(`
        UPDATE bookings
        SET status='confirmed', payment_status='completed',
            payment_method=?, transaction_id=?, commission_rate=?, commission_amount=?
        WHERE id=?
      `).run(payment_method, txId, rate, commission_amount, booking_id);
    });

    const trip = db.prepare(`
      SELECT t.departure_city, t.arrival_city, t.departure_date, t.departure_time,
             a.email agency_email, a.agency_name
      FROM bookings b
      JOIN trips t    ON b.trip_id    = t.id
      JOIN agencies a ON b.agency_id  = a.id
      WHERE b.id = ?
    `).get(booking_id);

    if (trip) {
      console.log('📤 Envoi email paiement à:', trip.agency_email);
      notifyPaymentConfirmed({
        agencyEmail: trip.agency_email,
        agencyName:  trip.agency_name,
        booking,
        trip,
        commission:  commission_amount,
      }).catch(e => console.error('❌ notifyPaymentConfirmed error:', e.message));
    }

    res.json({ success: true, transaction_id: txId, reference: booking.reference, commission: commission_amount, net_agency });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/contribute', async (req, res) => {
  const { contributor_name, phone_number, operator, amount, currency, message } = req.body;

  const montant = parseFloat(amount);
  if (!montant || isNaN(montant))          return res.status(400).json({ error: 'Montant invalide.' });
  if (currency === 'CDF' && montant < 500) return res.status(400).json({ error: 'Montant minimum : 500 FC.' });
  if (currency === 'USD' && montant < 1)   return res.status(400).json({ error: 'Montant minimum : 1 USD.' });
  if (!operator || !phone_number)          return res.status(400).json({ error: 'Opérateur et numéro requis.' });

  const devise    = (currency === 'USD') ? 'USD' : 'CDF';
  const reference = 'CONTRIB-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Date.now();
  const nom       = (contributor_name && contributor_name.trim()) ? contributor_name.trim() : 'Anonyme';
  const isLive    = process.env.MAISHAPAY_MODE === 'live';
  const keys      = {
    public: isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
    secret: isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
  };

  const payload = {
    gatewayMode:          isLive ? 1 : 0,
    publicApiKey:         keys.public,
    secretApiKey:         keys.secret,
    transactionReference: reference,
    amount:               montant,
    currency:             devise,
    chanel:               'MOBILEMONEY',
    provider:             operator.toUpperCase(),
    walletID:             phone_number,
    customerName:         nom,
    customerPhone:        phone_number,
    description:          `Contribution Nzela - ${nom}`,
  };

  try {
    const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d    = await r.json();
    const orig = (d && d.original) ? d.original : d;
    const initCode = String(orig?.data?.statusCode || '');

    if (!orig || !orig.data || !['202','200'].includes(initCode)) {
      return res.status(402).json({ error: orig?.data?.statusDescription || 'Paiement refusé. Vérifiez votre solde.' });
    }

    const pendingTxId = orig.data.transactionId || reference;
    const db = getDb();
    let finalTxId = pendingTxId;

    if (initCode !== '200') {
      // Enregistrer en pending d'abord
      runTransaction(db, () => {
        db.prepare(`
          INSERT INTO contributions
            (id, reference, contributor_name, phone, operator, amount, currency, transaction_id, message, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(uuidv4(), reference, nom, phone_number, operator.toUpperCase(), montant, devise, pendingTxId, message || null);
      });

      // Attendre la vraie confirmation
      const check = await checkPaymentStatus(pendingTxId, keys, isLive);
      if (!check.success) {
        db.prepare(`UPDATE contributions SET status='failed' WHERE reference=?`).run(reference);
        return res.status(402).json({ error: check.description });
      }
      finalTxId = check.txId;
      db.prepare(`UPDATE contributions SET status='completed', transaction_id=? WHERE reference=?`).run(finalTxId, reference);
    } else {
      // 200 direct → completed immédiatement
      runTransaction(db, () => {
        db.prepare(`
          INSERT INTO contributions
            (id, reference, contributor_name, phone, operator, amount, currency, transaction_id, message, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        `).run(uuidv4(), reference, nom, phone_number, operator.toUpperCase(), montant, devise, finalTxId, message || null);
      });
    }

    const montantFormate = devise === 'USD'
      ? `${montant} $`
      : `${Math.round(montant).toLocaleString()} FC`;

    return res.json({
      ok: true, reference,
      transaction_id: finalTxId,
      amount: montant, currency: devise, contributor: nom,
      message: nom === 'Anonyme'
        ? `Merci pour votre contribution de ${montantFormate} ! Nzela grandit grâce à des personnes comme vous. 💚`
        : `Merci ${nom} pour votre contribution de ${montantFormate} ! Votre soutien compte énormément pour toute l'équipe Nzela. 💚`,
    });

  } catch (e) {
    console.error('Contribution error:', e.message);
    return res.status(503).json({ error: 'Service de paiement indisponible. Réessayez plus tard.' });
  }
});

router.post('/card-checkout', (req, res) => {
  const { amount, currency, type, reference, nom } = req.body;
  if (!amount || !currency || !type || !reference) {
    return res.status(400).json({ error: 'Paramètres manquants.' });
  }
  const isLive      = process.env.MAISHAPAY_MODE === 'live';
  const frontendUrl = 'https://nzela-rust.vercel.app';
  const callbackUrl = `https://nzela-production-086a.up.railway.app/api/public/card-callback?type=${type}&ref=${reference}`;
  const successUrl  = `${frontendUrl}/paiement-succes?ref=${reference}&type=${type}`;
  const failureUrl  = `${frontendUrl}/paiement-echec?ref=${reference}&type=${type}`;

  return res.json({
    checkoutUrl:          'https://marchand.maishapay.online/payment/vers1.0/merchant/checkout',
    gatewayMode:          isLive ? 1 : 0,
    publicApiKey:         isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
    secretApiKey:         isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
    montant:              String(amount),
    devise:               currency,
    transactionReference: reference,
    customerName:         nom || 'Client Nzela',
    callbackUrl,
    successUrl,
    failureUrl,
  });
});

router.post('/card-callback', (req, res) => {
  const { type, ref } = req.query;
  const body      = req.body;
  const statusCode = body?.data?.statusCode || body?.statusCode;
  const txId       = body?.data?.transactionId || body?.transactionId || ref;
  const success    = ['200', '202', 200, 202].includes(statusCode) || body?.status === 'SUCCESS';

  try {
    const db = getDb();
    if (type === 'contribution') {
      db.prepare(`UPDATE contributions SET status=?, transaction_id=? WHERE reference=?`)
        .run(success ? 'completed' : 'failed', txId, ref);
    } else if (type === 'booking') {
      if (success) {
        const booking = db.prepare('SELECT * FROM bookings WHERE reference=?').get(ref);
        if (booking) {
          const rate              = booking.commission_rate || 10;
          const commission_amount = Math.round(booking.total_price * rate / 100);
          runTransaction(db, () => {
            db.prepare(`
              UPDATE bookings
              SET status='confirmed', payment_status='completed',
                  payment_method='card', transaction_id=?,
                  commission_rate=?, commission_amount=?
              WHERE reference=?
            `).run(txId, rate, commission_amount, ref);
          });
        }
      }
    }
    return res.json({ status: '1' });
  } catch (e) {
    console.error('Card callback error:', e.message);
    return res.json({ status: '1' });
  }
});

router.get('/card-callback', (req, res) => {
  res.json({ status: '1' });
});

module.exports = router;

