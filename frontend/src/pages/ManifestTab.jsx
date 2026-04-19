import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'https://nzela-production-086a.up.railway.app/api';

function getAuth() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
}

function Inp({ label, children }) {
  return <div className="input-group"><label className="input-label">{label}</label>{children}</div>;
}

// ── Génère et télécharge le PDF ────────────────────────────────
async function exportPDF(trip, bookings, agencyName) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();

  // Entête
  doc.setFillColor(42, 125, 79);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('NZELA — Manifeste de bord', 14, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${agencyName}`, 14, 20);

  // Infos voyage
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Informations du voyage', 14, 36);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const info = [
    [`Trajet`, `${trip.departure_city} → ${trip.arrival_city}`],
    [`Date`, new Date(trip.departure_date).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})],
    [`Heure départ`, trip.departure_time],
    [`Bus`, trip.bus_name || '—'],
    [`Places totales`, `${trip.total_seats}`],
    [`Réservées`, `${bookings.length}`],
    [`Présents`, `${bookings.filter(b=>b.boarding_status==='present').length}`],
    [`Absents`, `${bookings.filter(b=>b.boarding_status==='absent').length}`],
  ];
  let y = 42;
  info.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(k + ' :', 14, y);
    doc.setFont('helvetica', 'normal'); doc.text(v, 60, y);
    y += 6;
  });

  // Tableau passagers
  autoTable(doc, {
    startY: y + 6,
    head: [['#', 'Référence', 'Passager', 'Téléphone', 'Places', 'Montant (FC)', 'Statut']],
    body: bookings.map((b, i) => [
      i + 1,
      b.reference,
      b.passenger_name,
      b.passenger_phone,
      b.passengers,
      Number(b.total_price).toLocaleString('fr-FR'),
      b.boarding_status === 'present' ? '✓ Présent' : b.boarding_status === 'absent' ? '✗ Absent' : '⏳ En attente',
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [42, 125, 79], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 28 },
      6: { cellWidth: 24 },
    },
  });

  // Pied de page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Nzela RDC · Généré le ${new Date().toLocaleDateString('fr-FR')} · Page ${i}/${pageCount}`, 14, 290);
  }

  doc.save(`manifeste_${trip.departure_city}_${trip.arrival_city}_${trip.departure_date}.pdf`);
}

