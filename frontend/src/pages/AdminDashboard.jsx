import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = 'https://nzela-production-086a.up.railway.app/api';

const CITIES = ['Kinshasa', 'Matadi', 'Boma', 'Moanda'];
const CITY_META = {
  Kinshasa: { color:'#3DAA6A', bg:'rgba(61,170,106,0.12)', icon:'🏙️' },
  Boma:     { color:'#4A90D9', bg:'rgba(74,144,217,0.12)', icon:'⚓' },
  Matadi:   { color:'#E8A838', bg:'rgba(232,168,56,0.12)',  icon:'⛰️' },
  Moanda:   { color:'#9B59B6', bg:'rgba(155,89,182,0.12)', icon:'🌊' },
};

function getAdminHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const colors = { success:'var(--ok)', error:'var(--err)', info:'var(--gold)' };
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, display:'flex', alignItems:'center', gap:10, background:'var(--card)', border:`1px solid ${colors[type]||'var(--border)'}`, borderRadius:12, padding:'12px 16px', fontSize:13, fontWeight:600, color:colors[type]||'var(--text)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', minWidth:260, maxWidth:380 }}>
      <span>{type==='success'?'✓':type==='error'?'✕':'·'}</span>
      <span style={{ flex:1 }}>{msg}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:16, opacity:0.6 }}>×</button>
    </div>
  );
}

function Inp({ label, children, hint }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--muted)' }}>{hint}</div>}
    </div>
  );
}

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
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', fontSize:16, color:'var(--muted)' }}>×</button>
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

