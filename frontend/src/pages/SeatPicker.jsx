/**
 * SeatPicker.jsx — Composant de sélection de sièges Nzela RDC
 *
 * Props:
 *   layout       : "2+2" | "2+3" | "2"  — disposition des sièges
 *   totalSeats   : number                — total de sièges du bus
 *   occupiedSeats: string[]              — ex: ["1A","2C","3E"]  (réservés/confirmés)
 *   pendingSeats : string[]              — ex: ["4A"] (réservation en cours par d'autres)
 *   selectedSeats: string[]              — sièges sélectionnés par l'utilisateur courant
 *   onSelect     : (seats: string[]) => void
 *   maxSelect    : number                — nb de sièges max sélectionnables (= nb passagers)
 *   readOnly     : boolean               — mode consultation pure (pas de sélection)
 *   highlightSeats: string[]             — sièges à mettre en évidence (ex: réservation en cours de consultation)
 */

import { useState } from 'react';
import { User, Users, ArrowUp } from 'lucide-react';

/* ── Génération du plan de sièges ──────────────────────────── */
/**
 * Retourne un tableau de rangées.
 * Chaque rangée est un tableau de sièges { id, side: 'left'|'right' }.
 * La dernière rangée est toujours une banquette pleine de 5 sièges.
 *
 * Layouts :
 *   "2+2"  → gauche: [A,B]  droite: [C,D]
 *   "2+3"  → gauche: [A,B]  droite: [C,D,E]
 *   "2"    → gauche: [A]    droite: [B]
 */
export function generateSeats(layout = '2+3', totalSeats = 50) {
  const configs = {
    '2+2': { left: ['A','B'], right: ['C','D'] },
    '2+3': { left: ['A','B'], right: ['C','D','E'] },
    '2':   { left: ['A'],     right: ['B'] },
  };
  const cfg = configs[layout] || configs['2+3'];
  const seatsPerRow = cfg.left.length + cfg.right.length;
  const lastRowSeats = ['A','B','C','D','E']; // banquette 5 places

  // Le dernier rang occupe 5 sièges quelle que soit la config
  const regularSeats = totalSeats - 5;
  const regularRows  = Math.ceil(regularSeats / seatsPerRow);

  const rows = [];

  for (let r = 1; r <= regularRows; r++) {
    const row = { rowNum: r, isLastRow: false, seats: [] };
    [...cfg.left.map(l => ({ id:`${r}${l}`, col: l, side:'left' })),
     ...cfg.right.map(l => ({ id:`${r}${l}`, col: l, side:'right' }))
    ].forEach(s => row.seats.push(s));
    rows.push(row);
  }

  // Dernière rangée — banquette 5 sièges
  const lastRow = regularRows + 1;
  rows.push({
    rowNum: lastRow,
    isLastRow: true,
    seats: lastRowSeats.map(l => ({ id:`${lastRow}${l}`, col: l, side:'full' })),
  });

  return rows;
}

/* ── Couleurs des états ─────────────────────────────────────── */
const SEAT_STYLES = {
  available: {
    bg: 'rgba(61,170,106,0.10)', border: 'rgba(61,170,106,0.35)',
    color: 'var(--green-l)', cursor: 'pointer',
    hoverBg: 'rgba(61,170,106,0.22)', label: 'Libre',
  },
  selected: {
    bg: 'rgba(61,170,106,0.85)', border: 'rgba(61,170,106,1)',
    color: '#fff', cursor: 'pointer',
    hoverBg: 'rgba(61,170,106,0.95)', label: 'Sélectionné',
  },
  occupied: {
    bg: 'rgba(220,50,50,0.15)', border: 'rgba(220,50,50,0.35)',
    color: 'rgba(220,50,50,0.7)', cursor: 'not-allowed',
    hoverBg: 'rgba(220,50,50,0.15)', label: 'Occupé',
  },
  pending: {
    bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)',
    color: 'rgba(245,158,11,0.8)', cursor: 'not-allowed',
    hoverBg: 'rgba(245,158,11,0.15)', label: 'En attente',
  },
  highlight: {
    bg: 'rgba(74,144,217,0.25)', border: 'rgba(74,144,217,0.7)',
    color: '#4A90D9', cursor: 'default',
    hoverBg: 'rgba(74,144,217,0.25)', label: 'Cette réservation',
  },
};

