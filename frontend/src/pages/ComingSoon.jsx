import { useState, useEffect, useRef } from 'react';
import {
  Heart, Smartphone, CreditCard, Bus, Globe,
  Star, Target, ShieldCheck, Loader2, CheckCircle2,
  XCircle, X, AlertTriangle, Plus, DollarSign,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */
const API    = 'https://nzela-production-086a.up.railway.app/api';
const LAUNCH = new Date('2026-06-01T00:00:00');
const START  = new Date('2026-04-11T00:00:00');

const SUPPORTERS = [
  'Maman Chérie','Papa','My Wife.','Peniel M.','Pierdi T.','Perla S',
  'P. Bernard','Sephora Ngoma','Precieux P','Israel O.','Grâce M.',
  'Junior T.','Bobiano','Arnold L.','Jolie N.','Tresor T.','Chloé T.',
  'Aimerode I.','Peace Holding.','Nathalie Mbu.','Jean Claude Mbiya',
  'A. EMERY .M','Capot John','Daniella Ongala','Grace Kapamba',
  'Josué Tambwe','Gemima Masela','Pinos','Hubervelly Matias','Andy Binaki','Noela Babutana.',
];

const OBJECTIFS = [
  { Icon: Smartphone, titre:'Digitaliser', desc:"Éliminer les files d'attente et la vente informelle de billets en RDC." },
  { Icon: CreditCard, titre:'Sécuriser',   desc:'Mobile Money intégré – paiements fiables, traçables et sans cash.' },
  { Icon: Bus,        titre:'Valoriser',   desc:'Un tableau de bord professionnel pour chaque agence partenaire.' },
  { Icon: Globe,      titre:'Relier',      desc:'Couvrir toutes les routes majeures de Kinshasa vers les provinces.' },
];

/**
 * Pays disponibles pour Mobile Money.
 * prefix : code international requis par MaishaPay (+243XXXXXXXXX)
 */
const PAYS = [
  { code:'CD', nom:'RDC',           flag:'https://flagcdn.com/24x18/cd.png', currency:'CDF', prefix:'+243', ops:['MPESA','ORANGE','AIRTEL','AFRICEL'] },
  { code:'CG', nom:'Congo-Brazza',  flag:'https://flagcdn.com/24x18/cg.png', currency:'XAF', prefix:'+242', ops:['AIRTEL','MTN'] },
  { code:'CM', nom:'Cameroun',      flag:'https://flagcdn.com/24x18/cm.png', currency:'XAF', prefix:'+237', ops:['ORANGE','MTN'] },
  { code:'CI', nom:"Côte d'Ivoire", flag:'https://flagcdn.com/24x18/ci.png', currency:'XOF', prefix:'+225', ops:['ORANGE','MTN','MOOV'] },
];

const ALL_OPS = {
  MPESA:   { id:'MPESA',   label:'M-Pesa',       logo:'/mpesa.png',    v1: true  },
  ORANGE:  { id:'ORANGE',  label:'Orange Money', logo:'/orange.png',   v1: false },
  AIRTEL:  { id:'AIRTEL',  label:'Airtel',       logo:'/airtel.png',   v1: false },
  AFRICEL: { id:'AFRICEL', label:'Africell',     logo:'/africell.png', v1: false },
  MTN:     { id:'MTN',     label:'MTN',          logo:'/mtn.png',      v1: false },
  MOOV:    { id:'MOOV',    label:'Moov',         logo:'/moov.png',     v1: false },
};

/* ─────────────────────────────────────────────────────────────
   STYLES PARTAGÉS
───────────────────────────────────────────────────────────── */
const INP_STYLE = {
  width:'100%', padding:'11px 14px', borderRadius:12,
  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(61,170,106,0.2)',
  color:'#E8F4ED', fontSize:15, outline:'none',
  fontFamily:'DM Sans,sans-serif', boxSizing:'border-box',
};
const LBL_STYLE = {
  display:'block', fontSize:13, color:'rgba(232,244,237,0.6)',
  marginBottom:6, fontWeight:600,
};

/* ─────────────────────────────────────────────────────────────
   UTILITAIRES
───────────────────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return (
    'CONTRIB-' +
    Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') +
    '-' + Date.now()
  );
}

function getRapides(currency) {
  if (currency === 'USD') return [1, 2, 5, 10];
  return [500, 1000, 2000, 5000];
}

function getMinimum(currency) {
  if (currency === 'USD') return { val: 1, label: '1 USD' };
  return { val: 500, label: `500 ${currency}` };
}

/**
 * Formate un numéro brut en format international MaishaPay.
 * Ex: "0812345678" + "+243" => "+243812345678"
 *     "+243812345678"       => "+243812345678" (déjà bon)
 */
function formatPhone(raw, prefix) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Supprime le 0 ou les chiffres du préfixe s'ils sont déjà inclus
  const prefixDigits = prefix.replace('+', '');
  if (digits.startsWith(prefixDigits)) {
    return '+' + digits;
  }
  // Supprime le 0 initial local si présent
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return prefix + local;
}

