const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, runTransaction } = require('../db/database');
const { notifyNewBooking, notifyPaymentConfirmed } = require('../mailer');

const BACKEND_URL  = 'https://nzela-production-086a.up.railway.app/api';
const FRONTEND_URL = 'https://nzela-rust.vercel.app';

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUS-' + Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

function getMaishaKeys(isLive) {
  return {
    public: isLive ? process.env.MAISHAPAY_LIVE_PUBLIC_KEY  : process.env.MAISHAPAY_SANDBOX_PUBLIC_KEY,
    secret: isLive ? process.env.MAISHAPAY_LIVE_SECRET_KEY  : process.env.MAISHAPAY_SANDBOX_SECRET_KEY,
    mode:   isLive ? 1 : 0,
  };
}

// ── GET /trips ─────────────────────────────────────────────────
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
  `;
  const p = [];
  if (from) { q += ' AND LOWER(t.departure_city) LIKE ?'; p.push('%' + from.toLowerCase() + '%'); }
  if (to)   { q += ' AND LOWER(t.arrival_city) LIKE ?';   p.push('%' + to.toLowerCase() + '%'); }
  if (date) { q += ' AND t.departure_date = ?';            p.push(date); }
  q += ' ORDER BY a.note DESC, t.price ASC, t.departure_time ASC';
  try { res.json(db.prepare(q).all(...p)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /gallery ───────────────────────────────────────────────
router.get('/gallery', (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM gallery WHERE is_active=1 ORDER BY sort_order ASC').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /book ─────────────────────────────────────────────────
router.post('/book', (req, res) => {
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

    notifyNewBooking({
      agencyEmail: trip.agency_email, agencyName: trip.agency_name,
      booking: { reference:ref, passenger_name:name, passenger_phone:phone, passengers:seats, total_price:total },
      trip,
    }).catch(e => console.error('❌ notifyNewBooking:', e.message));

    res.status(201).json({ booking_id: id, reference: ref, total_price: total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /pay — Mobile Money v2 ────────────────────────────────
// Lance le paiement → MaishaPay envoie notif au téléphone
// La confirmation arrive via /mm-callback
router.post('/pay', async (req, res) => {
  const { booking_id, payment_method, operator, phone_number } = req.body;
  if (!booking_id) return res.status(400).json({ error: 'ID réservation requis' });

  const db      = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(booking_id);
  if (!booking)                                   return res.status(404).json({ error: 'Réservation introuvable' });
  if (booking.payment_status === 'completed')     return res.status(400).json({ error: 'Déjà payée' });

  const rate              = booking.commission_rate || 10;
  const commission_amount = Math.round(booking.total_price * rate / 100);
  const net_agency        = booking.total_price - commission_amount;

  // ── Paiement cash ──────────────────────────────────────────
  if (payment_method === 'cash') {
    const txId = 'CASH-' + Date.now();
    runTransaction(db, () => {
      db.prepare(`
        UPDATE bookings SET status='confirmed', payment_status='completed',
          payment_method=?, transaction_id=?, commission_rate=?, commission_amount=? WHERE id=?
      `).run(payment_method, txId, rate, commission_amount, booking_id);
    });
    return res.json({ success: true, transaction_id: txId, reference: booking.reference, commission: commission_amount, net_agency });
  }

  // ── Paiement Mobile Money v2 ───────────────────────────────
  if (!operator || !phone_number) return res.status(400).json({ error: 'Opérateur et numéro requis' });

  const isLive = process.env.MAISHAPAY_MODE === 'live';
  const keys   = getMaishaKeys(isLive);

  // Formater le numéro en international +243XXXXXXXXX
  const walletID = phone_number.replace(/\D/g,'').replace(/^0/, '+243');

  const payload = {
    transactionReference: booking.reference,
    gatewayMode:          keys.mode,
    publicApiKey:         keys.public,
    secretApiKey:         keys.secret,
    order: {
      amount:           booking.total_price,
      currency:         'CDF',
      customerFullName: booking.passenger_name,
    },
    paymentChannel: {
      channel:     'MOBILEMONEY',
      provider:    operator.toUpperCase(),
      walletID,
      callbackUrl: `${BACKEND_URL}/public/mm-callback?type=booking&id=${booking_id}`,
    },
  };

  try {
    const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/collect/v2/store/mobileMoney', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();

    // 202 = PENDING = envoyé au téléphone ✅
    if (d.status_code === 202 || d.transactionStatus === 'PENDING') {
      const txId = d.transactionId || booking.reference;
      // Marquer en attente de confirmation callback
      db.prepare(`UPDATE bookings SET transaction_id=? WHERE id=?`).run(txId, booking_id);
      return res.json({
        success:    true,
        pending:    true, // le frontend affiche "Vérifiez votre téléphone"
        transaction_id: txId,
        reference:  booking.reference,
        message:    'Vérifiez votre téléphone pour confirmer le paiement.',
      });
    }

    // Échec immédiat
    return res.status(402).json({ error: d.transactionStatus || 'Paiement refusé.' });

  } catch(e) {
    return res.status(503).json({ error: 'Service de paiement indisponible. Choisissez paiement espèces.' });
  }
});

// ── POST /mm-callback — Callback MaishaPay Mobile Money v2 ─────
// MaishaPay appelle cette URL (POST) quand le paiement est confirmé ou échoué
router.post('/mm-callback', (req, res) => {
  const { type, id } = req.query; // type=booking|contribution, id=booking_id|reference
  const body = req.body;

  console.log('📞 MM Callback reçu:', JSON.stringify(body));

  const statusCode = body?.status_code || body?.statusCode;
  const txStatus   = body?.transactionStatus || '';
  const txId       = body?.transactionId || id;
  const success    = statusCode === 200 || txStatus === 'SUCCESS';
  const failed     = statusCode === 400 || txStatus === 'FAILED';

  try {
    const db = getDb();

    if (type === 'booking' && id) {
      const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
      if (booking && booking.payment_status !== 'completed') {
        if (success) {
          const rate              = booking.commission_rate || 10;
          const commission_amount = Math.round(booking.total_price * rate / 100);
          runTransaction(db, () => {
            db.prepare(`
              UPDATE bookings SET status='confirmed', payment_status='completed',
                payment_method='mobilemoney', transaction_id=?, commission_rate=?, commission_amount=?
              WHERE id=?
            `).run(txId, rate, commission_amount, id);
          });

          // Notifier l'agence
          const tripInfo = db.prepare(`
            SELECT t.departure_city, t.arrival_city, t.departure_date, t.departure_time,
                   a.email agency_email, a.agency_name
            FROM bookings b JOIN trips t ON b.trip_id=t.id JOIN agencies a ON b.agency_id=a.id
            WHERE b.id=?
          `).get(id);
          if (tripInfo) {
            notifyPaymentConfirmed({
              agencyEmail: tripInfo.agency_email, agencyName: tripInfo.agency_name,
              booking, trip: tripInfo, commission: commission_amount,
            }).catch(e => console.error('❌ notifyPaymentConfirmed:', e.message));
          }
        } else if (failed) {
          db.prepare(`UPDATE bookings SET payment_status='failed' WHERE id=?`).run(id);
        }
      }
    }

    if (type === 'contribution' && id) {
      if (success) {
        db.prepare(`UPDATE contributions SET status='completed', transaction_id=? WHERE reference=?`).run(txId, id);
      } else if (failed) {
        db.prepare(`UPDATE contributions SET status='failed' WHERE reference=?`).run(id);
      }
    }

    return res.json({ status: '1' }); // réponse obligatoire pour MaishaPay
  } catch(e) {
    console.error('MM callback error:', e.message);
    return res.json({ status: '1' });
  }
});

// ── GET /pay-status — Frontend poll pour connaître le statut ───
// Le frontend peut appeler cette route toutes les 3s pour savoir si confirmé
router.get('/pay-status', (req, res) => {
  const { booking_id } = req.query;
  if (!booking_id) return res.status(400).json({ error: 'booking_id requis' });
  try {
    const db = getDb();
    const b  = db.prepare('SELECT payment_status, status, transaction_id, reference FROM bookings WHERE id=?').get(booking_id);
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    return res.json({
      payment_status: b.payment_status, // pending | completed | failed
      status:         b.status,
      transaction_id: b.transaction_id,
      reference:      b.reference,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /contribute — Contribution Mobile Money v2 ────────────
router.post('/contribute', async (req, res) => {
  const { contributor_name, phone_number, operator, amount, currency, message } = req.body;

  const montant = parseFloat(amount);
  if (!montant || isNaN(montant))          return res.status(400).json({ error: 'Montant invalide.' });
  if (currency === 'CDF' && montant < 500) return res.status(400).json({ error: 'Montant minimum : 500 FC.' });
  if (currency === 'USD' && montant < 1)   return res.status(400).json({ error: 'Montant minimum : 1 USD.' });
  if (!operator || !phone_number)          return res.status(400).json({ error: 'Opérateur et numéro requis.' });

  const devise    = currency === 'USD' ? 'USD' : 'CDF';
  const reference = 'CONTRIB-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Date.now();
  const nom       = (contributor_name && contributor_name.trim()) ? contributor_name.trim() : 'Anonyme';
  const isLive    = process.env.MAISHAPAY_MODE === 'live';
  const keys      = getMaishaKeys(isLive);
  const walletID  = phone_number.replace(/\D/g,'').replace(/^0/, '+243');

  const payload = {
    transactionReference: reference,
    gatewayMode:          keys.mode,
    publicApiKey:         keys.public,
    secretApiKey:         keys.secret,
    order: {
      amount:           montant,
      currency:         devise,
      customerFullName: nom,
    },
    paymentChannel: {
      channel:     'MOBILEMONEY',
      provider:    operator.toUpperCase(),
      walletID,
      callbackUrl: `${BACKEND_URL}/public/mm-callback?type=contribution&id=${reference}`,
    },
  };

  try {
    const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
    const r = await fetch('https://marchand.maishapay.online/api/collect/v2/store/mobileMoney', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();

    if (d.status_code === 202 || d.transactionStatus === 'PENDING') {
      const txId = d.transactionId || reference;

      // Enregistrer en pending — sera mis à jour par le callback
      const db = getDb();
      runTransaction(db, () => {
        db.prepare(`
          INSERT INTO contributions
            (id, reference, contributor_name, phone, operator, amount, currency, transaction_id, message, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `).run(uuidv4(), reference, nom, phone_number, operator.toUpperCase(), montant, devise, txId, message || null);
      });

      const montantFormate = devise === 'USD' ? `${montant} $` : `${Math.round(montant).toLocaleString()} FC`;
      return res.json({
        ok:             true,
        pending:        true,
        reference,
        transaction_id: txId,
        message:        `Vérifiez votre téléphone et confirmez le paiement de ${montantFormate}. Merci ${nom === 'Anonyme' ? '' : nom + ' '}pour votre soutien ! 💚`,
      });
    }

    return res.status(402).json({ error: d.transactionStatus || 'Paiement refusé. Vérifiez votre solde.' });

  } catch(e) {
    console.error('Contribution error:', e.message);
    return res.status(503).json({ error: 'Service de paiement indisponible. Réessayez plus tard.' });
  }
});

// ── POST /card-checkout — Carte v3 (redirection CyberSource) ───
router.post('/card-checkout', async (req, res) => {
  const { amount, currency, type, reference, nom } = req.body;
  if (!amount || !currency || !type || !reference) {
    return res.status(400).json({ error: 'Paramètres manquants.' });
  }

  const isLive = process.env.MAISHAPAY_MODE === 'live';
  const keys   = getMaishaKeys(isLive);

  const payload = {
    transactionReference: reference,
    gatewayMode:          keys.mode,
    publicApiKey:         keys.public,
    secretApiKey:         keys.secret,
    order: {
      amount:            parseFloat(amount),
      currency:          currency,
      customerFirstname: (nom || 'Client').split(' ')[0],
      customerLastname:  (nom || 'Nzela').split(' ').slice(1).join(' ') || 'Nzela',
    },
    paymentChannel: {
      callbackUrl: `${FRONTEND_URL}/paiement-succes?ref=${reference}&type=${type}`,
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

    if (d.status_code === 202 && d.paymentPage) {
      return res.json({ paymentPage: d.paymentPage, transactionId: d.transactionId });
    }
    return res.status(402).json({ error: d.transactionDescription || 'Erreur paiement carte.' });

  } catch(e) {
    return res.status(503).json({ error: 'Service indisponible.' });
  }
});

// ── GET /card-callback — Callback carte v3 (GET depuis CyberSource) ─
router.get('/card-callback', (req, res) => {
  const { status, description, transactionRefId } = req.query;
  const success = status === '200' || description === 'APPROVED';

  try {
    const db = getDb();
    if (transactionRefId) {
      // Chercher si c'est une contribution ou un billet
      const contrib = db.prepare('SELECT * FROM contributions WHERE reference=?').get(transactionRefId);
      if (contrib) {
        db.prepare(`UPDATE contributions SET status=? WHERE reference=?`)
          .run(success ? 'completed' : 'failed', transactionRefId);
      }
      const booking = db.prepare('SELECT * FROM bookings WHERE reference=?').get(transactionRefId);
      if (booking && success) {
        const rate              = booking.commission_rate || 10;
        const commission_amount = Math.round(booking.total_price * rate / 100);
        runTransaction(db, () => {
          db.prepare(`
            UPDATE bookings SET status='confirmed', payment_status='completed',
              payment_method='card', commission_rate=?, commission_amount=? WHERE reference=?
          `).run(rate, commission_amount, transactionRefId);
        });
      }
    }
  } catch(e) {
    console.error('Card callback error:', e.message);
  }

  // Rediriger vers la page appropriée
  const redirectUrl = success
    ? `${FRONTEND_URL}/paiement-succes?ref=${transactionRefId}&type=card`
    : `${FRONTEND_URL}/paiement-echec?ref=${transactionRefId}&type=card`;
  return res.redirect(redirectUrl);
});

module.exports = router;