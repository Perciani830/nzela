const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');
const { notifyNewBooking, notifyPaymentConfirmed } = require('../mailer');

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
    const payload = {
      gatewayMode:          isLive ? 1 : 0,
      publicApiKey:         isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY   : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
      secretApiKey:         isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY   : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
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
// ═══════════════════════════════════════════════════════════════
// CONTRIBUTION — À coller dans backend/routes/public.js
// AVANT la ligne : module.exports = router;
// ═══════════════════════════════════════════════════════════════
//
// DIFFÉRENCES vs paiement billet pour le dashboard MaishaPay :
//   Billet  → reference: "BUS-XXXXXXXX"  | description: "Billet bus Kinshasa→Matadi"
//   Contrib → reference: "CONTRIB-XXXX-TIMESTAMP" | description: "Contribution Nzela - [Nom]"
//
// Ces préfixes distincts permettent de filtrer facilement dans
// le tableau de bord MaishaPay et dans les exports.
// ═══════════════════════════════════════════════════════════════

router.post('/contribute', async (req, res) => {
  const { contributor_name, phone_number, operator, amount, currency, message } = req.body;

  // ── Validation ──────────────────────────────────────────────
  const montant = parseFloat(amount);
  if (!montant || isNaN(montant)) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (currency === 'CDF' && montant < 500) {
    return res.status(400).json({ error: 'Montant minimum : 500 FC.' });
  }
  if (currency === 'USD' && montant < 1) {
    return res.status(400).json({ error: 'Montant minimum : 1 USD.' });
  }
  if (!operator || !phone_number) {
    return res.status(400).json({ error: 'Opérateur et numéro requis.' });
  }
  const devise = (currency === 'USD') ? 'USD' : 'CDF';

  // ── Référence unique — préfixe CONTRIB (distinct des billets BUS-) ──
  const reference = 'CONTRIB-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Date.now();
  const nom       = (contributor_name && contributor_name.trim()) ? contributor_name.trim() : 'Anonyme';

  // ── Appel MaishaPay ─────────────────────────────────────────
  const isLive = process.env.MAISHAPAY_MODE === 'live';
  const payload = {
    gatewayMode:          isLive ? 1 : 0,
    publicApiKey:         isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
    secretApiKey:         isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
    transactionReference: reference,           // ← "CONTRIB-XXXX-..." visible dans MaishaPay
    amount:               montant,
    currency:             devise,
    chanel:               'MOBILEMONEY',
    provider:             operator.toUpperCase(),
    walletID:             phone_number,
    customerName:         nom,                 // ← nom visible dans MaishaPay
    customerPhone:        phone_number,
    description:          `Contribution Nzela - ${nom}`, // ← distinct de "Billet bus ..."
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

    if (!orig || !orig.data || !['202','200'].includes(String(orig.data.statusCode))) {
      return res.status(402).json({
        error: orig?.data?.statusDescription || 'Paiement refusé. Vérifiez votre solde.'
      });
    }

    const txId = orig.data.transactionId || reference;

    // ── Enregistrement en DB ────────────────────────────────
    const db = getDb();
    runTransaction(db, () => {
      db.prepare(`
        INSERT INTO contributions
          (id, reference, contributor_name, phone, operator, amount, currency, transaction_id, message, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `).run(
        uuidv4(), reference, nom, phone_number,
        operator.toUpperCase(), montant, devise,
        txId, message || null
      );
    });

    // ── Message de succès personnalisé ──────────────────────
    const montantFormate = devise === 'USD'
      ? `${montant} $`
      : `${Math.round(montant).toLocaleString()} FC`;

    return res.json({
      ok:             true,
      reference,
      transaction_id: txId,
      amount:         montant,
      currency:       devise,
      contributor:    nom,
      message:        nom === 'Anonyme'
        ? `Merci pour votre contribution de ${montantFormate} ! Nzela grandit grâce à des personnes comme vous. 💚`
        : `Merci ${nom} pour votre contribution de ${montantFormate} ! Votre soutien compte énormément pour toute l'équipe Nzela. 💚`,
    });

  } catch (e) {
    console.error('Contribution error:', e.message);
    return res.status(503).json({ error: 'Service de paiement indisponible. Réessayez plus tard.' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// COLLER CES 2 ROUTES dans backend/routes/public.js
// JUSTE AVANT la ligne : module.exports = router;
// ═══════════════════════════════════════════════════════════════════

// ── ÉTAPE 1 : Préparer le checkout carte ────────────────────────────
// Le frontend reçoit les params et soumet un formulaire vers MaishaPay
router.post('/card-checkout', (req, res) => {
  const { amount, currency, type, reference, nom } = req.body;
  // type = 'contribution' ou 'booking'

  if (!amount || !currency || !type || !reference) {
    return res.status(400).json({ error: 'Paramètres manquants.' });
  }

  const isLive     = process.env.MAISHAPAY_MODE === 'live';
  const frontendUrl = 'https://nzela-rust.vercel.app';

  // URL de callback serveur → Railway reçoit la confirmation MaishaPay
  const callbackUrl = `https://nzela-production-086a.up.railway.app/api/public/card-callback?type=${type}&ref=${reference}`;

  // MaishaPay redirige l'utilisateur ici après paiement
  const successUrl = `${frontendUrl}/paiement-succes?ref=${reference}&type=${type}`;
  const failureUrl = `${frontendUrl}/paiement-echec?ref=${reference}&type=${type}`;

  return res.json({
    checkoutUrl:   'https://marchand.maishapay.online/payment/vers1.0/merchant/checkout',
    gatewayMode:   isLive ? 1 : 0,
    publicApiKey:  isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
    secretApiKey:  isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
    montant:       String(amount),
    devise:        currency,                // CDF, USD
    transactionReference: reference,        // visible dans dashboard MaishaPay
    customerName:  nom || 'Client Nzela',
    callbackUrl,
    successUrl,
    failureUrl,
  });
});

// ── ÉTAPE 2 : Callback serveur-à-serveur MaishaPay ──────────────────
// MaishaPay appelle cette URL après le paiement carte (POST)
router.post('/card-callback', (req, res) => {
  const { type, ref } = req.query;
  const body = req.body;

  // MaishaPay envoie les détails de la transaction
  const statusCode = body?.data?.statusCode || body?.statusCode;
  const txId       = body?.data?.transactionId || body?.transactionId || ref;
  const success    = ['200', '202', 200, 202].includes(statusCode) || body?.status === 'SUCCESS';

  try {
    const db = getDb();

    if (type === 'contribution') {
      // Marquer la contribution comme complétée
      db.prepare(`
        UPDATE contributions SET status=?, transaction_id=? WHERE reference=?
      `).run(success ? 'completed' : 'failed', txId, ref);

    } else if (type === 'booking') {
      if (success) {
        // Récupérer la réservation
        const booking = db.prepare('SELECT * FROM bookings WHERE reference=?').get(ref);
        if (booking) {
          const rate             = booking.commission_rate || 10;
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

    // Réponse obligatoire pour MaishaPay
    return res.json({ status: '1' });

  } catch (e) {
    console.error('Card callback error:', e.message);
    return res.json({ status: '1' }); // toujours répondre 1 pour éviter les retries
  }
});
module.exports = router;
