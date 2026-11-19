// src/utils/attestationDocument.ts
// Rendu partagé d'une attestation d'achat-vente : HTML (impression) et PDF (jsPDF).
import jsPDF from 'jspdf';
import type { Attestation } from '../database/repositories/attestationRepository';

const DECHARGE =
  "Décharge : le cédant reconnaît avoir remis volontairement le matériel ci-dessus décrit, déclare en être le " +
  "légitime propriétaire et garantit qu'il n'est ni volé ni frappé d'aucune opposition. Le cessionnaire l'accepte " +
  "en l'état après vérification. La présente cession est ferme et définitive et décharge le cessionnaire de toute " +
  "réclamation ultérieure.";

// Contenu HTML du corps (utilisé par printHtml)
export function attestationHtml(a: Partial<Attestation>): string {
  const line = (v?: string | number | null) =>
    `<span style="border-bottom:1px dotted #333;display:inline-block;min-width:60%;">${(v ?? '') === '' ? '&nbsp;' : v}</span>`;
  return `
    <h1>ATTESTATION D'ACHAT-VENTE</h1>
    <div class="l">Je soussigné : ${line(a.cedant_nom)}</div>
    <div class="l">Domicilié : ${line(a.cedant_domicile)}</div>
    <div class="l">Numéro de téléphone : ${line(a.cedant_tel)}</div>
    <div class="l">Document d'identification N° : ${line(a.cedant_doc)}</div>
    <div class="l">Références : ${line(a.cedant_ref)}</div>
    <div class="sec l">Certifie avoir cédé à : ${line(a.cess_nom)}</div>
    <div class="l">Domicilié : ${line(a.cess_domicile)}</div>
    <div class="l">Numéro de téléphone : ${line(a.cess_tel)}</div>
    <div class="l">Document d'identification : ${line(a.cess_doc)}</div>
    <div class="l">Références : ${line(a.cess_ref)}</div>
    <div class="sec l">Le matériel décrit ci-après : ${line(a.materiel)}</div>
    <div class="l">En échange de : ${line(a.en_echange)}</div>
    <div class="decharge">${DECHARGE}</div>
    <div class="sec l">Fait à ${line(a.fait_a)} le ${line(a.date_acte)}. Pour valoir et servir ce que de droit, en autant d'exemplaires que de parties, soit ${line(a.nb_exemplaires)}.</div>
    <div class="mention">Date et signature avec mention « lu et approuvé » :</div>
    <div class="sign"><div>ACHETEUR</div><div>VENDEUR</div></div>
    ${a.code_attestation ? `<div style="margin-top:10px;font-size:11px;color:#888;">Réf. attestation : ${a.code_attestation}</div>` : ''}
  `;
}

export const ATTESTATION_PRINT_STYLES = `
  body { font-family: Arial, sans-serif; color:#111; padding:40px; line-height:2; font-size:14px; }
  h1 { text-align:center; font-size:18px; text-decoration:underline; letter-spacing:1px; margin-bottom:28px; }
  .l { margin:4px 0; }
  .sec { margin-top:14px; }
  .decharge { font-style:italic; text-align:justify; margin-top:16px; line-height:1.5; font-size:12.5px; }
  .sign { display:flex; justify-content:space-between; margin-top:50px; }
  .sign div { width:45%; text-align:center; }
  .mention { margin-top:24px; }
`;

// Génère un Blob PDF (texte vectoriel) à partir d'une attestation enregistrée.
export function attestationPdfBlob(a: Partial<Attestation>): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marge = 20;
  const largeur = 210 - marge * 2;
  let y = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text("ATTESTATION D'ACHAT-VENTE", 105, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const ligne = (label: string, val?: string | number | null) => {
    const txt = `${label} : ${val ?? '...............'}`;
    const wrapped = doc.splitTextToSize(txt, largeur);
    doc.text(wrapped, marge, y);
    y += wrapped.length * 6 + 1;
  };

  ligne('Je soussigné', a.cedant_nom);
  ligne('Domicilié', a.cedant_domicile);
  ligne('Numéro de téléphone', a.cedant_tel);
  ligne("Document d'identification N°", a.cedant_doc);
  ligne('Références', a.cedant_ref);
  y += 3;
  ligne('Certifie avoir cédé à', a.cess_nom);
  ligne('Domicilié', a.cess_domicile);
  ligne('Numéro de téléphone', a.cess_tel);
  ligne("Document d'identification", a.cess_doc);
  ligne('Références', a.cess_ref);
  y += 3;
  ligne('Le matériel décrit ci-après', a.materiel);
  ligne('En échange de', a.en_echange);
  y += 3;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  const decharge = doc.splitTextToSize(DECHARGE, largeur);
  doc.text(decharge, marge, y);
  y += decharge.length * 5 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const bas = doc.splitTextToSize(
    `Fait à ${a.fait_a || '.........'} le ${a.date_acte || '.........'}. Pour valoir et servir ce que de droit, en autant d'exemplaires que de parties, soit ${a.nb_exemplaires || 'deux (02)'}.`,
    largeur
  );
  doc.text(bas, marge, y);
  y += bas.length * 6 + 12;

  doc.text('ACHETEUR', marge + 15, y);
  doc.text('VENDEUR', 210 - marge - 35, y);

  if (a.code_attestation) {
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`Réf. attestation : ${a.code_attestation}`, marge, 285);
  }

  return doc.output('blob') as Blob;
}
