import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Check, X, Clock, UserPlus, Printer,
  ChevronDown, ChevronUp, Phone, AlertTriangle,
} from 'lucide-react';

const API = 'https://nzela-production-086a.up.railway.app/api';

function getHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

/* ── Badge statut embarquement ──────────────────────────────── */
function BoardBadge({ status }) {
  const map = {
    present: { label: 'Présent',  cls: 'b-g' },
    absent:  { label: 'Absent',   cls: 'b-r' },
    pending: { label: 'En attente', cls: 'b-o' },
  };
  const { label, cls } = map[status] || map.pending;
  return <span className={`badge ${cls}`}>{label}</span>;
}

/* ── Modal Walk-in ──────────────────────────────────────────── */
function WalkInModal({ trip, onClose, onSuccess }) {
  const [form, setForm] = useState({ passenger_name:'', passenger_phone:'', passengers:1, payment_method:'cash' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    if (!form.passenger_name || !form.passenger_phone) return setError('Nom et téléphone requis');
    setLoading(true); setError('');
    try {
      await axios.post(`${API}/agency/bookings/walkin`, { ...form, trip_id: trip.id }, { headers: getHeaders() });
      onSuccess();
      onClose();
    } catch(e) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ display:'flex', alignItems:'center', gap:8 }}><UserPlus size={17} /> Passager sur place</h2>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {trip.departure_city} → {trip.arrival_city} · {trip.departure_time}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {error && (
            <div style={{ background:'rgba(255,74,74,0.1)', border:'1px solid rgba(255,74,74,0.25)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'var(--err)', display:'flex', gap:7, alignItems:'center' }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Nom du passager *</label>
            <input className="input-field" placeholder="Jean Lukeba" value={form.passenger_name} onChange={e => setForm({...form, passenger_name: e.target.value})} />
          </div>
          <div className="input-group">
            <label className="input-label">Téléphone *</label>
            <input className="input-field" placeholder="+243 81 000 0000" value={form.passenger_phone} onChange={e => setForm({...form, passenger_phone: e.target.value})} />
          </div>
          <div className="input-group">
            <label className="input-label">Nombre de places</label>
            <input className="input-field" type="number" min={1} max={trip.available_seats} value={form.passengers} onChange={e => setForm({...form, passengers: parseInt(e.target.value)||1})} />
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{trip.available_seats} places restantes</div>
          </div>
          <div className="input-group">
            <label className="input-label">Mode de paiement</label>
            <select className="input-field" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:8, padding:'9px 12px', fontSize:13 }}>
            Total : <strong style={{ color:'var(--gold)' }}>{(trip.price * (form.passengers||1)).toLocaleString('fr-FR')} FC</strong>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" style={{ fontSize:12, padding:'7px 14px' }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            {loading ? <><div className="spinner"/> Enregistrement…</> : <><Check size={13} /> Confirmer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function ManifestTab({ agencyName, showToast, tripId }) {
  const [manifest, setManifest] = useState(null);   // { trip, bookings }
  const [loading, setLoading]   = useState(false);
  const [walkIn, setWalkIn]     = useState(false);
  const [updating, setUpdating] = useState(null);    // id du booking en cours de maj
  const [expanded, setExpanded] = useState({});      // lignes dépliées (détails)

  /* ── Chargement du manifeste ────────────────────────────── */
  const loadManifest = async (id) => {
    if (!id) { setManifest(null); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/agency/manifest/${id}`, { headers: getHeaders() });
      setManifest(res.data);
    } catch(e) {
      showToast(e.response?.data?.error || 'Erreur de chargement', 'error');
      setManifest(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadManifest(tripId); }, [tripId]);

  /* ── Mise à jour statut embarquement ───────────────────── */
  const updateBoarding = async (bookingId, status) => {
    setUpdating(bookingId);
    try {
      await axios.patch(`${API}/agency/bookings/${bookingId}/board`, { boarding_status: status }, { headers: getHeaders() });
      setManifest(prev => ({
        ...prev,
        bookings: prev.bookings.map(b => b.id === bookingId ? { ...b, boarding_status: status } : b),
      }));
      showToast(status === 'present' ? 'Passager marqué présent' : status === 'absent' ? 'Passager marqué absent' : 'Statut réinitialisé', 'success');
    } catch(e) { showToast('Erreur de mise à jour', 'error'); }
    finally { setUpdating(null); }
  };

  /* ── Impression ─────────────────────────────────────────── */
  const print = () => window.print();

  /* ── Stats rapides ──────────────────────────────────────── */
  const stats = manifest ? {
    total:   manifest.bookings.length,
    present: manifest.bookings.filter(b => b.boarding_status === 'present').length,
    absent:  manifest.bookings.filter(b => b.boarding_status === 'absent').length,
    pending: manifest.bookings.filter(b => b.boarding_status === 'pending' || !b.boarding_status).length,
    seats:   manifest.bookings.reduce((s, b) => s + (b.passengers || 1), 0),
  } : null;

  /* ── Aucun voyage sélectionné ───────────────────────────── */
  if (!tripId) {
    return (
      <div style={{ textAlign:'center', padding:'48px 20px', background:'var(--surface)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
          <Users size={40} style={{ opacity:.2 }} />
        </div>
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, marginBottom:6 }}>Aucun voyage sélectionné</div>
        <div style={{ color:'var(--muted)', fontSize:13 }}>Choisissez un voyage dans le sélecteur ci-dessus pour afficher son manifeste.</div>
      </div>
    );
  }

  /* ── Chargement ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ textAlign:'center', padding:'60px' }}>
        <div className="spinner" style={{ width:32, height:32, margin:'0 auto', borderWidth:2.5 }} />
      </div>
    );
  }

  /* ── Manifeste vide ou introuvable ─────────────────────── */
  if (!manifest) return null;

  const { trip, bookings } = manifest;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Barre d'actions ───────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize:12, display:'inline-flex', alignItems:'center', gap:6 }}
            onClick={print}
          >
            <Printer size={13} /> Imprimer
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize:12, display:'inline-flex', alignItems:'center', gap:6 }}
            onClick={() => setWalkIn(true)}
            disabled={trip.available_seats === 0}
          >
            <UserPlus size={13} /> Passager sur place
          </button>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize:12 }}
          onClick={() => loadManifest(tripId)}
        >
          Actualiser
        </button>
      </div>

      {/* ── Compteurs ─────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8 }}>
        {[
          { label:'Passagers',     val: stats.total,   color:'var(--text)' },
          { label:'Présents',      val: stats.present, color:'var(--ok)' },
          { label:'Absents',       val: stats.absent,  color:'var(--err)' },
          { label:'En attente',    val: stats.pending, color:'var(--gold)' },
          { label:'Sièges vendus', val: stats.seats,   color:'var(--green-l)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'11px 14px' }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:22, color }}>{val}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Liste passagers ───────────────────────────────── */}
      <div className="glass" style={{ overflow:'hidden' }}>
        {bookings.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)', fontSize:13 }}>
            Aucun passager confirmé pour ce voyage.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Référence</th>
                  <th>Passager</th>
                  <th>Sièges</th>
                  <th>Statut</th>
                  <th>Embarquement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => {
                  const isExp = expanded[b.id];
                  const busy  = updating === b.id;
                  return [
                    <tr key={b.id} style={{ cursor:'pointer' }}>
                      <td style={{ color:'var(--muted)', fontSize:12 }}>{i + 1}</td>
                      <td>
                        <code style={{ background:'var(--green-bg)', padding:'2px 7px', borderRadius:5, fontSize:11, color:'var(--green-l)' }}>
                          {b.reference}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontWeight:600 }}>{b.passenger_name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:4 }}>
                          <Phone size={10} /> {b.passenger_phone}
                        </div>
                      </td>
                      <td style={{ fontWeight:700 }}>{b.passengers || 1}</td>
                      <td><BoardBadge status={b.boarding_status || 'pending'} /></td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button
                            className={`btn ${b.boarding_status === 'present' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => updateBoarding(b.id, 'present')}
                            disabled={busy}
                            title="Marquer présent"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            className={`btn ${b.boarding_status === 'absent' ? 'btn-danger' : 'btn-ghost'}`}
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => updateBoarding(b.id, 'absent')}
                            disabled={busy}
                            title="Marquer absent"
                          >
                            <X size={12} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4, color:'var(--muted)' }}
                            onClick={() => updateBoarding(b.id, 'pending')}
                            disabled={busy}
                            title="Réinitialiser"
                          >
                            <Clock size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize:11, padding:'4px 8px', display:'inline-flex', alignItems:'center' }}
                          onClick={() => setExpanded(p => ({ ...p, [b.id]: !p[b.id] }))}
                        >
                          {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </td>
                    </tr>,

                    /* Ligne dépliée — détails supplémentaires */
                    isExp && (
                      <tr key={`${b.id}-detail`} style={{ background:'rgba(61,170,106,0.04)' }}>
                        <td colSpan={7} style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontSize:12 }}>
                            <div><span style={{ color:'var(--muted)' }}>Montant : </span><strong style={{ color:'var(--gold)' }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</strong></div>
                            <div><span style={{ color:'var(--muted)' }}>Paiement : </span><strong>{b.payment_method === 'cash' ? 'Espèces' : 'Mobile Money'}</strong></div>
                            {b.passenger_email && <div><span style={{ color:'var(--muted)' }}>Email : </span><strong>{b.passenger_email}</strong></div>}
                            <div><span style={{ color:'var(--muted)' }}>Réservé le : </span><strong>{new Date(b.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</strong></div>
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal walk-in ─────────────────────────────────── */}
      {walkIn && (
        <WalkInModal
          trip={trip}
          onClose={() => setWalkIn(false)}
          onSuccess={() => { loadManifest(tripId); showToast('Passager ajouté', 'success'); }}
        />
      )}
    </div>
  );
}