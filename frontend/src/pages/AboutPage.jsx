import { useEffect, useRef, useState } from 'react';

// ── ÉQUIPE — remplace les données ici ─────────────────────────
const TEAM = [
  { name: 'Perciani Lukielo',   role: 'CEO & Fondateur', photo:'/photos/perciani_luks.png' },
  { name: 'Israél Ongala',   role: 'Cyber Dev & DRH',    photo:'/photos/israel_ongala.png' },
  { name: 'Prénom Nom',   role: 'Directeur Commercial',  photo: null },
  { name: 'Prénom Nom',   role: 'Responsable Marketing', photo: null },
  { name: 'Prénom Nom',   role: 'Développeur Backend',   photo: null },
  { name: 'Prénom Nom',   role: 'Développeur Frontend',  photo: null },
  { name: 'Prénom Nom',   role: 'Designer UI/UX',        photo: null },
  { name: 'Prénom Nom',   role: 'Relations Agences',     photo: null },
  { name: 'Prénom Nom',   role: 'Responsable Finance',   photo: null },
  { name: 'Prénom Nom',   role: 'Support Client',        photo: null },
];

// ── CIBLES ────────────────────────────────────────────────────
const CIBLES = [
  { icon: '🧳', titre: 'Voyageurs RDC', desc: 'Toute personne cherchant à voyager entre Kinshasa et les villes de province de manière simple et sécurisée.' },
  { icon: '🚌', titre: 'Agences de Bus', desc: 'Compagnies de transport souhaitant digitaliser leur vente de billets et gérer leurs voyages en temps réel.' },
  { icon: '📱', titre: 'Utilisateurs Mobile', desc: 'Congolais connectés via smartphone, habitués au Mobile Money (M-Pesa, Orange Money, Airtel, Africell).' },
  { icon: '🌍', titre: 'Diaspora', desc: 'Congolais de l\'extérieur souhaitant réserver un billet pour un proche encore en RDC depuis n\'importe où dans le monde.' },
];

// ── OBJECTIFS ─────────────────────────────────────────────────
const OBJECTIFS = [
  { num: '01', titre: 'Digitaliser le transport', desc: 'Éliminer les longues files d\'attente et la vente informelle de billets de bus en RDC.' },
  { num: '02', titre: 'Sécuriser les paiements', desc: 'Intégrer le Mobile Money local pour des transactions fiables, traçables et sans cash.' },
  { num: '03', titre: 'Valoriser les agences', desc: 'Offrir aux compagnies de bus un tableau de bord professionnel pour gérer leurs opérations.' },
  { num: '04', titre: 'Relier le pays', desc: 'Couvrir progressivement toutes les routes majeures de la RDC depuis Kinshasa vers les provinces.' },
];

