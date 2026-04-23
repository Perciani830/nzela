import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = 'https://nzela-production-086a.up.railway.app/api';

const PAYS = [
  { code:'CD', nom:'🇨🇩 RDC',           currency:'CDF', ops:['MPESA','ORANGE','AIRTEL'] },
  { code:'CG', nom:'🇨🇬 Congo-Brazza',   currency:'XAF', ops:['AIRTEL','MTN'] },
  { code:'CM', nom:'🇨🇲 Cameroun',       currency:'XAF', ops:['ORANGE','MTN'] },
  { code:'CI', nom:'🇨🇮 Côte d\'Ivoire', currency:'XOF', ops:['ORANGE','MTN','MOOV'] },
];

const ALL_OPS = {
  MPESA:  { id:'MPESA',  l:'M-Pesa',       logo:'/photos/mpesa.png' },
  ORANGE: { id:'ORANGE', l:'Orange Money', logo:'/photos/orange.png' },
  AIRTEL: { id:'AIRTEL', l:'Airtel',       logo:'/photos/airtel.png' },
  MTN:    { id:'MTN',    l:'MTN',          logo:'/photos/mtn.png' },
  MOOV:   { id:'MOOV',  l:'Moov',          logo:'/photos/moov.png' },
};

const CARD_PROVIDERS = ['VISA','MASTERCARD','AMERICAN EXPRESS'];

