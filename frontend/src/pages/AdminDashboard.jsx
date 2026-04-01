import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BackupTab from './BackupTab';

const API = '/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={`toast ${type==='success'?'t-ok':type==='error'?'t-err':'t-inf'}`} style={{ zIndex:300 }}>
      {type==='success'?'✓':type==='error'?'✕':'·'} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'inherit', cursor:'pointer', fontSize:15 }}>×</button>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
      <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#F5A623,#E8860A)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', boxShadow:'0 3px 8px rgba(245,166,35,0.35)' }}>
        <img src="/logo.png" alt="" style={{ width:21, objectFit:'contain' }} />
      </div>
      <div>
        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, background:'linear-gradient(90deg,#fff,#F5A623)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'-0.02em' }}>nzela</div>
        <div style={{ fontSize:10, color:'var(--muted)' }}>Super Admin</div>
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

function Modal({ title, subtitle, onClose, onConfirm, confirmLabel='Sauvegarder', maxWidth=480, goldBtn, children }) {
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
          <button className={`btn ${goldBtn?'btn-gold':'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── CAROUSEL PARTENAIRES ───────────────────────────────────────
function PartnersCarousel({ agencies }) {
  const [cur, setCur] = useState(0);
  const timer = useRef(null);
  const n = agencies.length;
  const next = useCallback(() => setCur(c => (c+1) % n), [n]);
  const prev = useCallback(() => setCur(c => (c-1+n) % n), [n]);

  useEffect(() => {
    if (n <= 1) return;
    timer.current = setInterval(next, 4500);
    return () => clearInterval(timer.current);
  }, [next, n]);

  if (!n) return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
      🏢 Aucune agence enregistrée
    </div>
  );

  const go = i => { clearInterval(timer.current); setCur(i); timer.current = setInterval(next, 4500); };

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div className="section-title" style={{ margin:0 }}>🤝 Agences partenaires</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span className="badge b-o" style={{ fontSize:11 }}>{n} partenaire{n>1?'s':''}</span>
          {n > 1 && <>
            <button onClick={prev} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, width:26, height:26, cursor:'pointer', color:'var(--muted)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <button onClick={next} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, width:26, height:26, cursor:'pointer', color:'var(--muted)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
          </>}
        </div>
      </div>

      <div style={{ overflow:'hidden' }}>
        <div style={{ display:'flex', transition:'transform 0.55s cubic-bezier(0.77,0,0.175,1)', transform:`translateX(-${cur*100}%)` }}>
          {agencies.map(ag => (
            <div key={ag.id} style={{ minWidth:'100%' }}>
              <div style={{ background:'linear-gradient(135deg,rgba(245,166,35,0.06),rgba(61,170,106,0.04))', border:'1px solid rgba(245,166,35,0.12)', borderRadius:10, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:50, height:50, borderRadius:12, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>🏢</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16, marginBottom:3 }}>{ag.agency_name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>@{ag.username} · Commission {ag.commission_rate||10}% · Annulation {ag.cancel_rate||20}%</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <span className="badge b-g" style={{ fontSize:11 }}>✓ {ag.confirmed||0} confirmées</span>
                    {(ag.pending||0) > 0 && <span className="badge b-o" style={{ fontSize:11 }}>⏳ {ag.pending} en attente</span>}
                    {(ag.cancelled||0) > 0 && <span className="badge b-r" style={{ fontSize:11 }}>✕ {ag.cancelled} annulées</span>}
                    <span className="badge b-b" style={{ fontSize:11 }}>🚌 {ag.buses||0} bus</span>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>Revenus bruts</div>
                  <div style={{ fontFamily:'var(--font)', fontSize:17, fontWeight:800, color:'var(--gold)' }}>{Number(ag.revenue||0).toLocaleString('fr-FR')} <span style={{ fontSize:10 }}>FC</span></div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Commission Nzela</div>
                  <div style={{ fontFamily:'var(--font)', fontSize:14, fontWeight:700, color:'var(--ok)' }}>+{Number(ag.commission||0).toLocaleString('fr-FR')} FC</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {n > 1 && (
        <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:12 }}>
          {agencies.map((_,i) => (
            <div key={i} onClick={() => go(i)} style={{ height:3, borderRadius:99, background:i===cur?'var(--gold)':'var(--border)', width:i===cur?20:6, cursor:'pointer', transition:'all 0.3s' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── GALERIE ────────────────────────────────────────────────────
function GalleryTab({ toast }) {
  const h = headers();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title:'', description:'', image_url:'', category:'general', sort_order:0 });
  const CATS = ['general','bus','terminal','route','interieur'];

  const load = async () => {
    try { const r = await axios.get(`${API}/admin/gallery`, { headers:h }); setItems(r.data); }
    catch { toast('Erreur chargement galerie', 'error'); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'reversements' && !rev) loadReversements(); }, [tab]);

  const doAdd = async () => {
    if (!form.image_url) return toast("URL de l'image requise", 'error');
    try { await axios.post(`${API}/admin/gallery`, form, { headers:h }); toast('Photo ajoutée ✓','success'); setShowAdd(false); setForm({ title:'', description:'', image_url:'', category:'general', sort_order:0 }); load(); }
    catch(e) { toast(e.response?.data?.error||'Erreur','error'); }
  };
  const doEdit = async () => {
    try { await axios.patch(`${API}/admin/gallery/${editItem.id}`, editItem, { headers:h }); toast('Modifié ✓','success'); setEditItem(null); load(); }
    catch(e) { toast(e.response?.data?.error||'Erreur','error'); }
  };
  const doDelete = async id => {
    if (!confirm('Supprimer cette photo ?')) return;
    try { await axios.delete(`${API}/admin/gallery/${id}`, { headers:h }); toast('Supprimée','info'); load(); }
    catch { toast('Erreur','error'); }
  };
  const toggle = async item => {
    try { await axios.patch(`${API}/admin/gallery/${item.id}`, { is_active: item.is_active?0:1 }, { headers:h }); load(); }
    catch { toast('Erreur','error'); }
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div className="section-title" style={{ margin:0 }}>📸 Photos visibles sur le site public</div>
        <button className="btn btn-gold" style={{ fontSize:12, padding:'7px 14px' }} onClick={() => setShowAdd(true)}>+ Ajouter une photo</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:10 }}>
        {items.map(img => (
          <div key={img.id} style={{ borderRadius:10, overflow:'hidden', background:'var(--deep)', border:`1px solid ${img.is_active?'var(--border)':'rgba(240,80,80,0.2)'}`, opacity:img.is_active?1:0.55 }}>
            <div style={{ position:'relative', aspectRatio:'4/3', background:'var(--deep)' }}>
              <img src={img.image_url} alt={img.title||''} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e=>e.target.style.display='none'} />
              <div style={{ position:'absolute', top:6, left:6, background:'rgba(61,170,106,0.8)', borderRadius:5, padding:'2px 6px', fontSize:10, color:'#fff', fontWeight:700 }}>{img.category}</div>
              <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:4 }}>
                <button onClick={() => setEditItem({...img})} style={{ background:'rgba(6,15,26,0.75)', border:'none', borderRadius:5, width:24, height:24, cursor:'pointer', color:'#fff', fontSize:11 }}>✏️</button>
                <button onClick={() => doDelete(img.id)} style={{ background:'rgba(240,80,80,0.75)', border:'none', borderRadius:5, width:24, height:24, cursor:'pointer', color:'#fff', fontSize:11 }}>✕</button>
              </div>
            </div>
            <div style={{ padding:'8px 10px' }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{img.title||'(sans titre)'}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
                <span style={{ fontSize:10, color:'var(--muted)' }}>Ordre : {img.sort_order}</span>
                <button onClick={() => toggle(img)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:img.is_active?'var(--ok)':'var(--err)', fontWeight:600, padding:0 }}>
                  {img.is_active?'✓ Visible':'⛔ Masqué'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'40px', color:'var(--muted)', fontSize:13 }}>
            📸 Aucune photo. Ajoutez des images pour la galerie du site public.
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="📸 Ajouter une photo" onClose={() => setShowAdd(false)} onConfirm={doAdd} confirmLabel="Ajouter →" goldBtn>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="URL de l'image *"><input className="input-field" placeholder="https://images.unsplash.com/..." value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} /></Inp>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:-6 }}>Lien direct vers une image (Unsplash, Imgur, votre hébergeur…)</div>
            {form.image_url && <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}><img src={form.image_url} alt="" style={{ width:'100%', maxHeight:130, objectFit:'cover', display:'block' }} onError={e=>e.target.style.display='none'} /><div style={{ padding:'5px 10px', fontSize:11, color:'var(--muted)', background:'var(--deep)' }}>Aperçu</div></div>}
            <Inp label="Titre"><input className="input-field" placeholder="Bus Trans David" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></Inp>
            <Inp label="Description"><input className="input-field" placeholder="Notre flotte moderne" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Inp>
            <div className="grid-2">
              <Inp label="Catégorie"><select className="input-field" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Inp>
              <Inp label="Ordre d'affichage"><input className="input-field" type="number" min="0" value={form.sort_order} onChange={e=>setForm({...form,sort_order:parseInt(e.target.value)||0})} /></Inp>
            </div>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="✏️ Modifier la photo" onClose={() => setEditItem(null)} onConfirm={doEdit} confirmLabel="💾 Sauvegarder" goldBtn>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="URL"><input className="input-field" value={editItem.image_url||''} onChange={e=>setEditItem({...editItem,image_url:e.target.value})} /></Inp>
            {editItem.image_url && <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}><img src={editItem.image_url} alt="" style={{ width:'100%', maxHeight:120, objectFit:'cover', display:'block' }} onError={e=>e.target.style.display='none'} /></div>}
            <Inp label="Titre"><input className="input-field" value={editItem.title||''} onChange={e=>setEditItem({...editItem,title:e.target.value})} /></Inp>
            <Inp label="Description"><input className="input-field" value={editItem.description||''} onChange={e=>setEditItem({...editItem,description:e.target.value})} /></Inp>
            <div className="grid-2">
              <Inp label="Catégorie"><select className="input-field" value={editItem.category||'general'} onChange={e=>setEditItem({...editItem,category:e.target.value})}>{['general','bus','terminal','route','interieur'].map(c=><option key={c}>{c}</option>)}</select></Inp>
              <Inp label="Ordre"><input className="input-field" type="number" min="0" value={editItem.sort_order||0} onChange={e=>setEditItem({...editItem,sort_order:parseInt(e.target.value)||0})} /></Inp>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const h = headers();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [agStats, setAgStats] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showNewAg, setShowNewAg] = useState(false);
  const [agForm, setAgForm] = useState({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10, cancel_rate:20 });

  const msg = (text, type='info') => setToast({ msg:text, type });

  const load = async () => {
    setLoading(true);
    try {
      const [s, as, b, ag] = await Promise.all([
        axios.get(`${API}/admin/stats`,          { headers:h }),
        axios.get(`${API}/admin/agencies-stats`, { headers:h }),
        axios.get(`${API}/admin/bookings`,        { headers:h }),
        axios.get(`${API}/admin/agencies`,        { headers:h }),
      ]);
      setStats(s.data); setAgStats(as.data); setBookings(b.data); setAgencies(ag.data);
    } catch(e) {
      if (e.response?.status === 401) { localStorage.clear(); navigate('/login'); }
      else msg('Erreur de chargement — vérifiez que le backend tourne', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const loadReversements = async (period) => {
    const p = period || revPeriod;
    setRevLoading(true);
    try {
      const r = await axios.get(`${API}/admin/reversements?from=${p.from}&to=${p.to}`, { headers:h });
      setRev(r.data);
    } catch(e) { msg('Erreur chargement reversements', 'error'); }
    finally { setRevLoading(false); }
  };

  const doCreateAg = async () => {
    if (!agForm.agency_name || !agForm.username || !agForm.password) return msg('Nom, identifiant et mot de passe requis', 'error');
    try { await axios.post(`${API}/admin/agencies`, agForm, { headers:h }); msg('Agence créée 🎉','success'); setShowNewAg(false); setAgForm({ agency_name:'', username:'', password:'', email:'', phone:'', commission_rate:10, cancel_rate:20 }); load(); }
    catch(e) { msg(e.response?.data?.error||'Erreur','error'); }
  };

  const toggleAg = async (id, active) => {
    try { await axios.patch(`${API}/admin/agencies/${id}`, { is_active: active?0:1 }, { headers:h }); msg(`Agence ${active?'désactivée':'activée'}`,'info'); load(); }
    catch { msg('Erreur','error'); }
  };

  const TABS = [
    { id:'overview',     icon:'📊', label:"Vue d'ensemble" },
    { id:'reversements', icon:'💸', label:'Reversements' },
    { id:'agencies',     icon:'🏢', label:'Agences' },
    { id:'bookings',     icon:'🎟️', label:'Réservations' },
    { id:'gallery',      icon:'📸', label:'Galerie' },
  ];

  // ── REVERSEMENTS ──
  const [rev, setRev] = useState(null);
  const [revLoading, setRevLoading] = useState(false);
  const [revPeriod, setRevPeriod] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diffLun = day === 0 ? -6 : 1 - day;
    const lundi = new Date(now); lundi.setDate(now.getDate() + diffLun);
    const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
    return { from: lundi.toISOString().split('T')[0], to: dimanche.toISOString().split('T')[0] };
  });

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--night)' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo"><Logo /></div>
        <div style={{ padding:'10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.15)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:17, marginBottom:4 }}>👑</div>
            <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, color:'var(--gold)' }}>Super Admin</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Accès complet · Nzela RDC</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
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
          {tab==='agencies' && <button className="btn btn-gold" onClick={() => setShowNewAg(true)}>+ Nouvelle agence</button>}
        </div>

        {loading
          ? <div style={{ textAlign:'center', padding:'60px 0' }}><div className="spinner" style={{ width:34,height:34,margin:'0 auto',borderWidth:2.5 }}/></div>
          : <>

          {/* OVERVIEW */}
          {tab==='overview' && <>
            <div className="grid-4" style={{ marginBottom:16 }}>
              {[
                { icon:'💎', label:'Commissions Nzela', value:`${Number(stats.commission||0).toLocaleString('fr-FR')} FC`, cls:'gold' },
                { icon:'💰', label:'Revenus bruts totaux', value:`${Number(stats.revenue_raw||0).toLocaleString('fr-FR')} FC`, cls:'green' },
                { icon:'✓',  label:'Réservations confirmées', value:stats.confirmed||0, cls:'navy' },
                { icon:'🏢', label:'Agences actives', value:stats.total_agencies||0, cls:'purple' },
              ].map((s,i) => (
                <div key={i} className={`stat-card ${s.cls} fade-in fade-in-${i+1}`}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom:16 }}>
              <div className="glass p-16" style={{ display:'flex', gap:13, alignItems:'center' }}>
                <div style={{ width:38, height:38, borderRadius:9, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>⏳</div>
                <div><div style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800 }}>{stats.pending||0}</div><div style={{ fontSize:11, color:'var(--muted)' }}>En attente de confirmation</div></div>
              </div>
              <div className="glass p-16" style={{ display:'flex', gap:13, alignItems:'center' }}>
                <div style={{ width:38, height:38, borderRadius:9, background:'rgba(240,80,80,0.1)', border:'1px solid rgba(240,80,80,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✕</div>
                <div><div style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800 }}>{stats.cancelled||0}</div><div style={{ fontSize:11, color:'var(--muted)' }}>Annulées</div></div>
              </div>
            </div>

            <PartnersCarousel agencies={agStats} />
          </>}

          {/* AGENCES */}
          {tab==='agencies' && <div style={{ display:'grid', gap:10 }}>
            {agencies.map((ag,i) => (
              <div key={ag.id} className="glass fade-in" style={{ animationDelay:`${i*0.06}s`, padding:'13px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'rgba(245,166,35,0.08)', border:'1px solid rgba(245,166,35,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19 }}>🏢</div>
                    <div>
                      <div style={{ fontFamily:'var(--font)', fontSize:14, fontWeight:700 }}>{ag.agency_name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>@{ag.username}{ag.email&&` · ${ag.email}`}{ag.phone&&` · ${ag.phone}`}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>Commission {ag.commission_rate||10}% · Annulation {ag.cancel_rate||20}%</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className={`badge ${ag.is_active?'b-g':'b-r'}`}>{ag.is_active?'✓ Active':'⛔ Inactive'}</span>
                    <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 11px' }} onClick={() => toggleAg(ag.id, ag.is_active)}>{ag.is_active?'Désactiver':'Activer'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>}

          {/* RÉSERVATIONS */}
          {tab==='bookings' && <div className="glass" style={{ overflow:'hidden' }}>
            {bookings.length===0
              ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>📭 Aucune réservation</div>
              : <div style={{ overflowX:'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>Référence</th><th>Passager</th><th>Agence</th><th>Trajet</th><th>Montant</th><th>Commission</th><th>Statut</th></tr></thead>
                    <tbody>{bookings.map(b => (
                      <tr key={b.id}>
                        <td><code style={{ background:'var(--green-bg)', padding:'2px 7px', borderRadius:5, fontSize:11, color:'var(--green-l)' }}>{b.reference}</code></td>
                        <td><div style={{ fontWeight:600 }}>{b.passenger_name}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{b.passenger_phone}</div></td>
                        <td style={{ fontWeight:600, fontSize:13 }}>{b.agency_name}</td>
                        <td><div style={{ fontSize:13 }}>{b.departure_city} → {b.arrival_city}</div><div style={{ fontSize:11, color:'var(--muted)' }}>{new Date(b.departure_date).toLocaleDateString('fr-FR')}</div></td>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                        <td style={{ color:'var(--ok)', fontWeight:700 }}>+{Number(b.commission_amount||0).toLocaleString('fr-FR')} FC</td>
                        <td><span className={`badge ${b.status==='confirmed'?'b-g':b.status==='cancelled'?'b-r':'b-o'}`}>{b.status==='confirmed'?'Confirmé':b.status==='cancelled'?'Annulé':'En attente'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </div>}

          {/* REVERSEMENTS */}
          {tab==='reversements' && (
            <div>
              {/* Sélecteur de période */}
              <div className="glass p-16 fade-in" style={{ marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>📅 Période</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input className="input-field" type="date" value={revPeriod.from}
                    onChange={e => setRevPeriod(p => ({...p, from:e.target.value}))}
                    style={{ width:150, padding:'7px 10px', fontSize:13 }} />
                  <span style={{ color:'var(--muted)', fontSize:13 }}>→</span>
                  <input className="input-field" type="date" value={revPeriod.to}
                    onChange={e => setRevPeriod(p => ({...p, to:e.target.value}))}
                    style={{ width:150, padding:'7px 10px', fontSize:13 }} />
                </div>
                <button className="btn btn-gold" style={{ fontSize:12, padding:'7px 16px' }}
                  onClick={() => loadReversements(revPeriod)}>
                  🔍 Calculer
                </button>
                {/* Raccourcis rapides */}
                <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                  {[
                    { label:'Cette semaine', fn: () => {
                      const now = new Date();
                      const diff = now.getDay()===0?-6:1-now.getDay();
                      const lun = new Date(now); lun.setDate(now.getDate()+diff);
                      const dim = new Date(lun); dim.setDate(lun.getDate()+6);
                      return { from:lun.toISOString().split('T')[0], to:dim.toISOString().split('T')[0] };
                    }},
                    { label:'Semaine passée', fn: () => {
                      const now = new Date();
                      const diff = now.getDay()===0?-6:1-now.getDay();
                      const lun = new Date(now); lun.setDate(now.getDate()+diff-7);
                      const dim = new Date(lun); dim.setDate(lun.getDate()+6);
                      return { from:lun.toISOString().split('T')[0], to:dim.toISOString().split('T')[0] };
                    }},
                    { label:'Ce mois', fn: () => {
                      const now = new Date();
                      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                      const to   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];
                      return { from, to };
                    }},
                  ].map(btn => (
                    <button key={btn.label} className="btn btn-ghost" style={{ fontSize:11, padding:'5px 10px' }}
                      onClick={() => { const p = btn.fn(); setRevPeriod(p); loadReversements(p); }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {revLoading && <div style={{ textAlign:'center', padding:'40px' }}><div className="spinner" style={{ width:32,height:32,margin:'0 auto',borderWidth:2.5 }}/></div>}

              {rev && !revLoading && (
                <>
                  {/* Totaux globaux */}
                  <div className="grid-3" style={{ marginBottom:16 }}>
                    {[
                      { label:'Revenus bruts totaux',    value:rev.totaux.total_brut,       color:'#F5A623', bg:'rgba(245,166,35,0.08)',  border:'rgba(245,166,35,0.2)'  },
                      { label:'Commissions Nzela',        value:rev.totaux.total_commission,  color:'var(--green-l)', bg:'var(--green-bg)', border:'rgba(61,170,106,0.2)'  },
                      { label:'Total à reverser',         value:rev.totaux.total_a_reverser,  color:'#7EC8E3', bg:'rgba(30,80,130,0.2)',  border:'rgba(126,200,227,0.2)' },
                    ].map((s,i) => (
                      <div key={i} className="glass fade-in" style={{ padding:'16px 18px', animationDelay:`${i*0.06}s` }}>
                        <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:700, marginBottom:6 }}>{s.label}</div>
                        <div style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:800, color:s.color }}>
                          {Number(s.value).toLocaleString('fr-FR')} <span style={{ fontSize:12, fontWeight:500 }}>FC</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Période affichée */}
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                    <span>📅 Période :</span>
                    <strong style={{ color:'var(--text)' }}>
                      {new Date(rev.period.from).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
                      {' → '}
                      {new Date(rev.period.to).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
                    </strong>
                  </div>

                  {/* Card par agence */}
                  <div style={{ display:'grid', gap:12 }}>
                    {rev.agencies.map((ag, i) => (
                      <div key={ag.id} className="glass fade-in" style={{ animationDelay:`${i*0.07}s`, overflow:'hidden' }}>
                        {/* Header agence */}
                        <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: ag.confirmed>0 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                            <div style={{ width:38, height:38, borderRadius:10, background:'rgba(245,166,35,0.1)', border:'1px solid rgba(245,166,35,0.18)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                              {ag.logo_url
                                ? <img src={ag.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
                                : <span style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, color:'var(--gold)' }}>{ag.agency_name[0]}</span>
                              }
                            </div>
                            <div>
                              <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{ag.agency_name}</div>
                              <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{ag.phone || ag.username}</div>
                            </div>
                          </div>

                          {ag.confirmed === 0
                            ? <span className="badge b-r" style={{ fontSize:11 }}>Aucune réservation</span>
                            : <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <div style={{ textAlign:'right' }}>
                                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em' }}>À reverser</div>
                                  <div style={{ fontFamily:'var(--font)', fontSize:20, fontWeight:800, color:'#7EC8E3' }}>{Number(ag.a_reverser).toLocaleString('fr-FR')} FC</div>
                                </div>
                              </div>
                          }
                        </div>

                        {/* Détails chiffrés */}
                        {ag.confirmed > 0 && (
                          <div style={{ padding:'12px 18px', background:'rgba(255,255,255,0.015)' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                              {[
                                { label:'Réservations confirmées', value:ag.confirmed,                     color:'var(--text)',    unit:'' },
                                { label:'Revenus bruts',           value:Number(ag.revenue_brut).toLocaleString('fr-FR'), color:'var(--gold)',    unit:' FC' },
                                { label:`Commission Nzela (${ag.commission_rate}%)`, value:Number(ag.commission).toLocaleString('fr-FR'), color:'var(--green-l)', unit:' FC' },
                                { label:" À reverser à l'agence",  value:Number(ag.a_reverser).toLocaleString('fr-FR'),   color:'#7EC8E3',        unit:' FC' },
                              ].map((item, j) => (
                                <div key={j} style={{ background:'var(--card)', borderRadius:8, padding:'10px 12px', border:'1px solid var(--border)' }}>
                                  <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{item.label}</div>
                                  <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800, color:item.color }}>{item.value}{item.unit}</div>
                                </div>
                              ))}
                            </div>

                            {/* Liste des réservations de la période */}
                            {ag.bookings.length > 0 && (
                              <details style={{ marginTop:4 }}>
                                <summary style={{ fontSize:12, color:'var(--muted)', cursor:'pointer', userSelect:'none', padding:'4px 0' }}>
                                  📋 Voir les {ag.bookings.length} réservation{ag.bookings.length>1?'s':''} de la période
                                </summary>
                                <div style={{ marginTop:10, overflowX:'auto' }}>
                                  <table className="data-table" style={{ fontSize:12 }}>
                                    <thead><tr><th>Référence</th><th>Passager</th><th>Trajet</th><th>Date</th><th>Montant</th><th>Commission</th></tr></thead>
                                    <tbody>{ag.bookings.map(b => (
                                      <tr key={b.id}>
                                        <td><code style={{ background:'var(--green-bg)', padding:'1px 6px', borderRadius:4, fontSize:11, color:'var(--green-l)' }}>{b.reference}</code></td>
                                        <td>{b.passenger_name}</td>
                                        <td>{b.departure_city} → {b.arrival_city}</td>
                                        <td style={{ color:'var(--muted)' }}>{new Date(b.departure_date).toLocaleDateString('fr-FR')}</td>
                                        <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                                        <td style={{ color:'var(--green-l)' }}>-{Number(b.commission_amount||0).toLocaleString('fr-FR')} FC</td>
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              </details>
                            )}

                            {/* Bouton action reversement */}
                            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'rgba(126,200,227,0.06)', border:'1px solid rgba(126,200,227,0.15)', borderRadius:9 }}>
                              <span style={{ fontSize:16 }}>💳</span>
                              <div style={{ flex:1, fontSize:12, color:'var(--muted)' }}>
                                Reverser <strong style={{ color:'#7EC8E3' }}>{Number(ag.a_reverser).toLocaleString('fr-FR')} FC</strong> sur le compte mobile de <strong style={{ color:'var(--text)' }}>{ag.agency_name}</strong>
                                {ag.phone && <span> ({ag.phone})</span>}
                              </div>
                              <button className="btn" style={{ background:'rgba(126,200,227,0.15)', border:'1px solid rgba(126,200,227,0.3)', color:'#7EC8E3', fontSize:11, padding:'6px 12px', borderRadius:7 }}
                                onClick={() => {
                                  const txt = `Nzela — Reversement ${rev.period.from} au ${rev.period.to}\n${ag.agency_name} : ${Number(ag.a_reverser).toLocaleString('fr-FR')} FC\n(${ag.confirmed} réservations · Commission ${ag.commission_rate}% déduite)`;
                                  navigator.clipboard.writeText(txt);
                                  msg('Détails copiés dans le presse-papier ✓', 'success');
                                }}>
                                📋 Copier détails
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!rev && !revLoading && (
                <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>💸</div>
                  <div style={{ fontSize:15, fontFamily:'var(--font)', fontWeight:700, marginBottom:6 }}>Calculer les reversements</div>
                  <div style={{ fontSize:13 }}>Sélectionne une période et clique sur "Calculer"</div>
                </div>
              )}
            </div>
          )}

          {/* GALERIE */}
          {tab==='gallery' && <GalleryTab toast={(text,type) => setToast({msg:text,type})} />}
          </>
        }
      </main>

      {/* Modal nouvelle agence */}
      {showNewAg && (
        <Modal title="🏢 Nouvelle agence" onClose={() => setShowNewAg(false)} onConfirm={doCreateAg} confirmLabel="Créer →" goldBtn maxWidth={500}>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <Inp label="Nom de l'agence *"><input className="input-field" placeholder="Trans Excellence" value={agForm.agency_name} onChange={e=>setAgForm({...agForm,agency_name:e.target.value})} /></Inp>
            <div className="grid-2">
              <Inp label="Identifiant *"><input className="input-field" placeholder="transexcellence" value={agForm.username} onChange={e=>setAgForm({...agForm,username:e.target.value})} /></Inp>
              <Inp label="Mot de passe *"><input className="input-field" type="password" placeholder="••••••••" value={agForm.password} onChange={e=>setAgForm({...agForm,password:e.target.value})} /></Inp>
            </div>
            <div className="grid-2">
              <Inp label="Email"><input className="input-field" placeholder="contact@agence.cd" value={agForm.email} onChange={e=>setAgForm({...agForm,email:e.target.value})} /></Inp>
              <Inp label="Téléphone"><input className="input-field" placeholder="+243 81 234 5678" value={agForm.phone} onChange={e=>setAgForm({...agForm,phone:e.target.value})} /></Inp>
            </div>
            <div className="grid-2">
              <Inp label="Commission plateforme (%)"><input className="input-field" type="number" min="0" max="50" value={agForm.commission_rate} onChange={e=>setAgForm({...agForm,commission_rate:Number(e.target.value)})} /></Inp>
              <Inp label="Taux annulation (%)"><input className="input-field" type="number" min="0" max="100" value={agForm.cancel_rate} onChange={e=>setAgForm({...agForm,cancel_rate:Number(e.target.value)})} /></Inp>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}