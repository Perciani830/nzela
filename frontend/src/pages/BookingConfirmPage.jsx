import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBookingByRef } from '../api/client';
const fmt = n => new Intl.NumberFormat('fr-FR').format(n||0) + ' FC';

export default function BookingConfirmPage() {
  const { ref } = useParams(); const navigate = useNavigate();
  const [b, setB] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(()=>{ getBookingByRef(ref).then(r=>setB(r.data)).catch(()=>{}).finally(()=>setLoading(false)); },[ref]);

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><span className="spinner" style={{ width:36,height:36,borderWidth:3 }}/></div>;
  if (!b) return <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}><div style={{ fontSize:56 }}>❌</div><h2>Réservation introuvable</h2><button className="btn btn-primary" onClick={()=>navigate('/')}>Accueil</button></div>;

  const paid = b.payment_status==='completed';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ maxWidth:'480px', width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'22px' }}>
          <div style={{ fontSize:'60px', marginBottom:'10px' }}>{paid?'✅':'⏳'}</div>
          <h1 style={{ fontWeight:800, fontSize:'26px', letterSpacing:'-0.3px' }}>{paid?'Billet confirmé !':'En attente de paiement'}</h1>
          <p style={{ color:'var(--muted)', fontSize:'14px', marginTop:'6px' }}>{paid?'Votre voyage est confirmé.':'Présentez cette référence à l\'agence pour payer.'}</p>
        </div>

        <div style={{ background:'#fff', borderRadius:'20px', overflow:'hidden', boxShadow:'var(--shadow-lg)' }}>
          <div style={{ background:'var(--navy)', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div><div style={{ color:'rgba(255,255,255,.5)', fontSize:'11px', marginBottom:'3px' }}>N° BILLET</div><div style={{ fontWeight:800, fontSize:'22px', color:'var(--amber)', letterSpacing:'2px' }}>{b.booking_ref}</div></div>
            <span style={{ fontSize:'36px' }}>🎟️</span>
          </div>
          <div style={{ padding:'20px 24px', borderBottom:'2px dashed var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ textAlign:'center', flex:1 }}><div style={{ fontWeight:800, fontSize:'20px' }}>{b.origin}</div><div style={{ color:'var(--muted)', fontSize:'13px' }}>Dép. {b.departure_time}</div></div>
              <div style={{ textAlign:'center', padding:'6px 10px', background:'var(--bg)', borderRadius:'20px', fontSize:'13px', color:'var(--muted)' }}>→</div>
              <div style={{ textAlign:'center', flex:1 }}><div style={{ fontWeight:800, fontSize:'20px' }}>{b.destination}</div><div style={{ color:'var(--muted)', fontSize:'13px' }}>Arr. {b.arrival_time}</div></div>
            </div>
          </div>
          <div style={{ padding:'18px 24px' }}>
            {[['Passager', b.passenger_name], ['Téléphone', b.passenger_phone], ['Agence', b.agency_name], ['Date', b.travel_date], ['Sièges', b.seat_count], ['Montant', fmt(b.total_amount)], ['Statut', paid?'✅ Payé':'⏳ En attente']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13.5px' }}>
                <span style={{ color:'var(--muted)' }}>{l}</span><span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
          {b.loyalty_points_earned > 0 && <div style={{ padding:'12px 24px', background:'#FEF3C7', fontSize:'13px', color:'#92400E' }}>⭐ +{b.loyalty_points_earned} points fidélité gagnés sur ce voyage !</div>}
          <div style={{ padding:'12px 24px', background:'var(--bg)', textAlign:'center', fontSize:'12.5px', color:'var(--muted)' }}>Présentez ce billet à l'agent lors de l'embarquement</div>
        </div>

        <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
          <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }} onClick={()=>window.print()}>🖨️ Imprimer</button>
          <button className="btn btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={()=>navigate('/')}>← Accueil</button>
        </div>
      </div>
    </div>
  );
}
