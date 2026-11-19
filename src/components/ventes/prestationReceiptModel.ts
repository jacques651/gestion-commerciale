import type { TransactionContext, TransactionRef, TransactionServiceContract, TransactionView } from '../../services/transactionContracts.ts';
import type { AtelierConfig } from '../../hooks/useAtelierConfig.ts';

export type PrestationReceiptView = Extract<TransactionView, { origin: 'prestation' }>;
export type ReceiptCommerce = Pick<AtelierConfig, 'nom_atelier' | 'telephone' | 'adresse' | 'email' | 'ifu' | 'rccm' | 'message_facture' | 'logo_base64'> & { nif?: string };
function incomplete(detail: string): never { throw new Error(`Reçu indisponible : ${detail}. Aucune impression n’a été préparée.`); }
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const close = (a: number, b: number) => Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;

/** Vérifie la projection reçue ; ne complète ni les montants ni les lignes manquantes. */
export function validatePrestationReceipt(view: TransactionView, ref: TransactionRef): PrestationReceiptView {
  if (!view || view.origin !== 'prestation' || ref.origin !== 'prestation' || !Number.isSafeInteger(ref.id) || ref.id <= 0
    || view.ref?.origin !== ref.origin || view.ref.id !== ref.id) incomplete('référence de prestation incohérente');
  if (!text(view.code) || view.documents?.recuPrestation?.idVentePrestation !== ref.id
    || view.documents.recuPrestation.code !== view.code) incomplete('numéro du reçu absent ou incohérent');
  if (!text(view.dates?.creation) || !Number.isFinite(new Date(view.dates.creation).getTime())) incomplete('date absente ou invalide');
  if (!view.client || ![view.client.nom, view.client.contact].every(value => value === null || typeof value === 'string')) incomplete('informations client incomplètes');
  if (!Array.isArray(view.lines) || !view.lines.length) incomplete('aucune ligne de prestation');
  for (const line of view.lines) {
    if (!line || line.origin !== 'prestation' || !text(line.designation) || !text(line.unite)
      || !money(line.quantite) || line.quantite <= 0 || !money(line.prixUnitaire)
      || !Number.isFinite(line.quantite * line.prixUnitaire)) incomplete('ligne de prestation incomplète ou invalide');
  }
  if (![view.montantFacture, view.montantEncaisse, view.montantRembourse, view.restantDu].every(money)) incomplete('montants absents ou invalides');
  const total = view.lines.reduce((sum, line) => sum + line.quantite * line.prixUnitaire, 0);
  if (!close(total, view.montantFacture) || view.montantRembourse > view.montantEncaisse) incomplete('totaux incohérents');
  if (!['ACTIVE', 'ANNULEE'].includes(view.etatCommercial) || !['PAYEE', 'PARTIELLE', 'IMPAYEE', 'ANNULEE'].includes(view.etatPaiement)) incomplete('statut absent ou invalide');
  const net = view.montantEncaisse - view.montantRembourse;
  const expectedState = net > view.montantFacture || close(net, view.montantFacture) ? 'PAYEE' : net > 0 ? 'PARTIELLE' : 'IMPAYEE';
  if (view.etatCommercial === 'ANNULEE' ? view.etatPaiement !== 'ANNULEE' || !close(view.restantDu, 0)
    : view.etatPaiement !== expectedState || !close(view.restantDu, Math.max(0, view.montantFacture - net))) incomplete('statut ou restant dû incohérent');
  return view;
}

export async function loadPrestationReceipt(service: Pick<TransactionServiceContract, 'getView'>, ref: TransactionRef,
  ctx: TransactionContext | null): Promise<PrestationReceiptView> {
  if (!ctx) throw new Error('Connectez-vous pour consulter le reçu de prestation.');
  if (ref.origin !== 'prestation' || !Number.isSafeInteger(ref.id) || ref.id <= 0) incomplete('référence de prestation invalide');
  return validatePrestationReceipt(await service.getView(ref, ctx), ref);
}

