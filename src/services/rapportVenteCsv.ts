import type { RapportVente } from './rapportVenteService.ts';

export function construireRapportCsv(rapport: RapportVente): string {
    const lignes: string[] = [];
    lignes.push('RAPPORT DE VENTE');
    lignes.push(`Période;${rapport.libellePeriode}`);
    lignes.push(`Opérateur;${rapport.operateurNom}`);
    if (rapport.codeSession) lignes.push(`Session;${rapport.codeSession}`);
    lignes.push(`Statut;${rapport.provisoire ? 'Provisoire (poste ouvert)' : 'Définitif'}`);
    lignes.push('');
    lignes.push('Origine;N°;Date;Désignation;Type;Catégorie;Mode de paiement;Montant;Solde après;Référence;Opérateur');

    rapport.mouvements.forEach((m, i) => {
      lignes.push([
        m.origin === 'vente' ? 'Vente' : m.origin === 'prestation' ? 'Prestation' : '·',
        i + 1,
        m.date_journal || '',
        (m.designation || '').replace(/;/g, ','),
        m.type_mouvement || '',
        m.categorie || '',
        m.mode_paiement || 'Non précisé',
        m.montant || 0,
        m.solde_apres || 0,
        (m.reference || '').replace(/;/g, ','),
        (m.nom_utilisateur || '').replace(/;/g, ','),
      ].join(';'));
    });

    const v = rapport.ventilation;
    lignes.push('');
    lignes.push('SYNTHESE');
    lignes.push(`Report (fond de caisse);${rapport.report}`);
    lignes.push(`Total entrées;${rapport.totalEntrees}`);
    lignes.push(`Total sorties;${rapport.totalSorties}`);
    lignes.push(`Total général (report inclus);${rapport.soldeCalcule}`);
    lignes.push('');
    lignes.push('POINT DE CAISSE');
    lignes.push(`Montant total des opérations;${v.total}`);
    lignes.push(`Transferts Mobile Money;${v.mobileMoney}`);
    if (v.orangeMoney) lignes.push(`  dont Orange Money;${v.orangeMoney}`);
    if (v.moovMoney) lignes.push(`  dont Moov Money;${v.moovMoney}`);
    if (v.telecelMoney) lignes.push(`  dont Telecel Money;${v.telecelMoney}`);
    if (v.sankMoney) lignes.push(`  dont Sank Money;${v.sankMoney}`);
    if (v.wave) lignes.push(`  dont Wave;${v.wave}`);
    if (v.autreMobile) lignes.push(`  dont Autre mobile;${v.autreMobile}`);
    lignes.push(`Virements;${v.virements}`);
    lignes.push(`Chèques;${v.cheques}`);
    lignes.push(`Espèces en caisse (report inclus);${rapport.especesAttendues}`);
    if (v.nbNonPrecise > 0) {
      lignes.push(`Mode non précisé (${v.nbNonPrecise} opération(s));${v.nonPrecise}`);
    }
    if (rapport.soldeDeclare != null) {
      lignes.push(`Solde déclaré (comptage);${rapport.soldeDeclare}`);
      lignes.push(`Écart;${rapport.ecart ?? 0}`);
    }

    return lignes.join('\n');
  }
