// src/utils/rapportVenteHtml.ts
// ============================================================================
// Génération du HTML imprimable d'un rapport de vente / de poste.
// Séparé du composant afin d'être réutilisable :
//   - à la clôture du poste (GestionSession),
//   - à la demande depuis l'écran Rapports de vente,
//   - pour l'export PDF via la boîte d'impression du navigateur.
// Le format papier (A4, A5, A6, B5, B6...) est appliqué au moment de la
// génération et le corps s'adapte automatiquement.
// ============================================================================

import { RapportVente } from '../services/rapportVenteService';
import { libelleModePaiement } from '../services/journalCaisseService';
import {
  construireCssImpression,
  FormatPapier,
  OrientationPapier,
} from './printFormats';

const fmt = (v: number | null | undefined): string =>
  (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const fmtDate = (d?: string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('fr-FR') + ' ' +
    dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const echapper = (s: any): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export interface OptionsRapportHtml {
  format?: FormatPapier;
  orientation?: OrientationPapier;
  /** Nom du commerce affiché en en-tête */
  nomCommerce?: string;
  /** Inclut le détail ligne à ligne des opérations */
  avecDetail?: boolean;
}

export const construireRapportHtml = (
  rapport: RapportVente,
  options: OptionsRapportHtml = {}
): string => {
  const format = options.format || 'A4';
  const avecDetail = options.avecDetail !== false;
  const v = rapport.ventilation;

  // Solde courant reconstitué ligne à ligne, en partant du report.
  let soldeCourant = rapport.report;
  const lignes = rapport.mouvements.map((m, i) => {
    const estEntree = m.type_mouvement !== 'SORTIE';
    soldeCourant += estEntree ? (Number(m.montant) || 0) : -(Number(m.montant) || 0);
    return `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${fmtDate(m.date_journal)}</td>
        <td>${echapper(m.designation)}
          ${m.reference ? `<div class="ref">Réf : ${echapper(m.reference)}</div>` : ''}
        </td>
        <td style="text-align:center">${estEntree ? 'Entrée' : 'Sortie'}</td>
        <td style="text-align:center">${m.mode_paiement_detail || libelleModePaiement(m.mode_paiement)}</td>
        <td style="text-align:right;color:${estEntree ? '#1a8a1a' : '#c0392b'}">
          ${estEntree ? '+' : '−'} ${fmt(m.montant)}
        </td>
        <td style="text-align:right;font-weight:600">${fmt(soldeCourant)}</td>
      </tr>`;
  }).join('');

  const ligneReport = `
    <tr style="background:#f4f6fa">
      <td></td>
      <td>${fmtDate(rapport.dateOuverture)}</td>
      <td><strong>REPORT (fond de caisse reçu)</strong></td>
      <td></td><td></td><td></td>
      <td style="text-align:right;font-weight:700">${fmt(rapport.report)}</td>
    </tr>`;

  const ecart = rapport.ecart;
  const blocEcart = rapport.soldeDeclare == null ? '' : `
    <div class="ecart ${ecart === 0 ? 'ok' : (ecart || 0) > 0 ? 'plus' : 'moins'}">
      ${ecart === 0
        ? 'Caisse correcte ✓'
        : (ecart || 0) > 0
          ? `Excédent de ${fmt(Math.abs(ecart || 0))} FCFA`
          : `Manquant de ${fmt(Math.abs(ecart || 0))} FCFA`}
    </div>`;

  const bandeauProvisoire = rapport.provisoire ? `
    <div class="provisoire">
      ⚠ RAPPORT PROVISOIRE — le poste n'est pas encore clôturé.
      Les montants peuvent encore évoluer.
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Rapport de vente${rapport.codeSession ? ` — ${rapport.codeSession}` : ''}</title>
<style>
  * { box-sizing: border-box; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; }
  body { margin: 0; padding: 10mm; background: #fff; color: #1a1a2e; }
  .print-area { margin: 0 auto; }
  h1 { font-size: 17px; text-align: center; margin: 0 0 4px; color: #0d1b3e; letter-spacing: 1px; }
  .marque { text-align: center; font-size: 20px; font-weight: 700; color: #1b365d; letter-spacing: 2px; }
  .sub { text-align: center; color: #555; margin-bottom: 12px; font-size: 11px; }
  .provisoire {
    background: #fff8e1; border: 1px solid #f0c36d; color: #8a6d1a;
    padding: 6px 10px; border-radius: 4px; margin-bottom: 10px;
    font-weight: 600; text-align: center; font-size: 11px;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1b365d; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px;
       text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eceff4; font-size: 11px; }
  .ref { font-size: 9px; color: #8a8aa0; margin-top: 2px; }
  .infos { width: 100%; margin-bottom: 8px; }
  .infos td { border: none; padding: 3px 0; }
  .recap { margin-top: 12px; border: 1px solid #dde2ea; border-radius: 6px; padding: 10px 12px; }
  .recap .titre { font-weight: 700; color: #1b365d; margin-bottom: 6px;
                  text-transform: uppercase; font-size: 11px; letter-spacing: .5px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .row.total { font-weight: 700; border-top: 1px solid #ccd3dd; margin-top: 5px; padding-top: 5px; }
  .point { margin-top: 10px; border: 2px solid #1b365d; border-radius: 6px; padding: 10px 12px; }
  .point .row.total { border-top: 1px solid #1b365d; }
  .alerte { font-size: 9px; color: #8a6d1a; font-style: italic; margin-top: 5px; }
  .ecart { margin-top: 10px; padding: 7px 12px; border-radius: 5px; font-weight: 700; font-size: 11px; }
  .ecart.ok { background: #d3f9d8; color: #2b8a3e; }
  .ecart.plus { background: #d0ebff; color: #1864ab; }
  .ecart.moins { background: #ffe3e3; color: #c92a2a; }
  .signatures { margin-top: 28px; display: flex; justify-content: space-between; }
  .sig { width: 45%; text-align: center; }
  .sig .ligne { border-top: 1px solid #333; margin-top: 32px; padding-top: 4px; font-size: 10px; }
  .pied { margin-top: 16px; text-align: center; font-size: 9px; color: #a0a0c0;
          border-top: 1px solid #eef0f4; padding-top: 8px; }

  /* Format papier choisi par l'utilisateur + pagination séquentielle */
  ${construireCssImpression({ format, orientation: options.orientation, racine: '.print-area' })}
</style>
</head>
<body>
<div class="print-area">
  ${options.nomCommerce ? `<div class="marque">${echapper(options.nomCommerce)}</div>` : ''}
  <h1>RAPPORT DE VENTE${rapport.codeSession ? ' — FIN DE POSTE' : ''}</h1>
  <div class="sub">
    ${rapport.codeSession ? `${echapper(rapport.codeSession)} — ` : ''}
    Opérateur : <strong>${echapper(rapport.operateurNom)}</strong><br />
    Période : ${echapper(rapport.libellePeriode)}
  </div>

  ${bandeauProvisoire}

  <table class="infos">
    <tr>
      <td>Début de période</td>
      <td style="text-align:right"><strong>${fmtDate(rapport.dateOuverture)}</strong></td>
    </tr>
    <tr>
      <td>Fin de période</td>
      <td style="text-align:right"><strong>${rapport.dateFermeture ? fmtDate(rapport.dateFermeture) : 'En cours'}</strong></td>
    </tr>
    <tr>
      <td>Fond de caisse reçu (report)</td>
      <td style="text-align:right"><strong>${fmt(rapport.report)} FCFA</strong></td>
    </tr>
  </table>

  <div class="recap">
    <div class="titre">Récapitulatif des encaissements</div>
    <div class="row"><span>Ventes comptoir</span><span style="color:#1a8a1a">+ ${fmt(rapport.totalVentesComptoir)} FCFA</span></div>
    <div class="row"><span>Règlements de factures</span><span style="color:#1a8a1a">+ ${fmt(rapport.totalReglements)} FCFA</span></div>
    <div class="row"><span>Décomptes revendeurs</span><span style="color:#1a8a1a">+ ${fmt(rapport.totalDecomptes)} FCFA</span></div>
    <div class="row total"><span>Total encaissements</span><span style="color:#1a8a1a">+ ${fmt(rapport.totalEntrees)} FCFA</span></div>
    <div class="row" style="margin-top:6px"><span>Charges / dépenses</span><span style="color:#c0392b">− ${fmt(rapport.totalCharges)} FCFA</span></div>
    <div class="row total"><span>Total décaissements</span><span style="color:#c0392b">− ${fmt(rapport.totalSorties)} FCFA</span></div>
    <div class="row total"><span>Report (fond de caisse)</span><span>${fmt(rapport.report)} FCFA</span></div>
    <div class="row total"><span>TOTAL GÉNÉRAL (report + mouvements)</span><span>${fmt(rapport.soldeCalcule)} FCFA</span></div>
  </div>

  <!-- Point de caisse : ventilation automatique demandée pour le point -->
  <div class="point">
    <div class="titre">❖ Point de caisse</div>
    <div class="row"><span>Montant total des opérations</span><span><strong>${fmt(v.total)} FCFA</strong></span></div>
    <div class="row"><span>Transferts — Mobile Money</span><span style="color:#6c5ce7">${fmt(v.mobileMoney)} FCFA</span></div>
    ${v.virements !== 0 ? `<div class="row"><span>Transferts — Virements</span><span style="color:#6c5ce7">${fmt(v.virements)} FCFA</span></div>` : ''}
    ${v.cheques !== 0 ? `<div class="row"><span>Chèques</span><span>${fmt(v.cheques)} FCFA</span></div>` : ''}
    ${v.autres !== 0 ? `<div class="row"><span>Autres modes</span><span>${fmt(v.autres)} FCFA</span></div>` : ''}
    ${v.nbNonPrecise > 0 ? `<div class="row"><span>Mode non précisé (${v.nbNonPrecise} opération(s))</span><span style="color:#b8860b">${fmt(v.nonPrecise)} FCFA</span></div>` : ''}
    <div class="row total">
      <span>ESPÈCES EN CAISSE (comptage attendu)</span>
      <span style="color:#1a8a1a">${fmt(rapport.especesAttendues)} FCFA</span>
    </div>
    ${rapport.soldeDeclare != null ? `
    <div class="row total"><span>Solde déclaré (comptage physique)</span><span>${fmt(rapport.soldeDeclare)} FCFA</span></div>` : ''}
    ${v.nbNonPrecise > 0 ? `
    <div class="alerte">
      ⚠ ${v.nbNonPrecise} opération(s) enregistrée(s) sans mode de paiement
      (antérieures au suivi des modes). Elles ne sont comptées ni en espèces
      ni en transferts et doivent être régularisées manuellement.
    </div>` : ''}
  </div>

  ${blocEcart}

  ${avecDetail ? `
  <h3 style="margin-top:16px;font-size:12px;color:#1b365d">Détail des opérations</h3>
  <table>
    <thead>
      <tr>
        <th style="width:5%;text-align:center">N°</th>
        <th style="width:15%">Date</th>
        <th style="width:30%">Désignation</th>
        <th style="width:10%;text-align:center">Type</th>
        <th style="width:13%;text-align:center">Mode</th>
        <th style="width:14%;text-align:right">Montant</th>
        <th style="width:13%;text-align:right">Solde</th>
      </tr>
    </thead>
    <tbody>
      ${ligneReport}
      ${lignes || `<tr><td colspan="7" style="text-align:center;padding:24px;color:#a0a0c0">Aucune opération sur cette période</td></tr>`}
    </tbody>
  </table>` : ''}

  <div class="signatures">
    <div class="sig"><div class="ligne">Signature de l'opérateur<br />${echapper(rapport.operateurNom)}</div></div>
    <div class="sig"><div class="ligne">Visa du responsable</div></div>
  </div>

  <div class="pied">
    Document généré le ${new Date().toLocaleString('fr-FR')} — Format ${format}
  </div>
</div>
</body>
</html>`;
};

/**
 * Ouvre le rapport dans une fenêtre d'impression au format demandé.
 */
export const imprimerRapportVente = (
  rapport: RapportVente,
  options: OptionsRapportHtml = {}
): void => {
  const html = construireRapportHtml(rapport, options);
  const win = window.open('', '_blank', 'width=980,height=760,scrollbars=yes');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // Laisser le temps au rendu avant d'ouvrir la boîte d'impression
  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* ignore */ }
  }, 350);
};

export default construireRapportHtml;