function StatCard({ icon, label, value, sub, color='var(--green-l)' }) {
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px' }}>
      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:22, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function AgencyAvatar({ name, logoUrl, size=36 }) {
  const initials = name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '?';
  if (logoUrl) return <img src={logoUrl} alt={name} style={{ width:size, height:size, borderRadius:10, objectFit:'cover', border:'1px solid rgba(61,170,106,0.2)', flexShrink:0 }} onError={e=>{e.target.style.display='none'}} />;
  return <div style={{ width:size, height:size, borderRadius:10, background:'linear-gradient(135deg,var(--green-d),var(--green-l))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--font)', fontWeight:800, fontSize:size*0.36, flexShrink:0 }}>{initials}</div>;
}

function CityBadge({ city }) {
  const meta = CITY_META[city] || { color:'var(--muted)', bg:'var(--card)', icon:'📍' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:meta.bg, color:meta.color, border:`1px solid ${meta.color}30`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
      {meta.icon} {city}
    </span>
  );
}

// ── Panel gestionnaires d'une agence ─────────────────────────────────────────
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
    try {
      const r = await axios.get(`${API}/admin/agencies/${agency.id}/users`, { headers });
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [agency.id]);

  const doCreate = async () => {
    if (!form.username || !form.password) return showToast('Identifiant et mot de passe requis', 'error');
    if (form.password.length < 6) return showToast('Mot de passe trop court (min. 6)', 'error');
    setSaving(true);
    try {
      await axios.post(`${API}/admin/agencies/${agency.id}/users`, form, { headers });
      showToast(`Gestionnaire "${form.username}" créé ✓`, 'success');
      setShowForm(false);
      setForm({ username:'', password:'', full_name:'', city:'', role:'manager' });
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
    finally { setSaving(false); }
  };

  const doToggle = async (u) => {
    try {
      await axios.patch(`${API}/admin/agencies/${agency.id}/users/${u.id}`, { is_active: u.is_active ? 0 : 1 }, { headers });
      showToast(u.is_active ? 'Compte désactivé' : 'Compte activé ✓', 'info');
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  const doDelete = async (u) => {
    if (!confirm(`Supprimer "${u.full_name || u.username}" ?`)) return;
    try {
      await axios.delete(`${API}/admin/agencies/${agency.id}/users/${u.id}`, { headers });
      showToast('Compte supprimé', 'info');
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  const doResetPass = async () => {
    if (!newPass || newPass.length < 6) return showToast('Min. 6 caractères', 'error');
    try {
      await axios.post(`${API}/admin/agencies/${agency.id}/users/${resetTarget.id}/reset-password`, { password: newPass }, { headers });
      showToast(`Mot de passe réinitialisé ✓`, 'success');
      setResetTarget(null); setNewPass('');
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
  };

  return (
    <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>
          👥 Gestionnaires ({users.length})
        </div>
        <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 11px' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Annuler' : '+ Ajouter'}
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
                {CITIES.map(c => <option key={c} value={c}>{CITY_META[c]?.icon} {c}</option>)}
              </select>
            </Inp>
            <Inp label="Rôle">
              <select className="input-field" style={{ fontSize:12 }} value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="manager">🔧 Gestionnaire</option>
                <option value="owner">👑 Propriétaire</option>
              </select>
            </Inp>
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button className="btn btn-primary" style={{ fontSize:12, width:'100%', justifyContent:'center' }} onClick={doCreate} disabled={saving}>
                {saving ? '⏳…' : '✓ Créer'}
              </button>
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--muted)', padding:'6px 10px', background:'var(--card)', borderRadius:7 }}>
            {form.city
              ? <>📍 Ce gestionnaire verra uniquement les voyages depuis <strong>{form.city}</strong>.</>
              : <>🌍 Sans ville assignée → accès à toutes les villes (propriétaire).</>
            }
          </div>
        </div>
      )}

      {loading
        ? <div style={{ textAlign:'center', padding:16, color:'var(--muted)', fontSize:12 }}>Chargement…</div>
        : users.length === 0
          ? <div style={{ textAlign:'center', padding:16, color:'var(--muted)', fontSize:12 }}>
              Aucun gestionnaire — cliquez sur "+ Ajouter"
            </div>
          : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {users.map(u => {
                const meta = u.city ? (CITY_META[u.city] || { color:'var(--muted)', bg:'var(--card)', icon:'📍' }) : { color:'var(--gold)', bg:'rgba(245,166,35,0.08)', icon:'👑' };
                return (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background: u.is_active ? meta.bg : 'var(--card)', border:`1px solid ${u.is_active ? meta.color+'30':'var(--border)'}`, borderRadius:8, padding:'9px 12px', opacity: u.is_active ? 1 : 0.6, flexWrap:'wrap', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:16 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700 }}>{u.full_name || u.username}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                          <code style={{ background:'var(--card)', padding:'0 4px', borderRadius:3, fontSize:10 }}>{u.username}</code>
                          {u.city ? <CityBadge city={u.city} /> : <span style={{ color:'var(--gold)', fontWeight:700 }}>Toutes villes</span>}
                          <span style={{ color: u.role==='owner' ? 'var(--gold)' : 'var(--muted)' }}>
                            {u.role==='owner' ? '👑 Propriétaire' : 'Gestionnaire'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost" style={{ fontSize:10, padding:'4px 8px' }} title="Réinitialiser le mot de passe"
                        onClick={() => { setResetTarget(u); setNewPass(''); }}>🔑</button>
                      <button className="btn btn-ghost" style={{ fontSize:10, padding:'4px 8px', color: u.is_active ? 'var(--gold)' : 'var(--ok)' }}
                        onClick={() => doToggle(u)} title={u.is_active ? 'Désactiver' : 'Activer'}>
                        {u.is_active ? '⛔' : '✓'}
                      </button>
                      <button className="btn btn-danger" style={{ fontSize:10, padding:'4px 8px' }}
                        onClick={() => doDelete(u)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
      }

      {resetTarget && (
        <Modal title="🔑 Réinitialiser le mot de passe" subtitle={resetTarget.full_name || resetTarget.username}
          onClose={() => { setResetTarget(null); setNewPass(''); }}
          onConfirm={doResetPass} confirmLabel="Mettre à jour →" maxWidth={380}>
          <Inp label="Nouveau mot de passe (min. 6 caractères)">
            <input className="input-field" type="password" placeholder="••••••••" value={newPass}
              onChange={e=>setNewPass(e.target.value)} autoFocus />
          </Inp>
          <div style={{ fontSize:12, color:'var(--muted)', padding:'8px 12px', background:'var(--card)', borderRadius:8 }}>
            ⚠️ Le gestionnaire devra utiliser ce mot de passe dès sa prochaine connexion.
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const navigate = useNavigate();
  const headers  = getAdminHeaders();

  const [tab, setTab]         = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Données
  const [stats, setStats]               = useState({});
  const [agencies, setAgencies]         = useState([]);
  const [gallery, setGallery]           = useState([]);
  const [settings, setSettings]         = useState({ commission_rate:10 });
  const [contributions, setContributions] = useState([]);

  // État UI agences
  const [agencyModal, setAgencyModal]   = useState(false);
  const [editAgency, setEditAgency]     = useState(null);
  const [expandedAgency, setExpandedAgency] = useState(null);
  const [agencyForm, setAgencyForm]     = useState({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10 });

  // État UI galerie
  const [galleryModal, setGalleryModal] = useState(false);
  const [editGallery, setEditGallery]   = useState(null);
  const [galleryForm, setGalleryForm]   = useState({ title:'', description:'', image_url:'', category:'general', sort_order:0 });

  const ok  = msg => setToast({ msg, type:'success' });
  const err = msg => setToast({ msg, type:'error' });
  const inf = msg => setToast({ msg, type:'info' });
  const showToast = (msg, type='info') => setToast({ msg, type });
  const goTab = id => { setTab(id); setSidebarOpen(false); };

  // ── Chargement ────────────────────────────────────────────────────────────
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
      setStats(st.data || {});
      setAgencies(Array.isArray(ag.data) ? ag.data : []);
      setGallery(Array.isArray(gl.data) ? gl.data : []);
      setSettings(se.data || { commission_rate:10 });
      setContributions(Array.isArray(co.data) ? co.data : []);
    } catch(e) {
      if (e.response?.status===401) { localStorage.clear(); navigate('/admin/login'); }
      else if (!silent) err('Erreur de chargement');
    } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 15000);
    return () => clearInterval(iv);
  }, []);

  // ── CRUD Agences ──────────────────────────────────────────────────────────
  const doCreateAgency = async () => {
    const { agency_name, username, password } = agencyForm;
    if (!agency_name || !username || !password) return err('Nom, identifiant et mot de passe requis');
    if (password.length < 6) return err('Mot de passe trop court (min. 6 caractères)');
    try {
      await axios.post(`${API}/admin/agencies`, agencyForm, { headers });
      ok(`Agence "${agency_name}" créée ✓`);
      setAgencyModal(false);
      setAgencyForm({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10 });
      load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doSaveAgency = async () => {
    try {
      await axios.patch(`${API}/admin/agencies/${editAgency.id}`, editAgency, { headers });
      ok('Agence mise à jour ✓');
      setEditAgency(null); load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doToggleAgency = async (ag) => {
    try {
      await axios.patch(`${API}/admin/agencies/${ag.id}`, { is_active: ag.is_active ? 0 : 1 }, { headers });
      inf(ag.is_active ? `"${ag.agency_name}" désactivée` : `"${ag.agency_name}" activée ✓`);
      load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doDeleteAgency = async (ag) => {
    if (!confirm(`Supprimer "${ag.agency_name}" ? Toutes les données seront perdues.`)) return;
    try {
      await axios.delete(`${API}/admin/agencies/${ag.id}`, { headers });
      inf(`Agence "${ag.agency_name}" supprimée`);
      load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  // ── CRUD Gallery ──────────────────────────────────────────────────────────
  const doSaveGallery = async () => {
    if (!galleryForm.image_url) return err("URL de l'image requise");
    try {
      if (editGallery) {
        await axios.patch(`${API}/admin/gallery/${editGallery.id}`, galleryForm, { headers });
        ok('Image mise à jour ✓');
      } else {
        await axios.post(`${API}/admin/gallery`, galleryForm, { headers });
        ok('Image ajoutée ✓');
      }
      setGalleryModal(false); setEditGallery(null);
      setGalleryForm({ title:'', description:'', image_url:'', category:'general', sort_order:0 });
      load();
    } catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doDeleteGallery = async id => {
    if (!confirm('Supprimer cette image ?')) return;
    try { await axios.delete(`${API}/admin/gallery/${id}`, { headers }); inf('Image supprimée'); load(); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  // ── Settings & DB ─────────────────────────────────────────────────────────
  const doSaveSettings = async () => {
    try { await axios.patch(`${API}/admin/settings`, settings, { headers }); ok('Paramètres sauvegardés ✓'); }
    catch(e) { err(e.response?.data?.error || 'Erreur'); }
  };

  const doExport = async () => {
    try {
      const r = await axios.get(`${API}/admin/export`, { headers });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type:'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nzela_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      ok('Export téléchargé ✓');
    } catch { err('Erreur export'); }
  };

  const doImport = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('⚠️ Importer remplacera TOUTES les données. Continuer ?')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await axios.post(`${API}/admin/import`, data, { headers });
      ok('Import réussi — données restaurées ✓'); load();
    } catch { err('Erreur import — fichier invalide ?'); }
    e.target.value = '';
  };

  // ── TABS ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id:'overview',      icon:'📊', label:'Vue globale' },
    { id:'agencies',      icon:'🏢', label:'Agences' },
    { id:'gallery',       icon:'🖼️', label:'Galerie' },
    { id:'contributions', icon:'💚', label:'Contributions' },
    { id:'settings',      icon:'⚙️', label:'Paramètres' },
  ];

  const totalRevenue    = agencies.reduce((s,a) => s + Number(a.total_revenue||0), 0);
  const totalCommission = agencies.reduce((s,a) => s + Number(a.total_commission||0), 0);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}

      <button className="hamburger" onClick={()=>setSidebarOpen(true)} aria-label="Menu">☰</button>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:49, display:sidebarOpen?'block':'none' }} onClick={()=>setSidebarOpen(false)} />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👑</div>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, color:'var(--text)' }}>Super Admin</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>Nzela RDC · Panneau central</div>
            </div>
          </div>
        </div>

        <div style={{ padding:10, borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:11, color:'var(--gold)', fontWeight:700, marginBottom:4 }}>👑 ADMINISTRATEUR</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Accès complet — toutes agences, données et paramètres.</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>goTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
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
          <a href="/" target="_blank" style={{ display:'block', textAlign:'center', fontSize:12, color:'var(--muted)', textDecoration:'none', marginBottom:8, padding:'6px', borderRadius:8, border:'1px solid var(--border)' }}>
            🌐 Voir le site public
          </a>
          <button className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12, padding:'8px' }}
            onClick={()=>{ localStorage.clear(); navigate('/admin/login'); }}>
            🚪 Déconnexion
          </button>
          <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', marginTop:8 }}>© 2026 Nzela RDC</div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <main style={{ flex:1, padding:'24px 28px', overflowY:'auto', overflowX:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, margin:0 }}>
                {TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}
              </h1>
              <span style={{ fontSize:11, background:'rgba(245,158,11,0.1)', color:'var(--gold)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, padding:'2px 8px', fontWeight:700 }}>
                👑 Super Admin
              </span>
            </div>
            <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {tab==='agencies' && <button className="btn btn-primary" onClick={()=>setAgencyModal(true)}>+ Agence</button>}
            {tab==='gallery'  && <button className="btn btn-primary" onClick={()=>{ setEditGallery(null); setGalleryForm({ title:'',description:'',image_url:'',category:'general',sort_order:0 }); setGalleryModal(true); }}>+ Image</button>}
            <button className="btn btn-ghost mobile-logout" style={{ fontSize:12, padding:'7px 11px' }}
              onClick={()=>{ localStorage.clear(); navigate('/admin/login'); }}>🚪</button>
          </div>
        </div>

        {loading
          ? <div style={{ textAlign:'center', padding:'60px' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
          : <>

          {/* ─── VUE GLOBALE ─────────────────────────────────────────────────── */}
          {tab==='overview' && <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12, marginBottom:20 }}>
              <StatCard icon="🏢" label="Agences actives"   value={agencies.filter(a=>a.is_active).length} sub={`${agencies.length} total`} color="var(--green-l)" />
              <StatCard icon="💰" label="Revenus totaux"    value={`${totalRevenue.toLocaleString('fr-FR')} FC`} color="var(--gold)" />
              <StatCard icon="💎" label="Commissions Nzela" value={`${totalCommission.toLocaleString('fr-FR')} FC`} color="#9B59B6" />
              <StatCard icon="🎟️" label="Réservations"      value={stats.total_bookings || 0} color="var(--green-l)" />
              <StatCard icon="🚌" label="Voyages actifs"    value={stats.total_trips || 0} color="#4A90D9" />
              <StatCard icon="💚" label="Contributions"     value={contributions.length} sub={`${contributions.reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')} FC`} color="var(--ok)" />
            </div>

            {/* Classement agences */}
            <div className="glass p-16 fade-in" style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14 }}>🏆 Classement des agences</div>
              <div style={{ overflowX:'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Agence</th><th>Voyages</th><th>Réservations</th><th>Revenus</th><th>Commission</th><th>Statut</th></tr></thead>
                  <tbody>
                    {[...agencies]
                      .sort((a,b) => Number(b.total_revenue||0) - Number(a.total_revenue||0))
                      .map((ag, i) => (
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

            {/* Stats par ville */}
            <div className="glass p-16 fade-in fade-in-2">
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14 }}>📍 Activité par ville</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:10 }}>
                {CITIES.map(city => {
                  const meta = CITY_META[city];
                  const d = (stats.by_city || {})[city] || {};
                  return (
                    <div key={city} style={{ background:meta.bg, border:`1px solid ${meta.color}25`, borderRadius:12, padding:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:20 }}>{meta.icon}</span>
                        <span style={{ fontFamily:'var(--font)', fontWeight:800, color:meta.color }}>{city}</span>
                      </div>
                      {[
                        ['Voyages',      d.trips    || '—'],
                        ['Réservations', d.bookings || '—'],
                        ['Revenus (FC)', d.revenue  ? Number(d.revenue).toLocaleString('fr-FR') : '—'],
                      ].map(([l,v]) => (
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

          {/* ─── AGENCES ─────────────────────────────────────────────────────── */}
          {tab==='agencies' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {agencies.length===0
                ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                    <div style={{ fontSize:44, marginBottom:12 }}>🏢</div>
                    <h3 style={{ fontFamily:'var(--font)', fontSize:17, marginBottom:8 }}>Aucune agence</h3>
                    <button className="btn btn-primary" onClick={()=>setAgencyModal(true)}>+ Créer la première agence</button>
                  </div>
                : agencies.map((ag, i) => (
                    <div key={ag.id} className="glass fade-in" style={{ animationDelay:`${i*0.05}s`, padding:'16px 20px', opacity: ag.is_active ? 1 : 0.65 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                        {/* Identité */}
                        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                          <AgencyAvatar name={ag.agency_name} logoUrl={ag.logo_url} size={44} />
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>{ag.agency_name}</span>
                              <span className={`badge ${ag.is_active?'b-g':'b-r'}`}>{ag.is_active?'Actif':'Inactif'}</span>
                              {ag.premium ? <span style={{ fontSize:11, background:'rgba(245,166,35,0.12)', color:'var(--gold)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:6, padding:'1px 7px', fontWeight:700 }}>⭐ Premium</span> : null}
                            </div>
                            <div style={{ fontSize:12, color:'var(--muted)', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' }}>
                              <span>👤 {ag.username}</span>
                              {ag.email && <span>✉️ {ag.email}</span>}
                              {ag.phone && <span>📞 {ag.phone}</span>}
                              <span style={{ color:'var(--green-l)', fontWeight:700 }}>Commission : {ag.commission_rate||10}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats inline */}
                        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                          {[
                            ['Voyages',  ag.total_trips||0,   'var(--text)'],
                            ['Réserv.',  ag.total_bookings||0,'var(--green-l)'],
                            ['Revenus',  `${Number(ag.total_revenue||0).toLocaleString('fr-FR')} FC`, 'var(--gold)'],
                            ['Commiss.', `${Number(ag.total_commission||0).toLocaleString('fr-FR')} FC`, '#9B59B6'],
                          ].map(([l,v,c]) => (
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, color:c }}>{v}</div>
                              <div style={{ fontSize:10, color:'var(--muted)' }}>{l}</div>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px' }}
                            onClick={()=>setExpandedAgency(expandedAgency===ag.id ? null : ag.id)}>
                            {expandedAgency===ag.id ? '▲ Fermer' : '👥 Gestionnaires'}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px' }}
                            onClick={()=>setEditAgency({...ag})}>✏️ Modifier</button>
                          <button className="btn btn-ghost" style={{ fontSize:11, padding:'6px 11px', color: ag.is_active ? 'var(--gold)':'var(--ok)' }}
                            onClick={()=>doToggleAgency(ag)}>
                            {ag.is_active ? '⛔ Désactiver' : '✓ Activer'}
                          </button>
                          <button className="btn btn-danger" style={{ fontSize:11, padding:'6px 9px' }}
                            onClick={()=>doDeleteAgency(ag)}>🗑️</button>
                        </div>
                      </div>

                      {/* Panel gestionnaires (expandable) */}
                      {expandedAgency===ag.id && (
                        <AgencyUsersPanel agency={ag} headers={headers} showToast={showToast} />
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {/* ─── GALERIE ─────────────────────────────────────────────────────── */}
          {tab==='gallery' && (
            <div>
              {gallery.length===0
                ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                    <div style={{ fontSize:44, marginBottom:12 }}>🖼️</div>
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
                              <button className="btn btn-ghost" style={{ fontSize:11, padding:'4px 9px' }}
                                onClick={()=>{ setEditGallery(img); setGalleryForm({...img}); setGalleryModal(true); }}>✏️</button>
                              <button className="btn btn-danger" style={{ fontSize:11, padding:'4px 9px' }}
                                onClick={()=>doDeleteGallery(img.id)}>🗑️</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* ─── CONTRIBUTIONS ───────────────────────────────────────────────── */}
          {tab==='contributions' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:16 }}>
                <StatCard icon="💚" label="Total contributions" value={contributions.length} color="var(--ok)" />
                <StatCard icon="💰" label="Total CDF" value={`${contributions.filter(c=>c.currency==='CDF').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')} FC`} color="var(--gold)" />
                <StatCard icon="💵" label="Total USD" value={`$${contributions.filter(c=>c.currency==='USD').reduce((s,c)=>s+Number(c.amount||0),0).toLocaleString('fr-FR')}`} color="var(--green-l)" />
              </div>
              <div className="glass" style={{ overflow:'hidden' }}>
                {contributions.length===0
                  ? <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>💚 Aucune contribution pour l'instant</div>
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

          {/* ─── PARAMÈTRES ──────────────────────────────────────────────────── */}
          {tab==='settings' && (
            <div style={{ maxWidth:560, display:'flex', flexDirection:'column', gap:12 }}>
              <div className="glass p-16 fade-in">
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:12 }}>💎 Commission Nzela (globale)</div>
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
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:8 }}>🗄️ Sauvegarde de la base de données</div>
                <p style={{ fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.7 }}>
                  Exportez toutes les données en JSON. Importez pour restaurer une sauvegarde.
                </p>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={doExport}>📥 Exporter la base</button>
                  <label className="btn btn-ghost" style={{ fontSize:13, cursor:'pointer' }}>
                    📤 Importer une sauvegarde
                    <input type="file" accept=".json" style={{ display:'none' }} onChange={doImport} />
                  </label>
                </div>
                <div style={{ marginTop:12, padding:'10px 13px', background:'rgba(240,80,80,0.06)', border:'1px solid rgba(240,80,80,0.15)', borderRadius:8, fontSize:12, color:'var(--err)' }}>
                  ⚠️ L'import remplace <strong>toutes</strong> les données existantes. Faites d'abord un export.
                </div>
              </div>

              <div className="glass p-16 fade-in fade-in-3">
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:14, marginBottom:14 }}>ℹ️ Plateforme</div>
                {[
                  ['Version',   '2.1 — Nzela RDC'],
                  ['Agences',   `${agencies.length} enregistrées (${agencies.filter(a=>a.is_active).length} actives)`],
                  ['API',       API],
                  ['Base',      'SQLite WAL · Railway'],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--muted)' }}>{l}</span>
                    <span style={{ fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', height:42, fontSize:13 }} onClick={doSaveSettings}>
                💾 Sauvegarder les paramètres
              </button>
            </div>
          )}
        </>}
      </main>

      {/* ── MODAL Créer agence ───────────────────────────────────────────────── */}
      {agencyModal && (
        <Modal title="🏢 Nouvelle agence" subtitle="Crée un accès agence sur la plateforme"
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

      {/* ── MODAL Modifier agence ────────────────────────────────────────────── */}
      {editAgency && (
        <Modal title={`✏️ Modifier — ${editAgency.agency_name}`}
          onClose={()=>setEditAgency(null)} onConfirm={doSaveAgency} confirmLabel="💾 Sauvegarder" maxWidth={520}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Nom de l'agence">
                <input className="input-field" value={editAgency.agency_name}
                  onChange={e=>setEditAgency({...editAgency,agency_name:e.target.value})} />
              </Inp>
            </div>
            <Inp label="Email">
              <input className="input-field" type="email" value={editAgency.email||''}
                onChange={e=>setEditAgency({...editAgency,email:e.target.value})} />
            </Inp>
            <Inp label="Téléphone">
              <input className="input-field" value={editAgency.phone||''}
                onChange={e=>setEditAgency({...editAgency,phone:e.target.value})} />
            </Inp>
            <Inp label="Commission (%)">
              <input className="input-field" type="number" min="0" max="50" value={editAgency.commission_rate||10}
                onChange={e=>setEditAgency({...editAgency,commission_rate:Number(e.target.value)})} />
            </Inp>
            <Inp label="Note (1-5)">
              <input className="input-field" type="number" min="1" max="5" value={editAgency.note||3}
                onChange={e=>setEditAgency({...editAgency,note:Number(e.target.value)})} />
            </Inp>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Statut">
                <div style={{ display:'flex', gap:8 }}>
                  {[['✓ Actif',1],['⛔ Inactif',0]].map(([l,v])=>(
                    <button key={v} className={`btn ${editAgency.is_active===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }}
                      onClick={()=>setEditAgency({...editAgency,is_active:v})}>{l}</button>
                  ))}
                </div>
              </Inp>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <Inp label="Premium">
                <div style={{ display:'flex', gap:8 }}>
                  {[['⭐ Premium',1],['Standard',0]].map(([l,v])=>(
                    <button key={v} className={`btn ${editAgency.premium===v?'btn-primary':'btn-ghost'}`} style={{ fontSize:12, padding:'7px 14px' }}
                      onClick={()=>setEditAgency({...editAgency,premium:v})}>{l}</button>
                  ))}
                </div>
              </Inp>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL Galerie ────────────────────────────────────────────────────── */}
      {galleryModal && (
        <Modal title={editGallery ? "✏️ Modifier l'image" : '🖼️ Ajouter une image'}
          onClose={()=>{ setGalleryModal(false); setEditGallery(null); }}
          onConfirm={doSaveGallery} confirmLabel={editGallery ? '💾 Sauvegarder' : 'Ajouter →'} maxWidth={480}>
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
            <Inp label="Titre">
              <input className="input-field" placeholder="Vue de Boma" value={galleryForm.title}
                onChange={e=>setGalleryForm({...galleryForm,title:e.target.value})} />
            </Inp>
            <Inp label="Catégorie">
              <select className="input-field" value={galleryForm.category} onChange={e=>setGalleryForm({...galleryForm,category:e.target.value})}>
                {['general','ville','bus','route','agence'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Inp>
          </div>
          <Inp label="Description">
            <input className="input-field" placeholder="Description courte…" value={galleryForm.description}
              onChange={e=>setGalleryForm({...galleryForm,description:e.target.value})} />
          </Inp>
          <Inp label="Ordre d'affichage">
            <input className="input-field" type="number" min="0" value={galleryForm.sort_order}
              onChange={e=>setGalleryForm({...galleryForm,sort_order:Number(e.target.value)})} />
          </Inp>
        </Modal>
      )}
    </div>
  );
}