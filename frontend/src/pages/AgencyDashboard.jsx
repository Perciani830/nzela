import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ManifestTab from './ManifestTab';

const API = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa','Matadi','Boma','Moanda'];
const DAYS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

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
  if (logoUrl) return <img src={logoUrl} alt={name} style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', border:'1px solid rgba(61,170,106,0.2)' }} onError={e => { e.target.style.display='none'; }} />;
  return <div style={{ width:size, height:size, borderRadius:radius, background:'linear-gradient(135deg,var(--green-d),var(--green-l))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--font)', fontWeight:800, fontSize:size*0.36 }}>{initials}</div>;
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
  return <div className="input-group"><label className="input-label">{label}</label>{children}</div>;
}

function Modal({ title, subtitle, onClose, onConfirm, confirmLabel='Sauvegarder', maxWidth=480, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-header">
          <div><h2>{title}</h2>{subtitle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{subtitle}</div>}</div>
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

function LogoUploader({ currentLogo, agencyName, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Sélectionnez une image (JPG, PNG, WebP…)'); return; }
    if (file.size > 500 * 1024) { alert('Image trop lourde — maximum 500 Ko.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => { onChange(ev.target.result); setUploading(false); };
    reader.onerror = () => { alert('Erreur de lecture du fichier'); setUploading(false); };
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
      <div style={{ position:'relative', flexShrink:0 }}>
        <AgencyAvatar name={agencyName} logoUrl={currentLogo} size={80} radius={16} />
        <button onClick={() => fileRef.current?.click()} style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'var(--green-d)', border:'2px solid var(--night)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }} title="Changer le logo">📷</button>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{agencyName}</div>
        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:8 }}>{currentLogo ? '✓ Logo personnalisé configuré' : 'Aucun logo — initiales affichées par défaut'}</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '⏳ Chargement…' : '📁 Choisir un fichier'}</button>
          {currentLogo && <button className="btn btn-danger" style={{ fontSize:12, padding:'6px 10px' }} onClick={() => onChange('')}>🗑️ Supprimer</button>}
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>JPG, PNG, WebP · Max 500 Ko</div>
      </div>
    </div>
  );
}

function buildDates(dateFrom, dateTo, activeDays) {
  if (!dateFrom || !dateTo || activeDays.length === 0) return [];
  const dates = [];
  const cur = new Date(dateFrom + 'T12:00:00');
  const end = new Date(dateTo + 'T12:00:00');
  while (cur <= end) {
    if (activeDays.includes(cur.getDay())) dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const { user, headers } = getAuth();
  const [tab, setTab]             = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats]         = useState({});
  const [trips, setTrips]         = useState([]);
  const [bookings, setBookings]   = useState([]);
  const [buses, setBuses]         = useState([]);
  const [settings, setSettings]   = useState({ cancel_rate:20, phone:'', email:'', address:'', logo_url:'' });
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busModal, setBusModal]   = useState(false);
  const [tripModal, setTripModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editBus, setEditBus]     = useState(null);
  const [editTrip, setEditTrip]   = useState(null);
  const [busForm, setBusForm]     = useState({ bus_name:'', total_seats:50, description:'' });
  const [tripForm, setTripForm]   = useState({ bus_id:'', departure_city:'', arrival_city:'', departure_date:'', departure_time:'', price:'', description:'' });
  const [bulkForm, setBulkForm]   = useState({ bus_id:'', departure_city:'', arrival_city:'', departure_time:'', price:'', description:'', date_from:'', date_to:'', active_days:[1,2,3,4,5] });
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const ok  = msg => setToast({ msg, type:'success' });
  const err = msg => setToast({ msg, type:'error' });
  const inf = msg => setToast({ msg, type:'info' });
  const goTab = (id) => { setTab(id); setSidebarOpen(false); };

  // Wrapper pour ManifestTab — reçoit (msg, type) et appelle setToast
  const showToast = (msg, type='info') => setToast({ msg, type });

  const prevPendingRef = useRef(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
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
      const newBookings = Array.isArray(b.data) ? b.data : [];
      setBookings(newBookings);
      setBuses(Array.isArray(bs.data) ? bs.data : []);
      setSettings(se.data);
      const newPending = newBookings.filter(b => b.status === 'pending').length;
      if (prevPendingRef.current !== null && newPending > prevPendingRef.current) {
        const diff = newPending - prevPendingRef.current;
        inf(`🎟️ ${diff} nouvelle${diff > 1 ? 's' : ''} réservation${diff > 1 ? 's' : ''} en attente !`);
      }
      prevPendingRef.current = newPending;
    } catch(e) {
      if (e.response?.status===401) { localStorage.clear(); navigate('/login'); }
      else if (!silent) err('Erreur de chargement');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setBulkPreview(buildDates(bulkForm.date_from, bulkForm.date_to, bulkForm.active_days));
  }, [bulkForm.date_from, bulkForm.date_to, bulkForm.active_days]);

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
  const doCreateBulk = async () => {
    const { departure_city, arrival_city, departure_time, price, date_from, date_to, bus_id, description } = bulkForm;
    if (!departure_city || !arrival_city)   return err('Départ et arrivée requis');
    if (departure_city === arrival_city)    return err('Départ et arrivée doivent être différents');
    if (!departure_time || !price)          return err('Heure et prix requis');
    if (!date_from || !date_to)             return err('Période requise');
    if (new Date(date_from) > new Date(date_to)) return err('Date début doit être avant date fin');
    if (bulkPreview.length === 0)           return err('Aucune date générée — vérifiez la période et les jours');
    setBulkLoading(true);
    try {
      const res = await axios.post(`${API}/agency/trips/bulk`, { bus_id: bus_id || null, departure_city, arrival_city, departure_time, price: parseFloat(price), description: description || null, dates: bulkPreview }, { headers });
      ok(`✅ ${res.data.created} voyage${res.data.created > 1 ? 's' : ''} créé${res.data.created > 1 ? 's' : ''} !`);
      setBulkModal(false);
      setBulkForm({ bus_id:'', departure_city:'', arrival_city:'', departure_time:'', price:'', description:'', date_from:'', date_to:'', active_days:[1,2,3,4,5] });
      load();
    } catch(e) { err(e.response?.data?.error||'Erreur'); }
    finally { setBulkLoading(false); }
  };
  const doConfirm = async id => {
    try { await axios.patch(`${API}/agency/bookings/${id}/confirm`, {}, { headers }); ok('Confirmée ✓'); load(); }
    catch { err('Erreur'); }
  };
  const doCancel = async (id, amount) => {
    if (!confirm(`Annuler cette réservation ?\n${Number(amount).toLocaleString('fr-FR')} FC retirés de vos revenus.`)) return;
    try { await axios.patch(`${API}/agency/bookings/${id}/cancel`, {}, { headers }); inf('Annulée — revenus mis à jour'); load(); }
    catch { err('Erreur'); }
  };
  const toggleDay = (day) => setBulkForm(f => ({ ...f, active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort() }));

  // ── TABS — Manifeste ajouté ────────────────────────────────
  const TABS = [
    { id:'overview',  icon:'📊', label:"Vue d'ensemble" },
    { id:'buses',     icon:'🚌', label:'Mes bus' },
    { id:'trips',     icon:'🗺️', label:'Voyages' },
    { id:'bookings',  icon:'🎟️', label:'Réservations' },
    { id:'manifest',  icon:'📋', label:'Manifeste' },
    { id:'settings',  icon:'⚙️', label:'Paramètres' },
  ];

  const pending = bookings.filter(b => b.status==='pending').length;
  const agencyName = settings.agency_name || user.agency_name || user.username;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">☰</button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo"><SidebarLogo agencyName={agencyName} logoUrl={settings.logo_url} /></div>
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
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={() => goTab(t.id)}>
              <span className="nav-icon">{t.icon}</span><span>{t.label}</span>
              {t.id==='bookings' && pending>0 && <span style={{ marginLeft:'auto', background:'var(--gold)', color:'#000', borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{pending}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'8px' }} onClick={() => { localStorage.clear(); navigate('/login'); }}>🚪 Déconnexion</button>
          <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:8 }}>© 2026 Nzela RDC</div>
        </div>
      </aside>

      <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', overflowX:'hidden' }}>
        <div className="dash-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h1 style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800 }}>{TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}</h1>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {tab==='buses' && <button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Bus</button>}
            {tab==='trips' && <>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setBulkModal(true)}>📅 En masse</button>
              <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Voyage</button>
            </>}
            <button className="btn btn-ghost mobile-logout" style={{ fontSize:12, padding:'7px 11px' }} onClick={() => { localStorage.clear(); navigate('/login'); }}>🚪</button>
          </div>
        </div>

        {/* Manifeste ne dépend pas du loading global */}
        {tab === 'manifest'
          ? <ManifestTab agencyName={agencyName} showToast={showToast} />
          : loading
            ? <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
            : <>

          {tab==='overview' && <>
            <div className="grid-4" style={{ marginBottom:16 }}>
              {[
                { icon:'💰', label:'Revenus nets', value:`${Number(stats.total_revenue||0).toLocaleString('fr-FR')} FC`, cls:'gold' },
                { icon:'💎', label:`Commission Nzela (${settings.commission_rate||10}%)`, value:`${Number(stats.total_commission||0).toLocaleString('fr-FR')} FC`, cls:'green' },
                { icon:'🚌', label:'Bus actifs', value:stats.total_buses||0, cls:'navy' },
                { icon:'⏳', label:'En attente', value:stats.pending_bookings||0, cls:'purple' },
              ].map((s,i) => (
                <div key={i} className={`stat-card ${s.cls} fade-in fade-in-${i+1}`}>
                  <div className="stat-icon">{s.icon}</div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div>
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
                : <div style={{ overflowX:'auto' }}><table className="data-table">
                    <thead><tr><th>Passager</th><th>Trajet</th><th>Montant</th><th>Statut</th></tr></thead>
                    <tbody>{bookings.slice(0,5).map(b => (
                      <tr key={b.id}>
                        <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                        <td>{b.departure_city} → {b.arrival_city}</td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                        <td><StatusBadge status={b.status}/></td>
                      </tr>
                    ))}</tbody>
                  </table></div>}
            </div>
          </>}

          {tab==='buses' && <div style={{ display:'grid', gap:10 }}>
            {buses.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}><div style={{ fontSize:44, marginBottom:12 }}>🚌</div><h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucun bus enregistré</h3><button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Ajouter un bus</button></div>
              : buses.map((bus,i) => (
                <div key={bus.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'13px 18px' }}>
                  <div className="bus-card-row">
                    <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🚌</div>
                      <div><div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:700 }}>{bus.bus_name}</div><div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>{bus.total_seats} sièges{bus.description&&` · ${bus.description}`}</div></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span className={`badge ${bus.is_active?'b-g':'b-r'}`}>{bus.is_active?'✓ Actif':'⛔ Inactif'}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px' }} onClick={() => setEditBus({...bus})}>✏️ Modifier</button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px' }} onClick={() => doDeleteBus(bus.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>}

          {tab==='trips' && <div style={{ display:'grid', gap:10 }}>
            {trips.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:12 }}>Aucun voyage</h3>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => setBulkModal(true)}>📅 Générer en masse</button>
                    <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Nouveau voyage</button>
                  </div>
                </div>
              : trips.map((t,i) => (
                <div key={t.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'12px 18px' }}>
                  <div className="trip-card-row">
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <div style={{ textAlign:'center', minWidth:58 }}>
                        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{t.departure_city}</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--green-l)' }}>{t.departure_time}</div>
                      </div>
                      <div style={{ color:'var(--muted)', fontSize:18 }}>→</div>
                      <div style={{ textAlign:'center', minWidth:58 }}>
                        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{t.arrival_city}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{new Date(t.departure_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</div>
                      </div>
                      {t.bus_name && <span className="badge b-b" style={{ fontSize:11 }}>🚌 {t.bus_name}</span>}
                      <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800, color:'var(--gold)' }}>{Number(t.price).toLocaleString('fr-FR')} <span style={{ fontSize:11, fontWeight:500 }}>FC</span></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <div style={{ textAlign:'right' }}><div style={{ fontWeight:700, fontSize:12 }}>{t.available_seats}/{t.total_seats}</div><div style={{ fontSize:11, color:'var(--muted)' }}>places</div></div>
                      <span className={`badge ${t.available_seats>0?'b-g':'b-r'}`}>{t.available_seats>0?'✓ Actif':'⛔ Complet'}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px' }} onClick={() => setEditTrip({...t})}>✏️</button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px' }} onClick={() => doDeleteTrip(t.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>}

          {tab==='bookings' && <div className="glass" style={{ overflow:'hidden' }}>
            {bookings.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>📭 Aucune réservation</div>
              : <div style={{ overflowX:'auto' }}><table className="data-table">
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
                </table></div>}
          </div>}

          {tab==='settings' && <div style={{ maxWidth:540 }}>
            <div className="glass p-16 fade-in" style={{ marginBottom:12 }}>
              <div className="section-title">🖼️ Logo de l'agence</div>
              <LogoUploader currentLogo={settings.logo_url} agencyName={agencyName} onChange={val => setSettings({...settings, logo_url: val})} />
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
                    <span style={{ color:'var(--muted)' }}>{l}</span><span style={{ fontWeight:700, color:c }}>{v} FC</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:42, fontSize:13 }} disabled={savingSettings}
              onClick={async () => {
                setSavingSettings(true);
                try { await axios.patch(`${API}/agency/settings`, settings, { headers }); ok('Paramètres sauvegardés ✓'); }
                catch(e) { err(e.response?.data?.error||'Erreur'); }
                finally { setSavingSettings(false); }
              }}>
              {savingSettings ? <><div className="spinner"/>Sauvegarde…</> : '💾 Sauvegarder'}
            </button>
          </div>}
        </>}
      </main>

      <nav className="mobile-bottom-nav">
        {TABS.map(t => (
          <button key={t.id} className={`mobile-tab-btn ${tab===t.id?'active':''}`} onClick={() => goTab(t.id)}>
            <span className="mobile-tab-icon">{t.icon}</span>
            <span className="mobile-tab-label">{t.label}</span>
            {t.id==='bookings' && pending>0 && <span className="mobile-tab-badge">{pending}</span>}
          </button>
        ))}
      </nav>

      {busModal && <Modal title="🚌 Ajouter un bus" onClose={() => setBusModal(false)} onConfirm={doCreateBus} confirmLabel="Ajouter →">
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <Inp label="Nom du bus *"><input className="input-field" placeholder="Bus 1, Minibus A…" value={busForm.bus_name} onChange={e=>setBusForm({...busForm,bus_name:e.target.value})} /></Inp>
          <Inp label="Sièges"><input className="input-field" type="number" min="1" max="200" value={busForm.total_seats} onChange={e=>setBusForm({...busForm,total_seats:parseInt(e.target.value)})} /></Inp>
          <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={busForm.description} onChange={e=>setBusForm({...busForm,description:e.target.value})} /></Inp>
        </div>
      </Modal>}

      {editBus && <Modal title={`✏️ Modifier — ${editBus.bus_name}`} onClose={() => setEditBus(null)} onConfirm={doSaveBus} confirmLabel="💾 Sauvegarder">
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <Inp label="Nom"><input className="input-field" value={editBus.bus_name} onChange={e=>setEditBus({...editBus,bus_name:e.target.value})} /></Inp>
          <Inp label="Sièges"><input className="input-field" type="number" min="1" max="200" value={editBus.total_seats} onChange={e=>setEditBus({...editBus,total_seats:parseInt(e.target.value)})} /></Inp>
          <Inp label="Description"><input className="input-field" value={editBus.description||''} onChange={e=>setEditBus({...editBus,description:e.target.value})} /></Inp>
          <div>
            <label className="input-label" style={{ display:'block', marginBottom:6 }}>Statut</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['✓ Actif',1],['⛔ Inactif',0]].map(([l,v]) => (
                <button key={v} className={`btn ${editBus.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }} onClick={() => setEditBus({...editBus,is_active:v})}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>}

      {tripModal && <Modal title="🗺️ Nouveau voyage" onClose={() => setTripModal(false)} onConfirm={doCreateTrip} confirmLabel="Créer →" maxWidth={500}>
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
      </Modal>}

      {editTrip && <Modal title="✏️ Modifier le voyage" subtitle={`${editTrip.departure_city} → ${editTrip.arrival_city}`} onClose={() => setEditTrip(null)} onConfirm={doSaveTrip} confirmLabel="💾 Sauvegarder" maxWidth={500}>
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
      </Modal>}

      {bulkModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setBulkModal(false)}>
          <div className="modal-box" style={{ maxWidth:540 }}>
            <div className="modal-header">
              <div>
                <h2>📅 Générer des voyages en masse</h2>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Configure une liaison + une période → tous les voyages créés en un clic</div>
              </div>
              <button className="modal-close" onClick={() => setBulkModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div className="grid-2">
                <Inp label="Départ *"><select className="input-field" value={bulkForm.departure_city} onChange={e=>setBulkForm({...bulkForm,departure_city:e.target.value})}><option value="">Ville</option>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
                <Inp label="Arrivée *"><select className="input-field" value={bulkForm.arrival_city} onChange={e=>setBulkForm({...bulkForm,arrival_city:e.target.value})}><option value="">Ville</option>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Inp>
              </div>
              <Inp label="Bus (optionnel)">
                <select className="input-field" value={bulkForm.bus_id} onChange={e=>setBulkForm({...bulkForm,bus_id:e.target.value})}>
                  <option value="">Sans bus spécifique</option>
                  {buses.filter(b=>b.is_active).map(b=><option key={b.id} value={b.id}>{b.bus_name} — {b.total_seats} sièges</option>)}
                </select>
              </Inp>
              <div className="grid-2">
                <Inp label="Heure de départ *"><input className="input-field" type="time" value={bulkForm.departure_time} onChange={e=>setBulkForm({...bulkForm,departure_time:e.target.value})} /></Inp>
                <Inp label="Prix / siège (FC) *"><input className="input-field" type="number" placeholder="45000" value={bulkForm.price} onChange={e=>setBulkForm({...bulkForm,price:e.target.value})} /></Inp>
              </div>
              <div className="grid-2">
                <Inp label="Du *"><input className="input-field" type="date" min={new Date().toISOString().split('T')[0]} value={bulkForm.date_from} onChange={e=>setBulkForm({...bulkForm,date_from:e.target.value})} /></Inp>
                <Inp label="Au *"><input className="input-field" type="date" min={bulkForm.date_from||new Date().toISOString().split('T')[0]} value={bulkForm.date_to} onChange={e=>setBulkForm({...bulkForm,date_to:e.target.value})} /></Inp>
              </div>
              <div>
                <div className="input-label" style={{ marginBottom:8 }}>Jours de départ</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {DAYS_FR.map((day, idx) => (
                    <button key={idx} onClick={() => toggleDay(idx)} style={{ padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', transition:'var(--ease)', background:bulkForm.active_days.includes(idx)?'var(--green-d)':'var(--card)', border:`1px solid ${bulkForm.active_days.includes(idx)?'var(--green)':'var(--border)'}`, color:bulkForm.active_days.includes(idx)?'#fff':'var(--muted)' }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={bulkForm.description} onChange={e=>setBulkForm({...bulkForm,description:e.target.value})} /></Inp>
              {bulkPreview.length > 0 && (
                <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.2)', borderRadius:10, padding:'11px 13px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--green-l)', marginBottom:8 }}>✅ {bulkPreview.length} voyage{bulkPreview.length > 1 ? 's' : ''} seront créés</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {bulkPreview.slice(0,14).map(d => (
                      <span key={d} style={{ background:'rgba(61,170,106,.1)', border:'1px solid rgba(61,170,106,.2)', borderRadius:6, padding:'2px 8px', fontSize:11, color:'var(--text)' }}>
                        {new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}
                      </span>
                    ))}
                    {bulkPreview.length > 14 && <span style={{ fontSize:11, color:'var(--muted)', alignSelf:'center' }}>+{bulkPreview.length - 14} autres</span>}
                  </div>
                </div>
              )}
              {bulkForm.date_from && bulkForm.date_to && bulkPreview.length === 0 && (
                <div style={{ background:'rgba(240,80,80,0.08)', border:'1px solid rgba(240,80,80,0.2)', borderRadius:10, padding:'10px 13px', fontSize:12, color:'var(--err)' }}>
                  ⚠️ Aucune date générée — vérifiez les jours cochés et la période.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setBulkModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={doCreateBulk} disabled={bulkLoading || bulkPreview.length === 0}>
                {bulkLoading ? <><div className="spinner"/>Création…</> : `🚀 Créer ${bulkPreview.length > 0 ? bulkPreview.length + ' voyage' + (bulkPreview.length > 1 ? 's' : '') : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
