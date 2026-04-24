import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import BookingModal from './BookingModal';

const API   = 'https://nzela-production-086a.up.railway.app/api';
const CITIES = ['Kinshasa', 'Matadi', 'Boma', 'Moanda'];

const SLIDES = [
  { img:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80',    title:'Kinshasa → Boma',    sub:'Le fleuve Congo à ta gauche, la route à tes pieds.', tag:'🛣️ 05h00' },
  { img:'https://images.unsplash.com/photo-1557223562-6c77ef16210f?w=870&q=80',      title:'Flotte moderne',     sub:'Des bus climatisés, entretenus chaque semaine.',     tag:'❄️ Climatisé' },
  { img:'https://images.unsplash.com/photo-1601598851547-4302969d0614?w=1200&q=80',  title:'Kinshasa → Matadi',  sub:'La ville portuaire, à 5h de route.',                 tag:'⚓ Matadi' },
  { img:'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1200&q=80',  title:'Voyagez en famille', sub:'Des tarifs pour tous, du confort pour chacun.',       tag:'👨‍👩‍👧 Famille' },
];

const FEATURES = [
  { icon:'⚡', t:'Réservez en 2 min',   s:'Zéro queue, zéro stress' },
  { icon:'📱', t:'M-Pesa & Orange',     s:'Paiement 100% mobile' },
  { icon:'🔒', t:'Paiement sécurisé',  s:'Référence unique garantie' },
  { icon:'🚌', t:'Bus identifiés',      s:'Bus 1, Bus 2 — fiables' },
];

/* ─── INJECTION CSS GLOBALE ────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --night:    #060d14;
    --surf:     #0c1820;
    --surf2:    #111e29;
    --border:   rgba(255,255,255,0.07);
    --g:        #3DAA6A;
    --gd:       #2A7D4F;
    --gl:       #52C882;
    --gold:     #F5A623;
    --text:     #E8F4ED;
    --muted:    rgba(232,244,237,0.45);
    --err:      #F05050;
    --font:     'Syne', sans-serif;
    --body:     'DM Sans', sans-serif;
    --ease:     all 0.22s cubic-bezier(.4,0,.2,1);
    --r:        10px;
    --rl:       16px;
    --rxl:      22px;
  }

  body { font-family: var(--body); background: var(--night); color: var(--text); }

  /* ── SCROLLBAR ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--night); }
  ::-webkit-scrollbar-thumb { background: var(--gd); border-radius: 2px; }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp   { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: none; } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes shimmer  { 0%,100% { opacity:.5; } 50% { opacity:1; } }
  @keyframes pulseDot { 0%,100% { box-shadow: 0 0 0 0 rgba(61,170,106,.5); } 70% { box-shadow: 0 0 0 8px rgba(61,170,106,0); } }
  @keyframes slideTrack { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes rotateSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .fade-up   { animation: fadeUp   0.55s cubic-bezier(.4,0,.2,1) both; }
  .fade-in   { animation: fadeIn   0.4s ease both; }

  /* ── GRID LAYOUT ── */
  .hero-grid      { display: grid; grid-template-columns: 400px 1fr; gap: 20px; align-items: start; }
  .feat-strip     { display: grid; grid-template-columns: repeat(4,1fr); }
  .steps-grid     { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  .stats-row      { display: grid; grid-template-columns: repeat(4,1fr); }

  /* ── CHAMPS ── */
  .field {
    width: 100%; padding: 10px 13px; border-radius: var(--r);
    background: rgba(255,255,255,.04); border: 1px solid var(--border);
    color: var(--text); font-size: 14px; font-family: var(--body);
    outline: none; transition: var(--ease);
    -webkit-appearance: none; appearance: none;
  }
  .field:focus { border-color: rgba(61,170,106,.5); background: rgba(61,170,106,.05); box-shadow: 0 0 0 3px rgba(61,170,106,.1); }
  .lbl { display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 5px; letter-spacing: .04em; text-transform: uppercase; }

  /* ── BOUTONS ── */
  .btn { display: inline-flex; align-items: center; gap: 7px; border-radius: var(--r); padding: 9px 18px; font-size: 13px; font-weight: 600; font-family: var(--body); cursor: pointer; transition: var(--ease); border: none; }
  .btn-primary { background: var(--g); color: #050E17; }
  .btn-primary:hover { background: var(--gl); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(61,170,106,.35); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); }
  .btn-gold { background: var(--gold); color: #050E17; }
  .btn-gold:hover { background: #f7b84a; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(245,166,35,.35); }
  .w100 { width: 100%; }

  /* ── SPINNER ── */
  .spin { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.15); border-top-color: currentColor; border-radius: 50%; animation: rotateSlow .7s linear infinite; }

  /* ── TOAST ── */
  .toast { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; backdrop-filter: blur(20px); animation: fadeUp .3s ease; max-width: 340px; }
  .t-ok  { background: rgba(61,170,106,.18); border: 1px solid rgba(61,170,106,.3); color: var(--gl); }
  .t-err { background: rgba(240,80,80,.15);  border: 1px solid rgba(240,80,80,.3);  color: #ff9090; }
  .t-inf { background: rgba(126,200,227,.15); border: 1px solid rgba(126,200,227,.25); color: #7ec8e3; }

  /* ── CARDS 3D ── */
  .trip-card-wrap { perspective: 900px; }
  .trip-card {
    background: var(--surf);
    border: 1px solid var(--border);
    border-radius: var(--rxl);
    overflow: hidden;
    transition: box-shadow .3s ease;
    transform-style: preserve-3d;
    will-change: transform;
    transform: perspective(900px) rotateX(0deg) rotateY(0deg) scale(1);
    transition: transform .12s ease, box-shadow .3s ease, border-color .2s ease;
  }
  .trip-card:hover { box-shadow: 0 24px 64px rgba(0,0,0,.5), 0 0 0 1px rgba(61,170,106,.2); border-color: rgba(61,170,106,.22); }

  /* ── CAROUSEL ── */
  .carousel { position: relative; border-radius: var(--rl); overflow: hidden; background: var(--surf); aspect-ratio: 16/9; }
  .c-track { display: flex; height: 100%; transition: transform .55s cubic-bezier(.77,0,.175,1); }
  .c-slide { position: relative; min-width: 100%; height: 100%; flex-shrink: 0; overflow: hidden; }
  .c-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .c-slide::after { content:''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(6,13,20,.85) 0%, transparent 55%); }
  .c-cap { position: absolute; bottom: 14px; left: 16px; right: 16px; z-index: 2; }
  .c-cap h4 { font-family: var(--font); font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 3px; }
  .c-cap p  { font-size: 12px; color: rgba(255,255,255,.65); }
  .c-btn { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; background: rgba(6,13,20,.7); border: 1px solid rgba(255,255,255,.12); color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: var(--ease); }
  .c-btn:hover { background: rgba(61,170,106,.4); border-color: rgba(61,170,106,.5); }
  .c-btn.p { left: 10px; }
  .c-btn.n { right: 10px; }
  .c-dots { position: absolute; bottom: 10px; right: 14px; z-index: 3; display: flex; gap: 5px; }
  .cdot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.3); cursor: pointer; transition: var(--ease); }
  .cdot.act { width: 18px; border-radius: 3px; background: var(--gl); }

  /* ── BADGE DATE ── */
  .date-badge {
    display: inline-flex; flex-direction: column; align-items: center;
    background: linear-gradient(135deg, #1a3a28, #0f2a1e);
    border: 1.5px solid rgba(61,170,106,.4);
    border-radius: 12px; padding: 5px 10px; min-width: 54px;
    box-shadow: 0 4px 14px rgba(61,170,106,.15);
  }
  .date-badge-day   { font-family: var(--font); font-size: 22px; font-weight: 800; color: var(--gl); line-height: 1; }
  .date-badge-month { font-size: 10px; font-weight: 600; color: rgba(82,200,130,.7); text-transform: uppercase; letter-spacing: .06em; margin-top: 1px; }
  .date-badge-year  { font-size: 9px; color: rgba(82,200,130,.4); letter-spacing: .04em; }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .hero-grid   { grid-template-columns: 1fr; }
    .feat-strip  { grid-template-columns: 1fr 1fr; }
    .steps-grid  { grid-template-columns: 1fr; }
    .stats-row   { grid-template-columns: 1fr 1fr; }
    .hero-carousel { margin-top: 0; }
    .c-slide img { height: 200px; object-fit: cover; }
    .public-section { padding: 0 14px !important; }
  }
  @media (max-width: 480px) {
    .feat-strip { grid-template-columns: 1fr; }
    .stats-row  { grid-template-columns: 1fr 1fr; }
  }
`;

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */
function formatDateParts(raw) {
  if (!raw) return null;
  // "2026-06-15" → { day: "15", month: "JUN", year: "2026", full: "Lun 15 juin 2026" }
  const d = new Date(raw + 'T00:00:00');
  if (isNaN(d)) return null;
  return {
    day:   d.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.','').toUpperCase(),
    year:  d.getFullYear(),
    full:  d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }),
  };
}

/* ─── LOGO ─────────────────────────────────────────────────────────────────── */
function Logo({ size = 28, tagline = false }) {
  return (
    <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
      <div style={{ width:size, height:size, borderRadius:size*.24, background:'linear-gradient(135deg,#2A7D4F,#52C882)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(61,170,106,.32)', overflow:'hidden', flexShrink:0 }}>
        <img src="/logo.png" alt="Nzela" style={{ width:size*.78, height:size*.78, objectFit:'contain' }}/>
      </div>
      <div>
        <div style={{ fontFamily:'var(--font)', fontSize:size*.58, fontWeight:800, letterSpacing:'-.02em', background:'linear-gradient(90deg,#fff,#52C882)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1.1 }}>nzela</div>
        {tagline && <div style={{ fontSize:10, color:'var(--muted)', WebkitTextFillColor:'var(--muted)' }}>Ta route commence ici.</div>}
      </div>
    </a>
  );
}

/* ─── TOAST ─────────────────────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  return (
    <div className={`toast t-${type==='success'?'ok':type==='error'?'err':'inf'}`}>
      {type==='success'?'✓':type==='error'?'✕':'i'} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:14 }}>×</button>
    </div>
  );
}

/* ─── CAROUSEL ───────────────────────────────────────────────────────────────── */
function Carousel({ slides }) {
  const [cur, setCur] = useState(0);
  const timer = useRef(null);
  const next  = useCallback(() => setCur(c => (c+1) % slides.length), [slides.length]);
  const prev  = () => setCur(c => (c-1+slides.length) % slides.length);
  useEffect(() => { timer.current = setInterval(next, 5000); return () => clearInterval(timer.current); }, [next]);
  const go = i => { setCur(i); clearInterval(timer.current); timer.current = setInterval(next, 5000); };
  return (
    <div className="carousel">
      <div className="c-track" style={{ transform:`translateX(-${cur*100}%)` }}>
        {slides.map((s,i) => (
          <div className="c-slide" key={i}>
            <img src={s.img} alt={s.title} loading={i===0?'eager':'lazy'}/>
            <div style={{ position:'absolute', top:12, left:12, zIndex:2 }}>
              <span style={{ background:'rgba(61,170,106,.82)', backdropFilter:'blur(6px)', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:600, color:'#fff' }}>{s.tag}</span>
            </div>
            <div className="c-cap"><h4>{s.title}</h4><p>{s.sub}</p></div>
          </div>
        ))}
      </div>
      <button className="c-btn p" onClick={prev}>‹</button>
      <button className="c-btn n" onClick={next}>›</button>
      <div className="c-dots">{slides.map((_,i) => <div key={i} className={`cdot${i===cur?' act':''}`} onClick={() => go(i)}/>)}</div>
    </div>
  );
}

/* ─── TRIP CARD 3D ───────────────────────────────────────────────────────────── */
function TripCard({ trip, onBook, delay = 0 }) {
  const cardRef = useRef(null);
  const pct  = Math.round((trip.available_seats / trip.total_seats) * 100);
  const note = trip.agency_note || 3;
  const dateParts = formatDateParts(trip.departure_date);

  /* ── 3D Tilt sur MouseMove ── */
  const handleMouseMove = (e) => {
    const el   = cardRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;  // -0.5 → +0.5
    const y = (e.clientY - top)  / height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 5}deg) scale(1.018)`;
  };
  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
    el.style.transition = 'transform .5s cubic-bezier(.4,0,.2,1), box-shadow .3s ease, border-color .2s ease';
  };
  const handleMouseEnter = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform .1s ease, box-shadow .3s ease, border-color .2s ease';
  };

  return (
    <div className="trip-card-wrap fade-up" style={{ animationDelay:`${delay}s` }}>
      <div
        ref={cardRef}
        className="trip-card"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
      >
        {/* Barre accent top */}
        <div style={{ height:2, background:`linear-gradient(90deg, var(--gd), var(--gl), var(--gd))`, backgroundSize:'200% 100%' }}/>

        <div style={{ padding:'15px 16px' }}>

          {/* ── En-tête agence ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:11, background:'rgba(61,170,106,.1)', border:'1px solid rgba(61,170,106,.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                {trip.agency_logo
                  ? <img src={trip.agency_logo} alt={trip.agency_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{ e.target.style.display='none'; }}/>
                  : <span style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800, color:'var(--gl)' }}>{trip.agency_name?.[0]?.toUpperCase()||'?'}</span>
                }
              </div>
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15, lineHeight:1.1 }}>{trip.agency_name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                  {trip.bus_name && <span style={{ fontSize:11, color:'var(--muted)' }}>🚌 {trip.bus_name}</span>}
                  <span style={{ fontSize:10, color:'var(--gold)', letterSpacing:1 }}>{'★'.repeat(note)}{'☆'.repeat(5-note)}</span>
                </div>
              </div>
            </div>
            {/* Badge places */}
            {trip.available_seats <= 5
              ? <span style={{ background:'rgba(240,80,80,.12)', border:'1px solid rgba(240,80,80,.25)', color:'#ff9090', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, animation:'shimmer 2s ease infinite' }}>⚡ {trip.available_seats} restants</span>
              : <span style={{ background:'rgba(61,170,106,.1)', border:'1px solid rgba(61,170,106,.2)', color:'var(--gl)', borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:600 }}>{trip.available_seats} places</span>
            }
          </div>

          {/* ── TRAJET + DATE PROÉMINENTE ── */}
          <div style={{ display:'flex', alignItems:'stretch', gap:10, marginBottom:14 }}>

            {/* DATE — impossible à rater */}
            {dateParts && (
              <div className="date-badge" title={dateParts.full}>
                <span className="date-badge-day">{dateParts.day}</span>
                <span className="date-badge-month">{dateParts.month}</span>
                <span className="date-badge-year">{dateParts.year}</span>
              </div>
            )}

            {/* Départ → Arrivée */}
            <div style={{ flex:1, background:'rgba(255,255,255,.025)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
              {/* Départ */}
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16 }}>{trip.departure_city}</div>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:19, color:'var(--gl)', marginTop:1 }}>{trip.departure_time}</div>
              </div>

              {/* Flèche animée */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ display:'flex', alignItems:'center', width:50, gap:2 }}>
                  <div style={{ flex:1, height:1.5, background:'linear-gradient(90deg, transparent, var(--g), transparent)', borderRadius:1 }}/>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 7h12M8 3l4 4-4 4" stroke="#3DAA6A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Arrivée */}
              <div style={{ flex:1, textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16 }}>{trip.arrival_city}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Arrivée</div>
              </div>
            </div>
          </div>

          {/* ── Tooltip date lisible ── */}
          {dateParts && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, padding:'6px 10px', background:'rgba(61,170,106,.05)', border:'1px solid rgba(61,170,106,.12)', borderRadius:8 }}>
              <span style={{ fontSize:12 }}>📅</span>
              <span style={{ fontSize:12, color:'rgba(232,244,237,.65)', fontWeight:500 }}>
                Départ le <strong style={{ color:'var(--gl)' }}>{dateParts.full}</strong>
              </span>
            </div>
          )}

          {/* ── Prix + action ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600 }}>Prix / siège</div>
              <div style={{ fontFamily:'var(--font)', fontSize:24, fontWeight:800, color:'var(--gold)', lineHeight:1.1 }}>
                {Number(trip.price).toLocaleString('fr-FR')} <span style={{ fontSize:12, fontWeight:500, color:'var(--muted)' }}>FC</span>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Barre remplissage */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                <div style={{ width:60, height:4, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background: pct < 25 ? 'var(--err)' : 'var(--g)', borderRadius:99, transition:'width .5s ease' }}/>
                </div>
                <span style={{ fontSize:10, color:'var(--muted)' }}>{pct}% dispo</span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => onBook(trip)}
                style={{ borderRadius:10, padding:'9px 20px', fontSize:13, fontFamily:'var(--font)', fontWeight:700 }}>
                Réserver →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────── */