// ── Génère et télécharge Excel ─────────────────────────────────
async function exportExcel(trip, bookings, agencyName) {
  const XLSX = await import('xlsx');
  const rows = [
    [`NZELA — Manifeste de bord`],
    [`Agence : ${agencyName}`],
    [],
    [`Trajet : ${trip.departure_city} → ${trip.arrival_city}`],
    [`Date : ${trip.departure_date}`],
    [`Heure : ${trip.departure_time}`],
    [`Bus : ${trip.bus_name || '—'}`],
    [`Total réservés : ${bookings.length}`],
    [`Présents : ${bookings.filter(b=>b.boarding_status==='present').length}`],
    [`Absents : ${bookings.filter(b=>b.boarding_status==='absent').length}`],
    [],
    ['#', 'Référence', 'Passager', 'Téléphone', 'Places', 'Montant (FC)', 'Paiement', 'Statut embarquement'],
    ...bookings.map((b, i) => [
      i + 1,
      b.reference,
      b.passenger_name,
      b.passenger_phone,
      b.passengers,
      b.total_price,
      b.payment_method === 'cash' ? 'Espèces' : 'Mobile Money',
      b.boarding_status === 'present' ? 'Présent' : b.boarding_status === 'absent' ? 'Absent' : 'En attente',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [8,20,24,18,8,14,14,18].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Manifeste');
  XLSX.writeFile(wb, `manifeste_${trip.departure_city}_${trip.arrival_city}_${trip.departure_date}.xlsx`);
}

export default function ManifestTab({ agencyName, showToast }) {
  const { headers } = getAuth();
  const [trips, setTrips]         = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [manifest, setManifest]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [walkinModal, setWalkinModal] = useState(false);
  const [walkinForm, setWalkinForm]   = useState({ passenger_name:'', passenger_phone:'', passengers:1, payment_method:'cash' });
  const [savingWalkin, setSavingWalkin] = useState(false);
  const [exporting, setExporting] = useState('');

  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Charge les voyages du jour
  useEffect(() => {
    axios.get(`${API}/agency/manifest/trips`, { headers })
      .then(r => setTrips(Array.isArray(r.data) ? r.data : []))
      .catch(() => showToast('Erreur chargement voyages', 'error'));
  }, []);

  // Charge le manifeste d'un voyage
  const loadManifest = async (trip) => {
    setSelectedTrip(trip);
    setLoading(true);
    try {
      const r = await axios.get(`${API}/agency/manifest/${trip.id}`, { headers });
      setManifest(r.data);
    } catch { showToast('Erreur chargement manifeste', 'error'); }
    finally { setLoading(false); }
  };

  // Change le statut d'embarquement
  const updateBoarding = async (bookingId, status) => {
    try {
      await axios.patch(`${API}/agency/bookings/${bookingId}/board`, { boarding_status: status }, { headers });
      setManifest(m => ({
        ...m,
        bookings: m.bookings.map(b => b.id === bookingId ? { ...b, boarding_status: status } : b),
      }));
    } catch { showToast('Erreur mise à jour', 'error'); }
  };

  // Enregistrement walk-in
  const doWalkin = async () => {
    if (!walkinForm.passenger_name || !walkinForm.passenger_phone)
      return showToast('Nom et téléphone requis', 'error');
    setSavingWalkin(true);
    try {
      await axios.post(`${API}/agency/bookings/walkin`, {
        trip_id: selectedTrip.id,
        ...walkinForm,
      }, { headers });
      showToast('Passager enregistré ✓', 'success');
      setWalkinModal(false);
      setWalkinForm({ passenger_name:'', passenger_phone:'', passengers:1, payment_method:'cash' });
      loadManifest(selectedTrip);
    } catch(e) { showToast(e.response?.data?.error || 'Erreur', 'error'); }
    finally { setSavingWalkin(false); }
  };

  const statColor = s => s === 'present' ? 'var(--ok)' : s === 'absent' ? 'var(--err)' : 'var(--gold)';
  const statLabel = s => s === 'present' ? '✓ Présent' : s === 'absent' ? '✗ Absent' : '⏳ Attente';
  const statBg    = s => s === 'present' ? 'rgba(82,200,130,0.1)' : s === 'absent' ? 'rgba(240,80,80,0.1)' : 'rgba(245,166,35,0.1)';

  // ── VUE LISTE DES VOYAGES ──────────────────────────────────
  if (!selectedTrip) return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--font)', fontSize:14, fontWeight:700, color:'var(--muted)', marginBottom:4 }}>
          📅 {today}
        </div>
        <p style={{ fontSize:13, color:'var(--muted)' }}>
          Sélectionnez un voyage pour ouvrir son manifeste de bord.
        </p>
      </div>

      {trips.length === 0
        ? <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:700, marginBottom:8 }}>Aucun voyage aujourd'hui</div>
            <div style={{ fontSize:13 }}>Les voyages programmés pour aujourd'hui apparaîtront ici.</div>
          </div>
        : <div style={{ display:'grid', gap:10 }}>
            {trips.map(t => (
              <div key={t.id} className="glass" style={{ padding:'16px 20px', cursor:'pointer', transition:'var(--ease)' }}
                onClick={() => loadManifest(t)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(61,170,106,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{t.departure_city}</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'var(--green-l)' }}>{t.departure_time}</div>
                    </div>
                    <div style={{ color:'var(--muted)', fontSize:20 }}>→</div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{t.arrival_city}</div>
                      {t.bus_name && <div style={{ fontSize:11, color:'var(--muted)' }}>🚌 {t.bus_name}</div>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18, color:'var(--gold)' }}>{t.booked_count || 0}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>réservés</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18 }}>{t.available_seats}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>disponibles</div>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize:12, padding:'7px 14px' }}>
                      Ouvrir →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );

  // ── VUE MANIFESTE ──────────────────────────────────────────
  const bookings = manifest?.bookings || [];
  const present = bookings.filter(b => b.boarding_status === 'present').length;
  const absent  = bookings.filter(b => b.boarding_status === 'absent').length;
  const pending = bookings.filter(b => !b.boarding_status || b.boarding_status === 'pending').length;

  return (
    <div>
      {/* Bouton retour */}
      <button className="btn btn-ghost" style={{ fontSize:12, marginBottom:16 }}
        onClick={() => { setSelectedTrip(null); setManifest(null); }}>
        ← Retour aux voyages
      </button>

      {/* Entête voyage */}
      <div className="glass p-16" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:20 }}>
              {selectedTrip.departure_city} → {selectedTrip.arrival_city}
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:3 }}>
              {new Date(selectedTrip.departure_date).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
              &nbsp;·&nbsp;{selectedTrip.departure_time}
              {selectedTrip.bus_name && <>&nbsp;·&nbsp;🚌 {selectedTrip.bus_name}</>}
            </div>
          </div>
          {/* Actions */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }}
              onClick={() => setWalkinModal(true)}>
              ➕ Sur place
            </button>
            <button className="btn btn-ghost" style={{ fontSize:12, color:'var(--green-l)' }}
              disabled={exporting==='pdf'}
              onClick={async () => {
                setExporting('pdf');
                await exportPDF(selectedTrip, bookings, agencyName);
                setExporting('');
              }}>
              {exporting==='pdf' ? '⏳…' : '📄 PDF'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize:12, color:'var(--gold)' }}
              disabled={exporting==='excel'}
              onClick={async () => {
                setExporting('excel');
                await exportExcel(selectedTrip, bookings, agencyName);
                setExporting('');
              }}>
              {exporting==='excel' ? '⏳…' : '📊 Excel'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
          {[
            { label:'Total', value:bookings.length, color:'var(--text)' },
            { label:'✓ Présents', value:present, color:'var(--ok)' },
            { label:'✗ Absents', value:absent, color:'var(--err)' },
            { label:'⏳ Attente', value:pending, color:'var(--gold)' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 16px', textAlign:'center', minWidth:80 }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:20, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          {/* Barre de progression embarquement */}
          <div style={{ flex:1, minWidth:160, background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 16px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted)', marginBottom:6 }}>
              <span>Embarquement</span>
              <span style={{ color:'var(--green-l)', fontWeight:700 }}>
                {bookings.length > 0 ? Math.round((present/bookings.length)*100) : 0}%
              </span>
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,var(--green-d),var(--green-l))', width: bookings.length > 0 ? `${(present/bookings.length)*100}%` : '0%', transition:'width .5s ease' }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Liste passagers */}
      {loading
        ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ width:32, height:32, margin:'0 auto', borderWidth:2.5 }}/></div>
        : bookings.length === 0
          ? <div style={{ textAlign:'center', padding:'40px', color:'var(--muted)' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
              <div>Aucune réservation confirmée sur ce voyage.</div>
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setWalkinModal(true)}>
                ➕ Enregistrer un passager sur place
              </button>
            </div>
          : <div style={{ display:'grid', gap:8 }}>
              {bookings.map((b, i) => (
                <div key={b.id} className="glass" style={{ padding:'12px 16px', borderLeft:`3px solid ${statColor(b.boarding_status)}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                    {/* Infos passager */}
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font)', fontWeight:800, fontSize:13, color:'var(--green-l)', flexShrink:0 }}>
                        {i+1}
                      </div>
                      <div>
                        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>{b.passenger_name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>
                          {b.passenger_phone} &nbsp;·&nbsp;
                          <code style={{ background:'var(--green-bg)', padding:'1px 6px', borderRadius:4, fontSize:11, color:'var(--green-l)' }}>{b.reference}</code>
                          &nbsp;·&nbsp; {b.passengers} place{b.passengers>1?'s':''}
                        </div>
                      </div>
                    </div>

                    {/* Boutons statut */}
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ fontSize:11, color:'var(--muted)', marginRight:4 }}>
                        {b.payment_method==='cash'?'💵 Espèces':'📱 Mobile'}
                      </div>
                      {['present','pending','absent'].map(s => (
                        <button key={s} onClick={() => updateBoarding(b.id, s)}
                          style={{
                            padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                            cursor:'pointer', transition:'var(--ease)',
                            background: b.boarding_status===s ? statBg(s) : 'var(--card)',
                            border: `1px solid ${b.boarding_status===s ? statColor(s) : 'var(--border)'}`,
                            color: b.boarding_status===s ? statColor(s) : 'var(--muted)',
                          }}>
                          {statLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }

      {/* Modal walk-in */}
      {walkinModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setWalkinModal(false)}>
          <div className="modal-box" style={{ maxWidth:440 }}>
            <div className="modal-header">
              <div>
                <h2>➕ Passager sur place</h2>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                  {selectedTrip.departure_city} → {selectedTrip.arrival_city} · {selectedTrip.departure_time}
                </div>
              </div>
              <button className="modal-close" onClick={() => setWalkinModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <Inp label="Nom complet *">
                <input className="input-field" placeholder="Jean Mukendi" value={walkinForm.passenger_name}
                  onChange={e=>setWalkinForm({...walkinForm,passenger_name:e.target.value})} />
              </Inp>
              <Inp label="Téléphone *">
                <input className="input-field" placeholder="+243 81 234 5678" value={walkinForm.passenger_phone}
                  onChange={e=>setWalkinForm({...walkinForm,passenger_phone:e.target.value})} />
              </Inp>
              <div className="grid-2">
                <Inp label="Places">
                  <select className="input-field" value={walkinForm.passengers}
                    onChange={e=>setWalkinForm({...walkinForm,passengers:parseInt(e.target.value)})}>
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} place{n>1?'s':''}</option>)}
                  </select>
                </Inp>
                <Inp label="Paiement">
                  <select className="input-field" value={walkinForm.payment_method}
                    onChange={e=>setWalkinForm({...walkinForm,payment_method:e.target.value})}>
                    <option value="cash">💵 Espèces</option>
                    <option value="mobilemoney">📱 Mobile Money</option>
                  </select>
                </Inp>
              </div>
              {/* Aperçu montant */}
              <div style={{ background:'var(--green-bg)', border:'1px solid rgba(61,170,106,0.15)', borderRadius:9, padding:'10px 13px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'var(--muted)' }}>Montant à encaisser</span>
                  <span style={{ fontFamily:'var(--font)', fontWeight:800, color:'var(--gold)', fontSize:16 }}>
                    {Number(selectedTrip.price * walkinForm.passengers).toLocaleString('fr-FR')} FC
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setWalkinModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={doWalkin} disabled={savingWalkin}>
                {savingWalkin ? <><div className="spinner"/>Enregistrement…</> : '✓ Enregistrer & Embarquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
