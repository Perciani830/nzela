const { Resend } = require('resend');

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY manquante — emails désactivés');
    return null;
  }
  console.log('✅ Resend client initialisé');
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = 'Nzela RDC <onboarding@resend.dev>';

async function notifyNewBooking({ agencyEmail, agencyName, booking, trip }) {
  const client = getClient();
  if (!client || !agencyEmail) {
    console.log(`⚠️ Email non envoyé — client: ${!!client}, agencyEmail: ${agencyEmail}`);
    return;
  }
  console.log(`📤 Envoi email à ${agencyEmail}...`);
  try {
    await client.emails.send({
      from: FROM,
      to: agencyEmail,
      subject: `🎟️ Nouvelle réservation — ${booking.reference}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#050E17;color:#E8F4ED;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#2A7D4F,#52C882);padding:20px 24px">
            <h2 style="margin:0;color:#fff;font-size:20px">🚌 Nzela — Nouvelle réservation</h2>
          </div>
          <div style="padding:24px">
            <p style="color:#a0b8a8;margin-bottom:4px">Agence</p>
            <p style="font-size:18px;font-weight:700;margin:0 0 16px">${agencyName}</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Référence</td>
                  <td style="padding:8px 0;font-weight:700;color:#52C882">${booking.reference}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Passager</td>
                  <td style="padding:8px 0;font-weight:600">${booking.passenger_name}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Téléphone</td>
                  <td style="padding:8px 0">${booking.passenger_phone}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Trajet</td>
                  <td style="padding:8px 0;font-weight:600">${trip.departure_city} → ${trip.arrival_city}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Date départ</td>
                  <td style="padding:8px 0">${trip.departure_date} à ${trip.departure_time}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Places</td>
                  <td style="padding:8px 0">${booking.passengers} passager(s)</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Montant total</td>
                  <td style="padding:8px 0;font-size:18px;font-weight:800;color:#F5A623">${Number(booking.total_price).toLocaleString('fr-FR')} FC</td></tr>
            </table>
            <div style="margin-top:20px;padding:12px 16px;background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.25);border-radius:8px">
              <p style="margin:0;font-size:13px;color:#F5A623">⏳ Statut : <strong>En attente de paiement</strong></p>
              <p style="margin:6px 0 0;font-size:12px;color:#a0b8a8">Connectez-vous à votre dashboard pour confirmer ou annuler.</p>
            </div>
          </div>
          <div style="padding:14px 24px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#a0b8a8;text-align:center">
            © 2026 Nzela · Kinshasa, RDC · support@nzela.cd
          </div>
        </div>
      `,
    });
    console.log(`📧 Email envoyé à ${agencyEmail} — réservation ${booking.reference}`);
  } catch(e) {
    console.error('Resend booking error:', e.message);
  }
}

async function notifyPaymentConfirmed({ agencyEmail, agencyName, booking, trip, commission }) {
  const client = getClient();
  if (!client || !agencyEmail) return;
  try {
    await client.emails.send({
      from: FROM,
      to: agencyEmail,
      subject: `✅ Paiement reçu — ${booking.reference}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#050E17;color:#E8F4ED;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#2A7D4F,#52C882);padding:20px 24px">
            <h2 style="margin:0;color:#fff;font-size:20px">✅ Paiement confirmé</h2>
          </div>
          <div style="padding:24px">
            <p style="color:#a0b8a8;margin-bottom:4px">Agence</p>
            <p style="font-size:18px;font-weight:700;margin:0 0 16px">${agencyName}</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Référence</td>
                  <td style="padding:8px 0;font-weight:700;color:#52C882">${booking.reference}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Passager</td>
                  <td style="padding:8px 0;font-weight:600">${booking.passenger_name}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Trajet</td>
                  <td style="padding:8px 0;font-weight:600">${trip.departure_city} → ${trip.arrival_city}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Date départ</td>
                  <td style="padding:8px 0">${trip.departure_date} à ${trip.departure_time}</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Montant payé</td>
                  <td style="padding:8px 0;font-size:18px;font-weight:800;color:#F5A623">${Number(booking.total_price).toLocaleString('fr-FR')} FC</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Commission Nzela</td>
                  <td style="padding:8px 0;color:#F05050">-${Number(commission).toLocaleString('fr-FR')} FC</td></tr>
              <tr><td style="padding:8px 0;color:#a0b8a8;font-size:13px">Votre net</td>
                  <td style="padding:8px 0;font-size:16px;font-weight:800;color:#52C882">${Number(booking.total_price - commission).toLocaleString('fr-FR')} FC</td></tr>
            </table>
            <div style="margin-top:20px;padding:12px 16px;background:rgba(61,170,106,0.1);border:1px solid rgba(61,170,106,0.25);border-radius:8px">
              <p style="margin:0;font-size:13px;color:#52C882">✅ Statut : <strong>Réservation confirmée</strong></p>
              <p style="margin:6px 0 0;font-size:12px;color:#a0b8a8">Le passager présentera sa référence à l'embarquement.</p>
            </div>
          </div>
          <div style="padding:14px 24px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#a0b8a8;text-align:center">
            © 2026 Nzela · Kinshasa, RDC · support@nzela.cd
          </div>
        </div>
      `,
    });
    console.log(`📧 Email paiement envoyé à ${agencyEmail} — ${booking.reference}`);
  } catch(e) {
    console.error('Resend payment error:', e.message);
  }
}

module.exports = { notifyNewBooking, notifyPaymentConfirmed };