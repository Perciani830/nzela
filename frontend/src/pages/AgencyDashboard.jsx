import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = 'https://nzela-production.up.railway.app/api';
const CITIES = ['Kinshasa','Matadi','Boma','Moanda'];

function getAuth() {
  return {
    user: JSON.parse(localStorage.getItem('user') || '{}'),
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={`toast ${type==='success'?'t-ok':type==='error'?'t-err':'t-inf'}`} style={{ zIndex:300 }}>
      {type==='success'?'✓':type==='error'?'✕':'·'} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:15 }}>×</button>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = { pending:['En attente','b-o'], confirmed:['Confirmé','b-g'], cancelled:['Annulé','b-r'] };
  const [l,c] = m[status] || [status,'b-b'];
  return <span className={`badge ${c}`}>{l}</span>;
}

function AgencyAvatar({ name, logoUrl, size=32, radius=8 }) {
  const initials = name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '?';
  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name} style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', border:'1px solid rgba(61,170,106,0.2)' }}
        onError={e => { e.target.style.display='none'; }} />
    );
  }
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:'linear-gradient(135deg,var(--green-d),var(--green-l))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--font)', fontWeight:800, fontSize:size*0.36 }}>
      {initials}
    </div>
  );
}

function SidebarLogo({ agencyName, logoUrl }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
      <AgencyAvatar name={agencyName} logoUrl={logoUrl} size={30} radius={8} />
      <div>
        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{agencyName}</div>
        <div style={{ fontSize:10, color:'var(--muted)' }}>Espace Agence · nzela</div>
      </div>
    </div>
  );
}