/* ─────────────────────────────────────────────────────────────
   HOOK : COMPTE À REBOURS
───────────────────────────────────────────────────────────── */
function useCountdown() {
  const [time, setTime] = useState({ d:0, h:0, m:0, s:0, pct:0 });

  useEffect(() => {
    const tick = () => {
      const now  = new Date();
      const diff = LAUNCH - now;
      if (diff <= 0) { setTime({ d:0, h:0, m:0, s:0, pct:100 }); return; }
      const total   = LAUNCH - START;
      const elapsed = now   - START;
      setTime({
        d:   Math.floor(diff / 86400000),
        h:   Math.floor((diff % 86400000) / 3600000),
        m:   Math.floor((diff % 3600000)  / 60000),
        s:   Math.floor((diff % 60000)    / 1000),
        pct: Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT : MODALE DE CONTRIBUTION
───────────────────────────────────────────────────────────── */
function ContribModal({ onClose }) {
  const [step,       setStep]      = useState(1);
  const [pays,       setPays]      = useState('CD');
  const [anon,       setAnon]      = useState(false);
  const [payMethod,  setPayMethod] = useState('mobile');
  /**
   * currencyUSD : true = l'utilisateur veut payer en USD
   * Disponible aussi bien pour Mobile Money que pour la carte.
   * Pour la carte, la devise est TOUJOURS USD (MaishaPay Carte n'accepte
   * que USD / EUR — on fixe USD).
   */
  const [currencyUSD, setCurrencyUSD] = useState(false);
  const [error,      setError]     = useState('');
  const [result,     setResult]    = useState(null);
  const [form,       setForm]      = useState({ name:'', amount:'', operator:'', phone:'', message:'' });

  // Refs pour le nettoyage propre du polling
  const pollIntervalRef = useRef(null);
  const pollTimeoutRef  = useRef(null);

  // Nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      clearInterval(pollIntervalRef.current);
      clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const paysInfo = PAYS.find(p => p.code === pays);

  // ── Devise effective ──────────────────────────────────────
  // Carte : toujours USD (MaishaPay Carte = USD/EUR uniquement)
  // Mobile : choix utilisateur CDF|XAF|XOF ou USD
  const currency = (payMethod === 'card' || currencyUSD) ? 'USD' : paysInfo.currency;

  const ops     = paysInfo.ops.map(id => ALL_OPS[id]);
  const rapides = getRapides(currency);
  const minimum = getMinimum(currency);

  // Opérateur sélectionné (pour déterminer v1/v2)
  const selectedOp = form.operator ? ALL_OPS[form.operator] : null;
  const isV1 = selectedOp?.v1 === true; // MPESA uniquement

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePaysChange = (code) => {
    setPays(code);
    setForm(f => ({ ...f, operator: '', amount: '' }));
  };

  /* ── Validation ──────────────────────────────────────────── */
  const validate = () => {
    const amount = parseFloat(form.amount);
    if (!amount || isNaN(amount))                    return 'Entrez un montant valide.';
    if (amount < minimum.val)                        return `Minimum ${minimum.label}.`;
    if (payMethod === 'mobile') {
      if (!form.operator)                            return 'Choisissez un opérateur Mobile Money.';
      const formatted = formatPhone(form.phone, paysInfo.prefix);
      // Doit commencer par + et avoir au moins 10 chiffres après le +
      if (!/^\+\d{10,}$/.test(formatted))           return `Numéro invalide. Format attendu : ${paysInfo.prefix}XXXXXXXXX`;
    }
    return null;
  };

  /* ── Nettoyage du poll ───────────────────────────────────── */
  const stopPoll = () => {
    clearInterval(pollIntervalRef.current);
    clearTimeout(pollTimeoutRef.current);
    pollIntervalRef.current = null;
    pollTimeoutRef.current  = null;
  };

  /* ── Soumission ──────────────────────────────────────────── */
  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);

    if (payMethod === 'mobile') {
      // Numéro formaté en international pour MaishaPay
      const phoneFormatted = formatPhone(form.phone, paysInfo.prefix);

      let res;
      try {
        res = await fetch(`${API}/public/contribute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contributor_name: anon ? '' : form.name.trim(),
            amount:           form.amount,
            currency,                          // CDF, XAF, XOF, ou USD
            operator:         form.operator,   // MPESA, ORANGE, AIRTEL, MTN...
            phone_number:     phoneFormatted,  // +243XXXXXXXXX (format MaishaPay)
            message:          form.message.trim(),
          }),
        });
      } catch (networkErr) {
        console.error('[Nzela] Erreur réseau contribute:', networkErr);
        setError(`Impossible de joindre le serveur. Vérifiez votre connexion. (${networkErr.message})`);
        setStep(4);
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        setError(`Le serveur a renvoyé une réponse inattendue (HTTP ${res.status}).`);
        setStep(4);
        return;
      }

      if (!res.ok) { setError(data.error || 'Paiement refusé.'); setStep(4); return; }

      // ── Polling (v2 asynchrone ou v1 pending) ────────────
      if (data.pending) {
        const ref = data.reference;

        pollIntervalRef.current = setInterval(async () => {
          try {
            const r2 = await fetch(`${API}/public/contrib-status?ref=${ref}`);
            const d2 = await r2.json();
            if (d2.status === 'completed') {
              stopPoll();
              setResult(data);
              setStep(3);
            } else if (d2.status === 'failed') {
              stopPoll();
              setError('Paiement refusé ou annulé. Vérifiez votre solde et réessayez.');
              setStep(4);
            }
          } catch { /* réseau instable, on continue à poller */ }
        }, 3000);

        // Timeout global : 2 min (transactions MaishaPay v2 peuvent prendre du temps)
        pollTimeoutRef.current = setTimeout(() => {
          stopPoll();
          setError('Délai dépassé. Si vous avez confirmé sur votre téléphone, contactez support@nzela.cd');
          setStep(4);
        }, 120_000);

        return;
      }

      // Réponse directe (v1 MPESA synchrone)
      setResult(data);
      setStep(3);
      return;
    }

    // ── Carte bancaire (toujours USD) ─────────────────────
    const reference = genRef();
    const nom       = (anon || !form.name.trim()) ? 'Anonyme' : form.name.trim();
    try {
      const res = await fetch(`${API}/public/card-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    form.amount,
          currency:  'USD',   // MaishaPay Carte = USD/EUR — on fixe USD
          type:      'contribution',
          reference,
          nom,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur de paiement.'); setStep(4); return; }
      if (data.paymentPage) {
        window.location.href = data.paymentPage;
      } else {
        setError("Impossible d'accéder à la page de paiement.");
        setStep(4);
      }
    } catch {
      setError('Service indisponible. Réessayez dans quelques instants.');
      setStep(4);
    }
  };

  /* ── Rendu ───────────────────────────────────────────────── */
  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(5,14,23,0.93)', backdropFilter:'blur(14px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:'linear-gradient(160deg,#0d1f16,#081220)', border:'1px solid rgba(61,170,106,0.3)', borderRadius:24, padding:36, width:'100%', maxWidth:460, position:'relative', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,0.7)' }}>

        {/* Bouton fermer */}
        <button onClick={onClose}
          style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'rgba(232,244,237,0.35)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:4 }}>
          <X size={20} />
        </button>

        {/* ══ ÉTAPE 1 : Formulaire ══════════════════════════════ */}
        {step === 1 && (
          <>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <Heart size={44} color="#3DAA6A" fill="#3DAA6A" style={{ marginBottom:10 }} />
              <h2 style={{ fontSize:22, fontWeight:800, color:'#E8F4ED', margin:'0 0 6px', fontFamily:'Plus Jakarta Sans,sans-serif' }}>
                Soutenir Nzela
              </h2>
              <p style={{ fontSize:13, color:'rgba(232,244,237,0.4)', margin:0 }}>
                Mobile Money · Carte bancaire · Paiement sécurisé · Anonyme possible
              </p>
            </div>

            {/* ── Méthode de paiement ── */}
            <div style={{ marginBottom:20 }}>
              <label style={LBL_STYLE}>Méthode de paiement</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { id:'mobile', Icon: Smartphone, label:'Mobile Money',  sub:'M-Pesa · Orange · Airtel · Africell' },
                  { id:'card',   Icon: CreditCard,  label:'Carte bancaire', sub:'Visa · Mastercard · AmEx · USD uniquement' },
                ].map(meth => (
                  <button key={meth.id} onClick={() => { setPayMethod(meth.id); setError(''); }}
                    style={{ padding:'12px 10px', borderRadius:14, cursor:'pointer', transition:'all 0.2s', textAlign:'center',
                      background: payMethod === meth.id ? 'rgba(61,170,106,0.15)' : 'rgba(255,255,255,0.03)',
                      border:    `1px solid ${payMethod === meth.id ? '#3DAA6A' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <meth.Icon size={18} color={payMethod === meth.id ? '#3DAA6A' : '#E8F4ED'} style={{ margin:'0 auto 4px' }} />
                    <div style={{ fontSize:14, fontWeight:700, color: payMethod === meth.id ? '#3DAA6A' : '#E8F4ED', marginBottom:3 }}>
                      {meth.label}
                    </div>
                    <div style={{ fontSize:11, color:'rgba(232,244,237,0.4)' }}>{meth.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Sélection du pays (Mobile Money uniquement) ── */}
            {payMethod === 'mobile' && (
              <div style={{ marginBottom:16 }}>
                <label style={LBL_STYLE}>Pays</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
                  {PAYS.map(p => (
                    <button key={p.code}
                      onClick={() => handlePaysChange(p.code)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, cursor:'pointer', transition:'all 0.2s',
                        background: pays === p.code ? 'rgba(61,170,106,0.15)' : 'rgba(255,255,255,0.03)',
                        border:    `1px solid ${pays === p.code ? '#3DAA6A' : 'rgba(255,255,255,0.08)'}`,
                        color:      pays === p.code ? '#3DAA6A' : '#E8F4ED',
                        fontWeight:600, fontSize:14,
                      }}>
                      <img src={p.flag} alt={p.nom}
                        style={{ width:24, height:18, borderRadius:3, objectFit:'cover', flexShrink:0 }}
                        onError={e => { e.target.style.display = 'none'; }} />
                      {p.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Toggle devise : Local / USD (Mobile Money uniquement) ── */}
            {payMethod === 'mobile' && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', background:'rgba(61,170,106,0.05)', borderRadius:12, border:'1px solid rgba(61,170,106,0.1)' }}>
                <DollarSign size={16} color="#3DAA6A" style={{ flexShrink:0 }} />
                <label style={{ fontSize:14, color:'rgba(232,244,237,0.75)', cursor:'pointer', userSelect:'none', flex:1 }}>
                  Payer en <strong style={{ color:'#3DAA6A' }}>USD</strong> (dollars)
                </label>
                <div
                  onClick={() => { setCurrencyUSD(v => !v); set('amount', ''); }}
                  style={{ width:40, height:22, borderRadius:11, background: currencyUSD ? '#3DAA6A' : 'rgba(255,255,255,0.12)', cursor:'pointer', position:'relative', transition:'background 0.25s', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:3, left: currencyUSD ? 20 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.25s', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                </div>
              </div>
            )}

            {/* ── Info devise carte ── */}
            {payMethod === 'card' && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'10px 14px', background:'rgba(61,170,106,0.05)', borderRadius:12, border:'1px solid rgba(61,170,106,0.1)' }}>
                <DollarSign size={16} color="#3DAA6A" style={{ flexShrink:0 }} />
                <span style={{ fontSize:13, color:'rgba(232,244,237,0.65)' }}>
                  Paiement carte en <strong style={{ color:'#E8F4ED' }}>USD</strong> uniquement (MaishaPay)
                </span>
              </div>
            )}

            <p style={{ fontSize:11, color:'rgba(232,244,237,0.28)', marginBottom:12 }}>
              Minimum : {minimum.label}
            </p>

            {/* ── Montants rapides ── */}
            <div style={{ marginBottom:16 }}>
              <label style={LBL_STYLE}>
                Montant ({currency})
              </label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:8 }}>
                {rapides.map(v => (
                  <button key={v} onClick={() => set('amount', String(v))}
                    style={{ padding:'9px 4px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s',
                      background: form.amount === String(v) ? '#3DAA6A' : 'rgba(61,170,106,0.07)',
                      color:      form.amount === String(v) ? '#050E17' : '#3DAA6A',
                      border:    `1px solid ${form.amount === String(v) ? '#3DAA6A' : 'rgba(61,170,106,0.15)'}`,
                    }}>
                    {currency === 'USD' ? `$${v}` : v.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                value={form.amount}
                onChange={e => set('amount', e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Autre montant en ${currency}...`}
                style={INP_STYLE} type="text" inputMode="decimal"
              />
            </div>

            {/* ── Opérateur + Téléphone (Mobile Money uniquement) ── */}
            {payMethod === 'mobile' && (
              <>
                <div style={{ marginBottom:16 }}>
                  <label style={LBL_STYLE}>Opérateur Mobile Money</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {ops.map(op => (
                      <button key={op.id} onClick={() => set('operator', op.id)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, cursor:'pointer', transition:'all 0.2s',
                          background: form.operator === op.id ? 'rgba(61,170,106,0.15)' : 'rgba(255,255,255,0.03)',
                          border:    `1px solid ${form.operator === op.id ? '#3DAA6A' : 'rgba(255,255,255,0.07)'}`,
                          color:'#E8F4ED', fontSize:13, fontWeight:600,
                        }}>
                        <img src={op.logo} alt={op.label}
                          style={{ width:22, height:22, objectFit:'contain' }}
                          onError={e => { e.target.style.display = 'none'; }} />
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Champ téléphone avec préfixe affiché */}
                <div style={{ marginBottom:16 }}>
                  <label style={LBL_STYLE}>Numéro de téléphone</label>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {/* Préfixe non-éditable */}
                    <div style={{ ...INP_STYLE, width:'auto', flexShrink:0, color:'#3DAA6A', fontWeight:700, fontSize:14, background:'rgba(61,170,106,0.08)', border:'1px solid rgba(61,170,106,0.3)', padding:'11px 12px', borderRadius:12, whiteSpace:'nowrap' }}>
                      {paysInfo.prefix}
                    </div>
                    <input
                      value={form.phone}
                      onChange={e => set('phone', e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="8XXXXXXXX"
                      style={{ ...INP_STYLE, flex:1 }}
                      type="tel" inputMode="numeric"
                    />
                  </div>
                  <p style={{ fontSize:11, color:'rgba(232,244,237,0.3)', marginTop:5 }}>
                    Entrez le numéro sans le 0 initial ni l'indicatif — ex : <em>812345678</em>
                  </p>
                </div>

                {/* Indication v1 (MPESA synchrone) vs v2 (async avec PIN push) */}
                {selectedOp && (
                  <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(61,170,106,0.05)', border:'1px solid rgba(61,170,106,0.12)', borderRadius:12 }}>
                    <p style={{ fontSize:12, color:'rgba(232,244,237,0.55)', margin:0, lineHeight:1.7 }}>
                      {isV1
                        ? '📲 M-Pesa : une notification push sera envoyée sur votre téléphone. Saisissez votre code PIN pour valider.'
                        : '📲 Vous recevrez une notification push sur votre téléphone. Saisissez votre code PIN pour confirmer le paiement.'
                      }
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Info sécurité (Carte uniquement) ── */}
            {payMethod === 'card' && (
              <div style={{ marginBottom:16, padding:'14px 16px', background:'rgba(61,170,106,0.05)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:14 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                  <ShieldCheck size={18} color="#3DAA6A" style={{ flexShrink:0, marginTop:2 }} />
                  <p style={{ fontSize:13, color:'rgba(232,244,237,0.7)', lineHeight:1.7, margin:0 }}>
                    Vous serez redirigé vers la page sécurisée MaishaPay / CyberSource (Visa) pour saisir vos données de carte (3D Secure).
                  </p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {['VISA', 'Mastercard', 'AmEx'].map(c => (
                    <span key={c} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 10px', fontSize:12, color:'rgba(232,244,237,0.6)', fontWeight:600 }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Toggle anonyme ── */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'12px 14px', background:'rgba(61,170,106,0.05)', borderRadius:12, border:'1px solid rgba(61,170,106,0.1)' }}>
              <input type="checkbox" id="anon" checked={anon} onChange={e => setAnon(e.target.checked)}
                style={{ width:17, height:17, accentColor:'#3DAA6A', cursor:'pointer', flexShrink:0 }} />
              <label htmlFor="anon" style={{ fontSize:14, color:'rgba(232,244,237,0.75)', cursor:'pointer', userSelect:'none' }}>
                Contribuer anonymement
              </label>
            </div>

            {/* ── Nom (si pas anonyme) ── */}
            {!anon && (
              <div style={{ marginBottom:16 }}>
                <label style={LBL_STYLE}>Votre nom (optionnel)</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Prénom Nom"
                  style={INP_STYLE}
                />
              </div>
            )}

            {/* ── Message ── */}
            <div style={{ marginBottom:24 }}>
              <label style={LBL_STYLE}>Message d'encouragement (optionnel)</label>
              <input
                value={form.message}
                onChange={e => set('message', e.target.value)}
                placeholder="Un mot pour l'équipe Nzela..."
                style={INP_STYLE} maxLength={200}
              />
            </div>

            {/* ── Erreur ── */}
            {error && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'rgba(220,50,50,0.1)', border:'1px solid rgba(220,50,50,0.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#ff8080' }}>
                <AlertTriangle size={16} style={{ flexShrink:0, marginTop:2 }} />
                <span>{error}</span>
              </div>
            )}

            {/* ── Bouton soumettre ── */}
            <button onClick={submit}
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'#3DAA6A', color:'#050E17', fontWeight:800, fontSize:16, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif', transition:'opacity 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
              {payMethod === 'card' ? <CreditCard size={18} /> : <Smartphone size={18} />}
              {payMethod === 'card' ? 'Payer par carte' : 'Contribuer'}
              {form.amount ? ` ${parseFloat(form.amount || 0).toLocaleString()} ${currency}` : ''}
              <Heart size={16} fill="#050E17" />
            </button>

            <p style={{ fontSize:11, color:'rgba(232,244,237,0.22)', textAlign:'center', marginTop:10 }}>
              {payMethod === 'card'
                ? 'Vous serez redirigé vers la page sécurisée MaishaPay (USD)'
                : `Notification push → code PIN sur votre téléphone (${paysInfo.prefix})`}
            </p>
          </>
        )}

        {/* ══ ÉTAPE 2 : Chargement ══════════════════════════════ */}
        {step === 2 && (
          <div style={{ textAlign:'center', padding:'52px 0' }}>
            <Loader2 size={52} color="#3DAA6A" style={{ marginBottom:20, animation:'spin 1.2s linear infinite' }} />
            <h3 style={{ color:'#E8F4ED', fontSize:20, fontWeight:700, marginBottom:10, fontFamily:'Plus Jakarta Sans,sans-serif' }}>
              {payMethod === 'card' ? 'Redirection en cours...' : 'En attente de confirmation…'}
            </h3>
            <p style={{ color:'rgba(232,244,237,0.45)', fontSize:14, lineHeight:1.7 }}>
              {payMethod === 'card'
                ? 'Vous allez être redirigé vers la page de paiement sécurisée MaishaPay.'
                : isV1
                  ? 'Une notification a été envoyée sur votre téléphone M-Pesa. Saisissez votre code PIN pour confirmer.'
                  : 'Vérifiez votre téléphone et confirmez la notification Mobile Money en saisissant votre code PIN.'
              }
            </p>
          </div>
        )}

        {/* ══ ÉTAPE 3 : Succès ══════════════════════════════════ */}
        {step === 3 && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <CheckCircle2 size={64} color="#3DAA6A" style={{ marginBottom:16 }} />
            <h3 style={{ color:'#3DAA6A', fontSize:24, fontWeight:800, marginBottom:12, fontFamily:'Plus Jakarta Sans,sans-serif' }}>
              Merci pour votre soutien !
            </h3>
            <p style={{ color:'#E8F4ED', fontSize:16, lineHeight:1.7, marginBottom:16 }}>
              {result?.message}
            </p>
            {result?.reference && (
              <p style={{ color:'rgba(232,244,237,0.3)', fontSize:12, marginBottom:20, fontFamily:'monospace', letterSpacing:'0.05em' }}>
                Réf : {result.reference}
              </p>
            )}
            <div style={{ background:'rgba(61,170,106,0.07)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:16, padding:'18px 20px', marginBottom:28, textAlign:'left' }}>
              <p style={{ fontSize:14, color:'rgba(232,244,237,0.65)', lineHeight:1.8, margin:0 }}>
                🇨🇩 Votre contribution aide directement à construire la plateforme de transport de demain en RDC. Nzela est fier de vous compter parmi ses premiers soutiens.
              </p>
            </div>
            <button onClick={onClose}
              style={{ background:'#3DAA6A', color:'#050E17', border:'none', borderRadius:12, padding:'13px 40px', fontWeight:800, fontSize:15, cursor:'pointer' }}>
              Fermer
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 4 : Erreur ══════════════════════════════════ */}
        {step === 4 && (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <XCircle size={52} color="#ff8080" style={{ marginBottom:16 }} />
            <h3 style={{ color:'#ff8080', fontSize:20, fontWeight:700, marginBottom:10, fontFamily:'Plus Jakarta Sans,sans-serif' }}>
              Paiement échoué
            </h3>
            <p style={{ color:'rgba(232,244,237,0.55)', fontSize:14, marginBottom:28, lineHeight:1.7 }}>
              {error}
            </p>
            <button onClick={() => { setStep(1); setError(''); }}
              style={{ background:'rgba(61,170,106,0.1)', color:'#3DAA6A', border:'1px solid rgba(61,170,106,0.3)', borderRadius:12, padding:'12px 32px', fontWeight:700, fontSize:15, cursor:'pointer' }}>
              Réessayer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL : PAGE COMING SOON
───────────────────────────────────────────────────────────── */
export default function ComingSoon() {
  const { d, h, m, s, pct } = useCountdown();
  const [showContrib, setShowContrib] = useState(false);

  const half = Math.ceil(SUPPORTERS.length / 2);
  const row1 = [...SUPPORTERS.slice(0, half), ...SUPPORTERS.slice(0, half)];
  const row2 = [...SUPPORTERS.slice(half),    ...SUPPORTERS.slice(half)];

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=DM+Sans:wght@400;600&display=swap');
      *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
      body { background:#050E17; color:#E8F4ED; font-family:'DM Sans',sans-serif; }
      @keyframes scrollLeft  { from{transform:translateX(0)}    to{transform:translateX(-50%)} }
      @keyframes scrollRight { from{transform:translateX(-50%)} to{transform:translateX(0)}    }
      @keyframes floatUp     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      @keyframes pulse-dot   { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes spin        { to{transform:rotate(360deg)} }
      @keyframes fadeSlide   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:none} }
      .cs-in         { animation:fadeSlide 0.7s ease forwards; opacity:0; }
      .obj-card      { transition:border-color 0.3s,transform 0.3s; }
      .obj-card:hover{ border-color:rgba(61,170,106,0.45) !important; transform:translateY(-5px); }
      .cs-main-btn   { transition:transform 0.25s,box-shadow 0.25s; }
      .cs-main-btn:hover { transform:scale(1.05); box-shadow:0 16px 48px rgba(61,170,106,0.45) !important; }
      .cs-ghost-btn  { transition:background 0.2s; }
      .cs-ghost-btn:hover { background:rgba(61,170,106,0.13) !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#050E17', overflowX:'hidden' }}>
      {showContrib && <ContribModal onClose={() => setShowContrib(false)} />}

      {/* Grille de fond */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, backgroundImage:'linear-gradient(rgba(61,170,106,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(61,170,106,0.025) 1px,transparent 1px)', backgroundSize:'55px 55px' }} />

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', textAlign:'center' }}>

        <div style={{ position:'absolute', top:'25%', left:'50%', transform:'translateX(-50%)', width:640, height:640, borderRadius:'50%', background:'radial-gradient(circle,rgba(61,170,106,0.09) 0%,transparent 70%)', pointerEvents:'none', animation:'floatUp 10s ease-in-out infinite' }} />

        <div className="cs-in" style={{ animationDelay:'0ms' }}>
          <img src="/nzela-icon.png" alt="Nzela"
            style={{ width:76, height:76, borderRadius:20, marginBottom:28, boxShadow:'0 8px 32px rgba(61,170,106,0.35)', animation:'floatUp 7s ease-in-out infinite' }}
            onError={e => { e.target.style.display = 'none'; }} />
        </div>

        <div className="cs-in" style={{ animationDelay:'80ms', display:'inline-flex', alignItems:'center', gap:8, background:'rgba(61,170,106,0.1)', border:'1px solid rgba(61,170,106,0.25)', borderRadius:100, padding:'6px 20px', marginBottom:28 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#3DAA6A', display:'inline-block', animation:'pulse-dot 1.5s ease infinite' }} />
          <span style={{ fontSize:12, color:'#3DAA6A', fontWeight:700, letterSpacing:'0.1em' }}>
            BIENTÔT DISPONIBLE · 1ER JUIN 2026
          </span>
        </div>

        <h1 className="cs-in" style={{ animationDelay:'160ms', fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'clamp(42px,9vw,90px)', fontWeight:800, lineHeight:1.05, marginBottom:14 }}>
          <span style={{ background:'linear-gradient(135deg,#E8F4ED 40%,#5dca8a 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Nzela
          </span>
        </h1>

        <p className="cs-in" style={{ animationDelay:'240ms', fontSize:'clamp(15px,2.2vw,19px)', color:'rgba(232,244,237,0.5)', marginBottom:52, maxWidth:500, lineHeight:1.7 }}>
          Ta route commence ici · La plateforme de réservation de bus en République Démocratique du Congo.
        </p>

        {/* Compte à rebours */}
        <div className="cs-in" style={{ animationDelay:'320ms', display:'flex', gap:'clamp(10px,3vw,28px)', marginBottom:52 }}>
          {[['J', d], ['H', h], ['M', m], ['S', s]].map(([label, val]) => (
            <div key={label} style={{ textAlign:'center' }}>
              <div style={{ width:'clamp(70px,13vw,98px)', height:'clamp(70px,13vw,98px)', borderRadius:16, background:'rgba(61,170,106,0.07)', border:'1px solid rgba(61,170,106,0.18)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
                <span style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'clamp(24px,5vw,40px)', fontWeight:800, color:'#E8F4ED' }}>
                  {pad(val)}
                </span>
              </div>
              <span style={{ fontSize:11, color:'rgba(232,244,237,0.3)', marginTop:8, display:'block', letterSpacing:'0.12em' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Barre de progression */}
        <div className="cs-in" style={{ animationDelay:'400ms', width:'100%', maxWidth:420, marginBottom:52 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'rgba(232,244,237,0.3)' }}>Avancement</span>
            <span style={{ fontSize:12, color:'#3DAA6A', fontWeight:700 }}>{pct}%</span>
          </div>
          <div style={{ height:6, background:'rgba(61,170,106,0.08)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#1e6e40,#3DAA6A,#5dca8a)', borderRadius:3, transition:'width 1s ease', boxShadow:'0 0 12px rgba(61,170,106,0.35)' }} />
          </div>
        </div>

        {/* CTA principal */}
        <div className="cs-in" style={{ animationDelay:'480ms' }}>
          <button className="cs-main-btn" onClick={() => setShowContrib(true)}
            style={{ background:'#3DAA6A', color:'#050E17', border:'none', borderRadius:100, padding:'16px 42px', fontWeight:800, fontSize:17, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif', boxShadow:'0 8px 32px rgba(61,170,106,0.3)', display:'inline-flex', alignItems:'center', gap:10 }}>
            <Heart size={20} fill="#050E17" />
            Soutenir le projet
          </button>
          <p style={{ fontSize:12, color:'rgba(232,244,237,0.28)', marginTop:12 }}>
            À partir de 500 FC ou 1 $ · Anonyme possible · Mobile Money & Carte
          </p>
        </div>
      </section>

      {/* ══ VISION & MISSION ══════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, padding:'80px 24px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <p style={{ fontSize:12, letterSpacing:'0.15em', color:'#3DAA6A', fontWeight:700, marginBottom:10 }}>QUI SOMMES-NOUS</p>
          <h2 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'clamp(26px,4vw,46px)', fontWeight:800 }}>Vision & Mission</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24 }}>

          {/* Vision */}
          <div style={{ background:'linear-gradient(135deg,rgba(61,170,106,0.1),rgba(5,14,23,0.9))', border:'1px solid rgba(61,170,106,0.2)', borderRadius:24, padding:'40px 32px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(61,170,106,0.1),transparent)', pointerEvents:'none' }} />
            <Star size={42} color="#3DAA6A" fill="rgba(61,170,106,0.2)" style={{ marginBottom:16 }} />
            <h3 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:24, fontWeight:800, color:'#3DAA6A', marginBottom:14 }}>Notre Vision</h3>
            <p style={{ fontSize:16, lineHeight:1.85, color:'rgba(232,244,237,0.7)' }}>
              Devenir la plateforme de référence du transport terrestre en Afrique Centrale. Un Congo où chaque citoyen peut planifier, réserver et payer son voyage en quelques secondes depuis son téléphone.
            </p>
          </div>

          {/* Mission */}
          <div style={{ background:'rgba(5,14,23,0.85)', border:'1px solid rgba(61,170,106,0.12)', borderRadius:24, padding:'40px 32px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', bottom:-20, left:-20, width:120, height:120, borderRadius:'50%', background:'radial-gradient(circle,rgba(61,170,106,0.06),transparent)', pointerEvents:'none' }} />
            <Target size={42} color="#3DAA6A" style={{ marginBottom:16 }} />
            <h3 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:24, fontWeight:800, color:'#E8F4ED', marginBottom:14 }}>Notre Mission</h3>
            <p style={{ fontSize:16, lineHeight:1.85, color:'rgba(232,244,237,0.7)' }}>
              Connecter les voyageurs congolais aux agences de bus fiables grâce à une technologie simple et adaptée — Mobile Money intégré, zéro cash, zéro file d'attente, 100% traçable.
            </p>
          </div>

        </div>
      </section>

      {/* ══ OBJECTIFS ═════════════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, background:'rgba(61,170,106,0.025)', borderTop:'1px solid rgba(61,170,106,0.07)', borderBottom:'1px solid rgba(61,170,106,0.07)', padding:'72px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <p style={{ fontSize:12, letterSpacing:'0.15em', color:'#3DAA6A', fontWeight:700, marginBottom:10 }}>CE QUE NOUS CONSTRUISONS</p>
            <h2 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'clamp(26px,4vw,46px)', fontWeight:800 }}>Nos Objectifs</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
            {OBJECTIFS.map(({ Icon, titre, desc }, i) => (
              <div key={i} className="obj-card" style={{ background:'#050E17', border:'1px solid rgba(61,170,106,0.12)', borderRadius:20, padding:'28px 22px' }}>
                <Icon size={36} color="#3DAA6A" style={{ marginBottom:14 }} />
                <div style={{ width:30, height:3, background:'#3DAA6A', borderRadius:2, marginBottom:14 }} />
                <h4 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:18, fontWeight:800, marginBottom:10, color:'#E8F4ED' }}>{titre}</h4>
                <p style={{ fontSize:14, color:'rgba(232,244,237,0.5)', lineHeight:1.75 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SUPPORTERS ════════════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, padding:'72px 0 80px' }}>
        <div style={{ textAlign:'center', marginBottom:44, padding:'0 24px' }}>
          <p style={{ fontSize:12, letterSpacing:'0.15em', color:'rgba(232,244,237,0.3)', fontWeight:700, marginBottom:10 }}>ILS NOUS FONT CONFIANCE</p>
          <h2 style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'clamp(22px,4vw,40px)', fontWeight:800 }}>Nos Supporters</h2>
        </div>

        {/* Rangée 1 – gauche */}
        <div style={{ overflow:'hidden', marginBottom:12 }}>
          <div style={{ display:'flex', gap:14, width:'max-content', animation:'scrollLeft 38s linear infinite' }}>
            {row1.map((name, i) => (
              <div key={i} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, background:'rgba(61,170,106,0.07)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:100, padding:'8px 22px', fontSize:13, color:'rgba(232,244,237,0.8)', whiteSpace:'nowrap', fontWeight:600 }}>
                <Heart size={12} color="#3DAA6A" fill="#3DAA6A" />
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Rangée 2 – droite */}
        <div style={{ overflow:'hidden', marginBottom:48 }}>
          <div style={{ display:'flex', gap:14, width:'max-content', animation:'scrollRight 44s linear infinite' }}>
            {row2.map((name, i) => (
              <div key={i} style={{ flexShrink:0, background:'rgba(61,170,106,0.04)', border:'1px solid rgba(61,170,106,0.09)', borderRadius:100, padding:'8px 22px', fontSize:13, color:'rgba(232,244,237,0.55)', whiteSpace:'nowrap' }}>
                ✦ {name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign:'center' }}>
          <button className="cs-ghost-btn" onClick={() => setShowContrib(true)}
            style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(61,170,106,0.07)', color:'#3DAA6A', border:'1px solid rgba(61,170,106,0.25)', borderRadius:100, padding:'13px 34px', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif' }}>
            <Plus size={18} />
            Rejoindre les supporters
          </button>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════ */}
      <footer style={{ borderTop:'1px solid rgba(61,170,106,0.07)', padding:'28px 24px', textAlign:'center', position:'relative', zIndex:1 }}>
        <p style={{ fontSize:13, color:'rgba(232,244,237,0.22)' }}>© 2026 Nzela · Ta route commence ici 🇨🇩</p>
      </footer>
    </div>
  );
}