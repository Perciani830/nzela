import { useEffect, useState } from 'react';

export default function PaymentSuccess() {
  const params = new URLSearchParams(window.location.search);
  const ref    = params.get('ref') || '';
  const type   = params.get('type') || 'booking';
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, []);

  const isContrib = type === 'contribution';

  return (
    <div style={{ minHeight:'100vh', background:'#050E17', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Plus Jakarta Sans, DM Sans, sans-serif' }}>
      <div style={{ background:'linear-gradient(160deg,#0d1f16,#081220)', border:'1px solid rgba(61,170,106,0.3)', borderRadius:28, padding:'52px 40px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Cercle succès animé */}
        <div style={{ position:'relative', width:100, height:100, margin:'0 auto 28px' }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(61,170,106,0.2)', animation:'ping 1.5s ease-out infinite' }} />
          <div style={{ width:100, height:100, borderRadius:'50%', background:'rgba(61,170,106,0.12)', border:'2px solid #3DAA6A', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:44 }}>✅</span>
          </div>
        </div>

        <h1 style={{ fontSize:28, fontWeight:800, color:'#3DAA6A', margin:'0 0 12px' }}>
          {isContrib ? 'Merci pour votre soutien !' : 'Paiement confirmé !'}
        </h1>

        <p style={{ fontSize:16, color:'rgba(232,244,237,0.7)', lineHeight:1.7, marginBottom:20 }}>
          {isContrib
            ? 'Votre contribution a bien été reçue. Nzela grandit grâce à des personnes comme vous. 💚'
            : 'Votre paiement par carte a bien été reçu. Votre billet est confirmé.'}
        </p>

        {ref && (
          <div style={{ background:'rgba(61,170,106,0.07)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:12, padding:'12px 16px', marginBottom:28 }}>
            <p style={{ fontSize:12, color:'rgba(232,244,237,0.4)', margin:'0 0 4px' }}>Référence de transaction</p>
            <p style={{ fontSize:14, color:'#3DAA6A', fontWeight:700, margin:0, fontFamily:'monospace', letterSpacing:'0.05em', wordBreak:'break-all' }}>{ref}</p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <a href="/" style={{ background:'#3DAA6A', color:'#050E17', borderRadius:14, padding:'14px', fontWeight:800, fontSize:16, textDecoration:'none', display:'block' }}>
            {isContrib ? 'Retour à l\'accueil' : 'Retourner au site'}
          </a>
        </div>

        <p style={{ fontSize:12, color:'rgba(232,244,237,0.25)', marginTop:20 }}>
          🇨🇩 Nzela — Ta route commence ici
        </p>
      </div>

      <style>{`
        @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(1.5);opacity:0} }
      `}</style>
    </div>
  );
}