function Inp({ label, children }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, subtitle, onClose, onConfirm, confirmLabel='Sauvegarder', maxWidth=480, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" style={{ fontSize:12, padding:'7px 14px' }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGO UPLOAD — convertit en base64 ─────────────────────────
function LogoUploader({ currentLogo, agencyName, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Vérifie que c'est bien une image
    if (!file.type.startsWith('image/')) {
      alert('Sélectionnez une image (JPG, PNG, WebP…)');
      return;
    }
    // Limite à 500 Ko pour ne pas saturer SQLite
    if (file.size > 500 * 1024) {
      alert('Image trop lourde — maximum 500 Ko. Compressez-la avant upload.');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target.result); // base64 data URL
      setUploading(false);
    };
    reader.onerror = () => { alert('Erreur de lecture du fichier'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
      {/* Aperçu */}
      <div style={{ position:'relative', flexShrink:0 }}>
        <AgencyAvatar name={agencyName} logoUrl={currentLogo} size={80} radius={16} />
        <button
          onClick={() => fileRef.current?.click()}
          style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'var(--green-d)', border:'2px solid var(--night)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}
          title="Changer le logo"
        >📷</button>
      </div>

      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{agencyName}</div>
        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:8 }}>
          {currentLogo ? '✓ Logo personnalisé configuré' : 'Aucun logo — initiales affichées par défaut'}
        </div>

        {/* Bouton upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={handleFile}
        />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize:12, padding:'6px 12px' }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Chargement…' : '📁 Choisir un fichier'}
          </button>
          {currentLogo && (
            <button
              className="btn btn-danger"
              style={{ fontSize:12, padding:'6px 10px' }}
              onClick={() => onChange('')}
            >
              🗑️ Supprimer
            </button>
          )}
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
          JPG, PNG, WebP · Max 500 Ko
        </div>
      </div>
    </div>
  );
}

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const { user, headers } = getAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats]       = useState({});
  const [trips, setTrips]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [buses, setBuses]       = useState([]);
  const [settings, setSettings] = useState({ cancel_rate:20, phone:'', email:'', address:'', logo_url:'' });
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busModal, setBusModal]   = useState(false);
  const [tripModal, setTripModal] = useState(false);
  const [editBus, setEditBus]     = useState(null);
  const [editTrip, setEditTrip]   = useState(null);
  const [busForm, setBusForm]     = useState({ bus_name:'', total_seats:50, description:'' });
  const [tripForm, setTripForm]   = useState({ bus_id:'', departure_city:'', arrival_city:'', departure_date:'', departure_time:'', price:'', description:'' });

  const ok  = msg => setToast({ msg, type:'success' });
  const err = msg => setToast({ msg, type:'error' });
  const inf = msg => setToast({ msg, type:'info' });

  const load = async () => {
    setLoading(true);
    try {
      const [s,t,b,bs,se] = await Promise.all([
        axios.get(`${API}/agency/stats`,    { headers }),
        axios.get(`${API}/agency/trips`,    { headers }),
        axios.get(`${API}/agency/bookings`, { headers }),
        axios.get(`${API}/agency/buses`,    { headers }),
        axios.get(`${API}/agency/settings`, { headers }),
      ]);
      setStats(s.data);
      setTrips(Array.isArray(t.data) ? t.data : []);
      setBookings(Array.isArray(b.data) ? b.data : []);
      setBuses(Array.isArray(bs.data) ? bs.data : []);
      setSettings(se.data);
    } catch(e) {
      if (e.response?.status===401) { localStorage.clear(); navigate('/login'); }
      else err('Erreur de chargement');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // BUS
  const doCreateBus = async () => {
    if (!busForm.bus_name) return err('Nom du bus requis');
    try { await axios.post(`${API}/agency/buses`, busForm, { headers }); ok('Bus ajouté 🚌'); setBusModal(false); setBusForm({ bus_name:'', total_seats:50, description:'' }); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doSaveBus = async () => {
    try { await axios.patch(`${API}/agency/buses/${editBus.id}`, editBus, { headers }); ok('Bus mis à jour ✓'); setEditBus(null); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doDeleteBus = async id => {
    if (!confirm('Désactiver ce bus ?')) return;
    try { await axios.delete(`${API}/agency/buses/${id}`, { headers }); inf('Bus désactivé'); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };

  // TRIPS
  const doCreateTrip = async () => {
    const { departure_city, arrival_city, departure_date, departure_time, price } = tripForm;
    if (!departure_city||!arrival_city||!departure_date||!departure_time||!price) return err('Champs obligatoires manquants');
    try { await axios.post(`${API}/agency/trips`, tripForm, { headers }); ok('Voyage créé 🎉'); setTripModal(false); setTripForm({ bus_id:'', departure_city:'', arrival_city:'', departure_date:'', departure_time:'', price:'', description:'' }); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doSaveTrip = async () => {
    try { await axios.patch(`${API}/agency/trips/${editTrip.id}`, editTrip, { headers }); ok('Voyage modifié ✓'); setEditTrip(null); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doDeleteTrip = async id => {
    if (!confirm('Supprimer ce voyage ?')) return;
    try { await axios.delete(`${API}/agency/trips/${id}`, { headers }); inf('Voyage supprimé'); load(); }
    catch(e) { err(e.response?.data?.error||'Impossible : réservations actives sur ce voyage'); }
  };

  // BOOKINGS
  const doConfirm = async id => {
    try { await axios.patch(`${API}/agency/bookings/${id}/confirm`, {}, { headers }); ok('Confirmée ✓'); load(); }
    catch { err('Erreur'); }
  };
  const doCancel = async (id, amount) => {
    if (!confirm(`Annuler cette réservation ?\n${Number(amount).toLocaleString('fr-FR')} FC retirés de vos revenus.`)) return;
    try { await axios.patch(`${API}/agency/bookings/${id}/cancel`, {}, { headers }); inf('Annulée — revenus mis à jour'); load(); }
    catch { err('Erreur'); }
  };

  const TABS = [
    { id:'overview', icon:'📊', label:"Vue d'ensemble" },
    { id:'buses',    icon:'🚌', label:'Mes bus' },
    { id:'trips',    icon:'🗺️', label:'Voyages' },
    { id:'bookings', icon:'🎟️', label:'Réservations' },
    { id:'settings', icon:'⚙️', label:'Paramètres' },
  ];
  const pending = bookings.filter(b => b.status==='pending').length;
  const agencyName = settings.agency_name || user.agency_name || user.username;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <SidebarLogo agencyName={agencyName} logoUrl={settings.logo_url} />
        </div>
        <div style={{ padding:'10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
            <AgencyAvatar name={agencyName} logoUrl={settings.logo_url} size={38} radius={10} />
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{agencyName}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>Agence partenaire · RDC</div>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
              {t.id==='bookings' && pending>0 && (
                <span style={{ marginLeft:'auto', background:'var(--gold)', color:'#000', borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{pending}</span>
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'8px' }}
            onClick={() => { localStorage.clear(); navigate('/login'); }}>🚪 Déconnexion</button>
          <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:8 }}>© 2026 Nzela RDC</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, padding:'24px 28px', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h1 style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800 }}>
              {TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}
            </h1>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
          {tab==='buses'  && <button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Ajouter un bus</button>}
          {tab==='trips'  && <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Nouveau voyage</button>}
        </div>

        {loading
          ? <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
          : <>

          {/* OVERVIEW */}
          {tab==='overview' && <>
            <div className="grid-4" style={{ marginBottom:16 }}>
              {[
                { icon:'💰', label:'Revenus nets', value:`${Number(stats.total_revenue||0).toLocaleString('fr-FR')} FC`, cls:'gold' },
                { icon:'💎', label:`Commission Nzela (${settings.commission_rate||10}%)`, value:`${Number(stats.total_commission||0).toLocaleString('fr-FR')} FC`, cls:'green' },
                { icon:'🚌', label:'Bus actifs', value:stats.total_buses||0, cls:'navy' },
                { icon:'⏳', label:'En attente', value:stats.pending_bookings||0, cls:'purple' },
              ].map((s,i) => (
                <div key={i} className={`stat-card ${s.cls} fade-in fade-in-${i+1}`}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="glass p-16 fade-in fade-in-3">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div className="section-title" style={{ margin:0 }}>Réservations récentes</div>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 10px' }} onClick={() => setTab('bookings')}>Voir tout →</button>
              </div>
              {bookings.length===0
                ? <div style={{ textAlign:'center', padding:'28px', color:'var(--muted)', fontSize:13 }}>📭 Aucune réservation</div>
                : <table className="data-table">
                    <thead><tr><th>Passager</th><th>Trajet</th><th>Bus</th><th>Montant</th><th>Commission</th><th>Statut</th></tr></thead>
                    <tbody>{bookings.slice(0,5).map(b => (
                      <tr key={b.id}>
                        <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                        <td>{b.departure_city} → {b.arrival_city}</td>
                        <td>{b.bus_name?<span className="badge b-b" style={{ fontSize:11 }}>{b.bus_name}</span>:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                        <td style={{ color:'var(--err)', fontSize:12 }}>-{Number(b.commission_amount||0).toLocaleString('fr-FR')} FC</td>
                        <td><StatusBadge status={b.status}/></td>
                      </tr>
                    ))}</tbody>
                  </table>
              }
            </div>
          </>}

          {/* BUS */}
          {tab==='buses' && <div style={{ display:'grid', gap:10 }}>
            {buses.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>🚌</div>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucun bus enregistré</h3>
                  <button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Ajouter un bus</button>
                </div>
              : buses.map((bus,i) => (
                <div key={bus.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'13px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🚌</div>
                      <div>
                        <div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:700 }}>{bus.bus_name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>{bus.total_seats} sièges{bus.description&&` · ${bus.description}`}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className={`badge ${bus.is_active?'b-g':'b-r'}`}>{bus.is_active?'✓ Actif':'⛔ Inactif'}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px' }} onClick={() => setEditBus({...bus})}>✏️ Modifier</button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px' }} onClick={() => doDeleteBus(bus.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>}

          {/* TRIPS */}
          {tab==='trips' && <div style={{ display:'grid', gap:10 }}>
            {trips.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucun voyage</h3>
                  <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Nouveau voyage</button>
                </div>
              : trips.map((t,i) => (
                <div key={t.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'12px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ textAlign:'center', minWidth:58 }}>
                        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{t.departure_city}</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--green-l)' }}>{t.departure_time}</div>
                      </div>
                      <div style={{ color:'var(--muted)' }}>→</div>
                      <div style={{ textAlign:'center', minWidth:58 }}>
                        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{t.arrival_city}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{new Date(t.departure_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</div>
                      </div>
                      <div style={{ width:1, height:26, background:'var(--border)', margin:'0 2px' }}/>
                      {t.bus_name && <span className="badge b-b" style={{ fontSize:11 }}>🚌 {t.bus_name}</span>}
                      <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800, color:'var(--gold)' }}>{Number(t.price).toLocaleString('fr-FR')} <span style={{ fontSize:11, fontWeight:500 }}>FC</span></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:700, fontSize:12 }}>{t.available_seats}/{t.total_seats}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>places</div>
                      </div>
                      <span className={`badge ${t.available_seats>0?'b-g':'b-r'}`}>{t.available_seats>0?'✓ Actif':'⛔ Complet'}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px' }} onClick={() => setEditTrip({...t})}>✏️</button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px' }} onClick={() => doDeleteTrip(t.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>}

          {/* BOOKINGS */}
          {tab==='bookings' && <div className="glass" style={{ overflow:'hidden' }}>
            {bookings.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>📭 Aucune réservation</div>
              : <div style={{ overflowX:'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Référence</th><th>Passager</th><th>Trajet</th><th>Bus</th><th>Total</th><th>Commission</th><th>Paiement</th><th>Statut</th><th>Actions</th></tr></thead>
                    <tbody>{bookings.map(b => (
                      <tr key={b.id}>
                        <td><code style={{ background:'var(--green-bg)', padding:'2px 7px', borderRadius:5, fontSize:11, color:'var(--green-l)' }}>{b.reference}</code></td>
                        <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                        <td><div>{b.departure_city} → {b.arrival_city}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{new Date(b.departure_date).toLocaleDateString('fr-FR')} · {b.departure_time}</div></td>
                        <td>{b.bus_name?<span className="badge b-b" style={{ fontSize:11 }}>{b.bus_name}</span>:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                        <td style={{ color:'var(--err)', fontSize:12 }}>{b.commission_amount>0?`-${Number(b.commission_amount).toLocaleString('fr-FR')} FC`:'—'}</td>
                        <td><span className="badge b-b" style={{ fontSize:11 }}>{b.payment_method==='cash'?'💵 Espèces':'📱 Mobile'}</span></td>
                        <td><StatusBadge status={b.status}/></td>
                        <td><div style={{ display:'flex', gap:5 }}>
                          {b.status==='pending'&&<button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 9px', color:'var(--ok)', borderColor:'rgba(61,170,106,0.2)' }} onClick={() => doConfirm(b.id)}>✓</button>}
                          {(b.status==='pending'||b.status==='confirmed')&&<button className="btn btn-danger" style={{ fontSize:11, padding:'5px 9px' }} onClick={() => doCancel(b.id,b.total_price)}>✕</button>}
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </div>}

          {/* SETTINGS */}
          {tab==='settings' && <div style={{ maxWidth:540 }}>

            {/* ✅ LOGO UPLOAD LOCAL */}
            <div className="glass p-16 fade-in" style={{ marginBottom:12 }}>
              <div className="section-title">🖼️ Logo de l'agence</div>
              <LogoUploader
                currentLogo={settings.logo_url}
                agencyName={agencyName}
                onChange={val => setSettings({...settings, logo_url: val})}
              />
            </div>

            <div className="glass p-16 fade-in fade-in-2" style={{ marginBottom:12 }}>
              <div className="section-title">🏢 Informations</div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                <Inp label="Email"><input className="input-field" placeholder="contact@agence.cd" value={settings.email||''} onChange={e=>setSettings({...settings,email:e.target.value})} /></Inp>
                <Inp label="Téléphone"><input className="input-field" placeholder="+243 81 000 0000" value={settings.phone||''} onChange={e=>setSettings({...settings,phone:e.target.value})} /></Inp>
                <Inp label="Adresse"><input className="input-field" placeholder="Avenue du Commerce, Kinshasa" value={settings.address||''} onChange={e=>setSettings({...settings,address:e.target.value})} /></Inp>
              </div>
            </div>

            <div className="glass p-16 fade-in fade-in-3" style={{ marginBottom:12 }}>
              <div className="section-title">💸 Politique d'annulation</div>
              <p style={{ color:'var(--muted)', fontSize:12, marginBottom:12, lineHeight:1.6 }}>Pourcentage retenu quand un client annule.</p>
              <div style={{ marginBottom:12 }}>
                <Inp label="Taux de rétention (%)"><input className="input-field" type="number" min="0" max="100" step="5" value={settings.cancel_rate||20} onChange={e=>setSettings({...settings,cancel_rate:Number(e.target.value)})} /></Inp>
              </div>
              <div style={{ background:'rgba(61,170,106,0.05)', border:'1px solid rgba(61,170,106,0.12)', borderRadius:9, padding:'11px 13px' }}>
                <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Simulation sur 45 000 FC</div>
                {[
                  ['Commission Nzela ('+(settings.commission_rate||10)+'%)', (45000*(settings.commission_rate||10)/100).toLocaleString('fr-FR'), 'var(--err)'],
                  ['Rétention agence ('+(settings.cancel_rate||20)+'%)', (45000*(settings.cancel_rate||20)/100).toLocaleString('fr-FR'), 'var(--gold)'],
                  ['Remboursement client', Math.max(0,45000*(1-(settings.commission_rate||10)/100-(settings.cancel_rate||20)/100)).toLocaleString('fr-FR'), 'var(--ok)'],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'var(--muted)' }}>{l}</span>
                    <span style={{ fontWeight:700, color:c }}>{v} FC</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:42, fontSize:13 }} disabled={savingSettings}
              onClick={async () => {
                setSavingSettings(true);
                try {
                  await axios.patch(`${API}/agency/settings`, settings, { headers });
                  ok('Paramètres sauvegardés ✓');
                } catch(e) { err(e.response?.data?.error||'Erreur'); }
                finally { setSavingSettings(false); }
              }}>
              {savingSettings ? <><div className="spinner"/>Sauvegarde…</> : '💾 Sauvegarder'}
            </button>
          </div>}
        </>}
      </main>

      {/* ── MODALS ── */}
      {busModal && (
        <Modal title="🚌 Ajouter un bus" onClose={() => setBusModal(false)} onConfirm={doCreateBus} confirmLabel="Ajouter →">
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="Nom du bus *"><input className="input-field" placeholder="Bus 1, Minibus A…" value={busForm.bus_name} onChange={e=>setBusForm({...busForm,bus_name:e.target.value})} /></Inp>
            <Inp label="Sièges"><input className="input-field" type="number" min="1" max="200" value={busForm.total_seats} onChange={e=>setBusForm({...busForm,total_seats:parseInt(e.target.value)})} /></Inp>
            <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={busForm.description} onChange={e=>setBusForm({...busForm,description:e.target.value})} /></Inp>
          </div>
        </Modal>
      )}
      {editBus && (
        <Modal title={`✏️ Modifier — ${editBus.bus_name}`} onClose={() => setEditBus(null)} onConfirm={doSaveBus} confirmLabel="💾 Sauvegarder">
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="Nom"><input className="input-field" value={editBus.bus_name} onChange={e=>setEditBus({...editBus,bus_name:e.target.value})} /></Inp>
            <Inp label="Sièges"><input className="input-field" type="number" min="1" max="200" value={editBus.total_seats} onChange={e=>setEditBus({...editBus,total_seats:parseInt(e.target.value)})} /></Inp>
            <Inp label="Description"><input className="input-field" value={editBus.description||''} onChange={e=>setEditBus({...editBus,description:e.target.value})} /></Inp>
            <div>
              <label className="input-label" style={{ display:'block', marginBottom:6 }}>Statut</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['✓ Actif',1],['⛔ Inactif',0]].map(([l,v]) => (
                  <button key={v} className={`btn ${editBus.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }}
                    onClick={() => setEditBus({...editBus,is_active:v})}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
      {tripModal && (
        <Modal title="🗺️ Nouveau voyage" onClose={() => setTripModal(false)} onConfirm={doCreateTrip} confirmLabel="Créer →" maxWidth={500}>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="Bus (optionnel)">
              <select className="input-field" value={tripForm.bus_id} onChange={e=>setTripForm({...tripForm,bus_id:e.target.value})}>
                <option value="">Sans bus spécifique</option>
                {buses.filter(b=>b.is_active).map(b=><option key={b.id} value={b.id}>{b.bus_name} — {b.total_seats} sièges</option>)}
              </select>
            </Inp>
            <div className="grid-2">
              <Inp label="Départ *"><select className="input-field" value={tripForm.departure_city} onChange={e=>setTripForm({...tripForm,departure_city:e.target.value})}><option value="">Ville</option>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
              <Inp label="Arrivée *"><select className="input-field" value={tripForm.arrival_city} onChange={e=>setTripForm({...tripForm,arrival_city:e.target.value})}><option value="">Ville</option>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
            </div>
            <div className="grid-2">
              <Inp label="Date *"><input className="input-field" type="date" min={new Date().toISOString().split('T')[0]} value={tripForm.departure_date} onChange={e=>setTripForm({...tripForm,departure_date:e.target.value})} /></Inp>
              <Inp label="Heure départ *"><input className="input-field" type="time" value={tripForm.departure_time} onChange={e=>setTripForm({...tripForm,departure_time:e.target.value})} /></Inp>
            </div>
            <Inp label="Prix par siège (FC) *"><input className="input-field" type="number" placeholder="45000" value={tripForm.price} onChange={e=>setTripForm({...tripForm,price:e.target.value})} /></Inp>
            <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={tripForm.description} onChange={e=>setTripForm({...tripForm,description:e.target.value})} /></Inp>
          </div>
        </Modal>
      )}
      {editTrip && (
        <Modal title="✏️ Modifier le voyage" subtitle={`${editTrip.departure_city} → ${editTrip.arrival_city}`} onClose={() => setEditTrip(null)} onConfirm={doSaveTrip} confirmLabel="💾 Sauvegarder" maxWidth={500}>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <div className="grid-2">
              <Inp label="Départ"><select className="input-field" value={editTrip.departure_city} onChange={e=>setEditTrip({...editTrip,departure_city:e.target.value})}>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
              <Inp label="Arrivée"><select className="input-field" value={editTrip.arrival_city} onChange={e=>setEditTrip({...editTrip,arrival_city:e.target.value})}>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
            </div>
            <div className="grid-2">
              <Inp label="Date"><input className="input-field" type="date" value={editTrip.departure_date} onChange={e=>setEditTrip({...editTrip,departure_date:e.target.value})} /></Inp>
              <Inp label="Heure"><input className="input-field" type="time" value={editTrip.departure_time} onChange={e=>setEditTrip({...editTrip,departure_time:e.target.value})} /></Inp>
            </div>
            <Inp label="Prix (FC)"><input className="input-field" type="number" value={editTrip.price} onChange={e=>setEditTrip({...editTrip,price:e.target.value})} /></Inp>
            <div className="grid-2">
              <Inp label="Places totales"><input className="input-field" type="number" min="1" value={editTrip.total_seats} onChange={e=>setEditTrip({...editTrip,total_seats:parseInt(e.target.value)})} /></Inp>
              <div>
                <Inp label="Places disponibles"><input className="input-field" type="number" min="0" max={editTrip.total_seats} value={editTrip.available_seats} onChange={e=>setEditTrip({...editTrip,available_seats:parseInt(e.target.value)})} /></Inp>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Réduction manuelle possible</div>
              </div>
            </div>
            <Inp label="Description"><input className="input-field" value={editTrip.description||''} onChange={e=>setEditTrip({...editTrip,description:e.target.value})} /></Inp>
          </div>
        </Modal>
      )}
    </div>
  );
}