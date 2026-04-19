import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = 'https://nzela-production-086a.up.railway.app/api';

export default function LoginAgency() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); setError('');
    if (!form.username || !form.password) return setError('Remplissez tous les champs');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate(res.data.user.role === 'admin' ? '/admin' : '/agency');
    } catch(e) { setError(e.response?.data?.error || 'Identifiants incorrects'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        .login-wrapper {
          min-height: 100vh;
          display: flex;
          background: var(--night);
          position: relative;
          overflow: hidden;
        }
        /* GAUCHE */
        .login-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 60px 80px;
          position: relative;
          z-index: 1;
        }
        /* DROITE */
        .login-right {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 48px;
          position: relative;
          z-index: 1;
          background: rgba(255,255,255,0.018);
          border-left: 1px solid rgba(76,175,118,0.08);
          backdrop-filter: blur(30px);
        }
        /* MOBILE */
        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column;
          }
          /* Partie gauche réduite au logo + titre seulement */
          .login-left {
            padding: 32px 20px 20px;
            align-items: center;
            text-align: center;
          }
          .login-left-features { display: none; }
          .login-left-quote    { display: none; }
          .login-left-logo     { margin-bottom: 20px; }
          .login-left-title h1 { font-size: 26px !important; }
          .login-left-title p  { display: none; }
          /* Partie droite prend toute la largeur */
          .login-right {
            width: 100%;
            border-left: none;
            border-top: 1px solid rgba(76,175,118,0.08);
            padding: 28px 20px 40px;
          }
        }
      `}</style>

      <div className="login-wrapper">
        <div className="mesh-bg"><div className="mesh-blob"/></div>
        <div className="noise"/>

        {/* GAUCHE */}
        <div className="login-left">
          {/* Logo */}
          <a href="/" className="login-left-logo" style={{ display:'flex', alignItems:'center', gap:12, textDecoration:'none', marginBottom:48 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'rgba(76,175,118,0.1)', border:'1px solid rgba(76,175,118,0.3)', display:'flex', alignItems:'center', justifyContent:'center', padding:6, boxShadow:'0 6px 20px rgba(76,175,118,0.25)' }}>
              <img src="/nzela-icon.png" alt="Nzela" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            </div>
            <span style={{ fontFamily:'var(--font)', fontSize:28, fontWeight:800, background:'linear-gradient(90deg,#fff,var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'-0.02em' }}>nzela</span>
          </a>

          {/* Titre */}
          <div className="login-left-title fade-in">
            <h1 style={{ fontFamily:'var(--font)', fontSize:'clamp(28px,4vw,56px)', fontWeight:800, lineHeight:1.1, marginBottom:18 }}>
              Gérez votre<br />
              <span style={{ background:'linear-gradient(90deg,var(--green),var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>agence de bus</span><br />
              simplement.
            </h1>
            <p style={{ color:'var(--muted)', fontSize:16, lineHeight:1.7, maxWidth:400, marginBottom:48 }}>
              Tableau de bord, gestion de flotte, réservations en temps réel. Tout en un seul endroit.
            </p>
          </div>

          {/* Features — masquées sur mobile */}
          <div className="login-left-features fade-in fade-in-2" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              ['🚌','Gestion de flotte','Nommez vos bus, suivez leur disponibilité'],
              ['💳','Paiements Mobile Money','M-Pesa, Orange, Airtel intégrés'],
              ['⚙️','Paramètres flexibles','Taux d\'annulation personnalisable'],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:44, height:44, borderRadius:12, background:'rgba(76,175,118,0.08)', border:'1px solid rgba(76,175,118,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:15, marginBottom:2 }}>{title}</div>
                  <div style={{ fontSize:13, color:'var(--muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Citation — masquée sur mobile */}
          <div className="login-left-quote" style={{ marginTop:64, fontSize:14, color:'var(--muted)', fontStyle:'italic' }}>
            "Nzela — Ta route commence ici."
          </div>
        </div>

        {/* DROITE — formulaire */}
        <div className="login-right">
          <div className="fade-in">
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(76,175,118,0.1)', border:'1px solid rgba(76,175,118,0.2)', borderRadius:99, padding:'5px 14px', fontSize:12, color:'var(--green-l)', fontWeight:600, marginBottom:24, letterSpacing:'0.06em' }}>
              🔐 ESPACE AGENCE
            </div>
            <h2 style={{ fontFamily:'var(--font)', fontSize:32, fontWeight:800, marginBottom:8 }}>Bon retour 👋</h2>
            <p style={{ color:'var(--muted)', fontSize:15, marginBottom:32 }}>Connectez-vous à votre espace de gestion</p>

            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <label className="input-label" style={{ marginBottom:8, display:'block' }}>Identifiant</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, pointerEvents:'none', opacity:0.5 }}>👤</span>
                  <input className="input-field" style={{ paddingLeft:42 }} placeholder="nom_utilisateur" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} />
                </div>
              </div>
              <div>
                <label className="input-label" style={{ marginBottom:8, display:'block' }}>Mot de passe</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, pointerEvents:'none', opacity:0.5 }}>🔒</span>
                  <input className="input-field" style={{ paddingLeft:42, paddingRight:48 }} type={showPass?'text':'password'} placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
                  <button type="button" onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, opacity:0.5 }}>
                    {showPass?'🙈':'👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background:'rgba(255,74,74,0.1)', border:'1px solid rgba(255,74,74,0.25)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'var(--err)', display:'flex', gap:8, alignItems:'center' }}>
                  ⚠️ {error}
                </div>
              )}

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', height:52, fontSize:16, marginTop:4 }}>
                {loading ? <><div className="spinner"/>Connexion…</> : <>Se connecter →</>}
              </button>
            </form>

            <div style={{ textAlign:'center', marginTop:24, fontSize:13, color:'var(--muted)' }}>
              <a href="/" style={{ color:'var(--green-l)', textDecoration:'none' }}>← Retour au site public</a>
            </div>
          </div>

          <div style={{ marginTop:'auto', paddingTop:40, fontSize:12, color:'var(--muted)', textAlign:'center' }}>
            © 2026 Nzela · Ta route commence ici.
          </div>
        </div>
      </div>
    </>
  );
}
