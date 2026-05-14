import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ManifestTab from './ManifestTab';
import SeatMapModal from './SeatMapModal';
import {
  Check, X, Info, Crown, LogOut, Globe, Menu,
  BarChart2, Bus, Map, Ticket, ClipboardList, Users, Settings,
  Building2, Anchor, Mountain, Waves, MapPin,
  Camera, FolderOpen, Trash2, Loader,
  Calendar, Wallet, Gem, Clock,
  Inbox, ImageIcon, Building, Percent, Save,
  Banknote, Smartphone, Pencil, Ban, KeyRound, Wrench,
  AlertTriangle, Rocket, User, CheckCircle,
} from 'lucide-react';

const API = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa','Matadi','Boma','Moanda'];
const DAYS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// Icônes / couleurs par ville pour les badges
const CITY_META = {
  Kinshasa: { color:'#3DAA6A', bg:'rgba(61,170,106,0.12)', Icon: Building2 },
  Boma:     { color:'#4A90D9', bg:'rgba(74,144,217,0.12)', Icon: Anchor },
  Matadi:   { color:'#E8A838', bg:'rgba(232,168,56,0.12)',  Icon: Mountain },
  Moanda:   { color:'#9B59B6', bg:'rgba(155,89,182,0.12)', Icon: Waves },
};

function getAuth() {
  return {
    user: JSON.parse(localStorage.getItem('user') || '{}'),
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const Icon = type === 'success' ? Check : type === 'error' ? X : Info;
  return (
    <div className={`toast ${type==='success'?'t-ok':type==='error'?'t-err':'t-inf'}`} style={{ zIndex:300, display:'flex', alignItems:'center', gap:7 }}>
      <Icon size={13} />
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'inherit', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={14} /></button>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = { pending:['En attente','b-o'], confirmed:['Confirmé','b-g'], cancelled:['Annulé','b-r'] };
  const [l,c] = m[status] || [status,'b-b'];
  return <span className={`badge ${c}`}>{l}</span>;
}

function CityBadge({ city }) {
  const meta = CITY_META[city] || { color:'var(--muted)', bg:'var(--card)', Icon: MapPin };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:meta.bg, color:meta.color, border:`1px solid ${meta.color}30`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
      <meta.Icon size={10} /> {city}
    </span>
  );
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
        <button onClick={() => fileRef.current?.click()} style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'var(--green-d)', border:'2px solid var(--night)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Changer le logo"><Camera size={11} color="#fff" /></button>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{agencyName}</div>
        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>{currentLogo ? <><Check size={11} /> Logo personnalisé configuré</> : 'Aucun logo — initiales affichées par défaut'}</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile} />
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:5 }} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <><Loader size={11} /> Chargement…</> : <><FolderOpen size={11} /> Choisir un fichier</>}</button>
          {currentLogo && <button className="btn btn-danger" style={{ fontSize:12, padding:'6px 10px', display:'inline-flex', alignItems:'center', gap:5 }} onClick={() => onChange('')}><Trash2 size={11} /> Supprimer</button>}
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

