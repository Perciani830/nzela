
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SeatPicker from './SeatPicker';

const API = 'http://localhost:5000/api';

/* ── Pays / opérateurs Mobile Money ─────────────────────────── */
const PAYS = [
  { code:'CD', nom:'🇨🇩 RDC',           flag:'https://flagcdn.com/24x18/cd.png', prefix:'+243', ops:['MPESA','ORANGE','AIRTEL','AFRICEL'] },
  { code:'CG', nom:'🇨🇬 Congo-Brazza',   flag:'https://flagcdn.com/24x18/cg.png', prefix:'+242', ops:['AIRTEL','MTN'] },
  { code:'CM', nom:'🇨🇲 Cameroun',       flag:'https://flagcdn.com/24x18/cm.png', prefix:'+237', ops:['ORANGE','MTN'] },
  { code:'CI', nom:"🇨🇮 Côte d'Ivoire", flag:'https://flagcdn.com/24x18/ci.png', prefix:'+225', ops:['ORANGE','MTN','MOOV'] },
];
const ALL_OPS = {
  MPESA:   { id:'MPESA',   label:'M-Pesa',       logo:'/mpesa.png',    v1:true  },
  ORANGE:  { id:'ORANGE',  label:'Orange Money', logo:'/orange.png',   v1:false },
  AIRTEL:  { id:'AIRTEL',  label:'Airtel',       logo:'/airtel.png',   v1:false },
  AFRICEL: { id:'AFRICEL', label:'Africell',     logo:'/africell.png', v1:false },
  MTN:     { id:'MTN',     label:'MTN',          logo:'/mtn.png',      v1:false },
  MOOV:    { id:'MOOV',    label:'Moov',         logo:'/moov.png',     v1:false },
};
const CARD_PROVIDERS = ['VISA','MASTERCARD','AMERICAN EXPRESS'];

function formatPhone(raw, prefix) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const prefixDigits = prefix.replace('+', '');
  if (digits.startsWith(prefixDigits)) return '+' + digits;
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return prefix + local;
}
function validatePhone(formatted) {
  return /^\+\d{10,}$/.test(formatted);
}

/* ── Étapes ────────────────────────────────────────────────────
 *  0 = Informations
 *  1 = Sièges
 *  2 = Passagers supplémentaires
 *  3 = Politique d'annulation
 *  4 = Paiement
 *  5 = Résultat
 * ──────────────────────────────────────────────────────────── */
const STEP_LABELS = ['Infos', 'Sièges', 'Passagers', 'Annulation', 'Paiement'];

