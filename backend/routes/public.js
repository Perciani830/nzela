const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genContribRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'CONTRIB-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '-' + Date.now();
}

// ── GET /api/public/trips ─────────────────────────────────────
router.get('/trips', (req, res) => {
  const { from, to, date } = req.query;
  const db = getDb();
  let q = `
    SELECT t.*, a.agency_name, a.logo_url agency_logo, a.phone agency_phone,
           a.premium, a.premium_order, a.cancel_rate
    FROM trips t JOIN agencies a ON t.agency_id = a.id
    WHERE t.available_seats > 0 AND t.is_active = 1 AND a.is_active = 1
  `;
  const p = [];
  if (from) { q += ' AND LOWER(t.departure_city) LIKE ?'; p.push('%' + from.toLowerCase() + '%'); }
  if (to)   { q += ' AND LOWER(t.arrival_city) LIKE ?';   p.push('%' + to.toLowerCase() + '%'); }
  if (date) { q += ' AND t.departure_date = ?';            p.push(date); }
  q += ' ORDER BY a.premium DESC, a.premium_order ASC, t.price ASC, t.departure_time ASC';
  try { res.json(db.prepare(q).all(...p)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/public/gallery ───────────────────────────────────
router.get('/gallery', (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM gallery WHERE is_active=1 ORDER BY sort_order ASC').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/public/premium-agencies ─────────────────────────
router.get('/premium-agencies', (req, res) => {
  try {
    res.json(getDb().prepare(`
      SELECT id, agency_name, logo_url, premium_photo_url, premium_caption, phone
      FROM agencies WHERE is_active=1 AND premium=1 ORDER BY premium_order ASC
    `).all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/public/book ─────────────────────────────────────
router.post('/book', (req, res) => {
  const { trip_id, name, phone, email, passengers } = req.body;
  if (!trip_id || !name || !phone) return res.status(400).json({ error: 'Nom, téléphone et trajet requis' });
  const seats = Math.max(1, Math.min(10, parseInt(passengers) || 1));
  const db    = getDb();
  const trip  = db.prepare(`
    SELECT t.*, a.agency_name, a.commission_rate
    FROM trips t JOIN agencies a ON t.agency_id = a.id
    WHERE t.id = ? AND t.available_seats >= ? AND t.is_active = 1 AND a.is_active = 1
  `).get(trip_id, seats);
  if (!trip) return res.status(404).json({ error: 'Trajet indisponible ou places insuffisantes' });
  const total = trip.price * seats;
  const ref   = genRef();
  const id    = uuidv4();
  try {
    runTransaction(db, () => {
      db.prepare(`
        INSERT INTO bookings
          (id, reference, trip_id, agency_id, passenger_name, passenger_phone,
           passenger_email, passengers, total_price, commission_rate, status, payment_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, ref, trip_id, trip.agency_id, name, phone, email || null, seats, total,
             trip.commission_rate || 10, 'pending', 'pending');
      db.prepare('UPDATE trips SET available_seats = available_seats - ? WHERE id = ?').run(seats, trip_id);
    });
    res.status(201).json({ booking_id: id, reference: ref, total_price: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/pay
// ═══════════════════════════════════════════════════════════════
router.post('/pay', async (req, res) => {
  const { booking_id, payment_method, operator, phone_number,
          card_firstname, card_lastname, card_address, card_city,
          card_phone, card_email, card_provider } = req.body;

  if (!booking_id) return res.status(400).json({ error: 'ID réservation requis' });

  const db      = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!booking)                               return res.status(404).json({ error: 'Réservation introuvable' });
  if (booking.payment_status === 'completed') return res.status(400).json({ error: 'Déjà payée' });

  const rate              = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);

  const isLive      = process.env.MAISHAPAY_MODE === 'live';
  const publicKey   = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey   = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const gatewayMode = isLive ? '1' : '0';
  const callbackUrl = process.env.MAISHAPAY_CALLBACK_URL || '';

  let txId = null;

  if (payment_method === 'cash') {
    txId = 'CASH-' + Date.now();
  }

  else if (payment_method === 'mobilemoney') {
    if (!operator || !phone_number)
      return res.status(400).json({ error: 'Opérateur et numéro de téléphone requis' });

    const payload = {
      transactionReference: booking.reference,
      gatewayMode,
      publicApiKey: publicKey,
      secretApiKey: secretKey,
      order: {
        amount:              String(booking.total_price),
        currency:            'CDF',
        customerFullName:    booking.passenger_name  || '',
        customerEmailAdress: booking.passenger_email || '',
      },
      paymentChannel: {
        channel:     'MOBILEMONEY',
        provider:    operator.toUpperCase(),
        walletID:    phone_number,
        callbackUrl,
      },
    };

    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/collect/v2/store/mobileMoney', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const d    = await r.json();
      const data = d?.original?.data || d?.data || d;
      const code = String(data?.statusCode || d?.statusCode || '');
      const desc = data?.statusDescription || d?.statusDescription || d?.message || 'Paiement refusé';

      if (['200', '202', '2000'].includes(code)) {
        txId = data?.transactionId || data?.originatingTransactionId || booking.reference;
        console.log(`✅ MM v2 — ${booking.reference} | ${booking.total_price} CDF | tx: ${txId}`);
      } else {
        console.error(`❌ MM v2 — ${booking.reference} | code: ${code} | ${desc}`);
        return res.status(402).json({ error: desc });
      }
    } catch (e) {
      console.error('MaishaPay v2 erreur:', e.message);
      return res.status(503).json({ error: 'Service Mobile Money indisponible. Essayez paiement espèces.' });
    }
  }

  else if (payment_method === 'card') {
    if (!card_firstname || !card_lastname || !card_address || !card_city || !card_phone || !card_email || !card_provider)
      return res.status(400).json({ error: 'Tous les champs carte sont requis' });
    if (!callbackUrl)
      return res.status(400).json({ error: 'callbackUrl manquant — vérifiez MAISHAPAY_CALLBACK_URL dans .env' });

    const CDF_TO_USD_RATE = 2800;
    const amountUSD       = (booking.total_price / CDF_TO_USD_RATE).toFixed(2);

    const payload = {
      transactionReference: booking.reference,
      gatewayMode,
      publicApiKey: publicKey,
      secretApiKey: secretKey,
      order: {
        amount:              String(amountUSD),
        currency:            'USD',
        customerFirstname:   card_firstname,
        customerLastname:    card_lastname,
        customerAddress:     card_address,
        customerCity:        card_city,
        customerPhoneNumber: card_phone,
        customerEmailAdress: card_email,
      },
      paymentChannel: {
        channel:     'CARD',
        provider:    card_provider.toUpperCase(),
        callbackUrl,
      },
    };

    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/collect/v3/store/card', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const d    = await r.json();
      const data = d?.original?.data || d?.data || d;
      const code = String(data?.statusCode || d?.statusCode || '');
      const desc = data?.statusDescription || d?.statusDescription || d?.message || 'Paiement carte refusé';

      if (['200', '202', '2000'].includes(code)) {
        txId = data?.transactionId || data?.originatingTransactionId || booking.reference;
        console.log(`✅ Card v3 — ${booking.reference} | ${amountUSD} USD | tx: ${txId}`);
      } else {
        console.error(`❌ Card v3 — ${booking.reference} | code: ${code} | ${desc}`);
        return res.status(402).json({ error: desc });
      }
    } catch (e) {
      console.error('MaishaPay v3 erreur:', e.message);
      return res.status(503).json({ error: 'Service carte indisponible. Essayez Mobile Money.' });
    }
  }

  else {
    return res.status(400).json({ error: 'Méthode de paiement non reconnue : cash | mobilemoney | card' });
  }

  try {
    runTransaction(db, () => {
      db.prepare(`
        UPDATE bookings SET
          status            = 'confirmed',
          payment_status    = 'completed',
          payment_method    = ?,
          transaction_id    = ?,
          commission_rate   = ?,
          commission_amount = ?
        WHERE id = ?
      `).run(payment_method, txId, rate, commission_amount, booking_id);
    });
    console.log(`💳 ${booking.reference} | Total: ${booking.total_price} FC | Commission Nzela (${rate}%): ${commission_amount} FC`);
    res.json({ success: true, transaction_id: txId, reference: booking.reference, commission: commission_amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/contribute
//
// Contribution financière via Mobile Money (page ComingSoon).
// ═══════════════════════════════════════════════════════════════
router.post('/contribute', async (req, res) => {
  const { contributor_name, amount, currency, operator, phone_number, message } = req.body;

  if (!amount || !operator || !phone_number)
    return res.status(400).json({ error: 'Montant, opérateur et téléphone requis' });

  const montant = parseFloat(amount);
  if (isNaN(montant) || montant <= 0)
    return res.status(400).json({ error: 'Montant invalide' });
  if (currency === 'CDF' && montant < 500)
    return res.status(400).json({ error: 'Minimum 500 FC' });
  if (currency === 'USD' && montant < 1)
    return res.status(400).json({ error: 'Minimum 1 USD' });

  const nom       = contributor_name?.trim() || 'Anonyme';
  const reference = genContribRef();

  const isLive      = process.env.MAISHAPAY_MODE === 'live';
  const publicKey   = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey   = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const gatewayMode = isLive ? '1' : '0';
  const callbackUrl = process.env.MAISHAPAY_CALLBACK_URL || '';

  const payload = {
    transactionReference: reference,
    gatewayMode,
    publicApiKey: publicKey,
    secretApiKey: secretKey,
    order: {
      amount:              String(montant),
      currency:            currency || 'CDF',
      customerFullName:    nom,
      customerEmailAdress: '',
    },
    paymentChannel: {
      channel:     'MOBILEMONEY',
      provider:    operator.toUpperCase(),
      walletID:    phone_number,
      callbackUrl,
    },
  };

  try {
    const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/collect/v2/store/mobileMoney', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const d    = await r.json();
    const data = d?.original?.data || d?.data || d;
    const code = String(data?.statusCode || d?.statusCode || '');
    const desc = data?.statusDescription || d?.statusDescription || d?.message || 'Paiement refusé';

    if (['200', '202', '2000'].includes(code)) {
      const txId = data?.transactionId || data?.originatingTransactionId || reference;
      console.log(`✅ Contribution MM — ${reference} | ${montant} ${currency} | ${nom} | tx: ${txId}`);

      // Création table + enregistrement (non bloquant si erreur)
      try {
        const db = getDb();
        db.prepare(`
          CREATE TABLE IF NOT EXISTS contributions (
            id TEXT PRIMARY KEY,
            reference TEXT UNIQUE,
            contributor_name TEXT,
            amount REAL,
            currency TEXT DEFAULT 'CDF',
            operator TEXT,
            phone_number TEXT,
            message TEXT,
            transaction_id TEXT,
            status TEXT DEFAULT 'completed',
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        db.prepare(`
          INSERT OR IGNORE INTO contributions
            (id, reference, contributor_name, amount, currency, operator, phone_number, message, transaction_id)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).run(uuidv4(), reference, nom, montant, currency || 'CDF', operator, phone_number, message || '', txId);
      } catch (dbErr) {
        console.error('Contributions DB (non bloquant):', dbErr.message);
      }

      return res.json({
        success:   true,
        reference,
        message:   `Merci ${nom} ! Votre contribution de ${montant.toLocaleString()} ${currency} a bien été reçue. 💚`,
      });

    } else {
      console.error(`❌ Contribution MM — ${reference} | code: ${code} | ${desc}`);
      return res.status(402).json({ error: desc });
    }

  } catch (e) {
    console.error('Contribution erreur réseau:', e.message);
    return res.status(503).json({ error: 'Service indisponible. Réessayez dans quelques instants.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/card-checkout
//
// Retourne les paramètres pour la redirection vers la page
// de paiement hébergée MaishaPay (carte bancaire).
// Appelé depuis la page ComingSoon.jsx
// ═══════════════════════════════════════════════════════════════
router.post('/card-checkout', (req, res) => {
  const { amount, currency, reference, nom } = req.body;

  if (!amount || !reference)
    return res.status(400).json({ error: 'Montant et référence requis' });

  const montant = parseFloat(amount);
  if (isNaN(montant) || montant <= 0)
    return res.status(400).json({ error: 'Montant invalide' });

  const callbackUrl = process.env.MAISHAPAY_CALLBACK_URL || '';
  if (!callbackUrl)
    return res.status(400).json({ error: 'callbackUrl manquant — vérifiez MAISHAPAY_CALLBACK_URL dans .env' });

  const isLive      = process.env.MAISHAPAY_MODE === 'live';
  const publicKey   = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey   = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const gatewayMode = isLive ? '1' : '0';

  // La carte MaishaPay n'accepte pas CDF — conversion si nécessaire
  const CDF_TO_USD_RATE = 2800;
  const montantFinal = currency === 'CDF'
    ? (montant / CDF_TO_USD_RATE).toFixed(2)
    : montant.toFixed(2);
  const deviseFinal = currency === 'CDF' ? 'USD' : (currency || 'USD');

  const frontendUrl = process.env.FRONTEND_URL || 'https://nzela.cd';

  res.json({
    checkoutUrl:          'https://marchand.maishapay.online/checkout',
    gatewayMode,
    publicApiKey:          publicKey,
    secretApiKey:          secretKey,
    montant:               String(montantFinal),
    devise:                deviseFinal,
    transactionReference:  reference,
    customerName:          nom || 'Anonyme',
    callbackUrl,
    successUrl:            `${frontendUrl}/contribution-success`,
    failureUrl:            `${frontendUrl}/contribution-failure`,
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/maishapay-callback
//
// MaishaPay appelle cette route après traitement d'un paiement
// carte. Gère les bookings (BUS-) et contributions (CONTRIB-).
// MAISHAPAY_CALLBACK_URL=https://api.nzela.cd/api/public/maishapay-callback
// ═══════════════════════════════════════════════════════════════
router.post('/maishapay-callback', (req, res) => {
  const body = req.body;
  console.log('📩 MaishaPay callback reçu:', JSON.stringify(body));

  const ref  = body?.transactionReference
            || body?.original?.data?.transactionReference
            || body?.data?.transactionReference;

  const code = String(
    body?.statusCode
    || body?.original?.data?.statusCode
    || body?.data?.statusCode
    || ''
  );

  const txId = body?.transactionId
            || body?.original?.data?.transactionId
            || body?.data?.transactionId
            || ref;

  if (!ref) {
    console.error('❌ Callback sans transactionReference:', JSON.stringify(body));
    return res.status(400).json({ error: 'transactionReference manquant' });
  }

  const db = getDb();

  if (['200', '202', '2000'].includes(code)) {

    // Booking (BUS-...)
    if (ref.startsWith('BUS-')) {
      try {
        const booking = db.prepare('SELECT * FROM bookings WHERE reference = ?').get(ref);
        if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });
        if (booking.payment_status === 'completed') {
          console.log(`⚠️ Callback doublon ignoré — ${ref}`);
          return res.json({ received: true });
        }
        const rate              = booking.commission_rate || 10;
        const commission_amount = Math.round(booking.total_price * rate / 100);
        runTransaction(db, () => {
          db.prepare(`
            UPDATE bookings SET
              status = 'confirmed', payment_status = 'completed',
              transaction_id = ?, commission_amount = ?
            WHERE reference = ?
          `).run(txId, commission_amount, ref);
        });
        console.log(`✅ Callback booking confirmé — ${ref} | tx: ${txId}`);
      } catch (e) {
        console.error('❌ Callback booking DB erreur:', e.message);
        return res.status(500).json({ error: e.message });
      }
    }

    // Contribution (CONTRIB-...)
    else if (ref.startsWith('CONTRIB-')) {
      try {
        db.prepare(`UPDATE contributions SET status = 'completed', transaction_id = ? WHERE reference = ?`).run(txId, ref);
        console.log(`✅ Callback contribution confirmée — ${ref} | tx: ${txId}`);
      } catch (e) {
        console.log(`⚠️ Callback contribution — erreur non bloquante: ${e.message}`);
      }
    }

    else {
      console.log(`⚠️ Callback — référence non reconnue: ${ref}`);
    }

  } else {
    console.log(`❌ Callback échoué — ${ref} | code: ${code}`);
  }

  // MaishaPay attend toujours un 200
  res.json({ received: true });
});

module.exports = router;