export default function BookingModal({ trip, onClose, onSuccess, showToast }) {
  const [step,     setStep]     = useState(0);
  const [form,     setForm]     = useState({ name:'', phone:'', email:'', passengers:1 });
  const [pay,      setPay]      = useState({ method:'', operator:'', wallet:'' });
  const [cardInfo, setCardInfo] = useState({ firstname:'', lastname:'', address:'Kinshasa', city:'Kinshasa', phone:'', email:'', provider:'VISA' });
  const [accepted, setAccepted] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [booking,  setBooking]  = useState(null);
  const [result,   setResult]   = useState(null);
  const [pays,     setPays]     = useState('CD'); // ← ICI, dans le composant

  const paysInfo = PAYS.find(p => p.code === pays);
  const OPS = paysInfo.ops.map(id => ALL_OPS[id]).filter(Boolean);


  // Polling pour Mobile Money v2 en attente de PIN
  const pollRef    = useRef(null);
  const pollCount  = useRef(0);
  const MAX_POLLS  = 40; // 40 × 3s = 2 minutes max

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (bookingId) => {
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current++;
      try {
        const r = await axios.get(`${API}/public/booking-status/${bookingId}`);
        const { status, payment_status } = r.data;
        if (payment_status === 'completed' && status === 'confirmed') {
          clearInterval(pollRef.current);
          setResult({ type: 'confirmed', reference: r.data.reference });
        } else if (status === 'cancelled') {
          clearInterval(pollRef.current);
          setResult({ type: 'error', message: 'Paiement refusé ou annulé par l\'opérateur.' });
        } else if (pollCount.current >= MAX_POLLS) {
          clearInterval(pollRef.current);
          setResult({ type: 'error', message: 'Délai dépassé. Si vous avez été débité, contactez le support.' });
        }
      } catch {}
    }, 3000);
  };

  const doBook = async () => {
    if (!form.name || !form.phone) return showToast('Nom et téléphone requis', 'error');
    setLoading(true);
    try {
      const r = await axios.post(`${API}/public/book`, { trip_id: trip.id, ...form });
      setBooking(r.data);
      setStep(1);
    } catch (e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
    finally { setLoading(false); }
  };

  const doPay = async () => {
    if (!pay.method) return showToast('Choisissez un mode de paiement', 'error');

    if (pay.method === 'mobilemoney' && (!pay.operator || !pay.wallet))
      return showToast('Opérateur et numéro requis', 'error');

    if (pay.method === 'card' && (!cardInfo.phone || !cardInfo.email))
      return showToast('Téléphone et email requis pour le paiement par carte', 'error');

    setLoading(true);
    setStep(3);

    try {
      const payload = {
        booking_id:     booking.booking_id,
        payment_method: pay.method,
      };

      if (pay.method === 'mobilemoney') {
        payload.operator     = pay.operator;
        payload.phone_number = pay.wallet;
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
      payload.currency = paysInfo.currency;
      const r = await axios.post(`${API}/public/pay`, payload);
      const data = r.data;

      if (data.status === 'confirmed') {
        // Espèces ou MPESA v1 synchrone → confirmé immédiatement
        setResult({ type: 'confirmed', reference: data.reference });
        onSuccess && onSuccess();

      } else if (data.status === 'pending') {
        // Mobile Money v2 → PIN envoyé sur le téléphone, on attend via polling
        setResult({ type: 'pending_pin', reference: data.reference, message: data.message });
        startPolling(booking.booking_id);

      } else if (data.status === 'redirect') {
        // Carte v3 → redirection vers CyberSource
        setResult({ type: 'redirect_card', reference: data.reference, paymentPage: data.payment_page });
        // Ouvrir dans une nouvelle fenêtre ou rediriger
        window.open(data.payment_page, '_blank');
        // Lancer aussi le polling car le callback GET met à jour la DB
        startPolling(booking.booking_id);
      }

    } catch (e) {
      const msg = e.response?.data?.error || 'Erreur de paiement';
      showToast(msg, 'error');
      setResult({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Passager', 'Conditions', 'Paiement', 'Résultat'];
  const total = trip.price * form.passengers;
  const cancelRate = trip.cancel_rate || 20;

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="mbox" style={{ maxWidth: 500 }}>

        {/* Header */}
        <div className="mhead">
          <h3>
            {step===0 && '👤 Vos informations'}
            {step===1 && '⚠️ Politique d\'annulation'}
            {step===2 && '💳 Paiement'}
            {step===3 && (
              result?.type === 'confirmed'     ? '✅ Réservation confirmée !' :
              result?.type === 'pending_pin'   ? '📱 En attente de votre PIN' :
              result?.type === 'redirect_card' ? '💳 Paiement carte' :
              result?.type === 'error'         ? '❌ Paiement échoué' :
              '⏳ Traitement...'
            )}
          </h3>
          {!loading && <button className="mclose" onClick={onClose}>×</button>}
        </div>

        <div className="mbody">
          {/* Indicateur d'étapes */}
          {step < 3 && (
            <div className="steps">
              {STEPS.map((s, i) => (
                <div className="step-item" key={i}>
                  <div className={`sdot ${i<step?'done':i===step?'act':'off'}`}>{i<step?'✓':i+1}</div>
                  {i < STEPS.length-1 && <div className={`sline${i<step?' done':''}`}/>}
                </div>
              ))}
            </div>
          )}

          {/* Récap trajet */}
          {step < 3 && (
            <div style={{background:'var(--green-bg)',border:'1px solid rgba(61,170,106,.15)',borderRadius:10,padding:'9px 12px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:'var(--font)',fontWeight:700,fontSize:14}}>{trip.departure_city} → {trip.arrival_city}</span>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font)',fontWeight:800,color:'var(--gold)',fontSize:15}}>{total.toLocaleString('fr-FR')} FC</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{trip.agency_name}{trip.bus_name?` · ${trip.bus_name}`:''}</div>
              </div>
            </div>
          )}

          {/* ── STEP 0 : Passager ── */}
          {step===0 && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
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

          {/* ── STEP 1 : Conditions annulation ── */}
          {step===1 && (
            <div>
              <div style={{background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:12,padding:'13px 15px',marginBottom:13}}>
                <div style={{fontFamily:'var(--font)',fontWeight:700,fontSize:14,color:'var(--gold)',marginBottom:8}}>⚠️ Politique d'annulation — {trip.agency_name}</div>
                <div style={{fontSize:13,color:'var(--text)',lineHeight:1.7}}>En réservant, vous acceptez :</div>
              </div>
              {[
                { ico:'🔴', title:'Annulation le jour du départ', color:'var(--err)', bg:'rgba(240,80,80,0.07)', border:'rgba(240,80,80,0.2)',
                  desc:`Vous perdez 50% du montant payé.`,
                  retenu: Math.round(total * 0.5), rembourse: Math.round(total * 0.5) },
                { ico:'🟡', title:`Annulation avant le départ (frais ${cancelRate}%)`, color:'var(--gold)', bg:'rgba(245,166,35,0.07)', border:'rgba(245,166,35,0.2)',
                  desc:`Des frais de ${cancelRate}% sont retenus.`,
                  retenu: Math.round(total * cancelRate / 100), rembourse: Math.round(total * (1 - cancelRate/100)) },
              ].map((c,i) => (
                <div key={i} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,padding:'11px 13px',marginBottom:10}}>
                  <div style={{display:'flex',gap:8,marginBottom:5}}>
                    <span style={{fontSize:17,flexShrink:0}}>{c.ico}</span>
                    <div style={{fontFamily:'var(--font)',fontWeight:700,fontSize:13,color:c.color}}>{c.title}</div>
                  </div>
                  <div style={{fontSize:12,color:'var(--muted)',marginBottom:7,lineHeight:1.5}}>{c.desc}</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                    <span style={{color:'var(--muted)'}}>Retenu</span><span style={{fontWeight:700,color:c.color}}>{c.retenu.toLocaleString('fr-FR')} FC</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                    <span style={{color:'var(--muted)'}}>Remboursé</span><span style={{fontWeight:700,color:'var(--ok)'}}>{c.rembourse.toLocaleString('fr-FR')} FC</span>
                  </div>
                </div>
              ))}
              <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',padding:'10px 12px',background:'rgba(255,255,255,.03)',border:`1.5px solid ${accepted?'var(--green)':'var(--border)'}`,borderRadius:10,marginTop:4}}>
                <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} style={{width:16,height:16,marginTop:1,accentColor:'var(--green)',flexShrink:0}}/>
                <span style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>J'ai lu et j'accepte la politique d'annulation de <strong style={{color:'var(--text)'}}>{trip.agency_name}</strong>.</span>
              </label>
            </div>
          )}

          {/* ── STEP 2 : Paiement ── */}
          {step===2 && (
            <div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Réf : <strong style={{color:'var(--green-l)'}}>{booking?.reference}</strong></div>

              {/* Choix de méthode */}
              {[
                { m:'mobilemoney', i:'📱', t:'Mobile Money', s:'M-Pesa, Orange, Airtel, Africell, MTN' },
                { m:'card',        i:'💳', t:'Carte bancaire', s:'Visa, Mastercard — paiement sécurisé 3D' },
              ].map(o => (
                <div key={o.m} className={`pay-opt${pay.method===o.m?' sel':''}`} onClick={()=>setPay({...pay,method:o.m})}>
                  <span className="pi">{o.i}</span>
                  <div className="pinfo"><strong>{o.t}</strong><span>{o.s}</span></div>
                  <div className="prado">{pay.method===o.m&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--green-l)'}}/>}</div>
                </div>
              ))}
              <div style={{ marginBottom:10 }}>
  <div className="lbl" style={{ marginBottom:6 }}>Pays</div>
  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
    {PAYS.map(p => (
      <button key={p.code}
        className={`op-btn${pays===p.code?' act':''}`}
        onClick={() => { setPays(p.code); setPay({...pay, operator:''}); }}>
        {p.nom}
      </button>
    ))}
  </div>
</div>
              {/* Champs Mobile Money */}
              {pay.method==='mobilemoney' && (
                <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:10}}>
                  <div><div className="lbl" style={{marginBottom:6}}>Opérateur</div>
                    <div className="op-grid">
                      {OPS.map(o=>(
                        <button key={o.id} className={`op-btn${pay.operator===o.id?' act':''}`} onClick={()=>setPay({...pay,operator:o.id})}>
                          {o.e} {o.l}
                          {o.v==='v2'&&<span style={{fontSize:9,marginLeft:4,opacity:0.6}}>*</span>}
                        </button>
                      ))}
                    </div>
                    {pay.operator && OPS.find(o=>o.id===pay.operator)?.v==='v2' && (
                      <div style={{fontSize:11,color:'var(--muted)',marginTop:6,lineHeight:1.5}}>
                        * Vous recevrez une notification sur votre téléphone. Saisissez votre code PIN pour confirmer.
                      </div>
                    )}
                  </div>
                  <div className="input-group"><label className="lbl">Numéro Mobile Money</label>
                    <input className="field" placeholder="+243 81 234 5678" value={pay.wallet} onChange={e=>setPay({...pay,wallet:e.target.value})}/>
                  </div>
                </div>
              )}

              {/* Champs Carte */}
              {pay.method==='card' && (
                <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:10}}>
                  <div style={{fontSize:11,color:'var(--muted)',background:'rgba(126,200,227,0.06)',border:'1px solid rgba(126,200,227,0.15)',borderRadius:8,padding:'8px 11px',lineHeight:1.6}}>
                    💳 Vous serez redirigé vers une page de paiement sécurisée (CyberSource / Visa). Montant : ~{(total/2800).toFixed(2)} USD
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Prénom *</label><input className="field" placeholder="Jean" value={cardInfo.firstname} onChange={e=>setCardInfo({...cardInfo,firstname:e.target.value})}/></div>
                    <div className="input-group"><label className="lbl">Nom *</label><input className="field" placeholder="Mukendi" value={cardInfo.lastname} onChange={e=>setCardInfo({...cardInfo,lastname:e.target.value})}/></div>
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Téléphone *</label><input className="field" placeholder="+243 81 234 5678" value={cardInfo.phone} onChange={e=>setCardInfo({...cardInfo,phone:e.target.value})}/></div>
                    <div className="input-group"><label className="lbl">Email *</label><input className="field" type="email" placeholder="email@exemple.cd" value={cardInfo.email} onChange={e=>setCardInfo({...cardInfo,email:e.target.value})}/></div>
                  </div>
                  <div className="g2">
                    <div className="input-group"><label className="lbl">Adresse</label><input className="field" placeholder="Kinshasa" value={cardInfo.address} onChange={e=>setCardInfo({...cardInfo,address:e.target.value})}/></div>
                    <div className="input-group"><label className="lbl">Ville</label><input className="field" placeholder="Kinshasa" value={cardInfo.city} onChange={e=>setCardInfo({...cardInfo,city:e.target.value})}/></div>
                  </div>
                  <div className="input-group"><label className="lbl">Type de carte</label>
                    <div className="op-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                      {CARD_PROVIDERS.map(p=>(
                        <button key={p} className={`op-btn${cardInfo.provider===p?' act':''}`} onClick={()=>setCardInfo({...cardInfo,provider:p})}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 : Résultat ── */}
          {step===3 && (
            <div style={{textAlign:'center',padding:'12px 0'}}>

              {/* Traitement en cours */}
              {!result && (
                <div>
                  <div className="spinner" style={{width:36,height:36,margin:'0 auto 16px',borderWidth:3}}/>
                  <p style={{color:'var(--muted)',fontSize:13}}>Traitement en cours…</p>
                </div>
              )}

              {/* ✅ Confirmé */}
              {result?.type==='confirmed' && (
                <div>
                  <div style={{fontSize:52,marginBottom:12}}>🎊</div>
                  <h3 style={{fontFamily:'var(--font)',fontSize:18,marginBottom:6}}>Réservation confirmée !</h3>
                  <p style={{color:'var(--muted)',fontSize:13,marginBottom:18}}>{trip.departure_city} → {trip.arrival_city} · {trip.agency_name}</p>
                  <div style={{background:'var(--green-bg)',border:'1px solid rgba(61,170,106,.2)',borderRadius:12,padding:14,display:'inline-block',minWidth:200}}>
                    <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>Référence</div>
                    <div style={{fontFamily:'var(--font)',fontSize:20,fontWeight:800,color:'var(--green-l)',letterSpacing:'.05em'}}>{result.reference}</div>
                  </div>
                  <p style={{fontSize:12,color:'var(--muted)',marginTop:12}}>Présentez ce code à l'agence <strong style={{color:'var(--text)'}}>{trip.agency_name}</strong></p>
                </div>
              )}

              {/* 📱 En attente PIN */}
              {result?.type==='pending_pin' && (
                <div>
                  <div style={{fontSize:48,marginBottom:12}}>📱</div>
                  <h3 style={{fontFamily:'var(--font)',fontSize:17,marginBottom:8}}>Confirmez sur votre téléphone</h3>
                  <p style={{color:'var(--muted)',fontSize:13,marginBottom:16,lineHeight:1.7}}>{result.message}</p>
                  <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginBottom:16}}>
                    <div className="spinner" style={{width:20,height:20,borderWidth:2,flexShrink:0}}/>
                    <span style={{fontSize:13,color:'var(--muted)'}}>En attente de confirmation…</span>
                  </div>
                  <div style={{background:'rgba(245,166,35,0.07)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'var(--muted)',lineHeight:1.6}}>
                    ⚠️ Ne fermez pas cette fenêtre. Cette page se mettra à jour automatiquement.
                  </div>
                  <div style={{marginTop:12,fontSize:11,color:'var(--muted)'}}>Réf : <strong style={{color:'var(--green-l)'}}>{result.reference}</strong></div>
                </div>
              )}

              {/* 💳 Redirection carte */}
              {result?.type==='redirect_card' && (
                <div>
                  <div style={{fontSize:48,marginBottom:12}}>💳</div>
                  <h3 style={{fontFamily:'var(--font)',fontSize:17,marginBottom:8}}>Paiement en cours</h3>
                  <p style={{color:'var(--muted)',fontSize:13,marginBottom:16,lineHeight:1.7}}>
                    La page de paiement sécurisé s'est ouverte dans un nouvel onglet.<br/>Finalisez votre paiement carte là-bas.
                  </p>
                  <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'center',marginBottom:16}}>
                    <div className="spinner" style={{width:20,height:20,borderWidth:2,flexShrink:0}}/>
                    <span style={{fontSize:13,color:'var(--muted)'}}>En attente de confirmation…</span>
                  </div>
                  <button className="btn btn-ghost" style={{fontSize:12,marginBottom:10}} onClick={()=>window.open(result.paymentPage,'_blank')}>
                    🔗 Rouvrir la page de paiement
                  </button>
                  <div style={{background:'rgba(126,200,227,0.06)',border:'1px solid rgba(126,200,227,0.15)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'var(--muted)',lineHeight:1.6}}>
                    ⚠️ Ne fermez pas cette fenêtre. Elle se mettra à jour après votre paiement.
                  </div>
                  <div style={{marginTop:12,fontSize:11,color:'var(--muted)'}}>Réf : <strong style={{color:'var(--green-l)'}}>{result.reference}</strong></div>
                </div>
              )}

              {/* ❌ Erreur */}
              {result?.type==='error' && (
                <div>
                  <div style={{fontSize:48,marginBottom:12}}>❌</div>
                  <h3 style={{fontFamily:'var(--font)',fontSize:17,marginBottom:8,color:'var(--err)'}}>Paiement échoué</h3>
                  <p style={{color:'var(--muted)',fontSize:13,marginBottom:16,lineHeight:1.7}}>{result.message}</p>
                  <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>{setStep(2);setResult(null);}}>← Réessayer</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer boutons */}
        <div className="mfoot">
          {step===0 && <>
            <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary" onClick={doBook} disabled={loading}>
              {loading?<><div className="spin"/>Traitement…</>:'Continuer →'}
            </button>
          </>}
          {step===1 && <>
            <button className="btn btn-ghost" onClick={()=>setStep(0)}>← Retour</button>
            <button className="btn btn-primary" onClick={()=>{ if(!accepted) return showToast("Acceptez les conditions d'annulation",'error'); setStep(2); }}
              style={{opacity:accepted?1:0.5}}>J'accepte →</button>
          </>}
          {step===2 && <>
            <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Retour</button>
            <button className="btn btn-gold" onClick={doPay} disabled={loading}>
              {loading?<><div className="spin"/>…</>:'Confirmer le paiement'}
            </button>
          </>}
          {step===3 && result?.type==='confirmed' && (
            <button className="btn btn-primary w100" style={{justifyContent:'center'}} onClick={onClose}>Fermer</button>
          )}
          {step===3 && result?.type==='error' && (
            <button className="btn btn-ghost" style={{justifyContent:'center'}} onClick={onClose}>Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}
