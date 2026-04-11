import { useState, useEffect, useRef } from 'react';

// ── Date de lancement ──────────────────────────────────────────
const LAUNCH = new Date('2026-06-01T00:00:00');
const START  = new Date('2026-04-11T00:00:00');

// ── Liste des personnes à honorer ──────────────────────────────
// Modifie cette liste avec les vrais noms
const SUPPORTERS = [
  'Maman Chérie',
  'Papa',
  'My Wyfe.',
  'Peniel M.',
  'Pierdi T.',
  'Perla S',
  'P. Bernard',
  'Sephora Ngoma',
  'Precieux P',
  'Israel O.',
  'Grâce M.',
  'Junior T.',
  'Bobiano',
  'Arnold L.',
  'Jolie N.',
  'Tresor T.',
  'Chloé T.',
  'Aimerode I.',
  'Peace Holding.',
];

function pad(n) { return String(n).padStart(2, '0'); }

function useCountdown() {
  const [time, setTime] = useState({ d:0, h:0, m:0, s:0, pct:0 });
  useEffect(() => {
    const tick = () => {
      const now  = new Date();
      const diff = LAUNCH - now;
      if (diff <= 0) { setTime({ d:0, h:0, m:0, s:0, pct:100 }); return; }
      const total   = LAUNCH - START;
      const elapsed = now - START;
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        pct: Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Composant défilant ─────────────────────────────────────────
function ScrollingNames() {
  // Multiplie suffisamment pour couvrir n'importe quelle largeur d'écran
  const many = [...SUPPORTERS, ...SUPPORTERS, ...SUPPORTERS, ...SUPPORTERS, ...SUPPORTERS, ...SUPPORTERS];

  return (
    <div style={{
      overflow: 'hidden',
      maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
      marginBottom: 48,
    }}>
      {/* Ligne 1 — gauche vers droite */}
      <div style={{
        display: 'flex', gap: 12, whiteSpace: 'nowrap',
        width: 'max-content',
        animation: `scroll-r ${SUPPORTERS.length * 8}s linear infinite`,
        marginBottom: 10,
      }}>
        {many.map((name, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600, fontSize: 13,
            color: 'rgba(232,244,237,0.7)',
            background: 'rgba(61,170,106,0.08)',
            border: '1px solid rgba(61,170,106,0.15)',
            borderRadius: 99, padding: '5px 14px',
            flexShrink: 0,
          }}>
            <span style={{ color: 'var(--green-l)', fontSize: 9 }}>✦</span>
            {name}
          </span>
        ))}
      </div>

      {/* Ligne 2 — droite vers gauche */}
      <div style={{
        display: 'flex', gap: 12, whiteSpace: 'nowrap',
        width: 'max-content',
        animation: `scroll-l ${SUPPORTERS.length * 10}s linear infinite`,
      }}>
        {[...many].reverse().map((name, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600, fontSize: 13,
            color: 'rgba(232,244,237,0.55)',
            background: 'rgba(61,170,106,0.05)',
            border: '1px solid rgba(61,170,106,0.1)',
            borderRadius: 99, padding: '5px 14px',
            flexShrink: 0,
          }}>
            <span style={{ color: 'var(--gold)', fontSize: 9 }}>♡</span>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ComingSoon() {
  const { d, h, m, s, pct } = useCountdown();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --green: #3DAA6A; --green-l: #52C882; --green-d: #2A7D4F;
          --green-bg: rgba(61,170,106,0.1); --green-glow: rgba(61,170,106,0.25);
          --night: #050E17; --deep: #081220;
          --text: #E8F4ED; --muted: rgba(232,244,237,0.45);
          --gold: #F5A623;
          --font: 'Plus Jakarta Sans', sans-serif;
          --body: 'DM Sans', sans-serif;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          font-family: var(--body);
          background: var(--night);
          color: var(--text);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }

        /* ── FOND ── */
        .cs-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 90% 50% at 50% -5%, rgba(61,170,106,0.2) 0%, transparent 65%),
            radial-gradient(ellipse 40% 40% at 85% 90%, rgba(42,125,79,0.1) 0%, transparent 60%),
            var(--night);
        }
        .cs-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(61,170,106,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(61,170,106,0.035) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 75%);
        }
        .cs-orb {
          position: fixed; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(61,170,106,0.06) 0%, transparent 70%);
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          animation: cs-float 10s ease-in-out infinite;
          pointer-events: none; z-index: 0;
        }
        @keyframes cs-float {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50% { transform: translate(-50%,-53%) scale(1.04); }
        }

        /* ── WRAP ── */
        .cs-wrap {
          position: relative; z-index: 1;
          max-width: 680px; margin: 0 auto;
          padding: 60px 24px 40px;
          text-align: center;
        }

        /* ── ANIMATIONS ── */
        .cs-a1 { animation: cs-rise .8s .1s cubic-bezier(.16,1,.3,1) both; }
        .cs-a2 { animation: cs-rise .8s .2s cubic-bezier(.16,1,.3,1) both; }
        .cs-a3 { animation: cs-rise .8s .3s cubic-bezier(.16,1,.3,1) both; }
        .cs-a4 { animation: cs-rise .8s .4s cubic-bezier(.16,1,.3,1) both; }
        .cs-a5 { animation: cs-rise .8s .5s cubic-bezier(.16,1,.3,1) both; }
        .cs-a6 { animation: cs-rise .8s .6s cubic-bezier(.16,1,.3,1) both; }
        .cs-a7 { animation: cs-rise .8s .7s cubic-bezier(.16,1,.3,1) both; }
        .cs-a8 { animation: cs-rise .8s .8s cubic-bezier(.16,1,.3,1) both; }
        @keyframes cs-rise {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── LOGO ── */
        .cs-logo {
          display: inline-flex; align-items: center; gap: 13px;
          margin-bottom: 44px; text-decoration: none;
          background: linear-gradient(135deg, var(--green-d), var(--green-l));
        }
        .cs-logo-icon {
          width: 58px; height: 58px; border-radius: 16px;
          background: linear-gradient(135deg, var(--green-d), var(--green-l));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 32px rgba(61,170,106,0.4);
          overflow: hidden; flex-shrink: 0;
        }
        .cs-logo-icon img { width: 78%; height: 78%; object-fit: contain; }
        .cs-logo-text {
          font-family: var(--font); font-size: 34px; font-weight: 800;
          background: linear-gradient(90deg, #fff, var(--green-l));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          letter-spacing: -0.03em; line-height: 1;
        }
        .cs-logo-sub {
          font-size: 11px; color: var(--muted); -webkit-text-fill-color: var(--muted);
          font-weight: 400; letter-spacing: 0.04em;
        }

        /* ── BADGE ── */
        .cs-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(61,170,106,0.1); border: 1px solid rgba(61,170,106,0.22);
          border-radius: 99px; padding: 5px 18px; margin-bottom: 22px;
          font-size: 11px; font-weight: 600; color: var(--green-l);
          letter-spacing: .1em; text-transform: uppercase;
        }
        .cs-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green-l); animation: cs-pulse 2s ease infinite;
        }
        @keyframes cs-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.3; transform:scale(.6); }
        }

        /* ── TITRE ── */
        .cs-title {
          font-family: var(--font);
          font-size: clamp(36px, 7vw, 64px);
          font-weight: 800; line-height: 1.08;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }
        .cs-title .hl {
          background: linear-gradient(90deg, var(--green-d), var(--green-l));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .cs-sub {
          font-size: clamp(14px, 2vw, 16px);
          color: var(--muted); line-height: 1.75;
          max-width: 480px; margin: 0 auto 48px;
        }

        /* ── COMPTE À REBOURS ── */
        .cs-countdown {
          display: flex; align-items: flex-start; justify-content: center;
          gap: clamp(10px, 2.5vw, 24px); margin-bottom: 36px;
        }
        .cs-block { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .cs-num {
          font-family: var(--font);
          font-size: clamp(32px, 7vw, 64px);
          font-weight: 800; line-height: 1;
          min-width: clamp(68px, 12vw, 104px);
          text-align: center;
          background: var(--deep);
          border: 1px solid rgba(61,170,106,0.18);
          border-radius: 14px; padding: 14px 10px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04);
          position: relative; transition: border-color .3s;
        }
        .cs-num::after {
          content: ''; position: absolute;
          left: 0; right: 0; top: 50%; height: 1px;
          background: rgba(255,255,255,0.05);
        }
        .cs-block:hover .cs-num { border-color: rgba(61,170,106,0.35); }
        .cs-lbl {
          font-size: 10px; font-weight: 600; color: var(--muted);
          text-transform: uppercase; letter-spacing: .1em;
        }
        .cs-sep {
          font-family: var(--font);
          font-size: clamp(28px, 5vw, 52px); font-weight: 800;
          color: rgba(61,170,106,0.35); line-height: 1;
          padding-top: clamp(8px,1.5vw,14px);
          animation: cs-blink 1s step-end infinite;
        }
        @keyframes cs-blink { 0%,100%{opacity:1} 50%{opacity:.15} }

        /* ── BARRE ── */
        .cs-progress { margin-bottom: 52px; }
        .cs-prog-top {
          display: flex; justify-content: space-between;
          font-size: 11px; color: var(--muted); margin-bottom: 8px;
        }
        .cs-prog-bar {
          height: 3px; background: rgba(255,255,255,0.06);
          border-radius: 99px; overflow: hidden;
        }
        .cs-prog-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, var(--green-d), var(--green-l));
          box-shadow: 0 0 10px rgba(61,170,106,0.5);
          transition: width 1s ease;
        }

        /* ── SECTION SOUTIENS ── */
        .cs-thanks-label {
          font-size: 11px; font-weight: 700; color: var(--muted);
          text-transform: uppercase; letter-spacing: .12em;
          margin-bottom: 18px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .cs-thanks-label::before, .cs-thanks-label::after {
          content: ''; flex: 1; max-width: 60px; height: 1px;
          background: rgba(255,255,255,0.08);
        }

        /* ── SCROLL NOMS ── */
        @keyframes scroll-r {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes scroll-l {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }

        /* ── DATE LANCEMENT ── */
        .cs-date {
          display: inline-flex; align-items: center; gap: 10px;
          background: rgba(245,166,35,0.08); border: 1px solid rgba(245,166,35,0.2);
          border-radius: 12px; padding: 12px 24px; margin-bottom: 44px;
          font-family: var(--font); font-weight: 700; font-size: 15px; color: var(--gold);
        }

        /* ── FOOTER ── */
        .cs-foot {
          font-size: 12px; color: var(--muted);
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 24px; margin-top: 8px;
        }
        .cs-foot a { color: var(--green-l); text-decoration: none; }

        /* ── MOBILE ── */
        @media (max-width: 480px) {
          .cs-wrap { padding: 40px 16px 32px; }
          .cs-countdown { gap: 7px; }
          .cs-num { padding: 10px 8px; border-radius: 10px; }
        }
      `}</style>

      <div className="cs-bg"/>
      <div className="cs-grid"/>
      <div className="cs-orb"/>

      <div className="cs-wrap">

        {/* Logo */}
        <div className="cs-logo-icon">
  <img 
    src="/nzela-icon.png" 
    alt="Nzela"
    onError={e => { e.target.style.display='none'; }}
  />
</div>
        {/* Badge */}
        <div className="cs-a2">
          <div className="cs-badge">
            <div className="cs-badge-dot"/>
            Lancement officiel · 1er Juin 2026
          </div>
        </div>

        {/* Titre */}
        <div className="cs-a3">
          <h1 className="cs-title">
            La RDC se déplace<br/>
            <span className="hl">autrement, bientôt.</span>
          </h1>
          <p className="cs-sub">
            La première plateforme de réservation de bus en République Démocratique du Congo.
            Kinshasa · Boma · Matadi · Moanda — Mobile Money accepté.
          </p>
        </div>

        {/* Compte à rebours */}
        <div className="cs-a4">
          <div className="cs-countdown">
            <div className="cs-block">
              <div className="cs-num">{pad(d)}</div>
              <div className="cs-lbl">Jours</div>
            </div>
            <div className="cs-sep">:</div>
            <div className="cs-block">
              <div className="cs-num">{pad(h)}</div>
              <div className="cs-lbl">Heures</div>
            </div>
            <div className="cs-sep">:</div>
            <div className="cs-block">
              <div className="cs-num">{pad(m)}</div>
              <div className="cs-lbl">Minutes</div>
            </div>
            <div className="cs-sep">:</div>
            <div className="cs-block">
              <div className="cs-num">{pad(s)}</div>
              <div className="cs-lbl">Secondes</div>
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="cs-a5">
          <div className="cs-progress">
            <div className="cs-prog-top">
              <span>Progression vers le lancement</span>
              <span style={{ color:'var(--green-l)', fontWeight:600 }}>{pct}%</span>
            </div>
            <div className="cs-prog-bar">
              <div className="cs-prog-fill" style={{ width: `${pct}%` }}/>
            </div>
          </div>
        </div>

        {/* Date officielle */}
        <div className="cs-a6">
          <div style={{ display:'flex', justifyContent:'center', marginBottom:48 }}>
            <div className="cs-date">
              🗓️ &nbsp;Lancement officiel — <strong>1er Juin 2026</strong>
            </div>
          </div>
        </div>

        {/* Section soutiens */}
        <div className="cs-a7">
          <div className="cs-thanks-label">
            ✦ &nbsp;Avec la force de ceux qui y ont cru&nbsp; ✦
          </div>
          <ScrollingNames />
        </div>

        {/* Footer */}
        <div className="cs-a8">
          <div className="cs-foot">
            © 2026 Nzela · Kinshasa, RDC &nbsp;·&nbsp;
            <a href="mailto:support@nzela.cd">support@nzela.cd</a>
          </div>
        </div>

      </div>
    </>
  );
}