export default function BookingModal({ trip, onClose, onSuccess, showToast }) {
  /* ── State principal ─────────────────────────────────────── */
  const [step,          setStep]          = useState(0);
  const [form,          setForm]          = useState({
    name: '', phone: '', email: '',
    passengers:     1,  // passagers payants (adultes + enfants ≥ 10 ans)
    children_free:  0,  // enfants < 10 ans (gratuits, pas de siège dédié)
  });
  const [selectedSeats,    setSelectedSeats]    = useState([]);
  const [extraPassengers,  setExtraPassengers]  = useState([]); // [{name, is_child}]
  const [seatsData,        setSeatsData]        = useState(null);
  const [seatsLoading,     setSeatsLoading]     = useState(false);
  const [pay,              setPay]              = useState({ method:'', operator:'', wallet:'' });
  const [cardInfo,         setCardInfo]         = useState({
    firstname:'', lastname:'', address:'Kinshasa', city:'Kinshasa',
    phone:'', email:'', provider:'VISA',
  });
  const [accepted,  setAccepted]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [booking,   setBooking]   = useState(null);
  const [result,    setResult]    = useState(null);
  const [pays,      setPays]      = useState('CD');

  const paysInfo    = PAYS.find(p => p.code === pays);
  const OPS         = paysInfo.ops.map(id => ALL_OPS[id]).filter(Boolean);
  const sessionToken = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  /* ── Polling paiement ────────────────────────────────────── */
  const pollRef     = useRef(null);
  const pollTimeout = useRef(null);
  const pollCount   = useRef(0);
  const MAX_POLLS   = 40;

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearTimeout(pollTimeout.current);
      // Libérer sièges temporaires si fermeture sans paiement
      if (selectedSeats.length > 0 && !result?.type === 'confirmed') {
        axios.delete(`${API}/trips/${trip.id}/seats/reserve`, {
          data: { session_token: sessionToken.current }
        }).catch(() => {});
      }
    };
  }, []);

  const stopPolling = () => {
    clearInterval(pollRef.current);
    clearTimeout(pollTimeout.current);
    pollRef.current = pollTimeout.current = null;
  };

  const startPolling = (bookingId) => {
    stopPolling();
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current++;
      try {
        const r = await axios.get(`${API}/public/booking-status/${bookingId}`);
        const { status, payment_status, reference } = r.data;
        if (payment_status === 'completed' && status === 'confirmed') {
          stopPolling();
          setResult({ type:'confirmed', reference });
          onSuccess?.();
        } else if (status === 'cancelled') {
          stopPolling();
          setResult({ type:'error', message:"Paiement refusé ou annulé par l'opérateur." });
        } else if (pollCount.current >= MAX_POLLS) {
          stopPolling();
          setResult({ type:'error', message:'Délai dépassé. Si vous avez été débité, contactez le support.' });
        }
      } catch {}
    }, 3000);
  };

  /* ── Charger les sièges quand on arrive à l'étape 1 ─────── */
  useEffect(() => {
    if (step !== 1) return;
    setSeatsLoading(true);
    axios.get(`${API}/trips/${trip.id}/seats`)
      .then(r => setSeatsData(r.data))
      .catch(() => showToast('Impossible de charger le plan des sièges', 'error'))
      .finally(() => setSeatsLoading(false));
  }, [step]);

  /* ── Initialiser les passagers supplémentaires ───────────── */
  useEffect(() => {
    const count = form.passengers - 1;
    setExtraPassengers(prev => {
      const next = [...prev];
      while (next.length < count) next.push({ name: '', is_child: false });
      return next.slice(0, count);
    });
  }, [form.passengers]);

  /* ── STEP 0 → 1 : Valider infos ─────────────────────────── */
  const goToSeats = () => {
    if (!form.name.trim()) return showToast('Nom requis', 'error');
    if (!form.phone.trim()) return showToast('Téléphone requis', 'error');
    setStep(1);
  };

  /* ── STEP 1 → 2 : Réserver temporairement les sièges ────── */
  const goToPassengers = async () => {
    if (selectedSeats.length !== form.passengers)
      return showToast(`Sélectionnez ${form.passengers} siège${form.passengers > 1 ? 's' : ''}`, 'error');
    try {
      await axios.post(`${API}/trips/${trip.id}/seats/reserve`, {
        seat_numbers: selectedSeats,
        session_token: sessionToken.current,
      });
    } catch(e) {
      const unavail = e.response?.data?.unavailable || e.response?.data?.failed || [];
      if (unavail.length) {
        showToast(`Sièges ${unavail.join(', ')} pris entre-temps. Veuillez en choisir d'autres.`, 'error');
        // Désélectionner les sièges en conflit
        setSelectedSeats(prev => prev.filter(s => !unavail.includes(s)));
        return;
      }
      return showToast('Erreur lors de la réservation des sièges', 'error');
    }
    // Sauter l'étape passagers si 1 seul passager
    setStep(form.passengers > 1 ? 2 : 3);
  };

  /* ── STEP 3 : Créer la réservation ──────────────────────── */
  const doBook = async () => {
    if (!accepted) return showToast("Acceptez les conditions d'annulation", 'error');
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/book`, {
        trip_id: trip.id,
        name:           form.name,
        phone:          form.phone,
        email:          form.email,
        passengers:     form.passengers,
        children_free:  form.children_free,
        extra_passengers: extraPassengers,
        seat_numbers:   selectedSeats.join(','),
      });
      setBooking(r.data);

      // Assigner les sièges à la réservation créée
      if (selectedSeats.length > 0) {
        try {
          await axios.post(`${API}/trips/${trip.id}/seats/assign`, {
            seat_numbers: selectedSeats,
            booking_id:   r.data.booking_id,
            status:       'reserved',
          });
        } catch {}
      }
      setStep(4);
    } catch(e) {
      showToast(e.response?.data?.error || 'Erreur', 'error');
    } finally { setLoading(false); }
  };

  /* ── STEP 4 : Paiement ───────────────────────────────────── */
  const doPay = async () => {
    if (!pay.method) return showToast('Choisissez un mode de paiement', 'error');
    if (pay.method === 'mobilemoney') {
      if (!pay.operator) return showToast('Choisissez un opérateur', 'error');
      const phoneFormatted = formatPhone(pay.wallet, paysInfo.prefix);
      if (!validatePhone(phoneFormatted))
        return showToast(`Numéro invalide. Format : ${paysInfo.prefix}XXXXXXXXX`, 'error');
      pay._phoneFormatted = phoneFormatted;
    }
    if (pay.method === 'card' && (!cardInfo.phone || !cardInfo.email))
      return showToast('Téléphone et email requis pour la carte', 'error');

    setLoading(true);
    setStep(5);
    try {
      const payload = { booking_id: booking.booking_id, payment_method: pay.method, currency: 'CDF' };
      if (pay.method === 'mobilemoney') {
        payload.operator     = pay.operator;
        payload.phone_number = pay._phoneFormatted;
      }
      if (pay.method === 'card') {
        payload.card_firstname = cardInfo.firstname;
        payload.card_lastname  = cardInfo.lastname;
        payload.card_address   = cardInfo.address;
        payload.card_city      = cardInfo.city;
        payload.card_phone     = cardInfo.phone;
        payload.card_email     = cardInfo.email;
        payload.card_provider  = cardInfo.provider;
      }
      const r = await axios.post(`${API}/public/pay`, payload);
      const data = r.data;

      if (data.status === 'confirmed') {
        setResult({ type:'confirmed', reference: data.reference });
        onSuccess?.();
      } else if (data.status === 'pending') {
        setResult({ type:'pending_pin', reference: data.reference, message: data.message });
        startPolling(booking.booking_id);
      } else if (data.status === 'redirect') {
        setResult({ type:'redirect_card', reference: data.reference, paymentPage: data.payment_page });
        window.open(data.payment_page, '_blank');
        startPolling(booking.booking_id);
      }
    } catch(e) {
      const msg = e.response?.data?.error || 'Erreur de paiement';
      showToast(msg, 'error');
      setResult({ type:'error', message: msg });
    } finally { setLoading(false); }
  };

  /* ── Calculs ─────────────────────────────────────────────── */
  const total      = trip.price * form.passengers; // enfants_free ne paient pas
  const cancelRate = trip.cancel_rate || 20;

  // Données encodées dans le QR code
  const qrData = result?.reference
    ? [
        `NZELA`,
        `REF:${result.reference}`,
        `TRAJET:${trip.departure_city}-${trip.arrival_city}`,
        `DATE:${trip.departure_date}`,
        `HEURE:${trip.departure_time}`,
        `PAX:${form.passengers}`,
        `ENF:${form.children_free}`,
        selectedSeats.length ? `SIEGES:${selectedSeats.join(',')}` : '',
      ].filter(Boolean).join('|')
    : '';

  /* ── Rendu ───────────────────────────────────────────────── */
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="mbox" style={{ maxWidth: 520 }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mhead">
          <h3>
            {step === 0 && 'Vos informations'}
            {step === 1 && 'Choisissez vos sièges'}
            {step === 2 && 'Informations passagers'}
            {step === 3 && "Politique d'annulation"}
            {step === 4 && 'Paiement'}
            {step === 5 && (
              result?.type === 'confirmed'     ? 'Réservation confirmée !' :
              result?.type === 'pending_pin'   ? 'Confirmez sur votre téléphone' :
              result?.type === 'redirect_card' ? 'Paiement carte' :
              result?.type === 'error'         ? 'Paiement échoué' :
              'Traitement en cours…'
            )}
          </h3>
          {!loading && <button className="mclose" onClick={onClose}>×</button>}
        </div>

        <div className="mbody">

          {/* ── Indicateur d'étapes ──────────────────────────── */}
          {step < 5 && (
            <div className="steps">
              {STEP_LABELS.map((s, i) => (
                <div className="step-item" key={i}>
                  <div className={`sdot ${i < step ? 'done' : i === step ? 'act' : 'off'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {i < STEP_LABELS.length - 1 && <div className={`sline${i < step ? ' done' : ''}`} />}
                </div>
              ))}
            </div>
          )}

          {/* ── Récap trajet ─────────────────────────────────── */}
          {step < 5 && (
            <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.15)', borderRadius:10, padding:'9px 12px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{trip.departure_city} → {trip.arrival_city}</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:800, color:'var(--gold)', fontSize:15 }}>{total.toLocaleString('fr-FR')} FC</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>
                  {form.passengers} passager{form.passengers > 1 ? 's' : ''}
                  {form.children_free > 0 ? ` + ${form.children_free} enfant${form.children_free > 1 ? 's' : ''} gratuit${form.children_free > 1 ? 's' : ''}` : ''}
                  {selectedSeats.length > 0 ? ` · Sièges : ${selectedSeats.join(', ')}` : ''}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 0 — Informations
          ══════════════════════════════════════════════════ */}
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="input-group">
                <label className="lbl">Nom complet *</label>
                <input className="field" placeholder="Jean-Baptiste Mukendi"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="g2">
                <div className="input-group">
                  <label className="lbl">Téléphone *</label>
                  <input className="field" placeholder="+243 81 234 5678"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="input-group">
                  <label className="lbl">Email (optionnel)</label>
                  <input className="field" type="email" placeholder="email@exemple.cd"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              {/* Passagers payants */}
              <div className="g2">
                <div className="input-group">
                  <label className="lbl">Passagers payants</label>
                  <select className="field" value={form.passengers}
                    onChange={e => setForm({ ...form, passengers: Number(e.target.value) })}>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n}>{n} passager{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Enfants gratuits */}
                <div className="input-group">
                  <label className="lbl">Enfants &lt; 10 ans (gratuits)</label>
                  <select className="field" value={form.children_free}
                    onChange={e => setForm({ ...form, children_free: Number(e.target.value) })}>
                    {[0,1,2,3,4,5].map(n => (
                      <option key={n} value={n}>{n === 0 ? 'Aucun' : `${n} enfant${n > 1 ? 's' : ''}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info tarif enfants */}
              {form.children_free > 0 && (
                <div style={{ fontSize:12, color:'var(--muted)', background:'rgba(245,166,35,0.07)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:8, padding:'8px 11px', lineHeight:1.6 }}>
                  Les enfants de moins de 10 ans voyagent gratuitement et s'assoient sur les genoux d'un adulte. Les enfants de 10 ans et plus paient le plein tarif.
                </div>
              )}

              {/* Prix total */}
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:'var(--muted)' }}>Total à payer</span>
                <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:17, color:'var(--gold)' }}>
                  {total.toLocaleString('fr-FR')} FC
                </span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 1 — Sièges
          ══════════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              {seatsLoading ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, gap:10, color:'var(--muted)', fontSize:13 }}>
                  <div className="spinner" style={{ width:20, height:20 }} /> Chargement du plan…
                </div>
              ) : seatsData ? (
                <SeatPicker
                  layout={seatsData.layout}
                  totalSeats={seatsData.total_seats}
                  occupiedSeats={seatsData.seats.filter(s => s.status === 'reserved' || s.status === 'confirmed').map(s => s.seat_number)}
                  pendingSeats={seatsData.seats.filter(s => s.status === 'pending').map(s => s.seat_number)}
                  selectedSeats={selectedSeats}
                  onSelect={setSelectedSeats}
                  maxSelect={form.passengers}
                />
              ) : (
                <div style={{ textAlign:'center', padding:30, color:'var(--muted)' }}>
                  Impossible de charger le plan des sièges.
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 2 — Informations passagers supplémentaires
          ══════════════════════════════════════════════════ */}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>
                Renseignez les informations des autres passagers (optionnel mais recommandé pour le manifeste).
              </div>

              {/* Passager principal (rappel) */}
              <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:10, padding:'10px 13px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{form.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>Passager principal · {form.phone}</div>
                </div>
                {selectedSeats[0] && (
                  <span style={{ background:'rgba(61,170,106,0.2)', border:'1px solid rgba(61,170,106,0.4)', borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:800, color:'var(--green-l)', fontFamily:'monospace' }}>
                    {selectedSeats[0]}
                  </span>
                )}
              </div>

              {/* Passagers supplémentaires */}
              {extraPassengers.map((p, i) => (
                <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                      Passager {i + 2}
                    </span>
                    {selectedSeats[i + 1] && (
                      <span style={{ background:'rgba(74,144,217,0.15)', border:'1px solid rgba(74,144,217,0.3)', borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:800, color:'#4A90D9', fontFamily:'monospace' }}>
                        {selectedSeats[i + 1]}
                      </span>
                    )}
                  </div>
                  <div className="g2">
                    <div className="input-group" style={{ margin:0 }}>
                      <label className="lbl">Nom</label>
                      <input className="field" placeholder="Nom complet"
                        value={p.name}
                        onChange={e => {
                          const next = [...extraPassengers];
                          next[i] = { ...next[i], name: e.target.value };
                          setExtraPassengers(next);
                        }} />
                    </div>
                    <div className="input-group" style={{ margin:0 }}>
                      <label className="lbl">Enfant ≥ 10 ans ?</label>
                      <select className="field"
                        value={p.is_child ? 'oui' : 'non'}
                        onChange={e => {
                          const next = [...extraPassengers];
                          next[i] = { ...next[i], is_child: e.target.value === 'oui' };
                          setExtraPassengers(next);
                        }}>
                        <option value="non">Non — adulte</option>
                        <option value="oui">Oui — enfant (10+ ans)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {form.children_free > 0 && (
                <div style={{ fontSize:12, color:'var(--muted)', background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.15)', borderRadius:8, padding:'8px 11px' }}>
                  + {form.children_free} enfant{form.children_free > 1 ? 's' : ''} &lt; 10 ans (gratuit{form.children_free > 1 ? 's' : ''}, non enregistré{form.children_free > 1 ? 's' : ''})
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 3 — Politique d'annulation
          ══════════════════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <div style={{ background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:12, padding:'13px 15px', marginBottom:13 }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14, color:'var(--gold)', marginBottom:4 }}>
                  Politique d'annulation — {trip.agency_name}
                </div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.7 }}>En réservant, vous acceptez :</div>
              </div>
              {[
                { title:'Annulation le jour du départ', color:'var(--err)', bg:'rgba(240,80,80,0.07)', border:'rgba(240,80,80,0.2)',
                  desc:'Vous perdez 50% du montant payé.',
                  retenu: Math.round(total * 0.5), rembourse: Math.round(total * 0.5) },
                { title:`Annulation avant le départ (frais ${cancelRate}%)`, color:'var(--gold)', bg:'rgba(245,166,35,0.07)', border:'rgba(245,166,35,0.2)',
                  desc:`Des frais de ${cancelRate}% sont retenus.`,
                  retenu: Math.round(total * cancelRate / 100), rembourse: Math.round(total * (1 - cancelRate / 100)) },
              ].map((c, i) => (
                <div key={i} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:'11px 13px', marginBottom:10 }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, color:c.color, marginBottom:5 }}>{c.title}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:7, lineHeight:1.5 }}>{c.desc}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--muted)' }}>Retenu</span>
                    <span style={{ fontWeight:700, color:c.color }}>{c.retenu.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--muted)' }}>Remboursé</span>
                    <span style={{ fontWeight:700, color:'var(--ok)' }}>{c.rembourse.toLocaleString('fr-FR')} FC</span>
                  </div>
                </div>
              ))}
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', background:'rgba(255,255,255,.03)', border:`1.5px solid ${accepted ? 'var(--green)' : 'var(--border)'}`, borderRadius:10, marginTop:4 }}>
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                  style={{ width:16, height:16, marginTop:1, accentColor:'var(--green)', flexShrink:0 }} />
                <span style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
                  J'ai lu et j'accepte la politique d'annulation de <strong style={{ color:'var(--text)' }}>{trip.agency_name}</strong>.
                </span>
              </label>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 4 — Paiement
          ══════════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
                Réf : <strong style={{ color:'var(--green-l)' }}>{booking?.reference}</strong>
              </div>
              {[
                { m:'mobilemoney', i:'📱', t:'Mobile Money',   s:'M-Pesa, Orange, Airtel, Africell, MTN' },
                { m:'card',        i:'💳', t:'Carte bancaire', s:'Visa, Mastercard — paiement sécurisé 3D' },
              ].map(o => (
                <div key={o.m} className={`pay-opt${pay.method === o.m ? ' sel' : ''}`}
                  onClick={() => setPay({ ...pay, method: o.m, operator:'', wallet:'' })}>
                  <span className="pi">{o.i}</span>
                  <div className="pinfo"><strong>{o.t}</strong><span>{o.s}</span></div>
                  <div className="prado">{pay.method === o.m && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green-l)' }} />}</div>
                </div>
              ))}

              {pay.method === 'mobilemoney' && (
                <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Pays */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                    {PAYS.map(p => (
                      <button key={p.code} className={`op-btn${pays === p.code ? ' act' : ''}`}
                        onClick={() => { setPays(p.code); setPay(prev => ({ ...prev, operator:'', wallet:'' })); }}
                        style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <img src={p.flag} alt={p.nom} style={{ width:24, height:18, borderRadius:3, objectFit:'cover' }} onError={e => { e.target.style.display='none'; }} />
                        {p.nom}
                      </button>
                    ))}
                  </div>
                  {/* Opérateur */}
                  <div className="op-grid">
                    {OPS.map(o => (
                      <button key={o.id} className={`op-btn${pay.operator === o.id ? ' act' : ''}`}
                        onClick={() => setPay({ ...pay, operator: o.id })}
                        style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <img src={o.logo} alt={o.label} style={{ width:20, height:20, objectFit:'contain' }} onError={e => { e.target.style.display='none'; }} />
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {/* Numéro */}
                  <div className="input-group">
                    <label className="lbl">Numéro Mobile Money</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <div style={{ padding:'0 10px', height:38, display:'flex', alignItems:'center', background:'rgba(61,170,106,0.08)', border:'1px solid rgba(61,170,106,0.3)', borderRadius:'var(--rad)', color:'var(--green-l)', fontWeight:700, fontSize:13, flexShrink:0 }}>
                        {paysInfo.prefix}
                      </div>
                      <input className="field" style={{ flex:1 }} placeholder="8XXXXXXXX" inputMode="numeric"
                        value={pay.wallet}
                        onChange={e => setPay({ ...pay, wallet: e.target.value.replace(/[^\d]/g, '') })} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Sans le 0 initial — ex : 812345678</div>
                  </div>
                  {pay.operator && (
                    <div style={{ fontSize:12, color:'var(--muted)', background:'rgba(61,170,106,0.05)', border:'1px solid rgba(61,170,106,0.12)', borderRadius:8, padding:'8px 11px', lineHeight:1.7 }}>
                      {ALL_OPS[pay.operator]?.v1
                        ? '📲 M-Pesa : notification push. Saisissez votre code PIN pour valider.'
                        : `📲 Notification sur votre téléphone. Saisissez votre code PIN ${pay.operator} pour confirmer.`}
                    </div>
                  )}
                </div>
              )}

              {pay.method === 'card' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', background:'rgba(126,200,227,0.06)', border:'1px solid rgba(126,200,227,0.15)', borderRadius:8, padding:'8px 11px', lineHeight:1.6 }}>
                    💳 Redirection vers MaishaPay / CyberSource. Montant : ~{(total / 2800).toFixed(2)} USD
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Prénom *</label><input className="field" placeholder="Jean" value={cardInfo.firstname} onChange={e => setCardInfo({ ...cardInfo, firstname: e.target.value })} /></div>
                    <div className="input-group"><label className="lbl">Nom *</label><input className="field" placeholder="Mukendi" value={cardInfo.lastname} onChange={e => setCardInfo({ ...cardInfo, lastname: e.target.value })} /></div>
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Téléphone *</label><input className="field" placeholder="+243 81 234 5678" value={cardInfo.phone} onChange={e => setCardInfo({ ...cardInfo, phone: e.target.value })} /></div>
                    <div className="input-group"><label className="lbl">Email *</label><input className="field" type="email" placeholder="email@exemple.cd" value={cardInfo.email} onChange={e => setCardInfo({ ...cardInfo, email: e.target.value })} /></div>
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Adresse</label><input className="field" value={cardInfo.address} onChange={e => setCardInfo({ ...cardInfo, address: e.target.value })} /></div>
                    <div className="input-group"><label className="lbl">Ville</label><input className="field" value={cardInfo.city} onChange={e => setCardInfo({ ...cardInfo, city: e.target.value })} /></div>
                  </div>
                  <div className="input-group">
                    <label className="lbl">Type de carte</label>
                    <div className="op-grid" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
                      {CARD_PROVIDERS.map(p => (
                        <button key={p} className={`op-btn${cardInfo.provider === p ? ' act' : ''}`}
                          onClick={() => setCardInfo({ ...cardInfo, provider: p })}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STEP 5 — Résultat
          ══════════════════════════════════════════════════ */}
          {step === 5 && (
            <div style={{ textAlign:'center', padding:'12px 0' }}>

              {/* Traitement */}
              {!result && (
                <div>
                  <div className="spinner" style={{ width:36, height:36, margin:'0 auto 16px', borderWidth:3 }} />
                  <p style={{ color:'var(--muted)', fontSize:13 }}>Traitement en cours…</p>
                </div>
              )}

              {/* ✅ Confirmé + QR code */}
              {result?.type === 'confirmed' && (
                <div>
                  <div style={{ fontSize:44, marginBottom:8 }}>🎊</div>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:18, marginBottom:4 }}>Réservation confirmée !</h3>
                  <p style={{ color:'var(--muted)', fontSize:13, marginBottom:16 }}>
                    {trip.departure_city} → {trip.arrival_city} · {trip.agency_name}
                  </p>

                  {/* QR Code */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginBottom:16 }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&format=svg&color=3daa6a&bgcolor=0f172a&margin=10`}
                      alt="QR Code réservation"
                      style={{ width:180, height:180, borderRadius:14, border:'2px solid rgba(61,170,106,0.3)' }}
                    />
                    <div style={{ fontSize:11, color:'var(--muted)' }}>Présentez ce QR code au convoyeur</div>
                  </div>

                  {/* Référence */}
                  <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.2)', borderRadius:12, padding:14, display:'inline-block', minWidth:220, marginBottom:12 }}>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Référence</div>
                    <div style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, color:'var(--green-l)', letterSpacing:'.05em' }}>{result.reference}</div>
                    {selectedSeats.length > 0 && (
                      <div style={{ marginTop:6, display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center' }}>
                        {selectedSeats.map(s => (
                          <span key={s} style={{ background:'rgba(61,170,106,0.2)', border:'1px solid rgba(61,170,106,0.4)', borderRadius:5, padding:'2px 8px', fontSize:12, fontWeight:800, color:'var(--green-l)', fontFamily:'monospace' }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize:12, color:'var(--muted)' }}>
                    Présentez ce code à <strong style={{ color:'var(--text)' }}>{trip.agency_name}</strong>
                  </p>
                </div>
              )}

              {/* 📱 En attente PIN */}
              {result?.type === 'pending_pin' && (
                <div>
                  <div style={{ fontSize:48, marginBottom:12 }}>📱</div>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Confirmez sur votre téléphone</h3>
                  <p style={{ color:'var(--muted)', fontSize:13, marginBottom:16, lineHeight:1.7 }}>{result.message}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', marginBottom:16 }}>
                    <div className="spinner" style={{ width:20, height:20, borderWidth:2, flexShrink:0 }} />
                    <span style={{ fontSize:13, color:'var(--muted)' }}>En attente de confirmation…</span>
                  </div>
                  <div style={{ background:'rgba(245,166,35,0.07)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
                    Ne fermez pas cette fenêtre. La page se met à jour automatiquement.
                  </div>
                  <div style={{ marginTop:12, fontSize:11, color:'var(--muted)' }}>
                    Réf : <strong style={{ color:'var(--green-l)' }}>{result.reference}</strong>
                  </div>
                </div>
              )}

              {/* 💳 Carte — redirection */}
              {result?.type === 'redirect_card' && (
                <div>
                  <div style={{ fontSize:48, marginBottom:12 }}>💳</div>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Paiement en cours</h3>
                  <p style={{ color:'var(--muted)', fontSize:13, marginBottom:16, lineHeight:1.7 }}>
                    La page de paiement sécurisé s'est ouverte dans un nouvel onglet.
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'center', marginBottom:16 }}>
                    <div className="spinner" style={{ width:20, height:20, borderWidth:2, flexShrink:0 }} />
                    <span style={{ fontSize:13, color:'var(--muted)' }}>En attente de confirmation…</span>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize:12, marginBottom:10 }}
                    onClick={() => window.open(result.paymentPage, '_blank')}>
                    Rouvrir la page de paiement
                  </button>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>
                    Réf : <strong style={{ color:'var(--green-l)' }}>{result.reference}</strong>
                  </div>
                </div>
              )}

              {/* ❌ Erreur */}
              {result?.type === 'error' && (
                <div>
                  <div style={{ fontSize:48, marginBottom:12 }}>❌</div>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8, color:'var(--err)' }}>Paiement échoué</h3>
                  <p style={{ color:'var(--muted)', fontSize:13, marginBottom:16, lineHeight:1.7 }}>{result.message}</p>
                  <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => { setStep(4); setResult(null); }}>
                    ← Réessayer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer boutons ──────────────────────────────── */}
        <div className="mfoot">
          {step === 0 && <>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={goToSeats}>
              Choisir mes sièges →
            </button>
          </>}

          {step === 1 && <>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Retour</button>
            <button className="btn btn-primary" onClick={goToPassengers}
              style={{ opacity: selectedSeats.length === form.passengers ? 1 : 0.5 }}>
              {selectedSeats.length}/{form.passengers} siège{form.passengers > 1 ? 's' : ''} — Continuer →
            </button>
          </>}

          {step === 2 && <>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Retour</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Continuer →</button>
          </>}

          {step === 3 && <>
            <button className="btn btn-ghost" onClick={() => setStep(form.passengers > 1 ? 2 : 1)}>← Retour</button>
            <button className="btn btn-primary" onClick={doBook} disabled={loading || !accepted}
              style={{ opacity: accepted ? 1 : 0.5 }}>
              {loading ? <><div className="spin" />Traitement…</> : "J'accepte →"}
            </button>
          </>}

          {step === 4 && <>
            <button className="btn btn-ghost" onClick={() => setStep(3)}>← Retour</button>
            <button className="btn btn-gold" onClick={doPay} disabled={loading}>
              {loading ? <><div className="spin" />…</> : 'Confirmer le paiement'}
            </button>
          </>}

          {step === 5 && result?.type === 'confirmed' && (
            <button className="btn btn-primary w100" style={{ justifyContent:'center' }} onClick={onClose}>Fermer</button>
          )}
          {step === 5 && result?.type === 'error' && (
            <button className="btn btn-ghost" style={{ justifyContent:'center' }} onClick={onClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}