/* ── Composant Siège individuel ─────────────────────────────── */
function Seat({ seatId, status, isLastRow, onToggle, size = 36 }) {
  const [hovered, setHovered] = useState(false);
  const s = SEAT_STYLES[status] || SEAT_STYLES.available;
  const isClickable = status === 'available' || status === 'selected';

  return (
    <div
      onClick={() => isClickable && onToggle(seatId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Siège ${seatId} — ${s.label}`}
      style={{
        width: size, height: size + 4,
        borderRadius: isLastRow ? '6px 6px 10px 10px' : '8px 8px 4px 4px',
        background: hovered && isClickable ? s.hoverBg : s.bg,
        border: `1.5px solid ${s.border}`,
        color: s.color,
        cursor: s.cursor,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700,
        transition: 'all 0.15s ease',
        userSelect: 'none',
        position: 'relative',
        transform: hovered && isClickable ? 'translateY(-2px)' : 'none',
        boxShadow: status === 'selected'
          ? '0 4px 12px rgba(61,170,106,0.4)'
          : status === 'highlight'
          ? '0 4px 12px rgba(74,144,217,0.3)'
          : 'none',
      }}
    >
      {/* Icône dossier de siège */}
      <div style={{
        width: '75%', height: 5, borderRadius: '3px 3px 0 0',
        background: status === 'selected' ? 'rgba(255,255,255,0.3)'
          : status === 'occupied' ? 'rgba(220,50,50,0.3)'
          : status === 'pending' ? 'rgba(245,158,11,0.3)'
          : status === 'highlight' ? 'rgba(74,144,217,0.4)'
          : 'rgba(61,170,106,0.25)',
        marginBottom: 2,
      }} />
      <span style={{ fontSize: 8, lineHeight: 1 }}>{seatId}</span>
    </div>
  );
}

/* ── Légende ────────────────────────────────────────────────── */
function Legend({ showHighlight = false }) {
  const items = [
    { status:'available', label:'Libre' },
    { status:'selected',  label:'Sélectionné' },
    { status:'occupied',  label:'Occupé' },
    { status:'pending',   label:'En attente' },
    ...(showHighlight ? [{ status:'highlight', label:'Cette réservation' }] : []),
  ];
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center' }}>
      {items.map(({ status, label }) => {
        const s = SEAT_STYLES[status];
        return (
          <div key={status} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)' }}>
            <div style={{ width:14, height:14, borderRadius:4, background:s.bg, border:`1.5px solid ${s.border}` }} />
            {label}
          </div>
        );
      })}
    </div>
  );
}

/* ── Composant principal SeatPicker ─────────────────────────── */
export default function SeatPicker({
  layout = '2+3',
  totalSeats = 50,
  occupiedSeats = [],
  pendingSeats = [],
  selectedSeats = [],
  onSelect,
  maxSelect = 1,
  readOnly = false,
  highlightSeats = [],
}) {
  const rows = generateSeats(layout, totalSeats);

  const getStatus = (seatId) => {
    if (highlightSeats.includes(seatId)) return 'highlight';
    if (occupiedSeats.includes(seatId))  return 'occupied';
    if (pendingSeats.includes(seatId))   return 'pending';
    if (selectedSeats.includes(seatId))  return 'selected';
    return 'available';
  };

  const handleToggle = (seatId) => {
    if (readOnly) return;
    const isSelected = selectedSeats.includes(seatId);
    let next;
    if (isSelected) {
      next = selectedSeats.filter(s => s !== seatId);
    } else {
      if (selectedSeats.length >= maxSelect) {
        // Remplacer le premier sélectionné si max atteint
        next = [...selectedSeats.slice(1), seatId];
      } else {
        next = [...selectedSeats, seatId];
      }
    }
    onSelect?.(next);
  };

  const configs = {
    '2+2': { left: 2, right: 2 },
    '2+3': { left: 2, right: 3 },
    '2':   { left: 1, right: 1 },
  };
  const cfg = configs[layout] || configs['2+3'];
  const seatSize = layout === '2+3' ? 34 : 36;

  const freeCount     = rows.flatMap(r => r.seats).filter(s => getStatus(s.id) === 'available').length;
  const occupiedCount = occupiedSeats.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>

      {/* Stats rapides */}
      <div style={{ display:'flex', gap:12, width:'100%', maxWidth:340 }}>
        {[
          { label:'Libres', value: freeCount, color:'var(--green-l)' },
          { label:'Occupés', value: occupiedCount + pendingSeats.length, color:'var(--err)' },
          { label:'Sélectionnés', value: selectedSeats.length, color:'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex:1, background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16, color }}>{value}</div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Corps du bus */}
      <div style={{
        background:'var(--card)', border:'1.5px solid var(--border)',
        borderRadius:16, padding:'14px 16px', width:'100%', maxWidth:340,
        boxShadow:'0 4px 24px rgba(0,0,0,0.2)',
      }}>

        {/* Avant du bus — conducteur */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          padding:'8px 12px', marginBottom:14,
          background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
          borderRadius:10, fontSize:11, color:'var(--gold)', fontWeight:700,
        }}>
          <ArrowUp size={12} />
          <span>AVANT DU BUS — CONDUCTEUR</span>
          <ArrowUp size={12} />
        </div>

        {/* Numéros de colonnes */}
        <div style={{ display:'flex', justifyContent:'center', gap:4, marginBottom:6 }}>
          <div style={{ display:'flex', gap:4 }}>
            {['A','B'].slice(0, cfg.left).map(c => (
              <div key={c} style={{ width:seatSize, textAlign:'center', fontSize:9, color:'var(--muted)', fontWeight:700 }}>{c}</div>
            ))}
          </div>
          <div style={{ width:14 }} /> {/* Couloir */}
          <div style={{ display:'flex', gap:4 }}>
            {['C','D','E'].slice(0, cfg.right).map(c => (
              <div key={c} style={{ width:seatSize, textAlign:'center', fontSize:9, color:'var(--muted)', fontWeight:700 }}>{c}</div>
            ))}
          </div>
        </div>

        {/* Rangées */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {rows.map((row) => {
            const isLast = row.isLastRow;
            const leftSeats  = row.seats.filter(s => s.side === 'left');
            const rightSeats = row.seats.filter(s => s.side === 'right');
            const fullSeats  = row.seats.filter(s => s.side === 'full');

            return (
              <div key={row.rowNum} style={{ display:'flex', alignItems:'center', gap:4 }}>
                {/* Numéro de rangée */}
                <div style={{ width:18, textAlign:'center', fontSize:9, color:'var(--muted)', fontWeight:600, flexShrink:0 }}>
                  {row.rowNum}
                </div>

                {isLast ? (
                  /* Banquette complète */
                  <div style={{
                    flex:1, display:'flex', gap:4, justifyContent:'center',
                    padding:'4px 6px',
                    background:'rgba(61,170,106,0.04)',
                    border:'1px dashed rgba(61,170,106,0.15)',
                    borderRadius:8,
                  }}>
                    {fullSeats.map(s => (
                      <Seat key={s.id} seatId={s.id} status={getStatus(s.id)} isLastRow onToggle={handleToggle} size={seatSize} />
                    ))}
                  </div>
                ) : (
                  /* Rangée normale */
                  <div style={{ flex:1, display:'flex', gap:4, alignItems:'center', justifyContent:'center' }}>
                    {/* Gauche */}
                    <div style={{ display:'flex', gap:4 }}>
                      {leftSeats.map(s => (
                        <Seat key={s.id} seatId={s.id} status={getStatus(s.id)} isLastRow={false} onToggle={handleToggle} size={seatSize} />
                      ))}
                    </div>
                    {/* Couloir */}
                    <div style={{ width:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:2, height:seatSize, background:'rgba(255,255,255,0.04)', borderRadius:1 }} />
                    </div>
                    {/* Droite */}
                    <div style={{ display:'flex', gap:4 }}>
                      {rightSeats.map(s => (
                        <Seat key={s.id} seatId={s.id} status={getStatus(s.id)} isLastRow={false} onToggle={handleToggle} size={seatSize} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Arrière du bus */}
        <div style={{
          marginTop:10, padding:'6px', textAlign:'center',
          fontSize:10, color:'var(--muted)',
          borderTop:'1px solid var(--border)',
        }}>
          ↑ ARRIÈRE DU BUS
        </div>
      </div>

      {/* Sièges sélectionnés */}
      {!readOnly && selectedSeats.length > 0 && (
        <div style={{
          width:'100%', maxWidth:340,
          background:'rgba(61,170,106,0.08)', border:'1px solid rgba(61,170,106,0.25)',
          borderRadius:10, padding:'10px 14px',
          display:'flex', alignItems:'center', gap:10,
        }}>
          <User size={14} color="var(--green-l)" style={{ flexShrink:0 }} />
          <div style={{ fontSize:13, flex:1 }}>
            <span style={{ fontWeight:700, color:'var(--green-l)' }}>
              {selectedSeats.length === 1 ? 'Siège sélectionné' : 'Sièges sélectionnés'}
            </span>
            <div style={{ marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
              {selectedSeats.map(s => (
                <span key={s} style={{
                  background:'rgba(61,170,106,0.2)', border:'1px solid rgba(61,170,106,0.4)',
                  borderRadius:5, padding:'2px 8px', fontSize:12, fontWeight:800,
                  color:'var(--green-l)', fontFamily:'monospace',
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          {maxSelect > 1 && (
            <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>
              {selectedSeats.length}/{maxSelect}
            </span>
          )}
        </div>
      )}

      {/* Message si max atteint */}
      {!readOnly && maxSelect > 1 && selectedSeats.length >= maxSelect && (
        <div style={{ fontSize:11, color:'var(--gold)', display:'flex', alignItems:'center', gap:5 }}>
          <Users size={12} /> Maximum {maxSelect} siège{maxSelect > 1 ? 's' : ''} sélectionnable{maxSelect > 1 ? 's' : ''}
        </div>
      )}

      {/* Légende */}
      <Legend showHighlight={highlightSeats.length > 0} />
    </div>
  );
}