/** Structure et dimensions reprises du reçu de vente ; CSS autonome, limité au document. */
export const prestationReceiptCss = `
.recu-prestation-body{padding:12px;background:#fff;color:#1a1a2e;font-family:Arial,sans-serif;font-size:11px;line-height:1.4}
.recu-prestation-body *{box-sizing:border-box}
.recu-prestation-body header{display:flex;justify-content:space-between;align-items:center;gap:6px;border-bottom:2px solid #1b365d;padding-bottom:6px;margin-bottom:8px}
.recu-prestation-body h1{font-size:14px;margin:0;color:#1b365d}
.recu-prestation-body .receipt-title{text-align:center;font-weight:700;background:#f2d2bc;padding:3px;border-radius:3px;margin-bottom:6px}
.recu-prestation-body .receipt-muted{color:#64748b;font-size:10px}
.recu-prestation-body .receipt-right{text-align:right}
.recu-prestation-body .receipt-logo{height:32px;object-fit:contain}
.recu-prestation-body .receipt-client{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}
.recu-prestation-body .receipt-box{padding:4px;border:1px solid #e8ecf1}
.recu-prestation-body table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px;table-layout:fixed}
.recu-prestation-body th,.recu-prestation-body td{padding:5px 6px;border:1px solid #e8ecf1;overflow-wrap:anywhere}
.recu-prestation-body th{background:#1a1a2e;color:#fff;text-align:left}
.recu-prestation-body .receipt-total{background:#e8f5e9;border:1px solid #4caf50;color:#2e7d32;padding:4px;margin-bottom:4px;display:flex;justify-content:space-between;gap:6px}
.recu-prestation-body .receipt-cancelled{color:#1a1a2e;border:2px solid #1b365d;text-align:center;font-weight:700;padding:4px;margin-bottom:6px}
.recu-prestation-body footer{margin-top:6px;padding-top:4px;border-top:1px solid #e8ecf1;overflow-wrap:anywhere}
.recu-prestation-body .receipt-signature{display:flex;justify-content:space-between;margin-top:6px}
`;

/** HTML échappé : aucune dépendance aux composants ou aux styles de l’application. */
export function prestationReceiptHtml(raw: TransactionView, commerce: ReceiptCommerce): string {
  const view = validatePrestationReceipt(raw, raw.ref);
  if (!commerce || !text(commerce.nom_atelier)) incomplete('nom du commerce absent');
  const escape = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmt = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;
  const optional = (label: string, value: string | undefined | null) => value ? `<div>${label}${escape(value)}</div>` : '';
  // Les logos configurés doivent rester des images ; aucune URL exécutable ni SVG actif.
  const logo = /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(commerce.logo_base64 || '')
    ? `<img class="receipt-logo" src="${escape(commerce.logo_base64)}" alt="Logo">` : '';
  const state = view.etatCommercial === 'ANNULEE' ? 'ANNULÉE' : view.etatPaiement === 'PAYEE' ? 'Payée' : view.etatPaiement === 'PARTIELLE' ? 'Partiellement payée' : 'Impayée';
  return `<article class="recu-prestation-body" aria-label="Reçu de prestation">
<header><div>${logo}<h1>${escape(commerce.nom_atelier)}</h1>${optional('', commerce.telephone)}</div>
<div class="receipt-right"><strong>N° ${escape(view.code)}</strong><div>${escape(new Date(view.dates.creation).toLocaleDateString('fr-FR'))}</div></div></header>
<div class="receipt-title">REÇU DE PRESTATION</div>
${view.etatCommercial === 'ANNULEE' ? '<div class="receipt-cancelled">ANNULÉE</div>' : ''}
<div class="receipt-client"><div class="receipt-box"><div class="receipt-muted">Client</div>${escape(view.client.nom?.trim() || 'Client anonyme')}</div>
<div class="receipt-box"><div class="receipt-muted">Contact</div>${escape(view.client.contact || '-')}</div>
<div class="receipt-box"><div class="receipt-muted">Heure</div>${escape(new Date(view.dates.creation).toLocaleTimeString('fr-FR'))}</div></div>
<table><colgroup><col style="width:40%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:15%"></colgroup>
<thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Unité</th><th>Total ligne</th></tr></thead><tbody>
${view.lines.map(line => `<tr><td>${escape(line.designation)}</td><td>${escape(line.quantite)}</td><td class="receipt-right">${escape(fmt(line.prixUnitaire))}</td><td>${escape(line.unite)}</td><td class="receipt-right">${escape(fmt(line.quantite * line.prixUnitaire))}</td></tr>`).join('')}
</tbody></table><div class="receipt-total"><strong>Montant facturé</strong><strong>${escape(fmt(view.montantFacture))}</strong></div>
<div class="receipt-total"><span>Montant encaissé (brut)</span><strong>${escape(fmt(view.montantEncaisse))}</strong></div>
${view.montantRembourse > 0 ? `<div class="receipt-box">Montant remboursé : ${escape(fmt(view.montantRembourse))}<br>Encaissé net : ${escape(fmt(view.montantEncaisse - view.montantRembourse))}</div>` : ''}
<div class="receipt-total"><strong>Restant dû</strong><strong>${escape(fmt(view.restantDu))}</strong></div><div>Statut : ${state}</div>
${optional('Observations : ', view.observations)}
<div class="receipt-signature"><span>Fait le ${escape(new Date(view.dates.creation).toLocaleDateString('fr-FR'))}</span><span>Signature &amp; cachet</span></div>
<footer><em>${escape(commerce.message_facture || 'Merci de votre confiance')}</em>
<div class="receipt-muted">${optional('', commerce.adresse)}${optional('RCCM : ', commerce.rccm)}${optional('IFU : ', commerce.ifu)}${optional('NIF : ', commerce.nif)}${optional('', commerce.email)}</div>
<div class="receipt-muted">Gestion Pro v1.0</div></footer></article>`;
}
