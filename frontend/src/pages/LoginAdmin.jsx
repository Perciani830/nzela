import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginAdmin() {
  const { loginAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  if (user?.role === 'admin') { navigate('/dashboard'); return null; }

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handle = async e => {
    e.preventDefault(); setError('');
    try { await loginAdmin(username, password); navigate('/dashboard'); }
    catch (err) { setError(err.response?.data?.error || 'Identifiants incorrects'); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(150deg,#0D1B2A 0%,#0F2942 60%,#1A1A2E 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'380px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ width:'64px', height:'64px', background:'rgba(245,158,11,.15)', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'30px', margin:'0 auto 12px' }}>👑</div>
          <h1 style={{ fontWeight:800, color:'#fff', fontSize:'24px' }}>Administration</h1>
          <p style={{ color:'rgba(255,255,255,.4)', fontSize:'13px', marginTop:'4px' }}>Accès restreint — Super Admin</p>
        </div>

        <div className="card" style={{ borderRadius:'18px' }}>
          <form onSubmit={handle}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="label">Nom d'utilisateur</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="superadmin" required autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom:'20px' }}>
              <label className="label">Mot de passe</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>
              {loading ? <><span className="spinner"/> Vérification...</> : '🔐 Accéder au panneau'}
            </button>
          </form>
          <div style={{ marginTop:'16px', padding:'10px', background:'#F8FAFC', borderRadius:'var(--radius-sm)', fontSize:'12px', color:'var(--muted)', textAlign:'center' }}>
            Démo : <code>superadmin</code> / <code>Admin@2024!</code>
          </div>
        </div>
      </div>
    </div>
  );
}
