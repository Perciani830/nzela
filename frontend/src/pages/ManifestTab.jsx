import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Check, X, Clock, UserPlus, Printer,
  ChevronDown, ChevronUp, Phone,
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

/* ── Badge statut réservation (confirmée / annulée) ─────────── */
function BookingStatusBadge({ status }) {
  if (status === 'cancelled') return <span className="badge b-r">Annulée</span>;
  return <span className="badge b-g">Confirmée</span>;
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════ */
export default function ManifestTab({ agencyName, showToast, tripId, onOpenOnsiteBooking }) {
  const [manifest, setManifest]   = useState(null);   // { trip, bookings }
  const [loading, setLoading]     = useState(false);
  const [updating, setUpdating]   = useState(null);    // id du booking en cours de maj (embarquement)
  const [cancelling, setCancelling] = useState(null);  // id du booking en cours d'annulation
  const [expanded, setExpanded]   = useState({});      // lignes dépliées (détails)

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

  /* ── Annulation d'une réservation ─────────────────────────
     Réutilise la même route que l'onglet Réservations
     (PATCH /agency/bookings/:id/cancel) : remboursement de la
     commission et libération des sièges déjà gérés côté serveur. */
  const cancelBooking = async (bookingId, amount) => {
    if (!confirm(`Annuler cette réservation ?\n${Number(amount).toLocaleString('fr-FR')} FC retirés des revenus de l'agence.`)) return;
    setCancelling(bookingId);
    try {
      await axios.patch(`${API}/agency/bookings/${bookingId}/cancel`, {}, { headers: getHeaders() });
      showToast('Réservation annulée', 'success');
      loadManifest(tripId);
    } catch(e) { showToast(e.response?.data?.error || 'Erreur lors de l\'annulation', 'error'); }
    finally { setCancelling(null); }
  };

  /* ── Impression ─────────────────────────────────────────── */
  const print = () => window.print();

  /* ── Stats rapides ──────────────────────────────────────────
     Ne portent que sur les réservations confirmées : une
     réservation annulée n'a plus de sens d'embarquement. */
  const confirmedBookings = manifest ? manifest.bookings.filter(b => b.status === 'confirmed') : [];
  const cancelledCount    = manifest ? manifest.bookings.filter(b => b.status === 'cancelled').length : 0;
  const stats = manifest ? {
    total:     confirmedBookings.length,
    present:   confirmedBookings.filter(b => b.boarding_status === 'present').length,
    absent:    confirmedBookings.filter(b => b.boarding_status === 'absent').length,
    pending:   confirmedBookings.filter(b => b.boarding_status === 'pending' || !b.boarding_status).length,
    seats:     confirmedBookings.reduce((s, b) => s + (b.passengers || 1), 0),
    cancelled: cancelledCount,
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
            onClick={() => onOpenOnsiteBooking && onOpenOnsiteBooking(trip.id)}
            disabled={trip.available_seats === 0 || !onOpenOnsiteBooking}
            title={!onOpenOnsiteBooking ? 'Fonction indisponible' : undefined}
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
          { label:'Sièges vendus', val: stats.seats,     color:'var(--green-l)' },
          { label:'Annulés',       val: stats.cancelled, color:'var(--muted)' },
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
            Aucune réservation pour ce voyage.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Référence</th>
                  <th>Passager</th>
                  <th>Trajet / départ</th>
                  <th>Bus</th>
                  <th>Sièges</th>
                  <th>Total</th>
                  <th>Commission</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                  <th>Embarquement</th>
                  <th>Action</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => {
                  const isExp = expanded[b.id];
                  const busy  = updating === b.id;
                  const cancBusy = cancelling === b.id;
                  const isCancelled = b.status === 'cancelled';
                  const paymentLabel = b.payment_method === 'cash' ? 'Espèces'
                    : b.payment_method === 'card' ? 'Carte'
                    : b.payment_method === 'mobilemoney' ? 'Mobile Money'
                    : (b.payment_method || '—');
                  return [
                    <tr key={b.id} style={{ cursor:'pointer', opacity: isCancelled ? 0.6 : 1 }}>
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
                      <td style={{ fontSize:12 }}>
                        <div>{b.departure_city || trip.departure_city} → {b.arrival_city || trip.arrival_city}</div>
                        <div style={{ color:'var(--muted)', fontSize:11 }}>
                          {b.departure_date || trip.departure_date || '—'} · {b.departure_time || trip.departure_time || '—'}
                        </div>
                      </td>
                      <td>{trip.bus_name ? <span className="badge b-b" style={{ fontSize:11 }}>{trip.bus_name}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td style={{ fontWeight:700 }}>
                        {(() => { const raw = b.seat_numbers; let seats = []; try { seats = Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { seats = String(raw || '').split(',').map(x => x.trim()).filter(Boolean); } return seats.length ? seats.join(', ') : '—'; })()}
                      </td>
                      <td style={{ color:'var(--gold)', fontWeight:700 }}>{Number(b.total_price).toLocaleString('fr-FR')} FC</td>
                      <td style={{ color:'var(--err)', fontSize:12 }}>{b.commission_amount > 0 ? `-${Number(b.commission_amount).toLocaleString('fr-FR')} FC` : '—'}</td>
                      <td style={{ fontSize:12 }}>{paymentLabel}</td>
                      <td><BookingStatusBadge status={b.status} /></td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button
                            className={`btn ${b.boarding_status === 'present' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => updateBoarding(b.id, 'present')}
                            disabled={busy || isCancelled}
                            title="Marquer présent"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            className={`btn ${b.boarding_status === 'absent' ? 'btn-danger' : 'btn-ghost'}`}
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => updateBoarding(b.id, 'absent')}
                            disabled={busy || isCancelled}
                            title="Marquer absent"
                          >
                            <X size={12} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4, color:'var(--muted)' }}
                            onClick={() => updateBoarding(b.id, 'pending')}
                            disabled={busy || isCancelled}
                            title="Réinitialiser"
                          >
                            <Clock size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        {isCancelled ? (
                          <span style={{ fontSize:11, color:'var(--muted)' }}>—</span>
                        ) : (
                          <button
                            className="btn btn-danger"
                            style={{ fontSize:11, padding:'4px 9px', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => cancelBooking(b.id, b.total_price)}
                            disabled={cancBusy}
                            title="Annuler la réservation"
                          >
                            {cancBusy ? <div className="spinner" style={{ width:11, height:11 }} /> : <X size={12} />}
                          </button>
                        )}
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
                        <td colSpan={13} style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontSize:12 }}>
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

    </div>
  );
}