export default function PaymentFailed() {
  const params = new URLSearchParams(window.location.search);
  const ref    = params.get('ref') || '';
  const type   = params.get('type') || 'booking';

  return (
    <div style={{ minHeight:'100vh', background:'#050E17', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Plus Jakarta Sans, DM Sans, sans-serif' }}>
      <div style={{ background:'linear-gradient(160deg,#1f0d0d,#120808)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:28, padding:'52px 40px', maxWidth:480, width:'100%', textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}>

        <div style={{ width:100, height:100, borderRadius:'50%', background:'rgba(220,80,80,0.1)', border:'2px solid rgba(220,80,80,0.5)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 28px' }}>
          <span style={{ fontSize:44 }}>❌</span>
        </div>

        <h1 style={{ fontSize:28, fontWeight:800, color:'#ff8080', margin:'0 0 12px' }}>Paiement échoué</h1>

        <p style={{ fontSize:16, color:'rgba(232,244,237,0.6)', lineHeight:1.7, marginBottom:20 }}>
          Votre paiement par carte n'a pas pu être traité. Aucun montant n'a été débité.
        </p>

        {ref && (
          <div style={{ background:'rgba(220,80,80,0.06)', border:'1px solid rgba(220,80,80,0.15)', borderRadius:12, padding:'12px 16px', marginBottom:28 }}>
            <p style={{ fontSize:12, color:'rgba(232,244,237,0.35)', margin:'0 0 4px' }}>Référence</p>
            <p style={{ fontSize:13, color:'rgba(255,128,128,0.8)', fontWeight:600, margin:0, fontFamily:'monospace', wordBreak:'break-all' }}>{ref}</p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <a href="/" style={{ background:'rgba(220,80,80,0.12)', color:'#ff8080', border:'1px solid rgba(220,80,80,0.3)', borderRadius:14, padding:'14px', fontWeight:700, fontSize:15, textDecoration:'none', display:'block' }}>
            Réessayer
          </a>
          <a href="/" style={{ color:'rgba(232,244,237,0.4)', fontSize:13, textDecoration:'none' }}>
            Retour à l'accueil
          </a>
        </div>

        <p style={{ fontSize:12, color:'rgba(232,244,237,0.2)', marginTop:20 }}>
          Si le problème persiste, contactez support@nzela.cd
        </p>
      </div>
    </div>
  );
}