// ── STATS ─────────────────────────────────────────────────────
const STATS = [
  { val: '10 000+', label: 'Voyageurs/mois visés' },
  { val: '4',       label: 'Agences partenaires' },
  { val: '3',       label: 'Trajets phares' },
  { val: '100%',    label: 'Mobile Money' },
];

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Hook scroll reveal
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// Carte équipe avec tilt 3D
function TeamCard({ member, delay }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [ref, visible] = useReveal();

  const onMove = (e) => {
    const r = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 20;
    const y = -((e.clientY - r.top) / r.height - 0.5) * 20;
    setTilt({ x, y });
  };

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(40px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      <div
        ref={cardRef}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setTilt({ x: 0, y: 0 }); }}
        style={{
          background: 'linear-gradient(135deg, rgba(61,170,106,0.08) 0%, rgba(5,14,23,0.9) 100%)',
          border: `1px solid ${hover ? 'rgba(61,170,106,0.5)' : 'rgba(61,170,106,0.15)'}`,
          borderRadius: 20,
          padding: '28px 20px 24px',
          textAlign: 'center',
          cursor: 'default',
          transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(${hover ? 1.04 : 1})`,
          transition: hover ? 'border 0.2s, box-shadow 0.2s' : 'all 0.5s ease',
          boxShadow: hover ? '0 20px 60px rgba(61,170,106,0.2)' : '0 4px 20px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {hover && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 20,
            background: 'radial-gradient(circle at 50% 0%, rgba(61,170,106,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
        )}
        {/* Photo */}
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          margin: '0 auto 16px',
          border: '2px solid rgba(61,170,106,0.4)',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #1a3a2a, #0d2018)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hover ? '0 0 30px rgba(61,170,106,0.3)' : 'none',
          transition: 'box-shadow 0.3s',
          flexShrink: 0,
        }}>
          {member.photo
            ? <img src={member.photo} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 28, fontWeight: 700, color: '#3DAA6A', fontFamily: 'DM Sans, sans-serif' }}>
                {initials(member.name)}
              </span>
          }
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#F0F4F8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {member.name}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#3DAA6A', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.05em' }}>
          {member.role}
        </p>
      </div>
    </div>
  );
}

// Section révélée au scroll
function RevealSection({ children, delay = 0, direction = 'up' }) {
  const [ref, visible] = useReveal();
  const transforms = { up: 'translateY(50px)', left: 'translateX(-50px)', right: 'translateX(50px)' };
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transforms[direction],
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

export default function AboutPage() {
  // Inject keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatOrb {
        0%,100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-30px) scale(1.05); }
      }
      @keyframes floatOrb2 {
        0%,100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(25px) scale(0.95); }
      }
      @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      @keyframes pulse-ring {
        0% { transform: scale(0.9); opacity: 1; }
        100% { transform: scale(1.4); opacity: 0; }
      }
      @keyframes ticker {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={{
      background: '#050E17',
      minHeight: '100vh',
      fontFamily: 'Plus Jakarta Sans, DM Sans, sans-serif',
      color: '#F0F4F8',
      overflowX: 'hidden',
    }}>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        {/* Orbes animées */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,170,106,0.12) 0%, transparent 70%)', animation: 'floatOrb 8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,170,106,0.08) 0%, transparent 70%)', animation: 'floatOrb2 10s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '40%', right: '20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,170,106,0.06) 0%, transparent 70%)', animation: 'floatOrb 12s ease-in-out infinite 2s' }} />
          {/* Grille décorative */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(61,170,106,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(61,170,106,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(61,170,106,0.1)', border: '1px solid rgba(61,170,106,0.3)',
            borderRadius: 100, padding: '6px 18px', marginBottom: 32,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3DAA6A', display: 'inline-block', animation: 'pulse-ring 1.5s ease-out infinite', boxShadow: '0 0 0 0 rgba(61,170,106,0.4)' }} />
            <span style={{ fontSize: 13, color: '#3DAA6A', letterSpacing: '0.08em', fontWeight: 600 }}>NZELA — TA ROUTE COMMENCE ICI</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(40px, 7vw, 80px)',
            fontWeight: 800, lineHeight: 1.1,
            margin: '0 0 24px',
            background: 'linear-gradient(135deg, #F0F4F8 30%, #3DAA6A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Notre Vision,<br />Notre Mission
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: '#8899AA', lineHeight: 1.7, margin: '0 auto', maxWidth: 600 }}>
            Nzela redéfinit le voyage en République Démocratique du Congo — une réservation à la fois, un trajet à la fois.
          </p>
        </div>
      </section>

      {/* ── STATS TICKER ── */}
      <div style={{ borderTop: '1px solid rgba(61,170,106,0.1)', borderBottom: '1px solid rgba(61,170,106,0.1)', padding: '20px 0', overflow: 'hidden', background: 'rgba(61,170,106,0.03)' }}>
        <div style={{ display: 'flex', gap: 80, animation: 'ticker 20s linear infinite', width: 'max-content' }}>
          {[...STATS, ...STATS].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#3DAA6A' }}>{s.val}</span>
              <span style={{ fontSize: 14, color: '#8899AA', letterSpacing: '0.05em' }}>{s.label}</span>
              <span style={{ color: 'rgba(61,170,106,0.3)', fontSize: 20 }}>✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── VISION & MISSION ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>

          <RevealSection direction="left">
            <div style={{ background: 'linear-gradient(135deg, rgba(61,170,106,0.1), rgba(5,14,23,0.8))', border: '1px solid rgba(61,170,106,0.2)', borderRadius: 24, padding: '48px 40px', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,170,106,0.15), transparent)' }} />
              <div style={{ fontSize: 48, marginBottom: 20 }}>🌟</div>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: '#3DAA6A', margin: '0 0 16px' }}>Notre Vision</h2>
              <p style={{ fontSize: 17, lineHeight: 1.8, color: '#B8C9D9', margin: 0 }}>
                Devenir la plateforme de référence du transport terrestre en Afrique Centrale, en commençant par la RDC. Nous voulons un pays où chaque Congolais peut planifier, réserver et payer son voyage en quelques secondes depuis son téléphone.
              </p>
            </div>
          </RevealSection>

          <RevealSection direction="right" delay={150}>
            <div style={{ background: 'linear-gradient(135deg, rgba(5,14,23,0.9), rgba(61,170,106,0.08))', border: '1px solid rgba(61,170,106,0.15)', borderRadius: 24, padding: '48px 40px', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,170,106,0.1), transparent)' }} />
              <div style={{ fontSize: 48, marginBottom: 20 }}>🎯</div>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: '#F0F4F8', margin: '0 0 16px' }}>Notre Mission</h2>
              <p style={{ fontSize: 17, lineHeight: 1.8, color: '#B8C9D9', margin: 0 }}>
                Connecter les voyageurs congolais aux agences de bus fiables grâce à une technologie simple, accessible et adaptée à la réalité locale — Mobile Money inclus. Rendre le transport transparent, sécurisé et digne pour tous.
              </p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── OBJECTIFS ── */}
      <section style={{ background: 'rgba(61,170,106,0.03)', borderTop: '1px solid rgba(61,170,106,0.08)', borderBottom: '1px solid rgba(61,170,106,0.08)', padding: '100px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <RevealSection>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <p style={{ fontSize: 13, letterSpacing: '0.15em', color: '#3DAA6A', fontWeight: 700, marginBottom: 12 }}>CE QUE NOUS CONSTRUISONS</p>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0 }}>Nos Objectifs</h2>
            </div>
          </RevealSection>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {OBJECTIFS.map((obj, i) => (
              <RevealSection key={i} delay={i * 120}>
                <div style={{
                  background: '#050E17',
                  border: '1px solid rgba(61,170,106,0.15)',
                  borderRadius: 20,
                  padding: '32px 28px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.3s, transform 0.3s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(61,170,106,0.4)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(61,170,106,0.15)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <span style={{
                    fontSize: 64, fontWeight: 900, color: 'rgba(61,170,106,0.08)',
                    position: 'absolute', top: 16, right: 20, lineHeight: 1,
                    fontFamily: 'DM Sans, sans-serif',
                  }}>{obj.num}</span>
                  <div style={{ width: 40, height: 3, background: '#3DAA6A', borderRadius: 2, marginBottom: 20 }} />
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px', color: '#F0F4F8' }}>{obj.titre}</h3>
                  <p style={{ fontSize: 15, color: '#8899AA', lineHeight: 1.7, margin: 0 }}>{obj.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CIBLES ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
        <RevealSection>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 13, letterSpacing: '0.15em', color: '#3DAA6A', fontWeight: 700, marginBottom: 12 }}>À QUI NOUS NOUS ADRESSONS</p>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0 }}>Nos Cibles</h2>
          </div>
        </RevealSection>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
          {CIBLES.map((c, i) => (
            <RevealSection key={i} delay={i * 100}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(61,170,106,0.06), rgba(5,14,23,0.95))',
                border: '1px solid rgba(61,170,106,0.12)',
                borderRadius: 20, padding: '36px 28px',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(61,170,106,0.12), rgba(5,14,23,0.95))'; e.currentTarget.style.borderColor = 'rgba(61,170,106,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(61,170,106,0.06), rgba(5,14,23,0.95))'; e.currentTarget.style.borderColor = 'rgba(61,170,106,0.12)'; }}
              >
                <div style={{ fontSize: 40, marginBottom: 20 }}>{c.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px', color: '#3DAA6A' }}>{c.titre}</h3>
                <p style={{ fontSize: 15, color: '#8899AA', lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── ÉQUIPE ── */}
      <section style={{ background: 'rgba(61,170,106,0.03)', borderTop: '1px solid rgba(61,170,106,0.08)', padding: '100px 24px 120px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <RevealSection>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <p style={{ fontSize: 13, letterSpacing: '0.15em', color: '#3DAA6A', fontWeight: 700, marginBottom: 12 }}>LES PERSONNES DERRIÈRE NZELA</p>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: '0 0 16px' }}>Notre Équipe</h2>
              <p style={{ fontSize: 17, color: '#8899AA', maxWidth: 500, margin: '0 auto' }}>
                Une équipe passionnée, engagée à transformer la mobilité en RDC.
              </p>
            </div>
          </RevealSection>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
            {TEAM.map((member, i) => (
              <TeamCard key={i} member={member} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(61,170,106,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <RevealSection>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 20px' }}>
            Prêt à voyager avec Nzela ?
          </h2>
          <p style={{ fontSize: 17, color: '#8899AA', marginBottom: 40 }}>
            Ta route commence ici. Réserve ton billet en quelques clics.
          </p>
          <a href="/" style={{
            display: 'inline-block',
            background: '#3DAA6A',
            color: '#050E17',
            fontWeight: 800,
            fontSize: 16,
            padding: '16px 48px',
            borderRadius: 100,
            textDecoration: 'none',
            letterSpacing: '0.03em',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 8px 32px rgba(61,170,106,0.3)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(61,170,106,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(61,170,106,0.3)'; }}
          >
            Réserver maintenant →
          </a>
        </RevealSection>
      </section>

    </div>
  );
}