import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import BookingModal from './BookingModal';

const API = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa', 'Matadi', 'Boma', 'Moanda'];

const SLIDES = [
  { img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80', title: 'Kinshasa → Boma', sub: 'Le fleuve Congo à ta gauche, la route à tes pieds.', tag: '🛣️ 05h00' },
  { img: 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?q=80&w=870&auto=format&fit=crop', title: 'Flotte moderne', sub: 'Des bus climatisés, entretenus chaque semaine.', tag: '❄️ Climatisé' },
  { img: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=1200&q=80', title: 'Kinshasa → Matadi', sub: 'La ville portuaire, à 5h de route.', tag: '⚓ Matadi' },
  { img: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1200&q=80', title: 'Voyagez en famille', sub: 'Des tarifs pour tous, du confort pour chacun.', tag: '👨‍👩‍👧 Famille' },
];

const FEATURES = [
  { icon: '⚡', t: 'Réservez en 2 min', s: 'Zéro queue, zéro stress' },
  { icon: '📱', t: 'M-Pesa & Orange', s: 'Paiement 100% mobile' },
  { icon: '🔒', t: 'Paiement sécurisé', s: 'Référence unique garantie' },
  { icon: '🚌', t: 'Bus identifiés', s: 'Bus 1, Bus 2 — fiables' },
];

/* ── STYLES RESPONSIVE injectés une seule fois ── */
const RESPONSIVE_CSS = `
  .hero-grid         { display: grid; grid-template-columns: 380px 1fr; gap: 18px; align-items: start; }
  .hero-carousel     { display: block; }
  .feat-strip        { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; }
  .steps-grid        { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .stats-row         { display: flex; gap: 1px; }
  .trip-card-actions { display: flex; align-items: center; justify-content: space-between; }

@media (max-width: 768px) {
  /* ... tes règles existantes ... */
  .hero-carousel { display: block !important; margin-top: 16px; }
  /* Réduis la hauteur de l'image carousel sur mobile */
  .c-slide img { height: 200px !important; object-fit: cover; }
}

    /* Features : 2 colonnes */
    .feat-strip { grid-template-columns: 1fr 1fr !important; }

    /* Étapes : 1 colonne */
    .steps-grid { grid-template-columns: 1fr !important; }

    /* Stats : 2 colonnes */
    .stats-row { flex-wrap: wrap; }
    .stats-row > div { flex: 1 1 45%; }

    /* Padding sections */
    .public-section { padding: 0 14px !important; }

    /* Nav footer */
    .public-footer { flex-direction: column; align-items: flex-start !important; gap: 6px; }

    /* TripCard actions : on empile si besoin */
    .trip-card-actions { flex-wrap: wrap; gap: 8px; }
  }

  @media (max-width: 480px) {
    .feat-strip { grid-template-columns: 1fr !important; }
    .stats-row > div { flex: 1 1 100%; }
  }
`;

function Logo({ size = 28, tagline = false }) {
  return (
    <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
      <div style={{ width:size, height:size, borderRadius:size*.24, background:'linear-gradient(135deg,#2A7D4F,#52C882)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(61,170,106,.32)', overflow:'hidden', flexShrink:0 }}>
        <img src="/logo.png" alt="Nzela" style={{ width:size*.78, height:size*.78, objectFit:'contain' }} />
      </div>
      <div>
        <div style={{ fontFamily:'var(--font)', fontSize:size*.58, fontWeight:800, letterSpacing:'-.02em', background:'linear-gradient(90deg,#fff,#52C882)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>nzela</div>
        {tagline && <div style={{ fontSize:10, color:'var(--muted)', WebkitTextFillColor:'var(--muted)' }}>Ta route commence ici.</div>}
      </div>
    </a>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div className={`toast t-${type==='success'?'ok':type==='error'?'err':'inf'}`}>
      {type==='success'?'✓':type==='error'?'✕':'i'} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:14 }}>×</button>
    </div>
  );
}

function Carousel({ slides }) {
  const [cur, setCur] = useState(0);
  const timer = useRef(null);
  const next = useCallback(() => setCur(c => (c+1)%slides.length), [slides.length]);
  const prev = () => setCur(c => (c-1+slides.length)%slides.length);
  useEffect(() => { timer.current = setInterval(next, 5000); return () => clearInterval(timer.current); }, [next]);
  const go = i => { setCur(i); clearInterval(timer.current); timer.current = setInterval(next, 5000); };
  return (
    <div className="carousel">
      <div className="c-track" style={{ transform:`translateX(-${cur*100}%)` }}>
        {slides.map((s,i) => (
          <div className="c-slide" key={i}>
            <img src={s.img} alt={s.title} loading={i===0?'eager':'lazy'} />
            <div style={{ position:'absolute', top:12, left:12 }}>
              <span style={{ background:'rgba(61,170,106,.82)', backdropFilter:'blur(6px)', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:600, color:'#fff' }}>{s.tag}</span>
            </div>
            <div className="c-cap"><h4>{s.title}</h4><p>{s.sub}</p></div>
          </div>
        ))}
      </div>
      <button className="c-btn p" onClick={prev}>‹</button>
      <button className="c-btn n" onClick={next}>›</button>
      <div className="c-dots">{slides.map((_,i) => <div key={i} className={`cdot${i===cur?' act':''}`} onClick={() => go(i)} />)}</div>
    </div>
  );
}

function BookingModal({ trip, onClose, showToast, onSuccess }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:'', phone:'', email:'', passengers:1 });
  const [pay, setPay] = useState({ method:'', operator:'', wallet:'' });
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  const [warnChecked, setWarnChecked] = useState(false);

  const OPS = [
    { id:'MPESA',   l:'M-Pesa',       logo:'/mpesa.png' },
    { id:'ORANGE',  l:'Orange Money', logo:'/orange.png' },
    { id:'AIRTEL',  l:'Airtel',       logo:'/airtel.png' },
    { id:'AFRICEL', l:'Africell',     logo:'/africell.png' },
  ];

  const cancelRate = trip.agency_cancel_rate || 20;
  const totalPrice = (trip.price * form.passengers).toLocaleString('fr-FR');

  const book = async () => {
    if (!form.name||!form.phone) return showToast('Nom et téléphone requis','error');
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/book`, { trip_id:trip.id, ...form });
      setBooking(r.data);
      setStep(1);
    }
    catch(e) { showToast(e.response?.data?.error||'Erreur','error'); }
    finally { setLoading(false); }
  };

const doPay = async () => {
  if (!pay.method) return showToast('Choisissez un mode','error');
  if (pay.method === 'mobilemoney' && (!pay.operator || !pay.wallet))
    return showToast('Opérateur et numéro requis','error');
  if (pay.method === 'card') {
    const { card_firstname, card_lastname, card_address, card_city, card_phone, card_email, card_provider } = pay;
    if (!card_firstname || !card_lastname || !card_address || !card_city || !card_phone || !card_email || !card_provider)
      return showToast('Tous les champs carte sont requis','error');
  }
  setLoading(true);
  try {
    await axios.post(`${API}/public/pay`, {
      booking_id:     booking.booking_id,
      payment_method: pay.method,
      operator:       pay.operator,
      phone_number:   pay.wallet,
      card_firstname: pay.card_firstname,
      card_lastname:  pay.card_lastname,
      card_address:   pay.card_address,
      card_city:      pay.card_city,
      card_phone:     pay.card_phone,
      card_email:     pay.card_email,
      card_provider:  pay.card_provider,
    });
    setStep(3);
    onSuccess();
  } catch(e) {
    showToast(e.response?.data?.error || 'Erreur paiement','error');
  } finally {
    setLoading(false);
  }
};

  const STEP_LABELS = ['Passager','Conditions','Paiement','Confirmé'];

  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="mbox">
        <div className="mhead">
          <h3>
            {step===0?'👤 Vos informations'
            :step===1?'⚠️ Conditions d\'annulation'
            :step===2?'💳 Paiement'
            :'✅ Confirmé !'}
          </h3>
          <button className="mclose" onClick={onClose}>×</button>
        </div>
        <div className="mbody">
          {step < 3 && (
            <div className="steps">
              {STEP_LABELS.slice(0,3).map((s,i) => (
                <div className="step-item" key={i}>
                  <div className={`sdot ${i<step?'done':i===step?'act':'off'}`}>{i<step?'✓':i+1}</div>
                  {i<2 && <div className={`sline${i<step?' done':''}`}/>}
                </div>
              ))}
            </div>
          )}

          {/* Résumé trajet */}
          {step < 3 && (
            <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.15)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:32, height:32, borderRadius:8, overflow:'hidden', background:'var(--surface)', border:'1px solid rgba(61,170,106,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {trip.agency_logo
                      ? <img src={trip.agency_logo} alt={trip.agency_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{e.target.style.display='none';}}/>
                      : <span style={{ fontWeight:800, fontSize:13, color:'var(--green-l)' }}>{trip.agency_name?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{trip.agency_name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{trip.bus_name ? `🚌 ${trip.bus_name}` : 'Agence partenaire Nzela'}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, color:'var(--gold)', fontSize:16 }}>{totalPrice} FC</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{trip.departure_city} → {trip.arrival_city}</div>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 0 */}
          {step===0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="input-group"><label className="lbl">Nom complet *</label><input className="field" placeholder="Jean-Baptiste Mukendi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div className="g2">
                <div className="input-group"><label className="lbl">Téléphone *</label><input className="field" placeholder="+243 81 234 5678" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
                <div className="input-group"><label className="lbl">Passagers</label>
                  <select className="field" value={form.passengers} onChange={e=>setForm({...form,passengers:Number(e.target.value)})}>
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} passager{n>1?'s':''}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group"><label className="lbl">Email (optionnel)</label><input className="field" placeholder="jean@exemple.cd" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
            </div>
          )}

          {/* ÉTAPE 1 — Avertissement */}
          {step===1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>
                Réf : <strong style={{ color:'var(--green-l)' }}>{booking?.reference}</strong>
              </div>
              <div style={{ background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.2)', borderRadius:12, padding:14 }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, marginBottom:10, color:'var(--gold)' }}>⚠️ Politique d'annulation — {trip.agency_name}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { color:'var(--err)', bg:'rgba(240,80,80,0.08)', border:'rgba(240,80,80,0.18)', dot:'🔴', title:'Annulation le jour du départ', body:<>Vous perdez <strong style={{color:'var(--err)'}}>50%</strong> — soit <strong style={{color:'var(--err)'}}>{Math.round(trip.price*form.passengers*0.5).toLocaleString('fr-FR')} FC</strong></> },
                    { color:'var(--gold)', bg:'rgba(245,166,35,0.06)', border:'rgba(245,166,35,0.18)', dot:'🟡', title:`Annulation avant le départ (${cancelRate}%)`, body:<>Frais de <strong style={{color:'var(--gold)'}}>{Math.round(trip.price*form.passengers*cancelRate/100).toLocaleString('fr-FR')} FC</strong></> },
                    { color:'var(--green-l)', bg:'rgba(61,170,106,0.06)', border:'rgba(61,170,106,0.15)', dot:'🟢', title:'Pas d\'annulation', body:'Vous voyagez et récupérez 100% de la valeur.' },
                  ].map(r => (
                    <div key={r.title} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', background:r.bg, borderRadius:9, border:`1px solid ${r.border}` }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{r.dot}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color:r.color, marginBottom:2 }}>{r.title}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5 }}>{r.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', background:'var(--card)', border:`1px solid ${warnChecked?'rgba(61,170,106,.3)':'var(--border)'}`, borderRadius:9, transition:'var(--ease)' }}>
                <input type="checkbox" checked={warnChecked} onChange={e=>setWarnChecked(e.target.checked)} style={{ marginTop:2, accentColor:'var(--green)', width:16, height:16, flexShrink:0 }}/>
                <span style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5 }}>
                  J'ai lu et j'accepte la politique d'annulation de <strong style={{ color:'var(--text)' }}>{trip.agency_name}</strong>.
                </span>
              </label>
            </div>
          )}

          {/* ÉTAPE 2 — Paiement */}
          {step===2 && (
            <div>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>Réf : <strong style={{ color:'var(--green-l)' }}>{booking?.reference}</strong></div>
              <div className={`pay-opt${pay.method==='mobilemoney'?' sel':''}`} onClick={() => setPay({...pay,method:'mobilemoney'})}>
                <span className="pi">📱</span>
                <div className="pinfo"><strong>Mobile Money</strong><span>M-Pesa, Orange, Airtel, Africell</span></div>
                <div className="prado">{pay.method==='mobilemoney' && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green-l)' }}/>}</div>
              </div>
              {pay.method==='mobilemoney' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                  <div>
                    <div className="lbl" style={{ marginBottom:6 }}>Opérateur</div>
                    <div className="op-grid">
                      {OPS.map(o => (
                        <button key={o.id} className={`op-btn${pay.operator===o.id?' act':''}`} onClick={() => setPay({...pay,operator:o.id})}
                          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <img src={o.logo} alt={o.l} style={{ height:22, objectFit:'contain' }} onError={e=>e.target.style.display='none'} />
                          <span>{o.l}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="input-group"><label className="lbl">Numéro Mobile Money</label><input className="field" placeholder="+243 81 234 5678" value={pay.wallet} onChange={e=>setPay({...pay,wallet:e.target.value})}/></div>
                </div>
              )}
              <div className={`pay-opt${pay.method==='card'?' sel':''}`} onClick={() => setPay({...pay, method:'card'})} style={{ marginTop:8 }}>
  <span className="pi">💳</span>
  <div className="pinfo"><strong>Carte bancaire</strong><span>Visa, Mastercard — paiement en USD</span></div>
  <div className="prado">{pay.method==='card' && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green-l)' }}/>}</div>
</div>

{pay.method === 'card' && (
  <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
    <div className="g2">
      <div className="input-group">
        <label className="lbl">Prénom</label>
        <input className="field" placeholder="Jean" value={pay.card_firstname} onChange={e => setPay({...pay, card_firstname:e.target.value})}/>
      </div>
      <div className="input-group">
        <label className="lbl">Nom</label>
        <input className="field" placeholder="Mukendi" value={pay.card_lastname} onChange={e => setPay({...pay, card_lastname:e.target.value})}/>
      </div>
    </div>
    <div className="input-group">
      <label className="lbl">Adresse</label>
      <input className="field" placeholder="123 Avenue Kasa-Vubu" value={pay.card_address} onChange={e => setPay({...pay, card_address:e.target.value})}/>
    </div>
    <div className="g2">
      <div className="input-group">
        <label className="lbl">Ville</label>
        <input className="field" placeholder="Kinshasa" value={pay.card_city} onChange={e => setPay({...pay, card_city:e.target.value})}/>
      </div>
      <div className="input-group">
        <label className="lbl">Téléphone</label>
        <input className="field" placeholder="+243 81 234 5678" value={pay.card_phone} onChange={e => setPay({...pay, card_phone:e.target.value})}/>
      </div>
    </div>
    <div className="input-group">
      <label className="lbl">Email</label>
      <input className="field" type="email" placeholder="jean@exemple.cd" value={pay.card_email} onChange={e => setPay({...pay, card_email:e.target.value})}/>
    </div>
    <div className="input-group">
      <label className="lbl">Réseau carte</label>
      <select className="field" value={pay.card_provider} onChange={e => setPay({...pay, card_provider:e.target.value})}>
        <option value="">Choisir...</option>
        <option value="VISA">Visa</option>
        <option value="MASTERCARD">Mastercard</option>
        <option value="AMERICAN EXPRESS">American Express</option>
      </select>
    </div>
    <div style={{ fontSize:11, color:'var(--muted)', padding:'6px 10px', background:'rgba(245,166,35,0.06)', borderRadius:8, border:'1px solid rgba(245,166,35,0.15)' }}>
      ⚠️ Le montant sera converti en USD au taux en vigueur (~2800 CDF/USD)
    </div>
  </div>
)}
            </div>
          )}

          {/* ÉTAPE 3 — Confirmé */}
          {step===3 && (
            <div style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🎊</div>
              <h3 style={{ fontFamily:'var(--font)', fontSize:18, marginBottom:6 }}>Réservation confirmée !</h3>
              <p style={{ color:'var(--muted)', fontSize:13, marginBottom:6 }}>{trip.departure_city} → {trip.arrival_city}</p>
              <p style={{ color:'var(--text)', fontSize:13, fontWeight:700, marginBottom:18 }}>{trip.agency_name}</p>
              <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.2)', borderRadius:12, padding:14, display:'inline-block', minWidth:200 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Référence</div>
                <div style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, color:'var(--green-l)', letterSpacing:'.05em' }}>{booking?.reference}</div>
              </div>
              <p style={{ fontSize:12, color:'var(--muted)', marginTop:12 }}>Présentez ce code à <strong style={{ color:'var(--text)' }}>{trip.agency_name}</strong></p>
            </div>
          )}
        </div>

        <div className="mfoot">
          {step===0 && <>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={book} disabled={loading}>{loading?<><div className="spin"/>Traitement…</>:'Continuer →'}</button>
          </>}
          {step===1 && <>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Retour</button>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!warnChecked} style={{ opacity:warnChecked?1:0.5 }}>J'accepte →</button>
          </>}
          {step===2 && <>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Retour</button>
            <button className="btn btn-gold" onClick={doPay} disabled={loading}>{loading?<><div className="spin"/>…</>:'Confirmer le paiement'}</button>
          </>}
          {step===3 && <button className="btn btn-primary w100" style={{ justifyContent:'center' }} onClick={onClose}>Fermer</button>}
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, onBook, delay=0 }) {
  const pct = Math.round((trip.available_seats/trip.total_seats)*100);
  const note = trip.agency_note || 3;
  return (
    <div className="fi" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', transition:'var(--ease)', animationDelay:`${delay}s` }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(61,170,106,.25)'; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; }}>
      <div style={{ height:2, background:'linear-gradient(90deg,var(--green-d),var(--green-l))' }}/>
      <div style={{ padding:'14px 16px' }}>
        {/* En-tête agence */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
              {trip.agency_logo
                ? <img src={trip.agency_logo} alt={trip.agency_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.target.style.display='none'; e.target.parentNode.innerHTML=`<span style="font-size:15px;font-weight:800;color:var(--green-l)">${trip.agency_name?.[0]||'?'}</span>`; }}/>
                : <span style={{ fontSize:15, fontWeight:800, color:'var(--green-l)' }}>{trip.agency_name?.[0]?.toUpperCase()||'?'}</span>
              }
            </div>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, color:'var(--text)', lineHeight:1.1 }}>{trip.agency_name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                {trip.bus_name && <span style={{ fontSize:11, color:'var(--muted)' }}>🚌 {trip.bus_name}</span>}
                <span style={{ fontSize:10, color:'var(--gold)', letterSpacing:1 }}>{'★'.repeat(note)}{'☆'.repeat(5-note)}</span>
              </div>
            </div>
          </div>
          {trip.available_seats<=5
            ? <span className="badge b-r">⚡ {trip.available_seats} restants</span>
            : <span className="badge b-g">{trip.available_seats} places</span>}
        </div>

        {/* Trajet */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, background:'rgba(255,255,255,.025)', borderRadius:9, padding:'10px 12px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{trip.departure_city}</div>
            <div style={{ fontWeight:700, fontSize:20, color:'var(--green-l)' }}>{trip.departure_time}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', width:'100%', gap:3 }}>
              <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,var(--green-d))' }}/>
              <span style={{ fontSize:13 }}>📍</span>
              <div style={{ flex:1, height:1, background:'linear-gradient(90deg,var(--green-d),transparent)' }}/>
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{new Date(trip.departure_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div>
          </div>
          <div style={{ flex:1, textAlign:'right' }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{trip.arrival_city}</div>
          </div>
        </div>

        {/* Prix + action */}
        <div className="trip-card-actions">
          <div>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>Prix / siège</div>
            <div style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:800, color:'var(--gold)', lineHeight:1.1 }}>
              {Number(trip.price).toLocaleString('fr-FR')} <span style={{ fontSize:12, fontWeight:500 }}>FC</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:44, height:3, background:'rgba(255,255,255,.08)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:pct<25?'var(--err)':'var(--green)', borderRadius:99 }}/>
              </div>
              <span style={{ fontSize:10, color:'var(--muted)' }}>{pct}%</span>
            </div>
            <button className="btn btn-primary" onClick={() => onBook(trip)} style={{ borderRadius:8, padding:'8px 16px', fontSize:13 }}>Réserver</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicSite() {
  const [search, setSearch]   = useState({ from:'', to:'', date:'' });
  const [trips, setTrips]     = useState([]);
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]     = useState(null);
  const resultsRef = useRef(null);
  const showToast = (msg, type='info') => setToast({ msg, type });

  useEffect(() => {
    axios.get(`${API}/public/gallery`)
      .then(r => setGallery(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!search.from || !search.to) return showToast('Sélectionnez départ et arrivée','error');
    setLoading(true);
    try {
      const p = new URLSearchParams({ from:search.from, to:search.to });
      if (search.date) p.append('date', search.date);
      const res = await axios.get(`${API}/public/trips?${p}`);
      setTrips(Array.isArray(res.data) ? res.data : []);
      setSearched(true);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    } catch { showToast('Erreur de recherche','error'); }
    finally { setLoading(false); }
  };

  const swap = () => setSearch(s => ({ ...s, from:s.to, to:s.from }));

  const slides = gallery.length > 0
    ? gallery.slice(0,6).map(g => ({ img:g.image_url, title:g.title||'', sub:g.description||'', tag:g.category||'📸' }))
    : SLIDES;

  return (
    <div style={{ minHeight:'100vh', background:'var(--night)' }}>
      {/* CSS responsive injecté */}
      <style>{RESPONSIVE_CSS}</style>

      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', background:'rgba(5,14,23,.92)', backdropFilter:'blur(14px)', borderBottom:'1px solid var(--border)' }}>
        <Logo size={28}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>🇨🇩 RDC</span>
          <a href="/about" onClick={e => { e.preventDefault(); window.location.href='/about'; }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>À propos</a>
<a href="/login" onClick={e => { e.preventDefault(); window.location.href='/login'; }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>Agences →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="public-section" style={{ maxWidth:1060, margin:'0 auto', padding:'20px 18px 0' }}>
        <div className="hero-grid">

          {/* SEARCH */}
          <div className="fi">
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--font)', fontSize:'clamp(20px,5vw,28px)', fontWeight:800, lineHeight:1.2, marginBottom:5 }}>
                Ta route,<br/>
                <span style={{ background:'linear-gradient(90deg,var(--green-d),var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>commence ici.</span>
              </div>
              <p style={{ color:'var(--muted)', fontSize:12, lineHeight:1.65 }}>Kinshasa – Boma – Matadi · 2 min pour réserver, Mobile Money accepté.</p>
            </div>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', padding:'16px 16px 12px', boxShadow:'0 16px 36px rgba(0,0,0,.32)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                <div className="input-group">
                  <label className="lbl">📍 Départ</label>
                  <select className="field" value={search.from} onChange={e => setSearch({...search,from:e.target.value})}>
                    <option value="">Ville de départ</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                  <button onClick={swap}
                    style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.18)', borderRadius:99, padding:'3px 11px', cursor:'pointer', fontSize:12, color:'var(--green-l)', transition:'var(--ease)', fontFamily:'var(--font)', fontWeight:600 }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(61,170,106,.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--green-bg)'}>
                    ⇅ Inverser
                  </button>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                </div>
                <div className="input-group">
                  <label className="lbl">📍 Arrivée</label>
                  <select className="field" value={search.to} onChange={e => setSearch({...search,to:e.target.value})}>
                    <option value="">Ville d'arrivée</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="lbl">📅 Date</label>
                  <input className="field" type="date" value={search.date} min={new Date().toISOString().split('T')[0]} onChange={e => setSearch({...search,date:e.target.value})}/>
                </div>
                <button className="btn btn-primary w100" onClick={handleSearch} disabled={loading}
                  style={{ justifyContent:'center', height:40, fontSize:13, borderRadius:'var(--r)', marginTop:2 }}>
                  {loading ? <><div className="spin"/>Recherche…</> : '🔍  Trouver un voyage'}
                </button>
              </div>
            </div>
            {/* Raccourcis */}
            <div style={{ marginTop:10, display:'flex', gap:5, flexWrap:'wrap' }}>
              {[['Kinshasa','Boma'],['Kinshasa','Matadi'],['Boma','Kinshasa']].map(([f,t]) => (
                <button key={`${f}-${t}`} onClick={() => setSearch(s => ({...s,from:f,to:t}))}
                  style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.13)', borderRadius:99, padding:'4px 11px', fontSize:11, color:'var(--muted)', cursor:'pointer', transition:'var(--ease)' }}
                  onMouseEnter={e => { e.currentTarget.style.color='var(--green-l)'; e.currentTarget.style.borderColor='rgba(61,170,106,.28)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='rgba(61,170,106,.13)'; }}>
                  {f} → {t}
                </button>
              ))}
            </div>
          </div>

          {/* CAROUSEL — caché sur mobile via CSS */}
          <div className="fi fi-2 hero-carousel">
            <Carousel slides={slides}/>
            <div className="quote-band mt12">
              <p style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:600, position:'relative', zIndex:1, lineHeight:1.55 }}>
                "Plus de 10 000 voyageurs nous font confiance chaque mois."
                <br/><span style={{ opacity:.7, fontWeight:400, fontSize:11 }}>Rejoignez la communauté Nzela — la RDC se déplace avec nous.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="public-section" style={{ maxWidth:1060, margin:'16px auto 0', padding:'0 18px' }}>
        <div className="feat-strip" style={{ background:'var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
          {FEATURES.map((f,i) => (
            <div key={i} style={{ background:'var(--surface)', padding:'13px 15px', display:'flex', alignItems:'center', gap:9 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:12 }}>{f.t}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* RÉSULTATS */}
      <section ref={resultsRef} className="public-section" style={{ maxWidth:1060, margin:'0 auto', padding:'18px 18px 40px' }}>
        {searched && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:700 }}>{search.from} → {search.to}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{trips.length} trajet{trips.length!==1?'s':''} — classés par note agence</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSearched(false)} style={{ fontSize:12 }}>Réinitialiser</button>
            </div>
            {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spin" style={{ width:32, height:32, margin:'0 auto', borderWidth:3 }}/></div>}
            {!loading && trips.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 20px', background:'var(--surface)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)' }}>
                <img src="/logo.png" alt="" style={{ width:40, opacity:.18, marginBottom:10 }}/>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, marginBottom:5 }}>Aucun trajet ce jour-là</div>
                <div style={{ color:'var(--muted)', fontSize:12 }}>Nos agences opèrent tous les jours — essayez une autre date.</div>
              </div>
            )}
            <div style={{ display:'grid', gap:10 }}>
              {trips.map((t,i) => <TripCard key={t.id} trip={t} onBook={setSelected} delay={i*.05}/>)}
            </div>
          </>
        )}

        {!searched && (
          <div style={{ marginTop:18 }}>
            <div style={{ textAlign:'center', padding:'28px 20px', maxWidth:560, margin:'0 auto' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.16)', borderRadius:99, padding:'3px 13px', fontSize:11, color:'var(--green-l)', fontWeight:600, marginBottom:12 }}>🇨🇩 Fièrement congolais</div>
              <h2 style={{ fontFamily:'var(--font)', fontSize:'clamp(18px,2.8vw,26px)', fontWeight:800, lineHeight:1.25, marginBottom:9 }}>
                Voyager en RDC,<br/><span style={{ background:'linear-gradient(90deg,var(--green-d),var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>enfin sans galère.</span>
              </h2>
              <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.7 }}>Fini les files d'attente et les billets perdus.<br/>Avec Nzela — tu choisis, tu paies, tu montes.</p>
            </div>

            {/* Étapes — 3 colonnes desktop, 1 colonne mobile */}
            <div className="steps-grid" style={{ maxWidth:780, margin:'0 auto 20px' }}>
              {[
                { n:'01', i:'🔍', t:'Cherche ton trajet', d:'Départ, arrivée et date.' },
                { n:'02', i:'💳', t:'Paye en Mobile Money', d:'M-Pesa, Orange ou Airtel.' },
                { n:'03', i:'🚌', t:'Monte dans le bus', d:"Présente ta référence. C'est tout." },
              ].map(s => (
                <div key={s.n} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:15, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-10, right:10, fontFamily:'var(--font)', fontSize:44, fontWeight:800, color:'rgba(61,170,106,.06)', lineHeight:1 }}>{s.n}</div>
                  <div style={{ fontSize:22, marginBottom:7 }}>{s.i}</div>
                  <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, marginBottom:4 }}>{s.t}</div>
                  <div style={{ color:'var(--muted)', fontSize:12, lineHeight:1.6 }}>{s.d}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="stats-row" style={{ background:'var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', maxWidth:780, margin:'0 auto' }}>
              {[['10 000+','Voyageurs/mois'],['3','Agences'],['2','Trajets phares'],['100%','Mobile Money']].map(([v,l]) => (
                <div key={l} style={{ flex:1, background:'var(--surface)', padding:'13px 10px', textAlign:'center', minWidth:80 }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18, color:'var(--green-l)', marginBottom:2 }}>{v}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="public-footer" style={{ borderTop:'1px solid var(--border)', padding:'14px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <Logo size={22} tagline/>
        <div style={{ fontSize:11, color:'var(--muted)' }}>© 2026 Nzela · Kinshasa, RDC</div>
        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:10, flexWrap:'wrap' }}>
          <span>📞 +243 85 91 53 213</span><span>·</span><span>✉️ support@nzela.cd</span>
        </div>
      </footer>

      {selected && <BookingModal trip={selected} onClose={()=>setSelected(null)} onSuccess={()=>setSelected(null)} showToast={showToast}/>}
    </div>
  );
}
