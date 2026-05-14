/**
 * SeatMapModal.jsx — Modal de sélection / consultation des sièges
 *
 * Utilisé dans :
 *   - AgencyDashboard : sélection de sièges lors d'une réservation manuelle
 *   - AdminDashboard  : consultation de l'occupation d'un voyage
 *
 * Props:
 *   mode        : "select" | "view"
 *   trip        : object voyage (id, bus_id, bus_name, departure_city, arrival_city, departure_date, total_seats)
 *   booking     : object réservation existante (optionnel — pour pré-sélectionner ses sièges)
 *   passengers  : number — nb de passagers à placer (mode select)
 *   onConfirm   : (seatNumbers: string[]) => void
 *   onClose     : () => void
 *   headers     : axios headers
 *   API         : string — base URL API
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import SeatPicker from './SeatPicker';
import {
  X, Bus, MapPin, Calendar, Users, Check,
  Loader, AlertTriangle, RefreshCw,
} from 'lucide-react';

export default function SeatMapModal({
  mode = 'view',
  trip,
  booking = null,
  passengers = 1,
  onConfirm,
  onClose,
  headers,
  API,
}) {
  const [seatsData,     setSeatsData]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [saving,        setSaving]        = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await axios.get(`${API}/trips/${trip.id}/seats`, { headers });
      setSeatsData(r.data);

      // Pré-sélectionner les sièges de la réservation existante
      if (booking?.seat_numbers) {
        const pre = booking.seat_numbers.split(',').filter(Boolean);
        setSelectedSeats(pre);
      }
    } catch(e) {
      setError(e.response?.data?.error || 'Erreur de chargement');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [trip.id]);

  const handleConfirm = async () => {
    if (selectedSeats.length === 0) return;
    if (mode === 'select' && selectedSeats.length !== passengers) return;

    if (onConfirm) {
      setSaving(true);
      try { await onConfirm(selectedSeats); }
      finally { setSaving(false); }
    }
  };

  // Séparer les sièges occupés et en attente
  const occupiedSeats = seatsData?.seats
    .filter(s => (s.status === 'reserved' || s.status === 'confirmed') && s.booking_id !== booking?.id)
    .map(s => s.seat_number) || [];

  const pendingSeats = seatsData?.seats
    .filter(s => s.status === 'pending' && s.booking_id !== booking?.id)
    .map(s => s.seat_number) || [];

  const highlightSeats = booking?.seat_numbers
    ? booking.seat_numbers.split(',').filter(Boolean)
    : [];

  const canConfirm = mode === 'select'
    ? selectedSeats.length === passengers
    : false;

  return (
    <div
      style={{
        position:'fixed', inset:0,
        background:'rgba(0,0,0,0.8)', backdropFilter:'blur(5px)',
        zIndex:250, display:'flex', alignItems:'center', justifyContent:'center',
        padding:16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'var(--night)', border:'1px solid var(--border)',
        borderRadius:18, width:'100%', maxWidth:420,
        maxHeight:'94vh', overflowY:'auto',
        boxShadow:'0 32px 80px rgba(0,0,0,0.6)',
        display:'flex', flexDirection:'column',
      }}>

        {/* ── En-tête ─────────────────────────────────────── */}
        <div style={{
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--night)', zIndex:1,
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius:9,
              background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Bus size={16} color="var(--green-l)" />
            </div>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:15 }}>
                {mode === 'select' ? 'Choisir les sièges' : 'Occupation du voyage'}
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                {trip.bus_name || 'Bus'} · {trip.departure_city} → {trip.arrival_city}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={load}
              style={{ width:30, height:30, borderRadius:7, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}
              title="Actualiser"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={onClose}
              style={{ width:30, height:30, borderRadius:7, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Infos voyage ─────────────────────────────────── */}
        <div style={{
          padding:'10px 20px', borderBottom:'1px solid var(--border)',
          display:'flex', gap:14, flexWrap:'wrap',
          background:'rgba(61,170,106,0.03)',
        }}>
          {[
            { Icon: MapPin,   label:`${trip.departure_city} → ${trip.arrival_city}` },
            { Icon: Calendar, label: trip.departure_date ? new Date(trip.departure_date).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '—' },
            ...(mode === 'select' ? [{ Icon: Users, label:`${passengers} passager${passengers > 1 ? 's' : ''}` }] : []),
          ].map(({ Icon, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--muted)' }}>
              <Icon size={12} /> {label}
            </div>
          ))}
        </div>

        {/* ── Contenu ──────────────────────────────────────── */}
        <div style={{ padding:'16px 20px', flex:1 }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:40, gap:10, color:'var(--muted)', fontSize:13 }}>
              <Loader size={18} style={{ animation:'spin 1s linear infinite' }} /> Chargement du plan…
            </div>
          ) : error ? (
            <div style={{ textAlign:'center', padding:30 }}>
              <div style={{ color:'var(--err)', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <AlertTriangle size={16} /> {error}
              </div>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={load}>
                <RefreshCw size={12} style={{ marginRight:5 }} /> Réessayer
              </button>
            </div>
          ) : (
            <SeatPicker
              layout={seatsData.layout}
              totalSeats={seatsData.total_seats}
              occupiedSeats={occupiedSeats}
              pendingSeats={pendingSeats}
              selectedSeats={selectedSeats}
              onSelect={mode === 'select' ? setSelectedSeats : undefined}
              maxSelect={passengers}
              readOnly={mode === 'view'}
              highlightSeats={mode === 'view' ? highlightSeats : []}
            />
          )}
        </div>

        {/* ── Mode SELECT — instruction + bouton ───────────── */}
        {mode === 'select' && !loading && !error && (
          <div style={{
            padding:'14px 20px', borderTop:'1px solid var(--border)',
            position:'sticky', bottom:0, background:'var(--night)',
            display:'flex', flexDirection:'column', gap:10,
          }}>
            {selectedSeats.length < passengers && (
              <div style={{ fontSize:12, color:'var(--gold)', display:'flex', alignItems:'center', gap:6 }}>
                <AlertTriangle size={12} />
                Sélectionnez encore {passengers - selectedSeats.length} siège{passengers - selectedSeats.length > 1 ? 's' : ''}
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1, fontSize:13, justifyContent:'center' }} onClick={onClose}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ flex:2, fontSize:13, justifyContent:'center', display:'flex', alignItems:'center', gap:7, opacity: canConfirm ? 1 : 0.45 }}
                onClick={handleConfirm}
                disabled={!canConfirm || saving}
              >
                {saving
                  ? <><Loader size={13} style={{ animation:'spin 1s linear infinite' }} /> Enregistrement…</>
                  : <><Check size={13} /> Confirmer les sièges</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Mode VIEW — bouton fermer ─────────────────────── */}
        {mode === 'view' && (
          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" style={{ fontSize:13 }} onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}