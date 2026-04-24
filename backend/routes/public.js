const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── GET /api/public/trips ──────────────────────────────────────
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
  if (to)   { q += ' AND LOWER(t.arrival_city)   LIKE ?'; p.push('%' + to.toLowerCase()   + '%'); }
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
  if (!trip_id || !name || !phone)
    return res.status(400).json({ error: 'Nom, téléphone et trajet requis' });
  const seats = Math.max(1, Math.min(10, parseInt(passengers) || 1));
  const db    = getDb();
  const trip  = db.prepare(`
    SELECT t.*, a.agency_name, a.commission_rate
    FROM trips t JOIN agencies a ON t.agency_id = a.id
    WHERE t.id=? AND t.available_seats>=? AND t.is_active=1 AND a.is_active=1
  `).get(trip_id, seats);
  if (!trip) return res.status(404).json({ error: 'Trajet indisponible ou places insuffisantes' });
  const total = trip.price * seats;
  const ref   = genRef();
  const id    = uuidv4();
  try {
    runTransaction(db, () => {
      db.prepare(`
        INSERT INTO bookings
          (id,reference,trip_id,agency_id,passenger_name,passenger_phone,
           passenger_email,passengers,total_price,commission_rate,status,payment_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, ref, trip_id, trip.agency_id, name, phone, email||null,
             seats, total, trip.commission_rate||10, 'pending', 'pending');
      db.prepare('UPDATE trips SET available_seats=available_seats-? WHERE id=?').run(seats, trip_id);
    });
    res.status(201).json({ booking_id: id, reference: ref, total_price: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/public/booking-status/:id ───────────────────────
// Polling : le frontend interroge ce endpoint toutes les 3s après paiement
router.get('/booking-status/:id', (req, res) => {
  try {
    const b = getDb().prepare('SELECT id,reference,status,payment_status,transaction_id FROM bookings WHERE id=?').get(req.params.id);
    if (!b) return res.status(404).json({ error: 'Introuvable' });
    res.json({
      booking_id:     b.id,
      reference:      b.reference,
      status:         b.status,
      payment_status: b.payment_status,
      transaction_id: b.transaction_id,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════

router.post('/pay', async (req, res) => {
  const { booking_id, payment_method, operator, phone_number,
          card_firstname, card_lastname, card_address,
          card_city, card_phone, card_email, card_provider } = req.body;

  if (!booking_id) return res.status(400).json({ error: 'ID réservation requis' });

  const db      = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(booking_id);
  if (!booking)                               return res.status(404).json({ error: 'Réservation introuvable' });
  if (booking.payment_status === 'completed') return res.status(400).json({ error: 'Déjà payée' });

  const rate              = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);
  const isLive            = process.env.MAISHAPAY_MODE === 'live';
  const publicKey         = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey         = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const gatewayMode       = isLive ? '1' : '0';
  const BASE_URL          = process.env.API_BASE_URL || 'https://api.nzela.cd';

  // ──────────────────────────────────────────────────────────────
  // 1. ESPÈCES — confirmation immédiate
  // ──────────────────────────────────────────────────────────────
  if (payment_method === 'cash') {
    const txId = 'CASH-' + Date.now();
    try {
      db.prepare(`UPDATE bookings SET status='confirmed', payment_status='completed',
        payment_method=?, transaction_id=?, commission_rate=?, commission_amount=? WHERE id=?`)
        .run('cash', txId, rate, commission_amount, booking_id);
      console.log(`✅ Espèces — ${booking.reference} | ${booking.total_price} FC`);
      return res.json({ success: true, status: 'confirmed', reference: booking.reference, transaction_id: txId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. MOBILE MONEY MPESA — API v1 SYNCHRONE (MPESA uniquement)
  //    La connexion reste ouverte jusqu'à réponse finale de l'opérateur
  // ──────────────────────────────────────────────────────────────
// ✅ Après
const V1_OPERATORS = ['MPESA'];
const PROVIDER_MAP = {
  MPESA:   'MPESA',
  ORANGE:  'ORANGE',
  AIRTEL:  'AIRTEL_MONEY',
  AFRICEL: 'AFRICELL',
  MTN:     'MTN',
  MOOV:    'MOOV',
};
if (payment_method === 'mobilemoney' && operator && V1_OPERATORS.includes(operator.toUpperCase())) {
    if (!phone_number) return res.status(400).json({ error: 'Numéro de téléphone requis' });
    const payload = {
      transactionReference: booking.reference,
      gatewayMode,
      publicApiKey:  publicKey,
      secretApiKey:  secretKey,
      amount:        booking.total_price,
      currency: req.body.currency || 'CDF',
      chanel:        'MOBILEMONEY',
      provider: PROVIDER_MAP[operator.toUpperCase()] || operator.toUpperCase(),
      walletID:      phone_number,
    };
    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d = await r.json();
      // v1 répond directement avec le statut final
      const data   = d?.data || d;
      const code   = String(data?.statusCode || '');
      const status = data?.status || '';
      const txId   = data?.transactionId || booking.reference;

      if (code === '200' || status === 'APPROVED') {
        db.prepare(`UPDATE bookings SET status='confirmed', payment_status='completed',
          payment_method='mobilemoney', transaction_id=?, commission_rate=?, commission_amount=? WHERE id=?`)
          .run(txId, rate, commission_amount, booking_id);
        console.log(`✅ MPESA v1 — ${booking.reference} | ${booking.total_price} CDF | tx: ${txId}`);
        return res.json({ success: true, status: 'confirmed', reference: booking.reference, transaction_id: txId });
      } else if (code === '201' || code === '202' || status === 'PENDING') {
        // Rare cas pending v1
        db.prepare(`UPDATE bookings SET payment_method='mobilemoney', transaction_id=? WHERE id=?`).run(txId, booking_id);
        return res.json({ success: true, status: 'pending', reference: booking.reference,
          message: 'Transaction en attente de confirmation opérateur.' });
      } else {
        const desc = data?.transactionDescription || data?.statusDescription || 'Paiement refusé';
        console.error(`❌ MPESA v1 — ${booking.reference} | ${desc}`);
        // Remettre les places
        db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
        db.prepare("UPDATE bookings SET status='cancelled', payment_status='failed' WHERE id=?").run(booking_id);
        return res.status(402).json({ error: desc });
      }
    } catch (e) {
      console.error('MPESA v1 erreur réseau:', e.message);
      return res.status(503).json({ error: 'Service Mobile Money indisponible. Essayez paiement espèces.' });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. MOBILE MONEY AIRTEL / ORANGE / MTN — API v2 ASYNCHRONE
  //    Répond 202 PENDING immédiatement → résultat via callback POST
  // ──────────────────────────────────────────────────────────────
  if (payment_method === 'mobilemoney') {
    if (!operator || !phone_number)
      return res.status(400).json({ error: 'Opérateur et numéro de téléphone requis' });

    const callbackUrl = `${BASE_URL}/api/public/callback/mobilemoney`;
    const payload = {
      transactionReference: booking.reference,
      gatewayMode,
      publicApiKey: publicKey,
      secretApiKey: secretKey,
      order: {
        amount:              String(booking.total_price),
        currency: req.body.currency || 'CDF',
        customerFullName:    booking.passenger_name  || '',
        customerEmailAdress: booking.passenger_email || '',
      },
      paymentChannel: {
        channel:     'MOBILEMONEY',
        provider: PROVIDER_MAP[operator.toUpperCase()] || operator.toUpperCase(),
        walletID:    phone_number,
        callbackUrl,
      },
    };
    try {
      const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
      const r = await fetch('https://marchand.maishapay.online/api/collect/v2/store/mobileMoney', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const d    = await r.json();
      const code = String(d?.status_code || d?.statusCode || '');

      if (code === '202') {
        // Enregistrer comme "en cours" — la confirmation viendra via callback
        db.prepare(`UPDATE bookings SET payment_method='mobilemoney', transaction_id=? WHERE id=?`)
          .run(String(d.transactionId || ''), booking_id);
        console.log(`⏳ MM v2 — ${booking.reference} | ${operator} | en attente PIN client`);
        return res.json({
          success:    true,
          status:     'pending',
          reference:  booking.reference,
          booking_id: booking_id,
          message:    `Demande envoyée sur votre téléphone ${phone_number}. Veuillez saisir votre code PIN ${operator} pour confirmer.`,
        });
      } else {
        const desc = d?.transactionStatus || d?.message || 'Paiement refusé par l\'opérateur';
        // Remettre les places
        db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
        db.prepare("UPDATE bookings SET status='cancelled', payment_status='failed' WHERE id=?").run(booking_id);
        return res.status(402).json({ error: desc });
      }
    } catch (e) {
      console.error('MaishaPay v2 erreur réseau:', e.message);
      return res.status(503).json({ error: 'Service Mobile Money indisponible. Essayez paiement espèces.' });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 4. CARTE BANCAIRE — API v3 ASYNCHRONE
  //    Répond 202 + paymentPage URL → client redirigé vers CyberSource
  //    Résultat arrive via GET /callback/card
  // ──────────────────────────────────────────────────────────────
  if (payment_method === 'card') {
    if (!card_phone || !card_email || !card_provider)
      return res.status(400).json({ error: 'Téléphone, email et type de carte requis' });

    const CDF_TO_USD = parseFloat(process.env.CDF_TO_USD_RATE) || 2800;
    const amountUSD  = Math.max(1, +(booking.total_price / CDF_TO_USD).toFixed(2));
    const callbackUrl = `${BASE_URL}/api/public/callback/card`;

    const payload = {
      transactionReference: booking.reference,
      gatewayMode,
      publicApiKey: publicKey,
      secretApiKey: secretKey,
      order: {
        amount:              String(amountUSD),
        currency:            'USD',
        customerFirstname:   card_firstname || booking.passenger_name.split(' ')[0] || '',
        customerLastname:    card_lastname  || booking.passenger_name.split(' ').slice(1).join(' ') || '',
        customerAddress:     card_address  || 'Kinshasa',
        customerCity:        card_city     || 'Kinshasa',
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d    = await r.json();
      console.log('card-checkout MaishaPay response:', JSON.stringify(d));
      const code = String(d?.status_code || d?.statusCode || '');

      if (code === '202' && d?.paymentPage) {
        db.prepare(`UPDATE bookings SET payment_method='card', transaction_id=? WHERE id=?`)
          .run(String(d.transactionId || ''), booking_id);
        console.log(`💳 Card v3 — ${booking.reference} | ${amountUSD} USD | redirect CyberSource`);
        return res.json({
          success:      true,
          status:       'redirect',
          reference:    booking.reference,
          booking_id:   booking_id,
          payment_page: d.paymentPage,
          message:      'Veuillez compléter votre paiement sur la page sécurisée.',
        });
      } else {
        const desc = d?.transactionDescription || d?.message || 'Initialisation carte échouée';
        db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
        db.prepare("UPDATE bookings SET status='cancelled', payment_status='failed' WHERE id=?").run(booking_id);
        return res.status(402).json({ error: desc });
      }
    } catch (e) {
      console.error('MaishaPay v3 erreur réseau:', e.message);
      return res.status(503).json({ error: 'Service carte indisponible. Essayez Mobile Money.' });
    }
  }

  return res.status(400).json({ error: 'Méthode de paiement non reconnue : cash | mobilemoney | card' });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/public/callback/mobilemoney
// MaishaPay appelle cette URL quand le client a saisi son PIN
// Corps JSON : { status_code, transactionStatus, originatingTransactionId, transactionId, ... }
// ═══════════════════════════════════════════════════════════════
router.post('/callback/mobilemoney', (req, res) => {
  try {
    const body        = req.body;
    const status_code = String(body?.status_code || body?.statusCode || '');
    const txStatus    = (body?.transactionStatus || '').toUpperCase().trim();
    const ref         = body?.originatingTransactionId || body?.transactionRefId || '';
    const txId        = String(body?.transactionId || ref);

    console.log(`📲 Callback MM v2 — ref: ${ref} | status: ${status_code} | ${txStatus}`);

    const db      = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE reference=?').get(ref);

    if (!booking) {
      console.error(`Callback MM — réservation introuvable pour référence: ${ref}`);
      return res.status(200).json({ received: true }); // toujours 200 pour MaishaPay
    }

    if (booking.payment_status === 'completed') {
      return res.status(200).json({ received: true }); // déjà traitée
    }

    if (status_code === '200' || txStatus === 'SUCCESS') {
      const rate              = booking.commission_rate || 10;
      const commission_amount = Math.round(booking.total_price * rate / 100);
      db.prepare(`UPDATE bookings SET status='confirmed', payment_status='completed',
        transaction_id=?, commission_rate=?, commission_amount=? WHERE reference=?`)
        .run(txId, rate, commission_amount, ref);
      console.log(`✅ MM v2 CONFIRMÉ — ${ref} | ${booking.total_price} CDF | commission: ${commission_amount} FC`);

    } else if (status_code === '400' || txStatus === 'FAILED') {
      // Remettre les places disponibles
      db.prepare("UPDATE bookings SET status='cancelled', payment_status='failed' WHERE reference=?").run(ref);
      db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
      console.log(`❌ MM v2 ÉCHOUÉ — ${ref} | client n'a pas validé ou fonds insuffisants`);
    }
    // Si PENDING → on ne fait rien, on attend le prochain callback

    res.status(200).json({ received: true }); // MaishaPay attend toujours un 200
  } catch (e) {
    console.error('Erreur callback MM:', e.message);
    res.status(200).json({ received: true }); // Toujours 200 pour ne pas bloquer MaishaPay
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/public/callback/card
// MaishaPay appelle cette URL après paiement CyberSource
// Query params: ?status=200&description=APPROVED&transactionRefId=XXXX&operatorRefId=1234
// ═══════════════════════════════════════════════════════════════
router.get('/callback/card', (req, res) => {
  try {
    const { status, description, transactionRefId, operatorRefId } = req.query;
    const ref  = transactionRefId || '';
    const txId = operatorRefId    || ref;

    console.log(`💳 Callback Card v3 — ref: ${ref} | status: ${status} | ${description}`);

    const db      = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE reference=?').get(ref);

    if (!booking) {
      console.error(`Callback Card — réservation introuvable pour référence: ${ref}`);
      // Rediriger vers la page d'accueil quand même
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nzela.cd'}/?payment=notfound`);
    }

    if (String(status) === '200' || description === 'APPROVED') {
      if (booking.payment_status !== 'completed') {
        const rate              = booking.commission_rate || 10;
        const commission_amount = Math.round(booking.total_price * rate / 100);
        db.prepare(`UPDATE bookings SET status='confirmed', payment_status='completed',
          transaction_id=?, commission_rate=?, commission_amount=? WHERE reference=?`)
          .run(txId, rate, commission_amount, ref);
        console.log(`✅ Card v3 APPROUVÉE — ${ref} | commission: ${commission_amount} FC`);
      }
      // Rediriger vers la page de succès avec la référence
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nzela.cd'}/?payment=success&ref=${ref}`);

    } else if (description === 'CANCELED') {
      db.prepare("UPDATE bookings SET status='cancelled', payment_status='cancelled' WHERE reference=? AND payment_status!='completed'").run(ref);
      db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
      console.log(`↩️ Card v3 ANNULÉE — ${ref}`);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nzela.cd'}/?payment=cancelled&ref=${ref}`);

    } else {
      // DECLINED ou autre
      db.prepare("UPDATE bookings SET status='cancelled', payment_status='failed' WHERE reference=? AND payment_status!='completed'").run(ref);
      db.prepare('UPDATE trips SET available_seats=available_seats+? WHERE id=?').run(booking.passengers||1, booking.trip_id);
      console.log(`❌ Card v3 REFUSÉE — ${ref} | ${description}`);
      return res.redirect(`${process.env.FRONTEND_URL || 'https://nzela.cd'}/?payment=failed&ref=${ref}`);
    }
  } catch (e) {
    console.error('Erreur callback Card:', e.message);
    return res.redirect(`${process.env.FRONTEND_URL || 'https://nzela.cd'}/?payment=error`);
  }
});
router.post('/contribute', async (req, res) => {
  const { contributor_name, amount, currency, operator, phone_number, message } = req.body;
  if (!amount || !operator || !phone_number)
    return res.status(400).json({ error: 'Montant, opérateur et numéro requis' });

  const isLive    = process.env.MAISHAPAY_MODE === 'live';
  const publicKey = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;

 const payload = {
  transactionReference: booking.reference,
  gatewayMode,
  publicApiKey:  publicKey,
  secretApiKey:  secretKey,
  amount:        booking.total_price,
  currency:      'CDF',
  chanel:        'MOBILEMONEY',
  provider: PROVIDER_MAP[operator.toUpperCase()] || operator.toUpperCase(), // ← était hardcodé 'MPESA'
  walletID:      phone_number,
};

  try {
    const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/payment/rest/vers1.0/merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d    = await r.json();
    const data = d?.data || d;
    const code = String(data?.statusCode || '');

    if (code === '200' || data?.status === 'APPROVED') {
      console.log(`💚 Contribution reçue — ${contributor_name || 'Anonyme'} | ${amount} ${currency}`);
      return res.json({ success: true, message: 'Merci pour votre contribution !' });
    } else {
      const desc = data?.transactionDescription || data?.statusDescription || 'Paiement refusé';
      return res.status(402).json({ error: desc });
    }
  } catch (e) {
    console.error('Contribution erreur:', e.message);
    return res.status(503).json({ error: 'Service indisponible' });
  }
});

router.post('/card-checkout', async (req, res) => {
  const { amount, currency, reference, nom } = req.body;
  if (!amount || !currency) return res.status(400).json({ error: 'Montant et devise requis' });

  const isLive    = process.env.MAISHAPAY_MODE === 'live';
  const publicKey = isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY;
  const secretKey = isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY : process.env.MAISHAPAY_SANDBOX_SECRET_KEY;
  const BASE_URL  = process.env.API_BASE_URL || 'https://nzela-production-086a.up.railway.app';

  const amountUSD = currency === 'USD'
    ? parseFloat(amount)
    : Math.max(1, +(parseFloat(amount) / (parseFloat(process.env.CDF_TO_USD_RATE) || 2800)).toFixed(2));

  const nomParts = (nom || 'Supporter Nzela').trim().split(' ');
  const firstname = nomParts[0] || 'Supporter';
  const lastname  = nomParts.slice(1).join(' ') || 'Nzela';

  const payload = {
    transactionReference: reference || ('CONTRIB-' + Date.now()),
    gatewayMode:  isLive ? '1' : '0',
    publicApiKey: publicKey,
    secretApiKey: secretKey,
    order: {
      amount:              String(amountUSD),
      currency:            'USD',
      customerFirstname:   firstname,
      customerLastname:    lastname,
      customerAddress:     'Kinshasa',
      customerCity:        'Kinshasa',
      customerPhoneNumber: '+243800000000',
      customerEmailAdress: 'contrib@nzela.cd',
    },
    paymentChannel: {
      channel:     'CARD',
      provider:    'VISA',
      callbackUrl: `${BASE_URL}/api/public/callback/card`,
    },
  };

  try {
    const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/collect/v3/store/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    console.log('card-checkout MaishaPay response:', JSON.stringify(d));
    const code = String(d?.status_code || d?.statusCode || '');

    if (code === '202' && d?.paymentPage) {
      return res.json({ success: true, paymentPage: d.paymentPage, reference });
    } else {
      const desc = d?.transactionDescription || d?.message || 'Initialisation carte échouée';
      return res.status(402).json({ error: desc });
    }
  } catch (e) {
    console.error('card-checkout erreur:', e.message);
    return res.status(503).json({ error: 'Service carte indisponible.' });
  }
});
module.exports = router;
