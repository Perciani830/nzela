import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SeatMapModal from './SeatMapModal';
import {
  Check, X, Info, Crown, LogOut, Globe, Menu,
  LayoutDashboard, Building2, ImageIcon, HeartHandshake, Settings,
  Wallet, Gem, Ticket, Bus, Trophy, MapPin, Users,
  Pencil, Trash2, Ban, KeyRound, Star, User, Mail, Phone,
  AlertTriangle, Download, Upload, Database, Wrench,
  Anchor, Mountain, Waves, ChevronUp, ChevronDown,
  ShieldAlert, FileSpreadsheet, FileText, RotateCcw, Flame,
} from 'lucide-react';

const API = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa', 'Matadi', 'Boma', 'Moanda'];

const CITY_META = {
  Kinshasa: { color:'#3DAA6A', bg:'rgba(61,170,106,0.12)', Icon: Building2 },
  Boma:     { color:'#4A90D9', bg:'rgba(74,144,217,0.12)', Icon: Anchor },
  Matadi:   { color:'#E8A838', bg:'rgba(232,168,56,0.12)',  Icon: Mountain },
  Moanda:   { color:'#9B59B6', bg:'rgba(155,89,182,0.12)', Icon: Waves },
};

function getAdminHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

/* ── Toast ──────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const colors = { success:'var(--ok)', error:'var(--err)', info:'var(--gold)' };
  const Icon   = type === 'success' ? Check : type === 'error' ? X : Info;
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, display:'flex', alignItems:'center', gap:10, background:'var(--card)', border:`1px solid ${colors[type]||'var(--border)'}`, borderRadius:12, padding:'12px 16px', fontSize:13, fontWeight:600, color:colors[type]||'var(--text)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', minWidth:260, maxWidth:380 }}>
      <Icon size={14} />
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', display:'flex', alignItems:'center', opacity:0.6 }}><X size={14} /></button>
    </div>
  );
}

/* ── Inp ────────────────────────────────────────────────────── */
function Inp({ label, children, hint }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--muted)' }}>{hint}</div>}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────── */
function Modal({ title, subtitle, onClose, onConfirm, confirmLabel='Sauvegarder', maxWidth=500, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--night)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--night)', zIndex:1 }}>
          <div>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:17, margin:0 }}>{title}</h2>
            {subtitle && <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}><X size={14} /></button>
        </div>
        <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>{children}</div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, padding:'14px 22px', borderTop:'1px solid var(--border)', position:'sticky', bottom:0, background:'var(--night)' }}>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── StatCard ───────────────────────────────────────────────── */
function StatCard({ Icon: IconComp, label, value, sub, color='var(--green-l)' }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
      <div style={{ marginBottom:8 }}><IconComp size={22} color={color} /></div>
      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:22, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

/* ── AgencyAvatar ───────────────────────────────────────────── */
function AgencyAvatar({ name, logoUrl, size=36 }) {
  const initials = name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '?';
  if (logoUrl) return <img src={logoUrl} alt={name} style={{ width:size, height:size, borderRadius:10, objectFit:'cover', border:'1px solid rgba(61,170,106,0.2)', flexShrink:0 }} onError={e=>{e.target.style.display='none'}} />;
  return <div style={{ width:size, height:size, borderRadius:10, background:'linear-gradient(135deg,var(--green-d),var(--green-l))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--font)', fontWeight:800, fontSize:size*0.36, flexShrink:0 }}>{initials}</div>;
}

/* ── CityBadge ──────────────────────────────────────────────── */
function CityBadge({ city }) {
  const meta = CITY_META[city] || { color:'var(--muted)', bg:'var(--card)', Icon: MapPin };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:meta.bg, color:meta.color, border:`1px solid ${meta.color}30`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
      <meta.Icon size={10} /> {city}
    </span>
  );
}

