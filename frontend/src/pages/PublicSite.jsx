import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import BookingModal from './BookingModal';
import {
  MapPin, Calendar, Search, Smartphone, Lock, Bus, Zap,
  CreditCard, ArrowUpDown, Phone, Mail, Star, Camera,
  Anchor, Wind, Users, Route, Check, X, Info,
  ChevronLeft, ChevronRight, Flag, CheckCircle
} from 'lucide-react';

const API = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa', 'Matadi', 'Boma', 'Moanda'];

const SLIDES = [
  { img: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80', title: 'Kinshasa → Boma', sub: 'Le fleuve Congo à ta gauche, la route à tes pieds.', tag: 'route', tagLabel: '05h00' },
  { img: 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?q=80&w=870&auto=format&fit=crop', title: 'Flotte moderne', sub: 'Des bus climatisés, entretenus chaque semaine.', tag: 'wind', tagLabel: 'Climatisé' },
  { img: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=1200&q=80', title: 'Kinshasa → Matadi', sub: 'La ville portuaire, à 5h de route.', tag: 'anchor', tagLabel: 'Matadi' },
  { img: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1200&q=80', title: 'Voyagez en famille', sub: 'Des tarifs pour tous, du confort pour chacun.', tag: 'users', tagLabel: 'Famille' },
];

const FEATURES = [
  { icon: Zap,        t: 'Réservez en 2 min',   s: 'Zéro queue, zéro stress' },
  { icon: Smartphone, t: 'M-Pesa & Orange',      s: 'Paiement 100% mobile' },
  { icon: Lock,       t: 'Paiement sécurisé',    s: 'Référence unique garantie' },
  { icon: Bus,        t: 'Bus identifiés',        s: 'Bus 1, Bus 2 — fiables' },
];

/* Partenaires — remplace les URL par tes vrais logos */
const PARTNERS = [
  { name: 'M-Pesa',      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/1200px-M-PESA_LOGO-01.svg.png' },
  { name: 'Orange Money', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Orange_logo.svg/1200px-Orange_logo.svg.png' },
  { name: 'Airtel Money', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Airtel_logo_2010.svg/1280px-Airtel_logo_2010.svg.png' },
  { name: 'Rawbank',      logo: 'https://upload.wikimedia.org/wikipedia/fr/thumb/b/b5/Rawbank_logo.svg/1200px-Rawbank_logo.svg.png' },
  { name: 'Equity BCDC', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Equity_Bank_logo.png/640px-Equity_Bank_logo.png' },
  { name: 'FPI-RDC',     logo: '' }, /* logo interne — remplace par l'URL correcte */
];

/* ── Icône de tag pour le carousel hero ── */
function SlideTagIcon({ tag, size = 12 }) {
  const icons = { route: Route, wind: Wind, anchor: Anchor, users: Users, camera: Camera };
  const Icon = icons[tag] || Camera;
  return <Icon size={size} />;
}

/* ── STYLES RESPONSIVE injectés une seule fois ── */
const RESPONSIVE_CSS = `
  .hero-grid         { display: grid; grid-template-columns: 380px 1fr; gap: 18px; align-items: start; }
  .hero-carousel     { display: block; }
  .feat-strip        { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; }
  .steps-grid        { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .stats-row         { display: flex; gap: 1px; }
  .trip-card-actions { display: flex; align-items: center; justify-content: space-between; }

  /* Partner carousel */
  .partner-track {
    display: flex;
    gap: 32px;
    align-items: center;
    animation: scroll-partners 28s linear infinite;
    width: max-content;
  }
  .partner-track:hover { animation-play-state: paused; }
  @keyframes scroll-partners {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

@media (max-width: 768px) {
  .hero-grid { grid-template-columns: 1fr !important; }
  .hero-carousel { display: block !important; margin-top: 16px; }
  .c-slide img { height: 200px !important; object-fit: cover; }
  .feat-strip { grid-template-columns: 1fr 1fr !important; }
  .steps-grid { grid-template-columns: 1fr !important; }
  .stats-row { flex-wrap: wrap; }
  .stats-row > div { flex: 1 1 45%; }
  .public-section { padding: 0 14px !important; }
  .public-footer { flex-direction: column; align-items: flex-start !important; gap: 6px; }
  .trip-card-actions { flex-wrap: wrap; gap: 8px; }
}

@media (max-width: 480px) {
  .feat-strip { grid-template-columns: 1fr !important; }
  .stats-row > div { flex: 1 1 100%; }
}
`;

function Logo({ size = 28, tagline = false }) {
  return (
    <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
      <div style={{ width:size, height:size, borderRadius:size*.24, background:'linear-gradient(135deg,#2A7D4F,#52C882)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(61,170,106,.32)', overflow:'hidden', flexShrink:0 }}>
        <img src="/logo.png" alt="Nzela" style={{ width:size*.78, height:size*.78, objectFit:'contain' }} />
      </div>
      <div>
        <div style={{ fontFamily:'var(--font)', fontSize:size*.58, fontWeight:800, letterSpacing:'-.02em', background:'linear-gradient(90deg,#fff,#52C882)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>nzela</div>
        {tagline && <div style={{ fontSize:10, color:'var(--muted)', WebkitTextFillColor:'var(--muted)' }}>Ta route commence ici.</div>}
      </div>
    </a>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const Icon = type === 'success' ? Check : type === 'error' ? X : Info;
  return (
    <div className={`toast t-${type==='success'?'ok':type==='error'?'err':'inf'}`}>
      <Icon size={14} />
      {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', display:'flex', alignItems:'center' }}>
        <X size={14} />
      </button>
    </div>
  );
}

function Carousel({ slides }) {
  const [cur, setCur] = useState(0);
  const timer = useRef(null);
  const next = useCallback(() => setCur(c => (c+1)%slides.length), [slides.length]);
  const prev = () => setCur(c => (c-1+slides.length)%slides.length);
  useEffect(() => { timer.current = setInterval(next, 5000); return () => clearInterval(timer.current); }, [next]);
  const go = i => { setCur(i); clearInterval(timer.current); timer.current = setInterval(next, 5000); };
  return (
    <div className="carousel">
      <div className="c-track" style={{ transform:`translateX(-${cur*100}%)` }}>
        {slides.map((s,i) => (
          <div className="c-slide" key={i}>
            <img src={s.img} alt={s.title} loading={i===0?'eager':'lazy'} />
            <div style={{ position:'absolute', top:12, left:12 }}>
              <span style={{ background:'rgba(61,170,106,.82)', backdropFilter:'blur(6px)', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:600, color:'#fff', display:'flex', alignItems:'center', gap:5 }}>
                <SlideTagIcon tag={s.tag || 'camera'} size={11} />
                {s.tagLabel || s.tag}
              </span>
            </div>
            <div className="c-cap"><h4>{s.title}</h4><p>{s.sub}</p></div>
          </div>
        ))}
      </div>
      <button className="c-btn p" onClick={prev}><ChevronLeft size={18} /></button>
      <button className="c-btn n" onClick={next}><ChevronRight size={18} /></button>
      <div className="c-dots">{slides.map((_,i) => <div key={i} className={`cdot${i===cur?' act':''}`} onClick={() => go(i)} />)}</div>
    </div>
  );
}

/* ── Carousel partenaires ── */
function PartnerCarousel() {
  /* On duplique la liste pour l'effet de défilement infini */
  const doubled = [...PARTNERS, ...PARTNERS];
  return (
    <section style={{ borderTop:'1px solid var(--border)', padding:'28px 0', overflow:'hidden', background:'var(--surface)' }}>
      <div style={{ textAlign:'center', marginBottom:18 }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)' }}>
          Ils nous font confiance
        </div>
      </div>
      <div style={{ overflow:'hidden', position:'relative' }}>
        {/* Fondu gauche */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:80, zIndex:2, background:'linear-gradient(90deg,var(--surface),transparent)', pointerEvents:'none' }} />
        {/* Fondu droit */}
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, zIndex:2, background:'linear-gradient(270deg,var(--surface),transparent)', pointerEvents:'none' }} />

        <div className="partner-track">
          {doubled.map((p, i) => (
            <div key={i} style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', height:44, padding:'0 8px', opacity:.65, transition:'opacity .2s', cursor:'default' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '.65'}>
              {p.logo
                ? <img src={p.logo} alt={p.name} style={{ height:28, maxWidth:90, objectFit:'contain', filter:'grayscale(1) brightness(1.6)' }}
                    onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap">${p.name}</span>`; }}
                  />
                : <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', whiteSpace:'nowrap' }}>{p.name}</span>
              }
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StarRating({ note }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={10} fill={i < note ? 'var(--gold)' : 'none'} color={i < note ? 'var(--gold)' : 'var(--muted)'} />
      ))}
    </span>
  );
}

function TripCard({ trip, onBook, delay=0 }) {
  const pct = Math.round((trip.available_seats/trip.total_seats)*100);
  const note = trip.agency_note || 3;
  return (
    <div className="fi" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', transition:'var(--ease)', animationDelay:`${delay}s` }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(61,170,106,.25)'; e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; }}>
      <div style={{ height:2, background:'linear-gradient(90deg,var(--green-d),var(--green-l))' }}/>
      <div style={{ padding:'14px 16px' }}>
        {/* En-tête agence */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
              {trip.agency_logo
                ? <img src={trip.agency_logo} alt={trip.agency_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.target.style.display='none'; e.target.parentNode.innerHTML=`<span style="font-size:15px;font-weight:800;color:var(--green-l)">${trip.agency_name?.[0]||'?'}</span>`; }}/>
                : <span style={{ fontSize:15, fontWeight:800, color:'var(--green-l)' }}>{trip.agency_name?.[0]?.toUpperCase()||'?'}</span>
              }
            </div>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, color:'var(--text)', lineHeight:1.1 }}>{trip.agency_name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                {trip.bus_name && (
                  <span style={{ fontSize:11, color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:3 }}>
                    <Bus size={11} /> {trip.bus_name}
                  </span>
                )}
                <StarRating note={note} />
              </div>
            </div>
          </div>
          {trip.available_seats <= 5
            ? <span className="badge b-r" style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Zap size={10} /> {trip.available_seats} restants</span>
            : <span className="badge b-g">{trip.available_seats} places</span>}
        </div>

        {/* Trajet */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, background:'rgba(255,255,255,.025)', borderRadius:9, padding:'10px 12px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{trip.departure_city}</div>
            <div style={{ fontWeight:700, fontSize:20, color:'var(--green-l)' }}>{trip.departure_time}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', width:'100%', gap:3 }}>
              <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,var(--green-d))' }}/>
              <MapPin size={13} color="var(--green-l)" />
              <div style={{ flex:1, height:1, background:'linear-gradient(90deg,var(--green-d),transparent)' }}/>
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{new Date(trip.departure_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div>
          </div>
          <div style={{ flex:1, textAlign:'right' }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{trip.arrival_city}</div>
          </div>
        </div>

        {/* Prix + action */}
        <div className="trip-card-actions">
          <div>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>Prix / siège</div>
            <div style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:800, color:'var(--gold)', lineHeight:1.1 }}>
              {Number(trip.price).toLocaleString('fr-FR')} <span style={{ fontSize:12, fontWeight:500 }}>FC</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:44, height:3, background:'rgba(255,255,255,.08)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:pct<25?'var(--err)':'var(--green)', borderRadius:99 }}/>
              </div>
              <span style={{ fontSize:10, color:'var(--muted)' }}>{pct}%</span>
            </div>
            <button className="btn btn-primary" onClick={() => onBook(trip)} style={{ borderRadius:8, padding:'8px 16px', fontSize:13 }}>Réserver</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicSite() {
  const [search, setSearch]   = useState({ from:'', to:'', date:'' });
  const [trips, setTrips]     = useState([]);
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast]     = useState(null);
  const resultsRef = useRef(null);
  const showToast = (msg, type='info') => setToast({ msg, type });

  useEffect(() => {
    axios.get(`${API}/public/gallery`)
      .then(r => setGallery(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!search.from || !search.to) return showToast('Sélectionnez départ et arrivée','error');
    setLoading(true);
    try {
      const p = new URLSearchParams({ from:search.from, to:search.to });
      if (search.date) p.append('date', search.date);
      const res = await axios.get(`${API}/public/trips?${p}`);
      setTrips(Array.isArray(res.data) ? res.data : []);
      setSearched(true);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    } catch { showToast('Erreur de recherche','error'); }
    finally { setLoading(false); }
  };

  const swap = () => setSearch(s => ({ ...s, from:s.to, to:s.from }));

  const slides = gallery.length > 0
    ? gallery.slice(0,6).map(g => ({ img:g.image_url, title:g.title||'', sub:g.description||'', tag:'camera', tagLabel: g.category||'Photo' }))
    : SLIDES;

  return (
    <div style={{ minHeight:'100vh', background:'var(--night)' }}>
      <style>{RESPONSIVE_CSS}</style>

      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', background:'rgba(5,14,23,.92)', backdropFilter:'blur(14px)', borderBottom:'1px solid var(--border)' }}>
        <Logo size={28}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--muted)', display:'inline-flex', alignItems:'center', gap:4 }}>
            <Flag size={12} /> RDC
          </span>
          <a href="/about" onClick={e => { e.preventDefault(); window.location.href='/about'; }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>À propos</a>
          <a href="/login" onClick={e => { e.preventDefault(); window.location.href='/login'; }} className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>Agences →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="public-section" style={{ maxWidth:1060, margin:'0 auto', padding:'20px 18px 0' }}>
        <div className="hero-grid">

          {/* SEARCH */}
          <div className="fi">
            <div style={{ marginBottom:14 }}>
              <div style={{ fontFamily:'var(--font)', fontSize:'clamp(20px,5vw,28px)', fontWeight:800, lineHeight:1.2, marginBottom:5 }}>
                Ta route,<br/>
                <span style={{ background:'linear-gradient(90deg,var(--green-d),var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>commence ici.</span>
              </div>
              <p style={{ color:'var(--muted)', fontSize:12, lineHeight:1.65 }}>Kinshasa – Boma – Matadi · 2 min pour réserver, Mobile Money accepté.</p>
            </div>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', padding:'16px 16px 12px', boxShadow:'0 16px 36px rgba(0,0,0,.32)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                <div className="input-group">
                  <label className="lbl" style={{ display:'flex', alignItems:'center', gap:5 }}><MapPin size={12} /> Départ</label>
                  <select className="field" value={search.from} onChange={e => setSearch({...search,from:e.target.value})}>
                    <option value="">Ville de départ</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                  <button onClick={swap}
                    style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.18)', borderRadius:99, padding:'3px 11px', cursor:'pointer', fontSize:12, color:'var(--green-l)', transition:'var(--ease)', fontFamily:'var(--font)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:5 }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(61,170,106,.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--green-bg)'}>
                    <ArrowUpDown size={12} /> Inverser
                  </button>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                </div>
                <div className="input-group">
                  <label className="lbl" style={{ display:'flex', alignItems:'center', gap:5 }}><MapPin size={12} /> Arrivée</label>
                  <select className="field" value={search.to} onChange={e => setSearch({...search,to:e.target.value})}>
                    <option value="">Ville d'arrivée</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="lbl" style={{ display:'flex', alignItems:'center', gap:5 }}><Calendar size={12} /> Date</label>
                  <input className="field" type="date" value={search.date} min={new Date().toISOString().split('T')[0]} onChange={e => setSearch({...search,date:e.target.value})}/>
                </div>
                <button className="btn btn-primary w100" onClick={handleSearch} disabled={loading}
                  style={{ justifyContent:'center', height:40, fontSize:13, borderRadius:'var(--r)', marginTop:2, display:'flex', alignItems:'center', gap:7 }}>
                  {loading
                    ? <><div className="spin"/>Recherche…</>
                    : <><Search size={14} /> Trouver un voyage</>}
                </button>
              </div>
            </div>
            {/* Raccourcis */}
            <div style={{ marginTop:10, display:'flex', gap:5, flexWrap:'wrap' }}>
              {[['Kinshasa','Boma'],['Kinshasa','Matadi'],['Boma','Kinshasa']].map(([f,t]) => (
                <button key={`${f}-${t}`} onClick={() => setSearch(s => ({...s,from:f,to:t}))}
                  style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.13)', borderRadius:99, padding:'4px 11px', fontSize:11, color:'var(--muted)', cursor:'pointer', transition:'var(--ease)' }}
                  onMouseEnter={e => { e.currentTarget.style.color='var(--green-l)'; e.currentTarget.style.borderColor='rgba(61,170,106,.28)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='rgba(61,170,106,.13)'; }}>
                  {f} → {t}
                </button>
              ))}
            </div>
          </div>

          {/* CAROUSEL — caché sur mobile via CSS */}
          <div className="fi fi-2 hero-carousel">
            <Carousel slides={slides}/>
            <div className="quote-band mt12">
              <p style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:600, position:'relative', zIndex:1, lineHeight:1.55 }}>
                "Plus de 10 000 voyageurs nous font confiance chaque mois."
                <br/><span style={{ opacity:.7, fontWeight:400, fontSize:11 }}>Rejoignez la communauté Nzela — la RDC se déplace avec nous.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="public-section" style={{ maxWidth:1060, margin:'16px auto 0', padding:'0 18px' }}>
        <div className="feat-strip" style={{ background:'var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
          {FEATURES.map((f,i) => (
            <div key={i} style={{ background:'var(--surface)', padding:'13px 15px', display:'flex', alignItems:'center', gap:9 }}>
              <f.icon size={17} color="var(--green-l)" style={{ flexShrink:0 }} />
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:12 }}>{f.t}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* RÉSULTATS */}
      <section ref={resultsRef} className="public-section" style={{ maxWidth:1060, margin:'0 auto', padding:'18px 18px 40px' }}>
        {searched && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:700 }}>{search.from} → {search.to}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{trips.length} trajet{trips.length!==1?'s':''} — classés par note agence</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSearched(false)} style={{ fontSize:12 }}>Réinitialiser</button>
            </div>
            {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spin" style={{ width:32, height:32, margin:'0 auto', borderWidth:3 }}/></div>}
            {!loading && trips.length===0 && (
              <div style={{ textAlign:'center', padding:'40px 20px', background:'var(--surface)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)' }}>
                <img src="/logo.png" alt="" style={{ width:40, opacity:.18, marginBottom:10 }}/>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, marginBottom:5 }}>Aucun trajet ce jour-là</div>
                <div style={{ color:'var(--muted)', fontSize:12 }}>Nos agences opèrent tous les jours — essayez une autre date.</div>
              </div>
            )}
            <div style={{ display:'grid', gap:10 }}>
              {trips.map((t,i) => <TripCard key={t.id} trip={t} onBook={setSelected} delay={i*.05}/>)}
            </div>
          </>
        )}

        {!searched && (
          <div style={{ marginTop:18 }}>
            <div style={{ textAlign:'center', padding:'28px 20px', maxWidth:560, margin:'0 auto' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,.16)', borderRadius:99, padding:'3px 13px', fontSize:11, color:'var(--green-l)', fontWeight:600, marginBottom:12 }}>
                <Flag size={11} /> Fièrement congolais
              </div>
              <h2 style={{ fontFamily:'var(--font)', fontSize:'clamp(18px,2.8vw,26px)', fontWeight:800, lineHeight:1.25, marginBottom:9 }}>
                Voyager en RDC,<br/><span style={{ background:'linear-gradient(90deg,var(--green-d),var(--green-l))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>enfin sans galère.</span>
              </h2>
              <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.7 }}>Fini les files d'attente et les billets perdus.<br/>Avec Nzela — tu choisis, tu paies, tu montes.</p>
            </div>

            {/* Étapes */}
            <div className="steps-grid" style={{ maxWidth:780, margin:'0 auto 20px' }}>
              {[
                { n:'01', Icon:Search,       t:'Cherche ton trajet',    d:'Départ, arrivée et date.' },
                { n:'02', Icon:CreditCard,   t:'Paye en Mobile Money',  d:'M-Pesa, Orange ou Airtel.' },
                { n:'03', Icon:Bus,          t:'Monte dans le bus',     d:"Présente ta référence. C'est tout." },
              ].map(s => (
                <div key={s.n} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:15, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-10, right:10, fontFamily:'var(--font)', fontSize:44, fontWeight:800, color:'rgba(61,170,106,.06)', lineHeight:1 }}>{s.n}</div>
                  <s.Icon size={20} color="var(--green-l)" style={{ marginBottom:7 }} />
                  <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, marginBottom:4 }}>{s.t}</div>
                  <div style={{ color:'var(--muted)', fontSize:12, lineHeight:1.6 }}>{s.d}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="stats-row" style={{ background:'var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', maxWidth:780, margin:'0 auto' }}>
              {[['10 000+','Voyageurs/mois'],['3','Agences'],['2','Trajets phares'],['100%','Mobile Money']].map(([v,l]) => (
                <div key={l} style={{ flex:1, background:'var(--surface)', padding:'13px 10px', textAlign:'center', minWidth:80 }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18, color:'var(--green-l)', marginBottom:2 }}>{v}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* PARTNER CAROUSEL */}
      <PartnerCarousel />

      {/* FOOTER */}
      <footer className="public-footer" style={{ borderTop:'1px solid var(--border)', padding:'14px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <Logo size={22} tagline/>
        <div style={{ fontSize:11, color:'var(--muted)' }}>© 2026 Nzela · Kinshasa, RDC</div>
        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Phone size={11} /> +243 85 91 53 213</span>
          <span>·</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><Mail size={11} /> support@nzela.cd</span>
        </div>
      </footer>

      {selected && <BookingModal trip={selected} onClose={() => setSelected(null)} showToast={showToast} onSuccess={() => showToast('Réservation confirmée','success')}/>}
    </div>
  );
}