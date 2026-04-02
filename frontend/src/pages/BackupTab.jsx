import { useState, useRef } from 'react';
import axios from 'axios';

const API = 'https://nzela-production.up.railway.app/api';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function BackupTab({ onMsg }) {
  const now = new Date();
  const H = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // ── Backup JSON ──
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const fileRef = useRef(null);

  // ── Export + Reset mensuel ──
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exported, setExported]   = useState(false); // true après export réussi
  const [resetDone, setResetDone] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Export Excel via SheetJS ──
  const doExportExcel = async () => {
    setExporting(true);
    setExported(false);
    try {
      const r = await axios.get(`${API}/admin/export-month?year=${year}&month=${month}`, { headers: H() });
      const data = r.data;

      // Charger SheetJS dynamiquement
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');

      const wb = XLSX.utils.book_new();

      // ── Feuille 1 : Résumé par agence ──
      const summaryRows = [
        ['Agence', 'Confirmées', 'Annulées', 'Revenus bruts (FC)', `Commission Nzela (FC)`, 'À reverser (FC)'],
        ...data.summary.map(s => [
          s.agency_name, s.confirmed, s.cancelled,
          s.revenue, s.commission, s.a_reverser
        ]),
        [],
        ['TOTAL', data.total.confirmed, '', data.total.revenue, data.total.commission, data.total.revenue - data.total.commission],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch:22 },{ wch:14 },{ wch:12 },{ wch:22 },{ wch:22 },{ wch:18 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé mensuel');

      // ── Feuille 2 : Toutes les réservations ──
      const bookingRows = [
        ['Référence','Passager','Téléphone','Email','Passagers','Agence','Départ','Arrivée','Date voyage','Heure','Bus','Montant (FC)','Commission (FC)','Net agence (FC)','Statut','Paiement','Méthode','Transaction ID','Date réservation'],
        ...data.bookings.map(b => [
          b.reference, b.passenger_name, b.passenger_phone, b.passenger_email||'',
          b.passengers, b.agency_name, b.departure_city, b.arrival_city,
          b.departure_date, b.departure_time, b.bus_name||'',
          b.total_price, b.commission_amount||0, b.total_price - (b.commission_amount||0),
          b.status, b.payment_status, b.payment_method||'',
          b.transaction_id||'', b.created_at,
        ])
      ];
      const wsBookings = XLSX.utils.aoa_to_sheet(bookingRows);
      wsBookings['!cols'] = [
        {wch:14},{wch:24},{wch:18},{wch:24},{wch:10},{wch:18},
        {wch:12},{wch:12},{wch:14},{wch:8},{wch:10},
        {wch:16},{wch:16},{wch:16},{wch:12},{wch:12},{wch:12},{wch:20},{wch:22}
      ];
      XLSX.utils.book_append_sheet(wb, wsBookings, 'Réservations');

      // ── Feuille 3 : Une feuille par agence ──
      const agences = [...new Set(data.bookings.map(b => b.agency_name))];
      for (const agName of agences) {
        const agB = data.bookings.filter(b => b.agency_name === agName);
        const rows = [
          [`${agName} — ${MOIS[month-1]} ${year}`],
          [],
          ['Référence','Passager','Téléphone','Trajet','Date','Heure','Bus','Montant (FC)','Commission (FC)','Net agence (FC)','Statut','Méthode'],
          ...agB.map(b => [
            b.reference, b.passenger_name, b.passenger_phone,
            `${b.departure_city} → ${b.arrival_city}`,
            b.departure_date, b.departure_time, b.bus_name||'',
            b.total_price, b.commission_amount||0, b.total_price-(b.commission_amount||0),
            b.status, b.payment_method||'',
          ]),
          [],
          ['','','','','','','TOTAL',
            agB.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total_price,0),
            agB.filter(b=>b.status==='confirmed').reduce((s,b)=>s+(b.commission_amount||0),0),
            agB.filter(b=>b.status==='confirmed').reduce((s,b)=>s+b.total_price-(b.commission_amount||0),0),
          ],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:14},{wch:24},{wch:18},{wch:22},{wch:13},{wch:8},{wch:10},{wch:14},{wch:14},{wch:14},{wch:12},{wch:12}];
        // Nom de feuille max 31 chars
        const sheetName = agName.slice(0,28);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Télécharger
      const filename = `Nzela-${MOIS[month-1]}-${year}.xlsx`;
      XLSX.writeFile(wb, filename);

      onMsg(`Excel exporté avec succès : ${filename} 📊`, 'success');
      setExported(true);
    } catch(e) {
      console.error(e);
      onMsg("Erreur lors de l'export Excel", 'error');
    } finally { setExporting(false); }
  };

  // ── Reset mensuel ──
  const doReset = async () => {
    if (!exported) {
      onMsg("Exportez d'abord le fichier Excel avant de réinitialiser !", 'error');
      return;
    }
    setResetting(true);
    try {
      const r = await axios.post(`${API}/admin/reset-stats`, {
        year, month, confirm_reset: true
      }, { headers: H() });
      setResetDone(r.data);
      setExported(false);
      setConfirmReset(false);
      onMsg(`✅ ${r.data.deleted} réservations archivées. Statistiques réinitialisées.`, 'success');
    } catch(e) {
      onMsg(e.response?.data?.error || 'Erreur lors de la réinitialisation', 'error');
    } finally { setResetting(false); }
  };

  // ── Backup JSON ──
  const doBackup = async () => {
    setBackupLoading(true);
    try {
      const r = await axios.get(`${API}/admin/backup`, { headers: H() });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `nzela-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
      URL.revokeObjectURL(url);
      onMsg('Backup JSON téléchargé 📦', 'success');
    } catch { onMsg('Erreur backup', 'error'); }
    finally { setBackupLoading(false); }
  };

  const doRestore = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!confirm(`Restaurer "${file.name}" ?\n\nCela remplace TOUTES les données actuelles.`)) { e.target.value=''; return; }
    setRestoreLoading(true);
    try {
      const text = await file.text(); const data = JSON.parse(text);
      await axios.post(`${API}/admin/restore`, data, { headers: H() });
      onMsg('Base de données restaurée ♻️', 'success');
    } catch(err) { onMsg(err.response?.data?.error || 'Fichier invalide', 'error'); }
    finally { setRestoreLoading(false); e.target.value=''; }
  };

  const years = [now.getFullYear()-1, now.getFullYear()];

  return (
    <div style={{ maxWidth: 600 }}>

      {/* ══ EXPORT + RESET MENSUEL ══ */}
      <div className="glass p-20 fade-in" style={{ marginBottom: 16 }}>
        <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16, marginBottom:4 }}>📊 Export mensuel & Réinitialisation</div>
        <p style={{ color:'var(--muted)', fontSize:13, marginBottom:18, lineHeight:1.6 }}>
          À la fin de chaque mois, exportez le rapport complet en Excel puis réinitialisez les statistiques pour garder votre dashboard lisible.
        </p>

        {/* Sélecteur mois/année */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <label className="input-label" style={{ display:'block', marginBottom:5 }}>Mois</label>
            <select className="input-field" value={month} onChange={e=>{setMonth(Number(e.target.value));setExported(false);setResetDone(null);}}>
              {MOIS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label className="input-label" style={{ display:'block', marginBottom:5 }}>Année</label>
            <select className="input-field" value={year} onChange={e=>{setYear(Number(e.target.value));setExported(false);setResetDone(null);}}>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Étapes visuelles */}
        <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:16 }}>
          {[
            { n:1, label:'Exporter Excel', done: exported },
            { n:2, label:'Réinitialiser', done: !!resetDone },
          ].map((step, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex: i<1 ? '0 0 auto' : 1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: step.done ? 'var(--green)' : 'var(--card)', border:`1px solid ${step.done?'var(--green)':'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: step.done ? '#fff' : 'var(--muted)', flexShrink:0 }}>
                  {step.done ? '✓' : step.n}
                </div>
                <span style={{ fontSize:12, color: step.done ? 'var(--green-l)' : 'var(--muted)', fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
              </div>
              {i < 1 && <div style={{ flex:1, height:2, background:'var(--border)', margin:'0 12px' }}/>}
            </div>
          ))}
        </div>

        {/* Bouton Export */}
        <button className="btn btn-primary" onClick={doExportExcel} disabled={exporting}
          style={{ width:'100%', justifyContent:'center', height:42, fontSize:13, marginBottom:10 }}>
          {exporting
            ? <><div className="spinner"/>Génération Excel…</>
            : exported
              ? <>✓ Excel exporté — réexporter si besoin</>
              : <>📥 Exporter {MOIS[month-1]} {year} en Excel</>
          }
        </button>

        {/* Bouton Reset — visible seulement après export */}
        {exported && !resetDone && (
          <>
            {!confirmReset ? (
              <div style={{ background:'rgba(240,80,80,0.06)', border:'1px solid rgba(240,80,80,0.2)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:13, color:'var(--muted)', marginBottom:10, lineHeight:1.6 }}>
                  ✅ Excel téléchargé. Vous pouvez maintenant réinitialiser les statistiques de <strong style={{ color:'var(--text)' }}>{MOIS[month-1]} {year}</strong>.
                  <br/>Les réservations confirmées et annulées de ce mois seront archivées.
                </div>
                <button className="btn btn-danger" onClick={()=>setConfirmReset(true)}
                  style={{ width:'100%', justifyContent:'center', height:38, fontSize:13 }}>
                  🗑️ Réinitialiser les stats de {MOIS[month-1]} {year}
                </button>
              </div>
            ) : (
              <div style={{ background:'rgba(240,80,80,0.1)', border:'2px solid rgba(240,80,80,0.4)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14, color:'var(--err)', marginBottom:8 }}>⚠️ Confirmation finale</div>
                <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.6 }}>
                  Vous allez supprimer définitivement les réservations de <strong style={{ color:'var(--err)' }}>{MOIS[month-1]} {year}</strong> du tableau de bord.<br/>
                  Cette action est <strong style={{ color:'var(--err)' }}>irréversible</strong>. L'Excel est votre seule archive.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:13 }} onClick={()=>setConfirmReset(false)}>Annuler</button>
                  <button className="btn btn-danger" style={{ flex:1, justifyContent:'center', height:38, fontSize:13 }} disabled={resetting} onClick={doReset}>
                    {resetting ? <><div className="spinner"/>Réinitialisation…</> : '✓ Confirmer la réinitialisation'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Succès reset */}
        {resetDone && (
          <div style={{ background:'rgba(61,170,106,0.07)', border:'1px solid rgba(61,170,106,0.2)', borderRadius:10, padding:'12px 14px', marginTop:10 }}>
            <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13, color:'var(--green-l)', marginBottom:4 }}>✓ Réinitialisation effectuée</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{resetDone.deleted} réservations de {MOIS[month-1]} {year} ont été archivées dans votre fichier Excel.</div>
          </div>
        )}
      </div>

      {/* ══ BACKUP JSON ══ */}
      <div className="glass p-20 fade-in fade-in-2" style={{ marginBottom:16 }}>
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, marginBottom:4 }}>📦 Backup complet (JSON)</div>
        <p style={{ color:'var(--muted)', fontSize:13, marginBottom:14, lineHeight:1.6 }}>
          Sauvegarde intégrale de la base : agences, bus, voyages, réservations, galerie. À faire avant chaque mise à jour du code.
        </p>
        <button className="btn btn-primary" onClick={doBackup} disabled={backupLoading}
          style={{ width:'100%', justifyContent:'center', height:40, fontSize:13 }}>
          {backupLoading ? <><div className="spinner"/>Export…</> : <>📥 Télécharger le backup JSON</>}
        </button>
      </div>

      {/* ══ RESTORE ══ */}
      <div className="glass p-20 fade-in fade-in-3" style={{ marginBottom:16 }}>
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, marginBottom:4 }}>♻️ Restaurer depuis un backup</div>
        <p style={{ color:'var(--muted)', fontSize:13, marginBottom:10, lineHeight:1.6 }}>
          Restaure toutes les données depuis un fichier backup <code style={{ background:'var(--card)', padding:'1px 6px', borderRadius:4, fontSize:12 }}>.json</code>.
        </p>
        <div style={{ background:'rgba(240,80,80,0.06)', border:'1px solid rgba(240,80,80,0.15)', borderRadius:9, padding:'10px 13px', marginBottom:14, fontSize:12, color:'var(--muted)' }}>
          ⚠️ Remplace <strong style={{ color:'var(--text)' }}>toutes les données</strong> actuelles. Irréversible sans un nouveau backup.
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={doRestore}/>
        <button className="btn btn-danger" onClick={()=>fileRef.current?.click()} disabled={restoreLoading}
          style={{ width:'100%', justifyContent:'center', height:40, fontSize:13, borderRadius:'var(--r)' }}>
          {restoreLoading ? <><div className="spinner"/>Restauration…</> : <>📂 Sélectionner un fichier backup</>}
        </button>
      </div>

      {/* ══ RECOMMANDATIONS ══ */}
      <div className="glass p-20 fade-in fade-in-4">
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14, marginBottom:12 }}>📅 Routine recommandée</div>
        {[
          ['🟢','1er de chaque mois','Exporter Excel du mois précédent → Réinitialiser'],
          ['🟡','Chaque lundi','Backup JSON complet + Reversements aux agences'],
          ['🔵','Avant mise à jour code','Toujours backup JSON avant de modifier l\'application'],
          ['🔵','Stockage sécurisé','Google Drive, Dropbox ou disque dur externe'],
        ].map(([ico,t,d])=>(
          <div key={t} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{ico}</span>
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{t}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
