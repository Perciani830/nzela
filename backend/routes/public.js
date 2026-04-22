const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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
//
// payment_method :
//   "cash"        → confirmation immédiate, pas d'API externe
//   "mobilemoney" → MaishaPay Mobile Money API v2
//   "card"        → MaishaPay Card API v3
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

  // Commission calculée au moment du paiement
  const rate              = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);

  // Clés selon le mode (sandbox / live)
  const isLive      = process.env.MAISHAPAY_MODE === 'live';
  const publicKey   = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey   = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const gatewayMode = isLive ? '1' : '0';
  const callbackUrl = process.env.MAISHAPAY_CALLBACK_URL || '';

  let txId = null;

  // ────────────────────────────────────────────────────────────
  // 1. ESPÈCES
  // ────────────────────────────────────────────────────────────
  if (payment_method === 'cash') {
    txId = 'CASH-' + Date.now();
  }

  // ────────────────────────────────────────────────────────────
  // 2. MOBILE MONEY — MaishaPay API v2
  //    POST https://marchand.maishapay.online/api/collect/v2/store/mobileMoney
  // ────────────────────────────────────────────────────────────
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
        customerEmailAdress: booking.passenger_email || '',  // typo intentionnelle MaishaPay
      },
      paymentChannel: {
        channel:     'MOBILEMONEY',
        provider:    operator.toUpperCase(),   // MPESA, ORANGE, AIRTEL, AFRICEL, MTN
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

  // ────────────────────────────────────────────────────────────
  // 3. CARTE BANCAIRE — MaishaPay API v3
  //    POST https://marchand.maishapay.online/api/collect/v3/store/card
  //    Devise : USD ou EURO uniquement (pas CDF)
  // ────────────────────────────────────────────────────────────
  else if (payment_method === 'card') {
    if (!card_firstname || !card_lastname || !card_address || !card_city || !card_phone || !card_email || !card_provider)
      return res.status(400).json({ error: 'Tous les champs carte sont requis (nom, adresse, téléphone, email, opérateur)' });

    if (!callbackUrl)
      return res.status(400).json({ error: 'callbackUrl manquant — vérifiez MAISHAPAY_CALLBACK_URL dans .env' });

    const CDF_TO_USD_RATE = 2800; // 1 USD ≈ 2800 CDF — à mettre à jour
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
        customerEmailAdress: card_email,         // typo intentionnelle MaishaPay
      },
      paymentChannel: {
        channel:     'CARD',
        provider:    card_provider.toUpperCase(), // VISA, MASTERCARD, AMERICAN EXPRESS
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

  // ────────────────────────────────────────────────────────────
  // Enregistrement du paiement avec commission
  // ────────────────────────────────────────────────────────────
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

    res.json({
      success:        true,
      transaction_id: txId,
      reference:      booking.reference,
      commission:     commission_amount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/maishapay-callback
//
// MaishaPay appelle cette route automatiquement après traitement
// d'un paiement carte (API v3). Elle met à jour le booking en DB.
// URL à configurer dans Railway .env :
//   MAISHAPAY_CALLBACK_URL=https://api.nzela.cd/api/public/maishapay-callback
// ═══════════════════════════════════════════════════════════════
router.post('/maishapay-callback', (req, res) => {
  const body = req.body;
  console.log('📩 MaishaPay callback reçu:', JSON.stringify(body));

  // MaishaPay peut envoyer la référence à différents niveaux selon la version
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
    console.error('❌ Callback reçu sans transactionReference:', JSON.stringify(body));
    return res.status(400).json({ error: 'transactionReference manquant' });
  }

  const db = getDb();

  if (['200', '202', '2000'].includes(code)) {
    try {
      const booking = db.prepare('SELECT * FROM bookings WHERE reference = ?').get(ref);

      if (!booking) {
        console.error(`❌ Callback — réservation introuvable pour ref: ${ref}`);
        return res.status(404).json({ error: 'Réservation introuvable' });
      }

      if (booking.payment_status === 'completed') {
        // Déjà confirmée (double callback) — on répond OK sans rien écrire
        console.log(`⚠️ Callback doublon ignoré — ${ref}`);
        return res.json({ received: true });
      }

      const rate              = booking.commission_rate || 10;
      const commission_amount = Math.round(booking.total_price * rate / 100);

      runTransaction(db, () => {
        db.prepare(`
          UPDATE bookings SET
            status            = 'confirmed',
            payment_status    = 'completed',
            transaction_id    = ?,
            commission_amount = ?
          WHERE reference = ?
        `).run(txId, commission_amount, ref);
      });

      console.log(`✅ Callback carte confirmé — ${ref} | tx: ${txId} | commission: ${commission_amount} FC`);

    } catch (e) {
      console.error('❌ Callback DB erreur:', e.message);
      return res.status(500).json({ error: e.message });
    }

  } else {
    // Paiement échoué côté MaishaPay — on laisse le booking en pending
    console.log(`❌ Callback carte échoué — ${ref} | code: ${code}`);
  }

  // MaishaPay attend toujours un 200 pour arrêter de renvoyer le callback
  res.json({ received: true });
});

module.exports = router;