// ── Composant : Sélecteur de voyage pour le manifeste ─────────────────────────
function ManifestTripSelector({ trips, selectedId, onChange, userCity, isOwner }) {
  const relevantTrips = isOwner ? trips : trips.filter(t => t.departure_city === userCity);
  // Trier : les plus récents en premier
  const sorted = [...relevantTrips].sort((a,b) => {
    const da = new Date(`${a.departure_date}T${a.departure_time}`);
    const db = new Date(`${b.departure_date}T${b.departure_time}`);
    return db - da;
  });

  // Grouper par date
  const grouped = {};
  sorted.forEach(t => {
    const key = t.departure_date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
        Sélectionner un voyage
      </div>
      <select
        className="input-field"
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        style={{ width:'100%', fontSize:13 }}
      >
        <option value="">— Choisir un voyage pour voir son manifeste —</option>
        {Object.entries(grouped).map(([date, dayTrips]) => (
          <optgroup key={date} label={new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}>
            {dayTrips.map(t => (
              <option key={t.id} value={t.id}>
                {t.departure_city} → {t.arrival_city} · {t.departure_time} · {t.available_seats}/{t.total_seats} places {t.bus_name ? `· ${t.bus_name}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {sorted.length === 0 && (
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:8, padding:'10px', background:'var(--card)', borderRadius:8, textAlign:'center' }}>
          Aucun voyage créé. Créez des voyages depuis l'onglet Voyages.
        </div>
      )}
    </div>
  );
}

// ── Composant : Stats par ville (vue propriétaire) ─────────────────────────────
function CityStatsGrid({ trips, bookings }) {
  const cityData = CITIES.map(city => {
    const cityTrips    = trips.filter(t => t.departure_city === city);
    const cityBookings = bookings.filter(b => b.departure_city === city);
    const confirmed    = cityBookings.filter(b => b.status === 'confirmed').length;
    const pending      = cityBookings.filter(b => b.status === 'pending').length;
    const revenue      = cityBookings.filter(b => b.status !== 'cancelled').reduce((s,b) => s + Number(b.total_price||0), 0);
    const fillRate     = cityTrips.length > 0
      ? Math.round(cityBookings.filter(b=>b.status!=='cancelled').length / cityTrips.reduce((s,t) => s+(t.total_seats||0), 0) * 100)
      : 0;
    return { city, trips: cityTrips.length, bookings: cityBookings.length, confirmed, pending, revenue, fillRate };
  }).filter(d => d.trips > 0 || d.bookings > 0);

  if (cityData.length === 0) return null;

  return (
    <div className="glass p-16 fade-in fade-in-4" style={{ marginBottom:14 }}>
      <div className="section-title" style={{ marginBottom:12, display:'flex', alignItems:'center', gap:7 }}><MapPin size={14} /> Performance par ville</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:10 }}>
        {cityData.map(d => {
          const meta = CITY_META[d.city] || { color:'var(--green-l)', bg:'var(--green-bg)', Icon: MapPin };
          return (
            <div key={d.city} style={{ background:meta.bg, border:`1px solid ${meta.color}25`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <meta.Icon size={20} color={meta.color} />
                <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, color:meta.color }}>{d.city}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  ['Voyages',  d.trips,     'var(--text)'],
                  ['Réservés', d.confirmed, 'var(--ok)'],
                  ['En attente', d.pending, 'var(--gold)'],
                  ['Taux remplissage', `${d.fillRate}%`, meta.color],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ background:'rgba(0,0,0,0.12)', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10, padding:'7px 10px', background:'rgba(0,0,0,0.12)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>Revenus</span>
                <span style={{ fontWeight:800, fontSize:13, color:'var(--gold)' }}>{d.revenue.toLocaleString('fr-FR')} FC</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Composant : Tabs filtre ville (pour propriétaire) ─────────────────────────
function CityFilterTabs({ value, onChange, trips, bookings }) {
  const activeCities = CITIES.filter(c =>
    trips.some(t => t.departure_city === c) || bookings.some(b => b.departure_city === c)
  );
  if (activeCities.length < 2) return null;
  const tabs = [{ id:'all', label:'Toutes', Icon: Globe }, ...activeCities.map(c => ({ id:c, label:c, Icon: CITY_META[c]?.Icon || MapPin }))];
  return (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
      {tabs.map(t => {
        const meta = CITY_META[t.id];
        const isActive = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.18s',
              background: isActive ? (meta?.color || 'var(--green-d)') : 'var(--card)',
              border: `1px solid ${isActive ? (meta?.color || 'var(--green-d)') : 'var(--border)'}`,
              color: isActive ? '#fff' : 'var(--muted)',
              display:'inline-flex', alignItems:'center', gap:5,
            }}
          >
            <t.Icon size={11} /> {t.label}
          </button>
        );
      })}
    </div>
  );
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
  const [settings, setSettings]   = useState({ cancel_rate:20, phone:'', email:'', address:'', logo_url:'', home_city:'' });
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busModal, setBusModal]   = useState(false);
  const [tripModal, setTripModal] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [editBus, setEditBus]     = useState(null);
  const [editTrip, setEditTrip]   = useState(null);
  const [seatModal, setSeatModal] = useState(null); // { trip } — vue occupation sièges
  const [cityFilter, setCityFilter] = useState('all');
  const [manifestTripId, setManifestTripId] = useState('');
  const [busForm, setBusForm]     = useState({ bus_name:'', total_seats:50, layout:'2+3', description:'' });
  const [tripForm, setTripForm]   = useState({ bus_id:'', departure_city:'', arrival_city:'', departure_date:'', departure_time:'', price:'', description:'' });
  const [bulkForm, setBulkForm]   = useState({ bus_id:'', departure_city:'', arrival_city:'', departure_time:'', price:'', description:'', date_from:'', date_to:'', active_days:[1,2,3,4,5] });
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── État onglet Gestionnaires ─────────────────────────────────────────────────
  const [agencyUsers, setAgencyUsers]       = useState([]);
  const [usersLoading, setUsersLoading]     = useState(false);
  const [userModal, setUserModal]           = useState(false);
  const [editUser, setEditUser]             = useState(null);
  const [resetPassModal, setResetPassModal] = useState(null);
  const [newPass, setNewPass]               = useState('');
  const [userForm, setUserForm]             = useState({ username:'', password:'', full_name:'', city:'', role:'manager' });

  const ok  = msg => setToast({ msg, type:'success' });
  const err = msg => setToast({ msg, type:'error' });
  const inf = msg => setToast({ msg, type:'info' });
  const goTab = (id) => { setTab(id); setSidebarOpen(false); };
  const showToast = (msg, type='info') => setToast({ msg, type });

  // ── Ville du gestionnaire connecté ───────────────────────────────────────────
  // user.is_owner → vient du JWT signé par le serveur (infalsifiable)
  // user.city     → ville filtrée, null si propriétaire
  const isOwner  = user.is_owner === true;
  const userCity = isOwner ? null : (user.city || null);

  // ── Filtrage des voyages et réservations ──────────────────────────────────────
  const filteredByCity = (arr, cityKey) => {
    if (isOwner) return cityFilter === 'all' ? arr : arr.filter(x => x[cityKey] === cityFilter);
    return arr.filter(x => x[cityKey] === userCity);
  };

  const visibleTrips    = filteredByCity(trips,    'departure_city');
  const visibleBookings = filteredByCity(bookings, 'departure_city');

  // Voyages disponibles pour le sélecteur de manifeste (filtrés par ville du gestionnaire)
  const manifestTrips = isOwner ? trips : trips.filter(t => t.departure_city === userCity);

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
      setSettings(prev => ({ ...prev, ...se.data }));
      const newPending = newBookings.filter(b => b.status === 'pending').length;
      if (prevPendingRef.current !== null && newPending > prevPendingRef.current) {
        const diff = newPending - prevPendingRef.current;
        inf(`${diff} nouvelle${diff > 1 ? 's' : ''} réservation${diff > 1 ? 's' : ''} en attente !`);
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

  // Pré-remplir la ville de départ dès que userCity est connu
  useEffect(() => {
    if (userCity) {
      setTripForm(f => ({ ...f, departure_city: userCity }));
      setBulkForm(f => ({ ...f, departure_city: userCity }));
    }
  }, [userCity]);

  const doCreateBus = async () => {
    if (!busForm.bus_name) return err('Nom du bus requis');
    try { await axios.post(`${API}/agency/buses`, busForm, { headers }); ok('Bus ajouté'); setBusModal(false); setBusForm({ bus_name:'', total_seats:50, layout:'2+3', description:'' }); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doSaveBus = async () => {
    try { await axios.patch(`${API}/agency/buses/${editBus.id}`, editBus, { headers }); ok('Bus mis à jour'); setEditBus(null); load(); }
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
    if (departure_city === arrival_city) return err('Départ et arrivée doivent être différents');
    try { await axios.post(`${API}/agency/trips`, tripForm, { headers }); ok('Voyage créé'); setTripModal(false); setTripForm({ bus_id:'', departure_city: userCity||'', arrival_city:'', departure_date:'', departure_time:'', price:'', description:'' }); load(); }
    catch(e) { err(e.response?.data?.error||'Erreur'); }
  };
  const doSaveTrip = async () => {
    try { await axios.patch(`${API}/agency/trips/${editTrip.id}`, editTrip, { headers }); ok('Voyage modifié'); setEditTrip(null); load(); }
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
      ok(`${res.data.created} voyage${res.data.created > 1 ? 's' : ''} créé${res.data.created > 1 ? 's' : ''} !`);
      setBulkModal(false);
      setBulkForm({ bus_id:'', departure_city: userCity||'', arrival_city:'', departure_time:'', price:'', description:'', date_from:'', date_to:'', active_days:[1,2,3,4,5] });
      load();
    } catch(e) { err(e.response?.data?.error||'Erreur'); }
    finally { setBulkLoading(false); }
  };
  const doConfirm = async id => {
    try { await axios.patch(`${API}/agency/bookings/${id}/confirm`, {}, { headers }); ok('Confirmée'); load(); }
    catch { err('Erreur'); }
  };
  const doCancel = async (id, amount) => {
    if (!confirm(`Annuler cette réservation ?\n${Number(amount).toLocaleString('fr-FR')} FC retirés de vos revenus.`)) return;
    try { await axios.patch(`${API}/agency/bookings/${id}/cancel`, {}, { headers }); inf('Annulée — revenus mis à jour'); load(); }
    catch { err('Erreur'); }
  };
  const toggleDay = (day) => setBulkForm(f => ({ ...f, active_days: f.active_days.includes(day) ? f.active_days.filter(d => d !== day) : [...f.active_days, day].sort() }));

  // ── CRUD Gestionnaires ────────────────────────────────────────────────────────
  const loadUsers = async () => {
    if (!isOwner) return;
    setUsersLoading(true);
    try {
      const r = await axios.get(`${API}/agency/users`, { headers });
      setAgencyUsers(Array.isArray(r.data) ? r.data : []);
    } catch { err('Erreur chargement gestionnaires'); }
    finally { setUsersLoading(false); }
  };

  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);

  const doCreateUser = async () => {
    const { username, password, full_name, city, role } = userForm;
    if (!username || !password) return err('Identifiant et mot de passe requis');
    if (password.length < 6)   return err('Mot de passe trop court (min. 6 caractères)');
    try {
      await axios.post(`${API}/agency/users`, { username, password, full_name, city: city||null, role }, { headers });
      ok(`Gestionnaire "${username}" créé`);
      setUserModal(false);
      setUserForm({ username:'', password:'', full_name:'', city:'', role:'manager' });
      loadUsers();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doSaveUser = async () => {
    try {
      await axios.patch(`${API}/agency/users/${editUser.id}`, {
        full_name: editUser.full_name,
        city:      editUser.city || null,
        role:      editUser.role,
        is_active: editUser.is_active,
      }, { headers });
      ok('Gestionnaire mis à jour');
      setEditUser(null);
      loadUsers();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doDeleteUser = async (id, username) => {
    if (!confirm(`Supprimer le compte "${username}" ? Cette action est irréversible.`)) return;
    try {
      await axios.delete(`${API}/agency/users/${id}`, { headers });
      inf(`Compte "${username}" supprimé`);
      loadUsers();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doResetPassword = async () => {
    if (!newPass || newPass.length < 6) return err('Mot de passe trop court (min. 6 caractères)');
    try {
      await axios.post(`${API}/agency/users/${resetPassModal.id}/reset-password`, { password: newPass }, { headers });
      ok(`Mot de passe de "${resetPassModal.username}" réinitialisé`);
      setResetPassModal(null);
      setNewPass('');
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  // ── Villes d'arrivée disponibles (exclut la ville de départ) ─────────────────
  const arrivalCities = (depCity) => CITIES.filter(c => c !== depCity);

  const TABS = [
    { id:'overview',  Icon: BarChart2,     label:"Vue d'ensemble" },
    { id:'buses',     Icon: Bus,           label:'Mes bus' },
    { id:'trips',     Icon: Map,           label:'Voyages' },
    { id:'bookings',  Icon: Ticket,        label:'Réservations' },
    { id:'manifest',  Icon: ClipboardList, label:'Manifeste' },
    ...(isOwner ? [{ id:'users', Icon: Users, label:'Gestionnaires' }] : []),
    { id:'settings',  Icon: Settings,      label:'Paramètres' },
  ];

  const pending = visibleBookings.filter(b => b.status==='pending').length;
  const agencyName = settings.agency_name || user.agency_name || user.username;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo"><SidebarLogo agencyName={agencyName} logoUrl={settings.logo_url} /></div>

        {/* Indicateur de ville du gestionnaire */}
        <div style={{ padding:'10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: userCity ? 8 : 0 }}>
              <AgencyAvatar name={agencyName} logoUrl={settings.logo_url} size={38} radius={10} />
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13 }}>{agencyName}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                  {isOwner ? <><Crown size={11} /> Propriétaire — toutes villes</> : 'Agence partenaire · RDC'}
                </div>
              </div>
            </div>
            {userCity && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>Ville :</span>
                <CityBadge city={userCity} />
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={() => goTab(t.id)}>
              <span className="nav-icon"><t.Icon size={15} /></span><span>{t.label}</span>
              {t.id==='bookings' && pending>0 && <span style={{ marginLeft:'auto', background:'var(--gold)', color:'#000', borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{pending}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'8px', display:'inline-flex', alignItems:'center', gap:7 }} onClick={() => { localStorage.clear(); navigate('/login'); }}><LogOut size={13} /> Déconnexion</button>
          <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:8 }}>© 2026 Nzela RDC</div>
        </div>
      </aside>

      <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', overflowX:'hidden' }}>
        <div className="dash-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <h1 style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, display:'flex', alignItems:'center', gap:8 }}>{(() => { const T = TABS.find(t=>t.id===tab); return T ? <T.Icon size={20} /> : null; })()} {TABS.find(t=>t.id===tab)?.label}</h1>
              {userCity && <CityBadge city={userCity} />}
              {isOwner && <span style={{ fontSize:11, background:'rgba(255,200,0,0.12)', color:'var(--gold)', border:'1px solid rgba(255,200,0,0.25)', borderRadius:6, padding:'2px 8px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}><Crown size={10} /> Vue globale</span>}
            </div>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {tab==='buses' && <button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Bus</button>}
            {tab==='trips' && <>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setBulkModal(true)}><Calendar size={12} style={{ marginRight:5 }} />En masse</button>
              <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Voyage</button>
            </>}
            {tab==='users' && isOwner && <button className="btn btn-primary" onClick={() => setUserModal(true)}>+ Gestionnaire</button>}
            <button className="btn btn-ghost mobile-logout" style={{ fontSize:12, padding:'7px 11px', display:'inline-flex', alignItems:'center' }} onClick={() => { localStorage.clear(); navigate('/login'); }}><LogOut size={14} /></button>
          </div>
        </div>

        {tab === 'manifest'
          ? (
            <div>
              {/* Sélecteur de voyage pour le manifeste */}
              <div className="glass p-16 fade-in" style={{ marginBottom:14 }}>
                <div className="section-title" style={{ marginBottom:4, display:'flex', alignItems:'center', gap:7 }}><ClipboardList size={14} /> Manifeste passagers</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>
                  Choisissez un voyage pour voir la liste des passagers — disponible dès la création du voyage.
                </div>
                <ManifestTripSelector
                  trips={trips}
                  selectedId={manifestTripId}
                  onChange={setManifestTripId}
                  userCity={userCity}
                  isOwner={isOwner}
                />
                {manifestTripId && (() => {
                  const trip = trips.find(t => String(t.id) === String(manifestTripId));
                  if (!trip) return null;
                  return (
                    <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <CityBadge city={trip.departure_city} />
                      <span style={{ color:'var(--muted)', fontSize:16 }}>→</span>
                      <CityBadge city={trip.arrival_city} />
                      <span style={{ fontSize:13, fontWeight:700 }}>{trip.departure_time}</span>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>{new Date(trip.departure_date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</span>
                      <span className={`badge ${trip.available_seats>0?'b-g':'b-r'}`}>{trip.available_seats}/{trip.total_seats} places</span>
                      {trip.bus_name && <span className="badge b-b">{trip.bus_name}</span>}
                    </div>
                  );
                })()}
              </div>
              {/* ManifestTab reçoit le tripId sélectionné */}
              <ManifestTab
                agencyName={agencyName}
                showToast={showToast}
                tripId={manifestTripId || undefined}
              />
            </div>
          )
          : loading
            ? <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
            : <>

          {tab==='overview' && <>
            <div className="grid-4" style={{ marginBottom:16 }}>
              {[
                { Icon: Wallet,  label:'Revenus nets', value:`${Number(stats.total_revenue||0).toLocaleString('fr-FR')} FC`, cls:'gold' },
                { Icon: Gem,     label:`Commission Nzela (${settings.commission_rate||10}%)`, value:`${Number(stats.total_commission||0).toLocaleString('fr-FR')} FC`, cls:'green' },
                { Icon: Bus,     label:'Bus actifs', value:stats.total_buses||0, cls:'navy' },
                { Icon: Clock,   label:'En attente', value:pending, cls:'purple' },
              ].map((s,i) => (
                <div key={i} className={`stat-card ${s.cls} fade-in fade-in-${i+1}`}>
                  <div className="stat-icon"><s.Icon size={22} /></div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Stats par ville — visible uniquement pour le propriétaire */}
            {isOwner && <CityStatsGrid trips={trips} bookings={bookings} />}

            <div className="glass p-16 fade-in fade-in-3">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div className="section-title" style={{ margin:0 }}>Réservations récentes {userCity && <CityBadge city={userCity} />}</div>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 10px' }} onClick={() => setTab('bookings')}>Voir tout →</button>
              </div>
              {visibleBookings.length===0
                ? <div style={{ textAlign:'center', padding:'28px', color:'var(--muted)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}><Inbox size={15} /> Aucune réservation{userCity ? ` pour ${userCity}` : ''}</div>
                : <div style={{ overflowX:'auto' }}><table className="data-table">
                    <thead><tr><th>Passager</th><th>Trajet</th><th>Montant</th><th>Statut</th></tr></thead>
                    <tbody>{visibleBookings.slice(0,5).map(b => (
                      <tr key={b.id}>
                        <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <CityBadge city={b.departure_city} />
                            <span style={{ color:'var(--muted)' }}>→</span>
                            <span style={{ fontWeight:600 }}>{b.arrival_city}</span>
                          </div>
                        </td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                        <td><StatusBadge status={b.status}/></td>
                      </tr>
                    ))}</tbody>
                  </table></div>}
            </div>
          </>}

          {tab==='buses' && <div style={{ display:'grid', gap:10 }}>
            {buses.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}><div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><Bus size={44} style={{ opacity:.2 }} /></div><h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucun bus enregistré</h3><button className="btn btn-primary" onClick={() => setBusModal(true)}>+ Ajouter un bus</button></div>
              : buses.map((bus,i) => (
                <div key={bus.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'13px 18px' }}>
                  <div className="bus-card-row">
                    <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Bus size={20} color="var(--green-l)" /></div>
                      <div><div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:700 }}>{bus.bus_name}</div><div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>{bus.total_seats} sièges{bus.description&&` · ${bus.description}`}</div></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span className={`badge ${bus.is_active?'b-g':'b-r'}`} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{bus.is_active?<><Check size={10}/> Actif</>:<><Ban size={10}/> Inactif</>}</span>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px', display:'inline-flex', alignItems:'center', gap:5 }} onClick={() => setEditBus({...bus})}><Pencil size={11} /> Modifier</button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px', display:'inline-flex', alignItems:'center' }} onClick={() => doDeleteBus(bus.id)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                </div>
              ))}
          </div>}

          {tab==='trips' && <div style={{ display:'grid', gap:10 }}>
            {/* Filtre ville pour propriétaire */}
            {isOwner && <CityFilterTabs value={cityFilter} onChange={setCityFilter} trips={trips} bookings={bookings} />}

            {/* Bandeau informatif pour les gestionnaires */}
            {!isOwner && userCity && (
              <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <MapPin size={14} color="var(--green-l)" />
                <span style={{ fontSize:13 }}>Vous gérez les départs depuis <strong>{userCity}</strong> — seuls les voyages partant de votre ville sont affichés.</span>
              </div>
            )}

            {visibleTrips.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                  <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:12 }}>
                    Aucun voyage{userCity ? ` depuis ${userCity}` : ''}
                  </h3>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => setBulkModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Calendar size={12} /> Générer en masse</button>
                    <button className="btn btn-primary" onClick={() => setTripModal(true)}>+ Nouveau voyage</button>
                  </div>
                </div>
              : visibleTrips.map((t,i) => (
                <div key={t.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'12px 18px' }}>
                  <div className="trip-card-row">
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      {/* Ville départ */}
                      <div style={{ textAlign:'center', minWidth:70 }}>
                        <CityBadge city={t.departure_city} />
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--green-l)', marginTop:4 }}>{t.departure_time}</div>
                      </div>
                      <div style={{ color:'var(--muted)', fontSize:18 }}>→</div>
                      {/* Ville arrivée */}
                      <div style={{ textAlign:'center', minWidth:70 }}>
                        <CityBadge city={t.arrival_city} />
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{new Date(t.departure_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</div>
                      </div>
                      {t.bus_name && <span className="badge b-b" style={{ fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}><Bus size={10} /> {t.bus_name}</span>}
                      <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800, color:'var(--gold)' }}>{Number(t.price).toLocaleString('fr-FR')} <span style={{ fontSize:11, fontWeight:500 }}>FC</span></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <div style={{ textAlign:'right' }}><div style={{ fontWeight:700, fontSize:12 }}>{t.available_seats}/{t.total_seats}</div><div style={{ fontSize:11, color:'var(--muted)' }}>places</div></div>
                      <span className={`badge ${t.available_seats>0?'b-g':'b-r'}`} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>{t.available_seats>0?<><Check size={10}/> Actif</>:<><Ban size={10}/> Complet</>}</span>
                      {/* Bouton manifeste rapide */}
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize:11, padding:'5px 9px', color:'var(--muted)', display:'inline-flex', alignItems:'center' }}
                        title="Voir le plan des sièges"
                        onClick={() => setSeatModal(t)}
                      >
                        <Bus size={11} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize:11, padding:'5px 9px', color:'var(--muted)', display:'inline-flex', alignItems:'center' }}
                        title="Voir le manifeste de ce voyage"
                        onClick={() => { setManifestTripId(String(t.id)); goTab('manifest'); }}
                      >
                        <ClipboardList size={11} />
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 11px', display:'inline-flex', alignItems:'center' }} onClick={() => setEditTrip({...t})}><Pencil size={11} /></button>
                      <button className="btn btn-danger" style={{ padding:'6px 10px', display:'inline-flex', alignItems:'center' }} onClick={() => doDeleteTrip(t.id)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                </div>
              ))}
          </div>}

          {tab==='bookings' && <div className="glass" style={{ overflow:'hidden' }}>
            {/* Filtre ville pour propriétaire */}
            {isOwner && (
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                <CityFilterTabs value={cityFilter} onChange={setCityFilter} trips={trips} bookings={bookings} />
              </div>
            )}
            {visibleBookings.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Inbox size={16} /> Aucune réservation{userCity ? ` depuis ${userCity}` : ''}</div>
              : <div style={{ overflowX:'auto' }}><table className="data-table">
                  <thead><tr><th>Référence</th><th>Passager</th><th>Trajet</th><th>Bus</th><th>Total</th><th>Commission</th><th>Paiement</th><th>Statut</th><th>Actions</th></tr></thead>
                  <tbody>{visibleBookings.map(b => (
                    <tr key={b.id}>
                      <td><code style={{ background:'var(--green-bg)', padding:'2px 7px', borderRadius:5, fontSize:11, color:'var(--green-l)' }}>{b.reference}</code></td>
                      <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                          <CityBadge city={b.departure_city} />
                          <span style={{ color:'var(--muted)', fontSize:12 }}>→</span>
                          <span style={{ fontSize:12, fontWeight:600 }}>{b.arrival_city}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{new Date(b.departure_date).toLocaleDateString('fr-FR')} · {b.departure_time}</div>
                      </td>
                      <td>{b.bus_name?<span className="badge b-b" style={{ fontSize:11 }}>{b.bus_name}</span>:<span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                      <td style={{ color:'var(--err)', fontSize:12 }}>{b.commission_amount>0?`-${Number(b.commission_amount).toLocaleString('fr-FR')} FC`:'—'}</td>
                      <td><span className="badge b-b" style={{ fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>{b.payment_method==='cash'?<><Banknote size={10}/> Espèces</>:<><Smartphone size={10}/> Mobile</>}</span></td>
                      <td><StatusBadge status={b.status}/></td>
                      <td><div style={{ display:'flex', gap:5 }}>
                        {b.status==='pending'&&<button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 9px', color:'var(--ok)', borderColor:'rgba(61,170,106,0.2)', display:'inline-flex', alignItems:'center' }} onClick={() => doConfirm(b.id)}><Check size={11} /></button>}
                        {(b.status==='pending'||b.status==='confirmed')&&<button className="btn btn-danger" style={{ fontSize:11, padding:'5px 9px', display:'inline-flex', alignItems:'center' }} onClick={() => doCancel(b.id,b.total_price)}><X size={11} /></button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table></div>}
          </div>}

          {tab==='settings' && <div style={{ maxWidth:540 }}>
            <div className="glass p-16 fade-in" style={{ marginBottom:12 }}>
              <div className="section-title" style={{ display:'flex', alignItems:'center', gap:7 }}><ImageIcon size={14} /> Logo de l'agence</div>
              <LogoUploader currentLogo={settings.logo_url} agencyName={agencyName} onChange={val => setSettings({...settings, logo_url: val})} />
            </div>
            <div className="glass p-16 fade-in fade-in-2" style={{ marginBottom:12 }}>
              <div className="section-title" style={{ display:'flex', alignItems:'center', gap:7 }}><Building size={14} /> Informations</div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                <Inp label="Email"><input className="input-field" placeholder="contact@agence.cd" value={settings.email||''} onChange={e=>setSettings({...settings,email:e.target.value})} /></Inp>
                <Inp label="Téléphone"><input className="input-field" placeholder="+243 81 000 0000" value={settings.phone||''} onChange={e=>setSettings({...settings,phone:e.target.value})} /></Inp>
                <Inp label="Adresse"><input className="input-field" placeholder="Avenue du Commerce, Kinshasa" value={settings.address||''} onChange={e=>setSettings({...settings,address:e.target.value})} /></Inp>
              </div>
            </div>

            {/* Ville principale du gestionnaire (si pas définie dans le JWT) */}
            {!user.city && (
              <div className="glass p-16 fade-in fade-in-2" style={{ marginBottom:12 }}>
              <div className="section-title" style={{ display:'flex', alignItems:'center', gap:7 }}><MapPin size={14} /> Ville principale de départ</div>
                <p style={{ color:'var(--muted)', fontSize:12, marginBottom:12, lineHeight:1.6 }}>
                  Définit les voyages que vous gérez. Vous ne verrez que les départs depuis cette ville.
                  Laissez vide pour voir toutes les villes (propriétaire).
                </p>
                <Inp label="Ville de départ">
                  <select className="input-field" value={settings.home_city||''} onChange={e=>setSettings({...settings,home_city:e.target.value})}>
                    <option value="">— Toutes les villes (propriétaire) —</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Inp>
                {settings.home_city && (
                  <div style={{ marginTop:8, padding:'8px 12px', background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:8, fontSize:12, color:'var(--green-l)', display:'flex', alignItems:'center', gap:6 }}>
                    <Check size={12} /> Vous gérerez uniquement les voyages partant de <strong>{settings.home_city}</strong>.
                  </div>
                )}
              </div>
            )}

            <div className="glass p-16 fade-in fade-in-3" style={{ marginBottom:12 }}>
              <div className="section-title" style={{ display:'flex', alignItems:'center', gap:7 }}><Percent size={14} /> Politique d'annulation</div>
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
                try { await axios.patch(`${API}/agency/settings`, settings, { headers }); ok('Paramètres sauvegardés'); }
                catch(e) { err(e.response?.data?.error||'Erreur'); }
                finally { setSavingSettings(false); }
              }}>
              {savingSettings ? <><div className="spinner"/>Sauvegarde…</> : <><Save size={13} style={{ marginRight:5 }} />Sauvegarder</>}
            </button>
          </div>}

          {tab==='users' && isOwner && (
            <div>
              {/* Bandeau expliquant le système */}
              <div className="glass p-16 fade-in" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:48, height:48, background:'var(--green-bg)', borderRadius:12, border:'1px solid rgba(61,170,106,0.2)' }}><Users size={26} color="var(--green-l)" /></div>
                  <div>
                    <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, marginBottom:6 }}>Gestion des accès par ville</div>
                    <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.7, margin:0 }}>
                      Créez un compte par ville pour chaque chef d'agence.
                      Chaque gestionnaire se connecte avec ses propres identifiants et ne voit que les voyages partant de <strong>sa ville</strong>.
                      Un gestionnaire sans ville assignée voit tout (rôle Propriétaire).
                    </p>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
                      {CITIES.map(c => {
                        const meta = CITY_META[c];
                        const hasManager = agencyUsers.some(u => u.city === c && u.is_active);
                        return (
                          <div key={c} style={{ display:'flex', alignItems:'center', gap:6, background: hasManager ? meta.bg : 'var(--card)', border:`1px solid ${hasManager ? meta.color+'40' : 'var(--border)'}`, borderRadius:8, padding:'5px 10px' }}>
                            <meta.Icon size={13} color={hasManager ? meta.color : 'var(--muted)'} />
                            <span style={{ fontSize:12, fontWeight:700, color: hasManager ? meta.color : 'var(--muted)' }}>{c}</span>
                            <span style={{ fontSize:10, color: hasManager ? meta.color : 'var(--muted)' }}>{hasManager ? <Check size={10} /> : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Liste des gestionnaires */}
              {usersLoading
                ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ width:32,height:32,margin:'0 auto',borderWidth:2.5 }}/></div>
                : agencyUsers.length === 0
                  ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                      <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><User size={44} style={{ opacity:.2 }} /></div>
                      <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:700, marginBottom:8 }}>Aucun gestionnaire créé</div>
                      <p style={{ fontSize:13, marginBottom:16 }}>Créez un compte pour chaque chef d'agence de ville.</p>
                      <button className="btn btn-primary" onClick={() => setUserModal(true)}>+ Créer le premier gestionnaire</button>
                    </div>
                  : <div style={{ display:'grid', gap:10 }}>
                      {agencyUsers.map((u, i) => {
                        const meta = u.city ? (CITY_META[u.city] || { color:'var(--muted)', bg:'var(--card)', Icon: MapPin }) : { color:'var(--gold)', bg:'rgba(245,166,35,0.1)', Icon: Crown };
                        return (
                          <div key={u.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'14px 18px', borderLeft:`3px solid ${u.is_active ? meta.color : 'var(--border)'}`, opacity: u.is_active ? 1 : 0.55 }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                                {/* Avatar */}
                                <div style={{ width:42, height:42, borderRadius:10, background:meta.bg, border:`1px solid ${meta.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                  <meta.Icon size={20} color={meta.color} />
                                </div>
                                <div>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                    <span style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{u.full_name || u.username}</span>
                                    {u.full_name && <code style={{ fontSize:11, color:'var(--muted)', background:'var(--card)', padding:'1px 6px', borderRadius:4 }}>{u.username}</code>}
                                    <span style={{ fontSize:11, background: u.role==='owner' ? 'rgba(245,166,35,0.12)' : 'var(--green-bg)', color: u.role==='owner' ? 'var(--gold)' : 'var(--green-l)', border:`1px solid ${u.role==='owner' ? 'rgba(245,166,35,0.25)' : 'rgba(61,170,106,0.25)'}`, borderRadius:6, padding:'1px 7px', fontWeight:700 }}>
                                    {u.role === 'owner' ? <><Crown size={9} /> Propriétaire</> : <><Wrench size={9} /> Gestionnaire</>}
                                    </span>
                                  </div>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                                    {u.city
                                      ? <><span style={{ fontSize:11, color:'var(--muted)' }}>Ville :</span><CityBadge city={u.city} /></>
                                      : <span style={{ fontSize:11, color:'var(--gold)' }}>Accès toutes villes</span>
                                    }
                                    <span className={`badge ${u.is_active ? 'b-g' : 'b-r'}`} style={{ fontSize:10 }}>{u.is_active ? 'Actif' : 'Désactivé'}</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 10px', display:'inline-flex', alignItems:'center', gap:4 }}
                                  onClick={() => setResetPassModal({ id: u.id, username: u.full_name || u.username })}>
                                  <KeyRound size={11} /> MDP
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 10px', display:'inline-flex', alignItems:'center', gap:4 }}
                                  onClick={() => setEditUser({ ...u })}>
                                  <Pencil size={11} /> Modifier
                                </button>
                                <button className="btn btn-danger" style={{ fontSize:11, padding:'5px 10px', display:'inline-flex', alignItems:'center' }}
                                  onClick={() => doDeleteUser(u.id, u.full_name || u.username)}>
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
              }
            </div>
          )}
        </>}
      </main>

      <nav className="mobile-bottom-nav">
        {TABS.map(t => (
          <button key={t.id} className={`mobile-tab-btn ${tab===t.id?'active':''}`} onClick={() => goTab(t.id)}>
          <span className="mobile-tab-icon"><t.Icon size={20} /></span>
            <span className="mobile-tab-label">{t.label}</span>
            {t.id==='bookings' && pending>0 && <span className="mobile-tab-badge">{pending}</span>}
          </button>
        ))}
      </nav>

      {/* ── MODALS ─────────────────────────────────────────────────────────────── */}

      {busModal && <Modal title={<><Bus size={14} style={{ marginRight:6 }} />Ajouter un bus</>} onClose={() => setBusModal(false)} onConfirm={doCreateBus} confirmLabel="Ajouter →">
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <Inp label="Nom du bus *"><input className="input-field" placeholder="Bus 1, Minibus A…" value={busForm.bus_name} onChange={e=>setBusForm({...busForm,bus_name:e.target.value})} /></Inp>
          <div className="grid-2">
            <Inp label="Sièges"><input className="input-field" type="number" min="6" max="200" value={busForm.total_seats} onChange={e=>setBusForm({...busForm,total_seats:parseInt(e.target.value)})} /></Inp>
            <Inp label="Disposition des sièges">
              <select className="input-field" value={busForm.layout} onChange={e=>setBusForm({...busForm,layout:e.target.value})}>
                <option value="2+3">2+3 — Bus standard</option>
                <option value="2+2">2+2 — Minibus</option>
                <option value="2">2 — Coach</option>
              </select>
            </Inp>
          </div>
          <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={busForm.description} onChange={e=>setBusForm({...busForm,description:e.target.value})} /></Inp>
        </div>
      </Modal>}

      {editBus && <Modal title={<><Pencil size={14} style={{ marginRight:6 }} />Modifier — {editBus.bus_name}</>} onClose={() => setEditBus(null)} onConfirm={doSaveBus} confirmLabel={<><Save size={12} style={{ marginRight:4 }} />Sauvegarder</>}>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <Inp label="Nom"><input className="input-field" value={editBus.bus_name} onChange={e=>setEditBus({...editBus,bus_name:e.target.value})} /></Inp>
          <div className="grid-2">
            <Inp label="Sièges"><input className="input-field" type="number" min="6" max="200" value={editBus.total_seats} onChange={e=>setEditBus({...editBus,total_seats:parseInt(e.target.value)})} /></Inp>
            <Inp label="Disposition des sièges">
              <select className="input-field" value={editBus.layout||'2+3'} onChange={e=>setEditBus({...editBus,layout:e.target.value})}>
                <option value="2+3">2+3 — Bus standard</option>
                <option value="2+2">2+2 — Minibus</option>
                <option value="2">2 — Coach</option>
              </select>
            </Inp>
          </div>
          <Inp label="Description"><input className="input-field" value={editBus.description||''} onChange={e=>setEditBus({...editBus,description:e.target.value})} /></Inp>
          <div>
            <label className="input-label" style={{ display:'block', marginBottom:6 }}>Statut</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['Actif',1],['Inactif',0]].map(([l,v]) => (
                <button key={v} className={`btn ${editBus.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px', display:'inline-flex', alignItems:'center', gap:5 }} onClick={() => setEditBus({...editBus,is_active:v})}>
                  {v===1 ? <Check size={11} /> : <Ban size={11} />} {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>}

      {tripModal && <Modal title={<><Map size={14} style={{ marginRight:6 }} />Nouveau voyage</>} onClose={() => setTripModal(false)} onConfirm={doCreateTrip} confirmLabel="Créer →" maxWidth={500}>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <Inp label="Bus (optionnel)">
            <select className="input-field" value={tripForm.bus_id} onChange={e=>setTripForm({...tripForm,bus_id:e.target.value})}>
              <option value="">Sans bus spécifique</option>
              {buses.filter(b=>b.is_active).map(b=><option key={b.id} value={b.id}>{b.bus_name} — {b.total_seats} sièges</option>)}
            </select>
          </Inp>
          <div className="grid-2">
            <Inp label={`Départ *${!isOwner ? ` (${userCity})` : ''}`}>
              <select
                className="input-field"
                value={tripForm.departure_city}
                onChange={e => setTripForm({...tripForm, departure_city:e.target.value, arrival_city:''})}
                disabled={!isOwner}
                style={!isOwner ? { opacity:0.7, cursor:'not-allowed' } : {}}
              >
                <option value="">Ville</option>
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Inp>
            <Inp label="Arrivée *">
              <select
                className="input-field"
                value={tripForm.arrival_city}
                onChange={e=>setTripForm({...tripForm,arrival_city:e.target.value})}
              >
                <option value="">Ville</option>
                {arrivalCities(tripForm.departure_city).map(c=><option key={c}>{c}</option>)}
              </select>
            </Inp>
          </div>
          {!isOwner && (
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:-6, padding:'6px 10px', background:'var(--card)', borderRadius:7, display:'flex', alignItems:'center', gap:5 }}>
              <MapPin size={11} /> Départ verrouillé sur votre ville : <strong style={{ color:'var(--green-l)' }}>{userCity}</strong>
            </div>
          )}
          <div className="grid-2">
            <Inp label="Date *"><input className="input-field" type="date" min={new Date().toISOString().split('T')[0]} value={tripForm.departure_date} onChange={e=>setTripForm({...tripForm,departure_date:e.target.value})} /></Inp>
            <Inp label="Heure départ *"><input className="input-field" type="time" value={tripForm.departure_time} onChange={e=>setTripForm({...tripForm,departure_time:e.target.value})} /></Inp>
          </div>
          <Inp label="Prix par siège (FC) *"><input className="input-field" type="number" placeholder="45000" value={tripForm.price} onChange={e=>setTripForm({...tripForm,price:e.target.value})} /></Inp>
          <Inp label="Description (optionnel)"><input className="input-field" placeholder="Climatisé, bagages inclus…" value={tripForm.description} onChange={e=>setTripForm({...tripForm,description:e.target.value})} /></Inp>
        </div>
      </Modal>}

      {editTrip && <Modal title={<><Pencil size={14} style={{ marginRight:6 }} />Modifier le voyage</>} subtitle={`${editTrip.departure_city} → ${editTrip.arrival_city}`} onClose={() => setEditTrip(null)} onConfirm={doSaveTrip} confirmLabel={<><Save size={12} style={{ marginRight:4 }} />Sauvegarder</>} maxWidth={500}>
        <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
          <div className="grid-2">
            <Inp label="Départ">
              <select
                className="input-field"
                value={editTrip.departure_city}
                onChange={e=>setEditTrip({...editTrip,departure_city:e.target.value})}
                disabled={!isOwner}
                style={!isOwner ? { opacity:0.7, cursor:'not-allowed' } : {}}
              >
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Inp>
            <Inp label="Arrivée">
              <select className="input-field" value={editTrip.arrival_city} onChange={e=>setEditTrip({...editTrip,arrival_city:e.target.value})}>
                {arrivalCities(editTrip.departure_city).map(c=><option key={c}>{c}</option>)}
              </select>
            </Inp>
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
                <h2 style={{ display:'flex', alignItems:'center', gap:7 }}><Calendar size={16} /> Générer des voyages en masse</h2>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Configure une liaison + une période → tous les voyages créés en un clic</div>
              </div>
              <button className="modal-close" onClick={() => setBulkModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div className="grid-2">
                <Inp label={`Départ *${!isOwner ? ` (${userCity})` : ''}`}>
                  <select
                    className="input-field"
                    value={bulkForm.departure_city}
                    onChange={e => setBulkForm({...bulkForm, departure_city:e.target.value, arrival_city:''})}
                    disabled={!isOwner}
                    style={!isOwner ? { opacity:0.7, cursor:'not-allowed' } : {}}
                  >
                    <option value="">Ville</option>
                    {CITIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </Inp>
                <Inp label="Arrivée *">
                  <select
                    className="input-field"
                    value={bulkForm.arrival_city}
                    onChange={e=>setBulkForm({...bulkForm,arrival_city:e.target.value})}
                  >
                    <option value="">Ville</option>
                    {arrivalCities(bulkForm.departure_city).map(c=><option key={c}>{c}</option>)}
                  </select>
                </Inp>
              </div>
              {!isOwner && (
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:-8, padding:'6px 10px', background:'var(--card)', borderRadius:7, display:'flex', alignItems:'center', gap:5 }}>
                  <MapPin size={11} /> Départ verrouillé sur votre ville : <strong style={{ color:'var(--green-l)' }}>{userCity}</strong>
                </div>
              )}
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
                <Inp label="Du *"><input className="input-field" type="date" value={bulkForm.date_from} onChange={e=>setBulkForm({...bulkForm,date_from:e.target.value})} /></Inp>
                <Inp label="Au *"><input className="input-field" type="date" min={bulkForm.date_from||''} value={bulkForm.date_to} onChange={e=>setBulkForm({...bulkForm,date_to:e.target.value})} /></Inp>
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
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--green-l)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}><CheckCircle size={13} /> {bulkPreview.length} voyage{bulkPreview.length > 1 ? 's' : ''} seront créés</div>
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
                <div style={{ background:'rgba(240,80,80,0.08)', border:'1px solid rgba(240,80,80,0.2)', borderRadius:10, padding:'10px 13px', fontSize:12, color:'var(--err)', display:'flex', alignItems:'center', gap:6 }}>
                  <AlertTriangle size={12} /> Aucune date générée — vérifiez les jours cochés et la période.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setBulkModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={doCreateBulk} disabled={bulkLoading || bulkPreview.length === 0}>
                {bulkLoading ? <><div className="spinner"/>Création…</> : <><Rocket size={12} style={{ marginRight:5 }} />Créer {bulkPreview.length > 0 ? bulkPreview.length + ' voyage' + (bulkPreview.length > 1 ? 's' : '') : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Créer gestionnaire ─────────────────────────────────────────────── */}
      {userModal && (
        <Modal title={<><User size={14} style={{ marginRight:6 }} />Nouveau gestionnaire</>} subtitle="Le gestionnaire se connectera avec ces identifiants" onClose={() => setUserModal(false)} onConfirm={doCreateUser} confirmLabel="Créer →" maxWidth={460}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="grid-2">
              <Inp label="Identifiant *">
                <input className="input-field" placeholder="transdavid.boma" value={userForm.username}
                  onChange={e=>setUserForm({...userForm,username:e.target.value.toLowerCase().replace(/\s/g,'')})} />
              </Inp>
              <Inp label="Mot de passe * (min. 6 car.)">
                <input className="input-field" type="password" placeholder="••••••••" value={userForm.password}
                  onChange={e=>setUserForm({...userForm,password:e.target.value})} />
              </Inp>
            </div>
            <Inp label="Nom complet (optionnel)">
              <input className="input-field" placeholder="Jean Mbeki" value={userForm.full_name}
                onChange={e=>setUserForm({...userForm,full_name:e.target.value})} />
            </Inp>
            <div className="grid-2">
              <Inp label="Ville assignée">
                <select className="input-field" value={userForm.city} onChange={e=>setUserForm({...userForm,city:e.target.value})}>
                  <option value="">— Toutes les villes —</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Inp>
              <Inp label="Rôle">
                <select className="input-field" value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}>
                  <option value="manager">Gestionnaire</option>
                  <option value="owner">Propriétaire</option>
                </select>
              </Inp>
            </div>
            <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:9, padding:'10px 13px', fontSize:12, lineHeight:1.6 }}>
              {userForm.city
                ? <><strong style={{ color:'var(--green-l)' }}>{userForm.city}</strong> → Verra uniquement les voyages et réservations <strong>partant de {userForm.city}</strong>.</>
                : <>Sans ville → Accès à <strong>toutes les villes</strong> (vue propriétaire).</>
              }
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Modifier gestionnaire ──────────────────────────────────────────── */}
      {editUser && (
        <Modal title={<><Pencil size={14} style={{ marginRight:6 }} />Modifier — {editUser.full_name || editUser.username}</>} onClose={() => setEditUser(null)} onConfirm={doSaveUser} confirmLabel={<><Save size={12} style={{ marginRight:4 }} />Sauvegarder</>} maxWidth={460}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Inp label="Nom complet">
              <input className="input-field" value={editUser.full_name||''} onChange={e=>setEditUser({...editUser,full_name:e.target.value})} />
            </Inp>
            <div className="grid-2">
              <Inp label="Ville assignée">
                <select className="input-field" value={editUser.city||''} onChange={e=>setEditUser({...editUser,city:e.target.value})}>
                  <option value="">— Toutes les villes —</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Inp>
              <Inp label="Rôle">
                <select className="input-field" value={editUser.role} onChange={e=>setEditUser({...editUser,role:e.target.value})}>
                  <option value="manager">Gestionnaire</option>
                  <option value="owner">Propriétaire</option>
                </select>
              </Inp>
            </div>
            <div>
              <div className="input-label" style={{ marginBottom:8 }}>Statut du compte</div>
              <div style={{ display:'flex', gap:8 }}>
                {[['Actif', 1], ['Désactivé', 0]].map(([l, v]) => (
                  <button key={v} className={`btn ${editUser.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px', display:'inline-flex', alignItems:'center', gap:5 }}
                    onClick={() => setEditUser({...editUser,is_active:v})}>
                    {v===1 ? <Check size={11} /> : <Ban size={11} />} {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:9, padding:'10px 13px', fontSize:12 }}>
              <code style={{ color:'var(--green-l)' }}>{editUser.username}</code> →&nbsp;
              {editUser.city ? <>voyages depuis <strong>{editUser.city}</strong> uniquement</> : <strong>toutes les villes</strong>}
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Réinitialiser mot de passe ─────────────────────────────────────── */}
      {resetPassModal && (
        <Modal title={<><KeyRound size={14} style={{ marginRight:6 }} />Nouveau mot de passe</>} subtitle={`Compte : ${resetPassModal.username}`}
          onClose={() => { setResetPassModal(null); setNewPass(''); }}
          onConfirm={doResetPassword} confirmLabel="Mettre à jour →" maxWidth={400}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Inp label="Nouveau mot de passe (min. 6 caractères)">
              <input className="input-field" type="password" placeholder="••••••••" value={newPass}
                onChange={e=>setNewPass(e.target.value)} autoFocus />
            </Inp>
            <div style={{ fontSize:12, color:'var(--muted)', padding:'8px 12px', background:'var(--card)', borderRadius:8, display:'flex', alignItems:'center', gap:7 }}>
              <AlertTriangle size={12} color="var(--gold)" /> Le gestionnaire devra utiliser ce nouveau mot de passe dès sa prochaine connexion.
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Plan des sièges ──────────────────────────────── */}
      {seatModal && (
        <SeatMapModal
          mode="view"
          trip={seatModal}
          onClose={() => setSeatModal(null)}
          headers={headers}
          API={API}
        />
      )}
    </div>
  );
}