export default function PublicSite() {
  const [search,   setSearch]   = useState({ from:'', to:'', date:'' });
  const [trips,    setTrips]    = useState([]);
  const [gallery,  setGallery]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);
  const resultsRef = useRef(null);
  const showToast  = (msg, type='info') => setToast({ msg, type });

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
    ? gallery.slice(0,6).map(g => ({ img:g.image_url, title:g.title||'', sub:g.description||'', tag:g.category||'📸' }))
    : SLIDES;

  return (
    <div style={{ minHeight:'100vh', background:'var(--night)', fontFamily:'var(--body)' }}>
      <style>{GLOBAL_CSS}</style>

      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* ══ NAV ══════════════════════════════════════════════════════════════ */}
      <nav style={{ position:'sticky', top:0, zIndex:50, height:54, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', background:'rgba(6,13,20,.88)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border)' }}>
        <Logo size={28}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--g)', display:'inline-block', animation:'pulseDot 2s ease infinite' }}/>
            🇨🇩 RDC
          </span>
          <a href="/about"  onClick={e=>{ e.preventDefault(); window.location.href='/about'; }}  className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>À propos</a>
          <a href="/login"  onClick={e=>{ e.preventDefault(); window.location.href='/login'; }}  className="btn btn-ghost" style={{ fontSize:12, padding:'6px 13px' }}>Agences →</a>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <section style={{ maxWidth:1060, margin:'0 auto', padding:'24px 18px 0' }}>
        <div className="hero-grid">

          {/* ── SEARCH PANEL ── */}
          <div className="fade-up" style={{ animationDelay:'0ms' }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'rgba(61,170,106,.08)', border:'1px solid rgba(61,170,106,.18)', borderRadius:99, padding:'4px 14px', marginBottom:12, fontSize:11, color:'var(--gl)', fontWeight:600 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--g)', display:'inline-block', animation:'pulseDot 2s ease infinite' }}/>
                Réservation en ligne · Mobile Money
              </div>
              <div style={{ fontFamily:'var(--font)', fontSize:'clamp(22px,4.5vw,30px)', fontWeight:800, lineHeight:1.18, marginBottom:6 }}>
                Ta route,<br/>
                <span style={{ background:'linear-gradient(90deg, var(--gd), var(--gl))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>commence ici.</span>
              </div>
              <p style={{ color:'var(--muted)', fontSize:12.5, lineHeight:1.7 }}>Kinshasa – Boma – Matadi · 2 min pour réserver, Mobile Money accepté.</p>
            </div>

            {/* Formulaire de recherche */}
            <div style={{ background:'var(--surf)', border:'1px solid var(--border)', borderRadius:var_rxl(), padding:'18px 16px 14px', boxShadow:'0 20px 50px rgba(0,0,0,.38)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

                {/* Départ */}
                <div>
                  <label className="lbl">📍 Départ</label>
                  <select className="field" value={search.from} onChange={e => setSearch({...search,from:e.target.value})}>
                    <option value="">Ville de départ</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Inverser */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                  <button onClick={swap}
                    style={{ background:'rgba(61,170,106,.08)', border:'1px solid rgba(61,170,106,.18)', borderRadius:99, padding:'4px 13px', cursor:'pointer', fontSize:12, color:'var(--gl)', fontFamily:'var(--body)', fontWeight:600, transition:'var(--ease)' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(61,170,106,.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(61,170,106,.08)'}>
                    ⇅ Inverser
                  </button>
                  <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                </div>

                {/* Arrivée */}
                <div>
                  <label className="lbl">📍 Arrivée</label>
                  <select className="field" value={search.to} onChange={e => setSearch({...search,to:e.target.value})}>
                    <option value="">Ville d'arrivée</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* DATE — champ large et visible */}
                <div>
                  <label className="lbl">📅 Date de voyage</label>
                  <input
                    className="field"
                    type="date"
                    value={search.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSearch({...search,date:e.target.value})}
                    style={{ fontSize:14, fontWeight:600, letterSpacing:'.02em' }}
                  />
                  {/* Aperçu lisible de la date sélectionnée */}
                  {search.date && (() => {
                    const dp = formatDateParts(search.date);
                    return dp ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, padding:'5px 9px', background:'rgba(61,170,106,.06)', border:'1px solid rgba(61,170,106,.14)', borderRadius:8 }}>
                        <span style={{ fontSize:11 }}>📅</span>
                        <span style={{ fontSize:12, color:'var(--gl)', fontWeight:600 }}>{dp.full}</span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Bouton recherche */}
                <button className="btn btn-primary w100" onClick={handleSearch} disabled={loading}
                  style={{ justifyContent:'center', height:42, fontSize:13.5, borderRadius:11, marginTop:2, fontFamily:'var(--font)', fontWeight:700 }}>
                  {loading ? <><div className="spin"/>Recherche en cours…</> : '🔍 Trouver un voyage'}
                </button>
              </div>

              {/* Raccourcis rapides */}
              <div style={{ marginTop:10, display:'flex', gap:5, flexWrap:'wrap' }}>
                {[['Kinshasa','Boma'],['Kinshasa','Matadi'],['Boma','Kinshasa']].map(([f,t]) => (
                  <button key={`${f}-${t}`} onClick={() => setSearch(s => ({...s,from:f,to:t}))}
                    style={{ background:'rgba(61,170,106,.06)', border:'1px solid rgba(61,170,106,.12)', borderRadius:99, padding:'4px 11px', fontSize:11, color:'var(--muted)', cursor:'pointer', transition:'var(--ease)' }}
                    onMouseEnter={e => { e.currentTarget.style.color='var(--gl)'; e.currentTarget.style.borderColor='rgba(61,170,106,.28)'; e.currentTarget.style.background='rgba(61,170,106,.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='rgba(61,170,106,.12)'; e.currentTarget.style.background='rgba(61,170,106,.06)'; }}>
                    {f} → {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── CAROUSEL ── */}
          <div className="hero-carousel fade-up" style={{ animationDelay:'80ms' }}>
            <Carousel slides={slides}/>
            <div style={{ marginTop:10, background:'var(--surf)', border:'1px solid var(--border)', borderRadius:var_rl(), padding:'12px 16px' }}>
              <p style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:700, lineHeight:1.6, color:'var(--text)' }}>
                "Plus de 10 000 voyageurs nous font confiance chaque mois."
                <br/><span style={{ opacity:.6, fontWeight:400, fontSize:11, fontFamily:'var(--body)' }}>Rejoignez la communauté Nzela — la RDC se déplace avec nous.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURE STRIP ════════════════════════════════════════════════════ */}
      <section style={{ maxWidth:1060, margin:'20px auto 0', padding:'0 18px' }}>
        <div className="feat-strip" style={{ background:'var(--border)', borderRadius:var_rl(), overflow:'hidden', gap:'1px' }}>
          {FEATURES.map((f,i) => (
            <div key={i} className="fade-up" style={{ animationDelay:`${120+i*40}ms`, background:'var(--surf)', padding:'13px 15px', display:'flex', alignItems:'center', gap:10, transition:'var(--ease)' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--surf2)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--surf)'}>
              <span style={{ fontSize:20, flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:12, color:'var(--text)' }}>{f.t}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ RÉSULTATS / CONTENU ══════════════════════════════════════════════ */}
      <section ref={resultsRef} style={{ maxWidth:1060, margin:'0 auto', padding:'20px 18px 52px' }}>

        {/* ── Résultats de recherche ── */}
        {searched && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:800 }}>{search.from} → {search.to}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>
                  {trips.length} trajet{trips.length!==1?'s':''} trouvé{trips.length!==1?'s':''}
                  {search.date && (() => { const dp = formatDateParts(search.date); return dp ? ` · ${dp.full}` : ''; })()}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSearched(false)} style={{ fontSize:12 }}>← Réinitialiser</button>
            </div>

            {loading && (
              <div style={{ textAlign:'center', padding:52 }}>
                <div className="spin" style={{ width:34, height:34, margin:'0 auto', borderWidth:3 }}/>
              </div>
            )}

            {!loading && trips.length === 0 && (
              <div style={{ textAlign:'center', padding:'52px 20px', background:'var(--surf)', borderRadius:var_rxl(), border:'1px solid var(--border)' }}>
                <img src="/logo.png" alt="" style={{ width:44, opacity:.14, marginBottom:12 }}/>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:16, marginBottom:6 }}>Aucun trajet ce jour-là</div>
                <div style={{ color:'var(--muted)', fontSize:12 }}>Nos agences opèrent tous les jours — essayez une autre date.</div>
              </div>
            )}

            <div style={{ display:'grid', gap:12 }}>
              {trips.map((t,i) => <TripCard key={t.id} trip={t} onBook={setSelected} delay={i*.06}/>)}
            </div>
          </>
        )}

        {/* ── Page d'accueil (pas encore cherché) ── */}
        {!searched && (
          <div style={{ marginTop:20 }}>

            {/* Hero texte */}
            <div style={{ textAlign:'center', padding:'24px 20px', maxWidth:560, margin:'0 auto' }} className="fade-up">
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(61,170,106,.08)', border:'1px solid rgba(61,170,106,.16)', borderRadius:99, padding:'3px 13px', fontSize:11, color:'var(--gl)', fontWeight:600, marginBottom:14 }}>🇨🇩 Fièrement congolais</div>
              <h2 style={{ fontFamily:'var(--font)', fontSize:'clamp(20px,3vw,28px)', fontWeight:800, lineHeight:1.22, marginBottom:10 }}>
                Voyager en RDC,<br/>
                <span style={{ background:'linear-gradient(90deg,var(--gd),var(--gl))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>enfin sans galère.</span>
              </h2>
              <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.75 }}>
                Fini les files d'attente et les billets perdus.<br/>Avec Nzela — tu choisis, tu paies, tu montes.
              </p>
            </div>

            {/* Étapes */}
            <div className="steps-grid fade-up" style={{ maxWidth:780, margin:'20px auto' }}>
              {[
                { n:'01', i:'🔍', t:'Cherche ton trajet',    d:'Départ, arrivée et date.' },
                { n:'02', i:'💳', t:'Paye en Mobile Money', d:'M-Pesa, Orange ou Airtel.' },
                { n:'03', i:'🚌', t:'Monte dans le bus',    d:"Présente ta référence. C'est tout." },
              ].map((s,i) => (
                <div key={s.n} className="fade-up" style={{ animationDelay:`${i*80}ms`, background:'var(--surf)', border:'1px solid var(--border)', borderRadius:var_rl(), padding:16, position:'relative', overflow:'hidden', transition:'var(--ease)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(61,170,106,.25)'; e.currentTarget.style.transform='translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; }}>
                  <div style={{ position:'absolute', top:-8, right:8, fontFamily:'var(--font)', fontSize:52, fontWeight:800, color:'rgba(61,170,106,.05)', lineHeight:1 }}>{s.n}</div>
                  <div style={{ fontSize:24, marginBottom:9 }}>{s.i}</div>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:13, marginBottom:5 }}>{s.t}</div>
                  <div style={{ color:'var(--muted)', fontSize:12, lineHeight:1.65 }}>{s.d}</div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="stats-row fade-up" style={{ background:'var(--border)', borderRadius:var_rl(), overflow:'hidden', maxWidth:780, margin:'0 auto', gap:'1px' }}>
              {[['10 000+','Voyageurs/mois'],['3','Agences'],['2','Trajets phares'],['100%','Mobile Money']].map(([v,l]) => (
                <div key={l} style={{ background:'var(--surf)', padding:'14px 10px', textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:20, color:'var(--gl)', marginBottom:3 }}>{v}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop:'1px solid var(--border)', padding:'14px 22px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <Logo size={22} tagline/>
        <div style={{ fontSize:11, color:'var(--muted)' }}>© 2026 Nzela · Kinshasa, RDC</div>
        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', gap:10, flexWrap:'wrap' }}>
          <span>📞 +243 85 91 53 213</span><span>·</span><span>✉️ support@nzela.cd</span>
        </div>
      </footer>

      {selected && (
        <BookingModal trip={selected} onClose={() => setSelected(null)} showToast={showToast}
          onSuccess={() => showToast('Réservation confirmée 🎊','success')}/>
      )}
    </div>
  );
}

/* helpers pour éviter les template literals dans JSX style attr */
function var_rxl() { return '22px'; }
function var_rl()  { return '16px'; }