/* ── AgencyUsersPanel ───────────────────────────────────────── */
/* ── Panel voyages d'une agence (admin) ─────────────────────── */
function AgencyTripsPanel({ agency, headers, onViewSeats }) {
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/admin/agencies/${agency.id}/trips`, { headers })
      .then(r => setTrips(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [agency.id]);

  if (loading) return (
    <div style={{ padding:'14px 0', color:'var(--muted)', fontSize:12 }}>Chargement des voyages…</div>
  );
  if (trips.length === 0) return (
    <div style={{ padding:'14px 0', color:'var(--muted)', fontSize:12 }}>Aucun voyage enregistré pour cette agence.</div>
  );

  return (
    <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
        Voyages ({trips.length})
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {trips.map(t => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'8px 12px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:8 }}>
            <div style={{ fontSize:12 }}>
              <span style={{ fontWeight:700 }}>{t.departure_city} → {t.arrival_city}</span>
              <span style={{ color:'var(--muted)', marginLeft:8 }}>{t.departure_date} · {t.departure_time}</span>
              {t.bus_name && <span style={{ marginLeft:8, color:'var(--muted)' }}>· {t.bus_name}</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'var(--muted)' }}>{t.available_seats}/{t.total_seats} places</span>
              <span className={`badge ${t.is_active ? 'b-g' : 'b-r'}`} style={{ fontSize:10 }}>{t.is_active ? 'Actif' : 'Inactif'}</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize:11, padding:'4px 10px', display:'inline-flex', alignItems:'center', gap:5 }}
                onClick={() => onViewSeats(t)}
              >
                <Bus size={11} /> Sièges
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgencyUsersPanel({ agency, headers, showToast }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass]     = useState('');
  const [form, setForm]           = useState({ username:'', password:'', full_name:'', city:'', role:'manager' });

  const load = async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/admin/agencies/${agency.id}/users`, { headers }); setUsers(Array.isArray(r.data) ? r.data : []); }
    catch { setUsers([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [agency.id]);

  const doCreate = async () => {
    if (!form.username || !form.password) return showToast('Identifiant et mot de passe requis', 'error');
    if (form.password.length < 6) return showToast('Mot de passe trop court (min. 6)', 'error');
    setSaving(true);
    try {
      await axios.post(`${API}/admin/agencies/${agency.id}/users`, form, { headers });
      showToast(`Gestionnaire "${form.username}" créé`, 'success');
      setShowForm(false); setForm({ username:'', password:'', full_name:'', city:'', role:'manager' }); load();
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
    finally { setSaving(false); }
  };

  const doToggle = async (u) => {
    try {
      await axios.patch(`${API}/admin/agencies/${agency.id}/users/${u.id}`, { is_active: u.is_active ? 0 : 1 }, { headers });
      showToast(u.is_active ? 'Compte désactivé' : 'Compte activé', 'info'); load();
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  const doDelete = async (u) => {
    if (!confirm(`Supprimer "${u.full_name || u.username}" ?`)) return;
    try { await axios.delete(`${API}/admin/agencies/${agency.id}/users/${u.id}`, { headers }); showToast('Compte supprimé', 'info'); load(); }
    catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  const doResetPass = async () => {
    if (!newPass || newPass.length < 6) return showToast('Min. 6 caractères', 'error');
    try {
      await axios.post(`${API}/admin/agencies/${agency.id}/users/${resetTarget.id}/reset-password`, { password: newPass }, { headers });
      showToast('Mot de passe réinitialisé', 'success'); setResetTarget(null); setNewPass('');
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  return (
    <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', display:'flex', alignItems:'center', gap:6 }}>
          <Users size={13} /> Gestionnaires ({users.length})
        </div>
        <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 11px', display:'inline-flex', alignItems:'center', gap:5 }} onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={11} /> Annuler</> : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <div style={{ background:'rgba(61,170,106,0.04)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:10, padding:14, marginBottom:12, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Inp label="Identifiant *">
              <input className="input-field" style={{ fontSize:12 }} placeholder="transdavid.boma"
                value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase().replace(/\s/g,'')})} />
            </Inp>
            <Inp label="Mot de passe *">
              <input className="input-field" style={{ fontSize:12 }} type="password" placeholder="Min. 6 car."
                value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
            </Inp>
            <Inp label="Nom complet">
              <input className="input-field" style={{ fontSize:12 }} placeholder="Jean Mbeki"
                value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} />
            </Inp>
            <Inp label="Ville assignée">
              <select className="input-field" style={{ fontSize:12 }} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}>
                <option value="">— Toutes les villes —</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Inp>
            <Inp label="Rôle">
              <select className="input-field" style={{ fontSize:12 }} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="manager">Gestionnaire</option>
                <option value="owner">Propriétaire</option>
              </select>
            </Inp>
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button className="btn btn-primary" style={{ fontSize:12, width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:6 }} onClick={doCreate} disabled={saving}>
                {saving ? 'Création…' : <><Check size={12} /> Créer</>}
              </button>
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--muted)', padding:'6px 10px', background:'var(--card)', borderRadius:7, display:'flex', alignItems:'center', gap:6 }}>
            <MapPin size={11} />
            {form.city
              ? <>Ce gestionnaire verra uniquement les voyages depuis <strong>{form.city}</strong>.</>
              : <>Sans ville assignée → accès à toutes les villes (propriétaire).</>
            }
          </div>
        </div>
      )}

      {loading
        ? <div style={{ textAlign:'center', padding:16, color:'var(--muted)', fontSize:12 }}>Chargement…</div>
        : users.length === 0
          ? <div style={{ textAlign:'center', padding:16, color:'var(--muted)', fontSize:12 }}>Aucun gestionnaire — cliquez sur "+ Ajouter"</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {users.map(u => {
                const meta = u.city ? (CITY_META[u.city] || { color:'var(--muted)', bg:'var(--card)', Icon: MapPin }) : { color:'var(--gold)', bg:'rgba(245,166,35,0.08)', Icon: Crown };
                return (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: u.is_active ? meta.bg : 'var(--card)', border:`1px solid ${u.is_active ? meta.color+'30':'var(--border)'}`, borderRadius:8, padding:'9px 12px', opacity: u.is_active ? 1 : 0.6, flexWrap:'wrap', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <meta.Icon size={16} color={meta.color} />
                      <div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <code style={{ background:'var(--card)', padding:'0 4px', borderRadius:3, fontSize:10 }}>{u.username}</code>
                          {u.city ? <CityBadge city={u.city} /> : <span style={{ color:'var(--gold)', fontWeight:700 }}>Toutes villes</span>}
                          <span style={{ color: u.role==='owner' ? 'var(--gold)' : 'var(--muted)' }}>
                            {u.role==='owner' ? 'Propriétaire' : 'Gestionnaire'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost" style={{ fontSize:10, padding:'4px 8px', display:'inline-flex', alignItems:'center', gap:4 }} title="Réinitialiser le mot de passe"
                        onClick={() => { setResetTarget(u); setNewPass(''); }}>
                        <KeyRound size={11} />
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize:10, padding:'4px 8px', color: u.is_active ? 'var(--gold)':'var(--ok)', display:'inline-flex', alignItems:'center' }}
                        onClick={() => doToggle(u)} title={u.is_active ? 'Désactiver' : 'Activer'}>
                        {u.is_active ? <Ban size={11} /> : <Check size={11} />}
                      </button>
                      <button className="btn btn-danger" style={{ fontSize:10, padding:'4px 8px', display:'inline-flex', alignItems:'center' }}
                        onClick={() => doDelete(u)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
      }

      {resetTarget && (
        <Modal title="Réinitialiser le mot de passe" subtitle={resetTarget.full_name || resetTarget.username}
          onClose={() => { setResetTarget(null); setNewPass(''); }}
          onConfirm={doResetPass} confirmLabel="Mettre à jour →" maxWidth={380}>
          <Inp label="Nouveau mot de passe (min. 6 caractères)">
            <input className="input-field" type="password" placeholder="••••••••" value={newPass}
              onChange={e=>setNewPass(e.target.value)} autoFocus />
          </Inp>
          <div style={{ fontSize:12, color:'var(--muted)', padding:'8px 12px', background:'var(--card)', borderRadius:8, display:'flex', alignItems:'center', gap:7 }}>
            <AlertTriangle size={13} color="var(--gold)" /> Le gestionnaire devra utiliser ce mot de passe dès sa prochaine connexion.
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const headers  = getAdminHeaders();

  const [tab, setTab]         = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats]               = useState({});
  const [agencies, setAgencies]         = useState([]);
  const [gallery, setGallery]           = useState([]);
  const [settings, setSettings]         = useState({ commission_rate:10 });
  const [contributions, setContributions] = useState([]);

  const [agencyModal, setAgencyModal]   = useState(false);
  const [editAgency, setEditAgency]     = useState(null);
  const [expandedAgency, setExpandedAgency] = useState(null);
  const [expandedTrips,  setExpandedTrips]  = useState(null); // agence dont on voit les voyages
  const [seatModal,      setSeatModal]      = useState(null); // trip à afficher dans SeatMapModal
  const [agencyForm, setAgencyForm]     = useState({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10 });

  const [galleryModal, setGalleryModal] = useState(false);
  const [editGallery, setEditGallery]   = useState(null);
  const [galleryForm, setGalleryForm]   = useState({ title:'', description:'', image_url:'', category:'general', sort_order:0 });

  // ── Reset Dashboard ──────────────────────────────────────────
  const [resetModal,       setResetModal]       = useState(false);
  const [backupXlsxDone,   setBackupXlsxDone]   = useState(false);
  const [backupPdfDone,    setBackupPdfDone]     = useState(false);
  const [resetConfirmText, setResetConfirmText]  = useState('');
  const [resetting,        setResetting]         = useState(false);

  const ok  = msg => setToast({ msg, type:'success' });
  const err = msg => setToast({ msg, type:'error' });
  const inf = msg => setToast({ msg, type:'info' });
  const showToast = (msg, type='info') => setToast({ msg, type });
  const goTab = id => { setTab(id); setSidebarOpen(false); };

  const load = async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const [st, ag, gl, se, co] = await Promise.all([
        axios.get(`${API}/admin/stats`,        { headers }).catch(()=>({data:{}})),
        axios.get(`${API}/admin/agencies`,      { headers }),
        axios.get(`${API}/admin/gallery`,       { headers }).catch(()=>({data:[]})),
        axios.get(`${API}/admin/settings`,      { headers }).catch(()=>({data:{commission_rate:10}})),
        axios.get(`${API}/admin/contributions`, { headers }).catch(()=>({data:[]})),
      ]);
      setStats(st.data || {}); setAgencies(Array.isArray(ag.data) ? ag.data : []);
      setGallery(Array.isArray(gl.data) ? gl.data : []); setSettings(se.data || { commission_rate:10 });
      setContributions(Array.isArray(co.data) ? co.data : []);
    } catch(e) {
      if (e.response?.status===401) { localStorage.clear(); navigate('/admin/login'); }
      else if (!silent) err('Erreur de chargement');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { load(); const iv = setInterval(() => load(true), 15000); return () => clearInterval(iv); }, []);

  const doCreateAgency = async () => {
    const { agency_name, username, password } = agencyForm;
    if (!agency_name || !username || !password) return err('Nom, identifiant et mot de passe requis');
    if (password.length < 6) return err('Mot de passe trop court (min. 6 caractères)');
    try {
      await axios.post(`${API}/admin/agencies`, agencyForm, { headers });
      ok(`Agence "${agency_name}" créée`); setAgencyModal(false);
      setAgencyForm({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10 }); load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doSaveAgency = async () => {
    try { await axios.patch(`${API}/admin/agencies/${editAgency.id}`, editAgency, { headers }); ok('Agence mise à jour'); setEditAgency(null); load(); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doToggleAgency = async (ag) => {
    try { await axios.patch(`${API}/admin/agencies/${ag.id}`, { is_active: ag.is_active ? 0 : 1 }, { headers }); inf(ag.is_active ? `"${ag.agency_name}" désactivée` : `"${ag.agency_name}" activée`); load(); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doDeleteAgency = async (ag) => {
    if (!confirm(`Supprimer "${ag.agency_name}" ? Toutes les données seront perdues.`)) return;
    try { await axios.delete(`${API}/admin/agencies/${ag.id}`, { headers }); inf(`Agence "${ag.agency_name}" supprimée`); load(); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doSaveGallery = async () => {
    if (!galleryForm.image_url) return err("URL de l'image requise");
    try {
      if (editGallery) { await axios.patch(`${API}/admin/gallery/${editGallery.id}`, galleryForm, { headers }); ok('Image mise à jour'); }
      else { await axios.post(`${API}/admin/gallery`, galleryForm, { headers }); ok('Image ajoutée'); }
      setGalleryModal(false); setEditGallery(null);
      setGalleryForm({ title:'', description:'', image_url:'', category:'general', sort_order:0 }); load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doDeleteGallery = async id => {
    if (!confirm('Supprimer cette image ?')) return;
    try { await axios.delete(`${API}/admin/gallery/${id}`, { headers }); inf('Image supprimée'); load(); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doSaveSettings = async () => {
    try { await axios.patch(`${API}/admin/settings`, settings, { headers }); ok('Paramètres sauvegardés'); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doExport = async () => {
    try {
      const r = await axios.get(`${API}/admin/export`, { headers });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type:'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `nzela_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
      ok('Export téléchargé');
    } catch { err('Erreur export'); }
  };

  const doImport = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm('Importer remplacera TOUTES les données. Continuer ?')) return;
    try {
      const text = await file.text(); const data = JSON.parse(text);
      await axios.post(`${API}/admin/import`, data, { headers }); ok('Import réussi — données restaurées'); load();
    } catch { err('Erreur import — fichier invalide ?'); }
    e.target.value = '';
  };

  /* ── Export Excel ──────────────────────────────────────────── */
  const doExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const date = new Date().toLocaleDateString('fr-FR');

      // Feuille 1 — Résumé global
      const resumeData = [
        ['NZELA RDC — Rapport de sauvegarde', '', date],
        [],
        ['Indicateur', 'Valeur'],
        ['Nombre d\'agences', agencies.length],
        ['Agences actives', agencies.filter(a => a.is_active).length],
        ['Agences premium', agencies.filter(a => a.premium).length],
        ['Revenus totaux (FC)', agencies.reduce((s, a) => s + Number(a.total_revenue || 0), 0)],
        ['Commissions totales (FC)', agencies.reduce((s, a) => s + Number(a.total_commission || 0), 0)],
        ['Total réservations', agencies.reduce((s, a) => s + Number(a.total_bookings || 0), 0)],
        ['Total contributions', contributions.length],
        ['Montant contributions CDF', contributions.filter(c => c.currency === 'CDF').reduce((s, c) => s + Number(c.amount || 0), 0)],
        ['Montant contributions USD', contributions.filter(c => c.currency === 'USD').reduce((s, c) => s + Number(c.amount || 0), 0)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumeData), 'Résumé');

      // Feuille 2 — Agences
      const agHeaders = ['ID', 'Nom', 'Identifiant', 'Email', 'Téléphone', 'Ville', 'Commission %', 'Premium', 'Actif', 'Note', 'Revenus (FC)', 'Commissions (FC)', 'Réservations', 'Date création'];
      const agRows = agencies.map(a => [
        a.id, a.agency_name, a.username, a.email || '', a.phone || '',
        a.home_city || '', a.commission_rate || 10,
        a.premium ? 'Oui' : 'Non', a.is_active ? 'Oui' : 'Non',
        a.note || 3,
        Number(a.total_revenue || 0), Number(a.total_commission || 0),
        Number(a.total_bookings || 0),
        a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR') : '',
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([agHeaders, ...agRows]), 'Agences');

      // Feuille 3 — Contributions
      const coHeaders = ['Référence', 'Contributeur', 'Téléphone', 'Opérateur', 'Montant', 'Devise', 'ID Transaction', 'Message', 'Date'];
      const coRows = contributions.map(c => [
        c.reference, c.contributor_name || 'Anonyme', c.phone || '',
        c.operator || '', Number(c.amount || 0), c.currency || 'CDF',
        c.transaction_id || '', c.message || '',
        c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '',
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([coHeaders, ...coRows]), 'Contributions');

      XLSX.writeFile(wb, `nzela_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      setBackupXlsxDone(true);
      ok('Export Excel téléchargé');
    } catch (e) { err('Erreur export Excel'); console.error(e); }
  };

  /* ── Export PDF ────────────────────────────────────────────── */
  const doExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const dateStr = new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
      const totalRevenue    = agencies.reduce((s, a) => s + Number(a.total_revenue || 0), 0);
      const totalCommission = agencies.reduce((s, a) => s + Number(a.total_commission || 0), 0);

      // ── En-tête
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(61, 170, 106);
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text('NZELA RDC', 14, 16);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text('Rapport de sauvegarde — Super Admin', 14, 25);
      doc.setFontSize(9); doc.setTextColor(150, 160, 180);
      doc.text(`Généré le ${dateStr}`, 14, 33);
      doc.setTextColor(245, 158, 11);
      doc.text(`${agencies.length} agences · ${contributions.length} contributions`, 140, 33);

      // ── Résumé stats
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Vue globale', 14, 52);

      autoTable(doc, {
        startY: 56,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Agences enregistrées', `${agencies.length} (${agencies.filter(a=>a.is_active).length} actives)`],
          ['Agences premium', agencies.filter(a=>a.premium).length.toString()],
          ['Revenus totaux', `${totalRevenue.toLocaleString('fr-FR')} FC`],
          ['Commissions totales', `${totalCommission.toLocaleString('fr-FR')} FC`],
          ['Total réservations', agencies.reduce((s,a)=>s+Number(a.total_bookings||0),0).toLocaleString('fr-FR')],
          ['Contributions CDF', `${contributions.filter(c=>c.currency==='CDF').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')} FC`],
          ['Contributions USD', `$${contributions.filter(c=>c.currency==='USD').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')}`],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [61, 170, 106], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 247] },
        margin: { left: 14, right: 14 },
      });

      // ── Tableau agences
      const afterStats = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Liste des agences', 14, afterStats);

      autoTable(doc, {
        startY: afterStats + 4,
        head: [['Agence', 'Ville', 'Comm.', 'Statut', 'Revenus (FC)', 'Réservations']],
        body: agencies.map(a => [
          a.agency_name,
          a.home_city || '—',
          `${a.commission_rate || 10}%`,
          a.is_active ? 'Actif' : 'Inactif',
          Number(a.total_revenue || 0).toLocaleString('fr-FR'),
          Number(a.total_bookings || 0).toString(),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 4: { halign: 'right' }, 5: { halign: 'center' } },
        margin: { left: 14, right: 14 },
      });

      // ── Tableau contributions (nouvelle page si nécessaire)
      if (contributions.length > 0) {
        const afterAgencies = doc.lastAutoTable.finalY + 10;
        const remainingSpace = 297 - afterAgencies - 20;
        if (remainingSpace < 40) doc.addPage();
        const yContrib = remainingSpace < 40 ? 20 : afterAgencies;

        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Contributions', 14, yContrib);

        autoTable(doc, {
          startY: yContrib + 4,
          head: [['Référence', 'Contributeur', 'Opérateur', 'Montant', 'Devise', 'Date']],
          body: contributions.map(c => [
            c.reference,
            c.contributor_name || 'Anonyme',
            c.operator || '—',
            Number(c.amount || 0).toLocaleString('fr-FR'),
            c.currency || 'CDF',
            c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—',
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: 14, right: 14 },
        });
      }

      // ── Pied de page sur chaque page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150, 160, 180);
        doc.text(`Nzela RDC · Document confidentiel · Page ${i}/${pageCount}`, 14, 290);
      }

      doc.save(`nzela_backup_${new Date().toISOString().split('T')[0]}.pdf`);
      setBackupPdfDone(true);
      ok('Export PDF téléchargé');
    } catch (e) { err('Erreur export PDF'); console.error(e); }
  };

  /* ── Reset complet ─────────────────────────────────────────── */
  const doResetAll = async () => {
    if (!backupXlsxDone || !backupPdfDone) return err('Veuillez d\'abord télécharger les deux sauvegardes');
    if (resetConfirmText !== 'SUPPRIMER') return err('Saisissez exactement "SUPPRIMER"');
    setResetting(true);
    try {
      await axios.delete(`${API}/admin/reset`, { headers });
      ok('Dashboard réinitialisé — toutes les agences supprimées');
      setResetModal(false);
      setBackupXlsxDone(false); setBackupPdfDone(false); setResetConfirmText('');
      load();
    } catch (e) { err(e.response?.data?.error || 'Erreur lors de la réinitialisation'); }
    finally { setResetting(false); }
  };

  const TABS = [
    { id:'overview',      Icon: LayoutDashboard, label:'Vue globale' },
    { id:'agencies',      Icon: Building2,       label:'Agences' },
    { id:'gallery',       Icon: ImageIcon,        label:'Galerie' },
    { id:'contributions', Icon: HeartHandshake,   label:'Contributions' },
    { id:'settings',      Icon: Settings,         label:'Paramètres' },
  ];

  const totalRevenue    = agencies.reduce((s,a) => s + Number(a.total_revenue||0), 0);
  const totalCommission = agencies.reduce((s,a) => s + Number(a.total_commission||0), 0);
  const currentTab      = TABS.find(t => t.id === tab);

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}

      <button className="hamburger" onClick={()=>setSidebarOpen(true)} aria-label="Menu" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
        <Menu size={20} />
      </button>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:49, display:sidebarOpen?'block':'none' }} onClick={()=>setSidebarOpen(false)} />

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Crown size={15} color="rgba(245,158,11,0.9)" />
            </div>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, color:'var(--text)' }}>Super Admin</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>Nzela RDC · Panneau central</div>
            </div>
          </div>
        </div>

        <div style={{ padding:10, borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:11, color:'var(--gold)', fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:5 }}>
              <Crown size={11} /> ADMINISTRATEUR
            </div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Accès complet — toutes agences, données et paramètres.</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>goTab(t.id)}>
              <span className="nav-icon"><t.Icon size={15} /></span>
              <span>{t.label}</span>
              {t.id==='agencies' && (
                <span style={{ marginLeft:'auto', background:'var(--green-bg)', color:'var(--green-l)', borderRadius:99, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                  {agencies.length}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/" target="_blank" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, textAlign:'center', fontSize:12, color:'var(--muted)', textDecoration:'none', marginBottom:8, padding:'6px', borderRadius:8, border:'1px solid var(--border)' }}>
            <Globe size={13} /> Voir le site public
          </a>
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'8px', display:'flex', alignItems:'center', gap:7 }}
            onClick={()=>{ localStorage.clear(); navigate('/admin/login'); }}>
            <LogOut size={14} /> Déconnexion
          </button>
          <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:8 }}>© 2026 Nzela RDC</div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', overflowX:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, margin:0, display:'flex', alignItems:'center', gap:8 }}>
                {currentTab && <currentTab.Icon size={20} />} {currentTab?.label}
              </h1>
              <span style={{ fontSize:11, background:'rgba(245,158,11,0.1)', color:'var(--gold)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, padding:'2px 8px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:4 }}>
                <Crown size={10} /> Super Admin
              </span>
            </div>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {tab==='agencies' && <button className="btn btn-primary" onClick={()=>setAgencyModal(true)}>+ Agence</button>}
            {tab==='gallery'  && <button className="btn btn-primary" onClick={()=>{ setEditGallery(null); setGalleryForm({ title:'',description:'',image_url:'',category:'general',sort_order:0 }); setGalleryModal(true); }}>+ Image</button>}
            <button className="btn btn-ghost mobile-logout" style={{ fontSize:12, padding:'7px 11px', display:'inline-flex', alignItems:'center' }}
              onClick={()=>{ localStorage.clear(); navigate('/admin/login'); }}><LogOut size={14} /></button>
          </div>
        </div>

        {loading
          ? <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
          : <>

          {/* ── VUE GLOBALE ─────────────────────────────────── */}
          {tab==='overview' && <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12, marginBottom:20 }}>
              <StatCard Icon={Building2}    label="Agences actives"   value={agencies.filter(a=>a.is_active).length} sub={`${agencies.length} total`} color="var(--green-l)" />
              <StatCard Icon={Wallet}       label="Revenus totaux"    value={`${totalRevenue.toLocaleString('fr-FR')} FC`} color="var(--gold)" />
              <StatCard Icon={Gem}          label="Commissions Nzela" value={`${totalCommission.toLocaleString('fr-FR')} FC`} color="#9B59B6" />
              <StatCard Icon={Ticket}       label="Réservations"      value={stats.total_bookings || 0} color="var(--green-l)" />
              <StatCard Icon={Bus}          label="Voyages actifs"    value={stats.total_trips || 0} color="#4A90D9" />
              <StatCard Icon={HeartHandshake} label="Contributions"   value={contributions.length} sub={`${contributions.reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')} FC`} color="var(--ok)" />
            </div>

            <div className="glass p-16 fade-in" style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                <Trophy size={15} color="var(--gold)" /> Classement des agences
              </div>
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Agence</th><th>Voyages</th><th>Réservations</th><th>Revenus</th><th>Commission</th><th>Statut</th></tr></thead>
                  <tbody>
                    {[...agencies].sort((a,b) => Number(b.total_revenue||0) - Number(a.total_revenue||0)).map((ag, i) => (
                      <tr key={ag.id}>
                        <td style={{ fontFamily:'var(--font)', fontWeight:800, color:'var(--muted)' }}>#{i+1}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <AgencyAvatar name={ag.agency_name} logoUrl={ag.logo_url} size={28} />
                            <div>
                              <div style={{ fontWeight:700, fontSize:13 }}>{ag.agency_name}</div>
                              <div style={{ fontSize:11, color:'var(--muted)' }}>{ag.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>{ag.total_trips||0}</td>
                        <td>{ag.total_bookings||0}</td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(ag.total_revenue||0).toLocaleString('fr-FR')} FC</td>
                        <td style={{ color:'#9B59B6', fontWeight:700 }}>{Number(ag.total_commission||0).toLocaleString('fr-FR')} FC</td>
                        <td><span className={`badge ${ag.is_active?'b-g':'b-r'}`}>{ag.is_active?'Actif':'Inactif'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass p-16 fade-in fade-in-2">
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                <MapPin size={15} color="var(--green-l)" /> Activité par ville
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:10 }}>
                {CITIES.map(city => {
                  const meta = CITY_META[city];
                  const d = (stats.by_city || {})[city] || {};
                  return (
                    <div key={city} style={{ background:meta.bg, border:`1px solid ${meta.color}25`, borderRadius:12, padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <meta.Icon size={18} color={meta.color} />
                        <span style={{ fontFamily:'var(--font)', fontWeight:800, color:meta.color }}>{city}</span>
                      </div>
                      {[['Voyages', d.trips||'—'],['Réservations', d.bookings||'—'],['Revenus (FC)', d.revenue ? Number(d.revenue).toLocaleString('fr-FR') : '—']].map(([l,v]) => (
                        <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:'var(--muted)' }}>{l}</span>
                          <span style={{ fontWeight:700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>}

          {/* ── AGENCES ─────────────────────────────────────── */}
          {tab==='agencies' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {agencies.length===0
                ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><Building2 size={44} style={{ opacity:.2 }} /></div>
                    <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucune agence</h3>
                    <button className="btn btn-primary" onClick={()=>setAgencyModal(true)}>+ Créer la première agence</button>
                  </div>
                : agencies.map((ag, i) => (
                    <div key={ag.id} className="glass fade-in" style={{ animationDelay:`${i*0.05}s`, padding:'16px 20px', opacity: ag.is_active ? 1 : 0.65 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                          <AgencyAvatar name={ag.agency_name} logoUrl={ag.logo_url} size={44} />
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{ag.agency_name}</span>
                              <span className={`badge ${ag.is_active?'b-g':'b-r'}`}>{ag.is_active?'Actif':'Inactif'}</span>
                              {ag.premium ? <span style={{ fontSize:11, background:'rgba(245,166,35,0.12)', color:'var(--gold)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:6, padding:'1px 7px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}><Star size={9} fill="currentColor" /> Premium</span> : null}
                            </div>
                            <div style={{ fontSize:12, color:'var(--muted)', marginTop:3, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><User size={11} /> {ag.username}</span>
                              {ag.email && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Mail size={11} /> {ag.email}</span>}
                              {ag.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Phone size={11} /> {ag.phone}</span>}
                              <span style={{ color:'var(--green-l)', fontWeight:700 }}>Commission : {ag.commission_rate||10}%</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                          {[['Voyages',ag.total_trips||0,'var(--text)'],['Réserv.',ag.total_bookings||0,'var(--green-l)'],['Revenus',`${Number(ag.total_revenue||0).toLocaleString('fr-FR')} FC`,'var(--gold)'],['Commiss.',`${Number(ag.total_commission||0).toLocaleString('fr-FR')} FC`,'#9B59B6']].map(([l,v,c]) => (
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, color:c }}>{v}</div>
                              <div style={{ fontSize:10, color:'var(--muted)' }}>{l}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px', display:'inline-flex', alignItems:'center', gap:5 }}
                            onClick={()=>setExpandedAgency(expandedAgency===ag.id ? null : ag.id)}>
                            {expandedAgency===ag.id ? <><ChevronUp size={12} /> Fermer</> : <><Users size={12} /> Gestionnaires</>}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px', display:'inline-flex', alignItems:'center', gap:5 }}
                            onClick={()=>setExpandedTrips(expandedTrips===ag.id ? null : ag.id)}>
                            {expandedTrips===ag.id ? <><ChevronUp size={12} /> Fermer</> : <><Bus size={12} /> Voyages</>}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px', display:'inline-flex', alignItems:'center', gap:5 }}
                            onClick={()=>setEditAgency({...ag})}><Pencil size={12} /> Modifier</button>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px', color: ag.is_active ? 'var(--gold)':'var(--ok)', display:'inline-flex', alignItems:'center', gap:5 }}
                            onClick={()=>doToggleAgency(ag)}>
                            {ag.is_active ? <><Ban size={12} /> Désactiver</> : <><Check size={12} /> Activer</>}
                          </button>
                          <button className="btn btn-danger" style={{ fontSize:11, padding:'6px 9px', display:'inline-flex', alignItems:'center' }}
                            onClick={()=>doDeleteAgency(ag)}><Trash2 size={12} /></button>
                        </div>
                      </div>

                      {expandedAgency===ag.id && (
                        <AgencyUsersPanel agency={ag} headers={headers} showToast={showToast} />
                      )}
                      {expandedTrips===ag.id && (
                        <AgencyTripsPanel agency={ag} headers={headers} onViewSeats={t => setSeatModal(t)} />
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── GALERIE ─────────────────────────────────────── */}
          {tab==='gallery' && (
            <div>
              {gallery.length===0
                ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><ImageIcon size={44} style={{ opacity:.2 }} /></div>
                    <p style={{ marginBottom:16 }}>Aucune image dans la galerie</p>
                    <button className="btn btn-primary" onClick={()=>setGalleryModal(true)}>+ Ajouter une image</button>
                  </div>
                : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                    {gallery.map((img, i) => (
                      <div key={img.id} className="glass fade-in" style={{ animationDelay:`${i*0.05}s`, overflow:'hidden', opacity: img.is_active?1:0.5 }}>
                        {img.image_url && (
                          <div style={{ height:160, background:'var(--card)' }}>
                            <img src={img.image_url} alt={img.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{e.target.style.display='none'}} />
                          </div>
                        )}
                        <div style={{ padding:'12px 14px' }}>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{img.title||'(sans titre)'}</div>
                          {img.description && <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>{img.description}</div>}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <span style={{ fontSize:11, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'2px 7px' }}>{img.category}</span>
                              <span className={`badge ${img.is_active?'b-g':'b-r'}`} style={{ fontSize:10 }}>{img.is_active?'Visible':'Caché'}</span>
                            </div>
                            <div style={{ display:'flex', gap:5 }}>
                              <button className="btn btn-ghost" style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center' }}
                                onClick={()=>{ setEditGallery(img); setGalleryForm({...img}); setGalleryModal(true); }}><Pencil size={11} /></button>
                              <button className="btn btn-danger" style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center' }}
                                onClick={()=>doDeleteGallery(img.id)}><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* ── CONTRIBUTIONS ───────────────────────────────── */}
          {tab==='contributions' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
                <StatCard Icon={HeartHandshake} label="Total contributions" value={contributions.length} color="var(--ok)" />
                <StatCard Icon={Wallet}         label="Total CDF" value={`${contributions.filter(c=>c.currency==='CDF').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')} FC`} color="var(--gold)" />
                <StatCard Icon={Gem}            label="Total USD" value={`$${contributions.filter(c=>c.currency==='USD').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')}`} color="var(--green-l)" />
              </div>
              <div className="glass" style={{ overflow:'hidden' }}>
                {contributions.length===0
                  ? <div style={{ textAlign:'center', padding:40, color:'var(--muted)', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                      <HeartHandshake size={32} style={{ opacity:.25 }} /> Aucune contribution pour l'instant
                    </div>
                  : <div style={{ overflowX:'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Référence</th><th>Contributeur</th><th>Téléphone</th><th>Opérateur</th><th>Montant</th><th>Message</th><th>Date</th></tr></thead>
                        <tbody>{contributions.map(c=>(
                          <tr key={c.id}>
                            <td><code style={{ background:'var(--green-bg)', padding:'2px 6px', borderRadius:4, fontSize:11, color:'var(--green-l)' }}>{c.reference}</code></td>
                            <td style={{ fontWeight:600 }}>{c.contributor_name}</td>
                            <td style={{ color:'var(--muted)', fontSize:12 }}>{c.phone||'—'}</td>
                            <td><span className="badge b-b" style={{ fontSize:11 }}>{c.operator||'—'}</span></td>
                            <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(c.amount).toLocaleString('fr-FR')} {c.currency}</td>
                            <td style={{ fontSize:12, color:'var(--muted)', maxWidth:180 }}>{c.message||'—'}</td>
                            <td style={{ fontSize:11, color:'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                }
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES ──────────────────────────────────── */}
          {tab==='settings' && (
            <div style={{ maxWidth:560, display:'flex', flexDirection:'column', gap:12 }}>
              <div className="glass p-16 fade-in">
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                  <Gem size={15} /> Commission Nzela (globale)
                </div>
                <p style={{ fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.7 }}>
                  Taux par défaut appliqué à chaque nouvelle agence. Chaque agence peut avoir son propre taux modifiable dans sa fiche.
                </p>
                <Inp label="Taux de commission par défaut (%)">
                  <input className="input-field" type="number" min="0" max="50" step="1"
                    value={settings.commission_rate||10}
                    onChange={e=>setSettings({...settings,commission_rate:Number(e.target.value)})} />
                </Inp>
              </div>

              <div className="glass p-16 fade-in fade-in-2">
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>
                  <Database size={15} /> Sauvegarde de la base de données
                </div>
                <p style={{ fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.7 }}>
                  Exportez toutes les données en JSON. Importez pour restaurer une sauvegarde.
                </p>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
                  <button className="btn btn-ghost" style={{ fontSize:13, display:'inline-flex', alignItems:'center', gap:7 }} onClick={doExport}>
                    <Download size={13} /> Exporter JSON
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize:13, display:'inline-flex', alignItems:'center', gap:7 }} onClick={doExportExcel}>
                    <FileSpreadsheet size={13} /> Exporter Excel
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize:13, display:'inline-flex', alignItems:'center', gap:7 }} onClick={doExportPdf}>
                    <FileText size={13} /> Exporter PDF
                  </button>
                  <label className="btn btn-ghost" style={{ fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}>
                    <Upload size={13} /> Importer JSON
                    <input type="file" accept=".json" style={{ display:'none' }} onChange={doImport} />
                  </label>
                </div>
                <div style={{ padding:'10px 13px', background:'rgba(240,80,80,0.06)', border:'1px solid rgba(240,80,80,0.15)', borderRadius:8, fontSize:12, color:'var(--err)', display:'flex', alignItems:'center', gap:7 }}>
                  <AlertTriangle size={13} /> L'import remplace <strong>toutes</strong> les données existantes. Faites d'abord un export.
                </div>
              </div>

              <div className="glass p-16 fade-in fade-in-3">
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                  <Info size={15} /> Plateforme
                </div>
                {[['Version','2.1 — Nzela RDC'],['Agences',`${agencies.length} enregistrées (${agencies.filter(a=>a.is_active).length} actives)`],['API', API],['Base','SQLite WAL · Railway']].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--muted)' }}>{l}</span>
                    <span style={{ fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:42, fontSize:13, display:'flex', alignItems:'center', gap:8 }} onClick={doSaveSettings}>
                <Settings size={14} /> Sauvegarder les paramètres
              </button>

              {/* ── Zone Danger ───────────────────────────────── */}
              <div style={{ marginTop:8, border:'1.5px solid rgba(220,50,50,0.35)', borderRadius:14, overflow:'hidden' }}>
                <div style={{ background:'rgba(220,50,50,0.08)', padding:'14px 18px', borderBottom:'1px solid rgba(220,50,50,0.2)', display:'flex', alignItems:'center', gap:9 }}>
                  <ShieldAlert size={16} color="var(--err)" />
                  <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, color:'var(--err)' }}>Zone Danger</span>
                </div>
                <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                  <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.7, margin:0 }}>
                    La réinitialisation supprime <strong style={{ color:'var(--text)' }}>toutes les agences</strong>, leurs bus, voyages, réservations et gestionnaires.
                    Les contributions et paramètres sont conservés.
                    <br/>Cette action est <strong style={{ color:'var(--err)' }}>irréversible</strong>.
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(220,50,50,0.06)', border:'1px solid rgba(220,50,50,0.15)', borderRadius:10, fontSize:12, color:'var(--muted)' }}>
                    <Flame size={13} color="var(--err)" style={{ flexShrink:0 }} />
                    <span>Avant toute réinitialisation, un export <strong>Excel</strong> ET <strong>PDF</strong> sera obligatoire pour garder une trace de toutes vos données.</span>
                  </div>
                  <button
                    className="btn"
                    style={{ background:'rgba(220,50,50,0.1)', border:'1.5px solid rgba(220,50,50,0.4)', color:'var(--err)', fontSize:13, display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:700, width:'fit-content' }}
                    onClick={() => { setResetModal(true); setBackupXlsxDone(false); setBackupPdfDone(false); setResetConfirmText(''); }}
                  >
                    <RotateCcw size={14} /> Réinitialiser le dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </>}
      </main>

      {/* ── MODAL Créer agence ───────────────────────────────── */}
      {agencyModal && (
        <Modal title="Nouvelle agence" subtitle="Crée un accès agence sur la plateforme"
          onClose={()=>setAgencyModal(false)} onConfirm={doCreateAgency} confirmLabel="Créer →" maxWidth={520}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Nom de l'agence *">
                <input className="input-field" placeholder="Trans David SARL" value={agencyForm.agency_name}
                  onChange={e=>setAgencyForm({...agencyForm,agency_name:e.target.value})} />
              </Inp>
            </div>
            <Inp label="Identifiant *">
              <input className="input-field" placeholder="transdavid" value={agencyForm.username}
                onChange={e=>setAgencyForm({...agencyForm,username:e.target.value.toLowerCase().replace(/\s/g,'')})} />
            </Inp>
            <Inp label="Mot de passe * (min. 6)">
              <input className="input-field" type="password" placeholder="••••••••" value={agencyForm.password}
                onChange={e=>setAgencyForm({...agencyForm,password:e.target.value})} />
            </Inp>
            <Inp label="Email">
              <input className="input-field" type="email" placeholder="contact@agence.cd" value={agencyForm.email||''}
                onChange={e=>setAgencyForm({...agencyForm,email:e.target.value})} />
            </Inp>
            <Inp label="Téléphone">
              <input className="input-field" placeholder="+243 81 000 0000" value={agencyForm.phone||''}
                onChange={e=>setAgencyForm({...agencyForm,phone:e.target.value})} />
            </Inp>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Taux de commission (%)" hint={`Taux global actuel : ${settings.commission_rate||10}%`}>
                <input className="input-field" type="number" min="0" max="50" step="1" value={agencyForm.commission_rate}
                  onChange={e=>setAgencyForm({...agencyForm,commission_rate:Number(e.target.value)})} />
              </Inp>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Modifier agence ───────────────────────────── */}
      {editAgency && (
        <Modal title={`Modifier — ${editAgency.agency_name}`}
          onClose={()=>setEditAgency(null)} onConfirm={doSaveAgency} confirmLabel="Sauvegarder" maxWidth={520}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Nom de l'agence">
                <input className="input-field" value={editAgency.agency_name}
                  onChange={e=>setEditAgency({...editAgency,agency_name:e.target.value})} />
              </Inp>
            </div>
            <Inp label="Email"><input className="input-field" type="email" value={editAgency.email||''} onChange={e=>setEditAgency({...editAgency,email:e.target.value})} /></Inp>
            <Inp label="Téléphone"><input className="input-field" value={editAgency.phone||''} onChange={e=>setEditAgency({...editAgency,phone:e.target.value})} /></Inp>
            <Inp label="Commission (%)"><input className="input-field" type="number" min="0" max="50" value={editAgency.commission_rate||10} onChange={e=>setEditAgency({...editAgency,commission_rate:Number(e.target.value)})} /></Inp>
            <Inp label="Note (1-5)"><input className="input-field" type="number" min="1" max="5" value={editAgency.note||3} onChange={e=>setEditAgency({...editAgency,note:Number(e.target.value)})} /></Inp>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Statut">
                <div style={{ display:'flex', gap:8 }}>
                  {[['Actif',1],['Inactif',0]].map(([l,v])=>(
                    <button key={v} className={`btn ${editAgency.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }}
                      onClick={()=>setEditAgency({...editAgency,is_active:v})}>{l}</button>
                  ))}
                </div>
              </Inp>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Premium">
                <div style={{ display:'flex', gap:8 }}>
                  {[['Premium',1],['Standard',0]].map(([l,v])=>(
                    <button key={v} className={`btn ${editAgency.premium===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }}
                      onClick={()=>setEditAgency({...editAgency,premium:v})}>{l}</button>
                  ))}
                </div>
              </Inp>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Galerie ───────────────────────────────────── */}
      {galleryModal && (
        <Modal title={editGallery ? "Modifier l'image" : 'Ajouter une image'}
          onClose={()=>{ setGalleryModal(false); setEditGallery(null); }}
          onConfirm={doSaveGallery} confirmLabel={editGallery ? 'Sauvegarder' : 'Ajouter →'} maxWidth={480}>
          <Inp label="URL de l'image *">
            <input className="input-field" placeholder="https://…" value={galleryForm.image_url}
              onChange={e=>setGalleryForm({...galleryForm,image_url:e.target.value})} />
          </Inp>
          {galleryForm.image_url && (
            <div style={{ height:120, borderRadius:10, overflow:'hidden', background:'var(--card)' }}>
              <img src={galleryForm.image_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{e.target.style.display='none'}} alt="preview" />
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Inp label="Titre"><input className="input-field" placeholder="Vue de Boma" value={galleryForm.title} onChange={e=>setGalleryForm({...galleryForm,title:e.target.value})} /></Inp>
            <Inp label="Catégorie">
              <select className="input-field" value={galleryForm.category} onChange={e=>setGalleryForm({...galleryForm,category:e.target.value})}>
                {['general','ville','bus','route','agence'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Inp>
          </div>
          <Inp label="Description"><input className="input-field" placeholder="Description courte…" value={galleryForm.description} onChange={e=>setGalleryForm({...galleryForm,description:e.target.value})} /></Inp>
          <Inp label="Ordre d'affichage"><input className="input-field" type="number" min="0" value={galleryForm.sort_order} onChange={e=>setGalleryForm({...galleryForm,sort_order:Number(e.target.value)})} /></Inp>
        </Modal>
      )}

      {/* ── MODAL Réinitialisation Dashboard ────────────────── */}
      {resetModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--night)', border:'1.5px solid rgba(220,50,50,0.4)', borderRadius:18, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(200,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ background:'rgba(220,50,50,0.1)', padding:'18px 22px', borderBottom:'1px solid rgba(220,50,50,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'rgba(220,50,50,0.15)', border:'1px solid rgba(220,50,50,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ShieldAlert size={17} color="var(--err)" />
                </div>
                <div>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16 }}>Réinitialisation du dashboard</div>
                  <div style={{ fontSize:11, color:'var(--err)', marginTop:1 }}>Action irréversible · Toutes les agences seront supprimées</div>
                </div>
              </div>
              <button onClick={()=>setResetModal(false)} style={{ width:30, height:30, borderRadius:8, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}><X size={14} /></button>
            </div>

            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:16 }}>

              {/* Warning */}
              <div style={{ background:'rgba(220,50,50,0.07)', border:'1px solid rgba(220,50,50,0.2)', borderRadius:10, padding:'12px 15px', fontSize:13, lineHeight:1.7 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, fontWeight:700, color:'var(--err)', marginBottom:6 }}><AlertTriangle size={14} /> Avant de continuer, lisez attentivement</div>
                Ceci supprimera définitivement <strong>toutes les agences</strong> ({agencies.length}), leurs bus, voyages, réservations et gestionnaires.<br/>
                Les <strong>contributions</strong> et <strong>paramètres</strong> seront conservés.<br/>
                <span style={{ color:'var(--err)', fontWeight:700 }}>Cette action est irréversible.</span>
              </div>

              {/* Étape 1 — Excel */}
              <div style={{ border:`1.5px solid ${backupXlsxDone ? 'rgba(61,170,106,0.5)' : 'var(--border)'}`, borderRadius:12, padding:'14px 16px', background: backupXlsxDone ? 'rgba(61,170,106,0.06)' : 'var(--card)', transition:'all 0.25s' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background: backupXlsxDone ? 'rgba(61,170,106,0.15)' : 'rgba(61,170,106,0.08)', border:`1px solid ${backupXlsxDone ? 'rgba(61,170,106,0.4)' : 'rgba(61,170,106,0.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {backupXlsxDone ? <Check size={14} color="var(--green-l)" /> : <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:12, color:'var(--green-l)' }}>1</span>}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                        <FileSpreadsheet size={13} color="var(--green-l)" /> Export Excel obligatoire
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Agences, stats, contributions — toutes les données</div>
                    </div>
                  </div>
                  {backupXlsxDone
                    ? <span style={{ fontSize:12, fontWeight:700, color:'var(--green-l)', display:'flex', alignItems:'center', gap:5 }}><Check size={13} /> Téléchargé</span>
                    : <button className="btn btn-ghost" style={{ fontSize:12, display:'inline-flex', alignItems:'center', gap:6, borderColor:'rgba(61,170,106,0.3)', color:'var(--green-l)' }} onClick={doExportExcel}>
                        <Download size={12} /> Télécharger Excel
                      </button>
                  }
                </div>
              </div>

              {/* Étape 2 — PDF */}
              <div style={{ border:`1.5px solid ${backupPdfDone ? 'rgba(61,170,106,0.5)' : 'var(--border)'}`, borderRadius:12, padding:'14px 16px', background: backupPdfDone ? 'rgba(61,170,106,0.06)' : 'var(--card)', transition:'all 0.25s' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background: backupPdfDone ? 'rgba(61,170,106,0.15)' : 'rgba(74,144,217,0.08)', border:`1px solid ${backupPdfDone ? 'rgba(61,170,106,0.4)' : 'rgba(74,144,217,0.2)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {backupPdfDone ? <Check size={14} color="var(--green-l)" /> : <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:12, color:'#4A90D9' }}>2</span>}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                        <FileText size={13} color="#4A90D9" /> Export PDF obligatoire
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Rapport complet avec tableaux imprimables</div>
                    </div>
                  </div>
                  {backupPdfDone
                    ? <span style={{ fontSize:12, fontWeight:700, color:'var(--green-l)', display:'flex', alignItems:'center', gap:5 }}><Check size={13} /> Téléchargé</span>
                    : <button className="btn btn-ghost" style={{ fontSize:12, display:'inline-flex', alignItems:'center', gap:6, borderColor:'rgba(74,144,217,0.3)', color:'#4A90D9' }} onClick={doExportPdf}>
                        <Download size={12} /> Télécharger PDF
                      </button>
                  }
                </div>
              </div>

              {/* Étape 3 — Confirmation textuelle */}
              <div style={{ border:`1.5px solid ${(backupXlsxDone && backupPdfDone) ? 'rgba(220,50,50,0.3)' : 'var(--border)'}`, borderRadius:12, padding:'14px 16px', background:'var(--card)', opacity: (backupXlsxDone && backupPdfDone) ? 1 : 0.45, pointerEvents: (backupXlsxDone && backupPdfDone) ? 'auto' : 'none', transition:'all 0.25s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:12, color:'var(--err)' }}>3</span>
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--err)' }}>Confirmation finale</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Saisissez <strong style={{ color:'var(--text)', letterSpacing:'0.05em' }}>SUPPRIMER</strong> pour confirmer</div>
                  </div>
                </div>
                <input
                  className="input-field"
                  placeholder='Tapez "SUPPRIMER"'
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  style={{ borderColor: resetConfirmText === 'SUPPRIMER' ? 'rgba(220,50,50,0.5)' : undefined, fontFamily:'monospace', letterSpacing:'0.08em' }}
                />
              </div>

              {/* Bouton final */}
              <button
                onClick={doResetAll}
                disabled={!backupXlsxDone || !backupPdfDone || resetConfirmText !== 'SUPPRIMER' || resetting}
                style={{
                  width:'100%', height:44, borderRadius:10, border:'none', cursor: (!backupXlsxDone || !backupPdfDone || resetConfirmText !== 'SUPPRIMER' || resetting) ? 'not-allowed' : 'pointer',
                  background: (!backupXlsxDone || !backupPdfDone || resetConfirmText !== 'SUPPRIMER' || resetting) ? 'rgba(220,50,50,0.15)' : 'rgba(220,50,50,0.85)',
                  color: (!backupXlsxDone || !backupPdfDone || resetConfirmText !== 'SUPPRIMER' || resetting) ? 'rgba(220,50,50,0.4)' : '#fff',
                  fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'all 0.2s',
                }}
              >
                {resetting
                  ? <><div className="spinner" style={{ borderTopColor:'currentColor' }} /> Réinitialisation en cours…</>
                  : <><Trash2 size={15} /> Tout supprimer et réinitialiser ({agencies.length} agences)</>
                }
              </button>

              <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)' }}>
                Les deux sauvegardes doivent être téléchargées avant de pouvoir confirmer.
              </div>
            </div>
          </div>
        </div>
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