// src/services/annulationService.ts
// ============================================================================
// ANNULATION EN CASCADE D'UNE COMMANDE STANDARD
// ----------------------------------------------------------------------------
// Auparavant l'annulation d'une commande se contentait de réintégrer le stock
// et de marquer la commande. La facture liée restait « en attente » et les
// règlements encaissés restaient actifs, ce qui faussait le chiffre d'affaires,
// les créances clients et le solde de caisse.
//
// Ce service applique l'annulation complète :
//   1. commande  -> ANNULEE (+ réintégration du stock)
//   2. facture   -> ANNULEE
//   3. règlements-> ANNULE
//   4. caisse    -> écriture d'une SORTIE compensatoire par règlement annulé
// ============================================================================

import { getDb } from '../database/db';
import { journalCaisseService } from './journalCaisseService';

export interface ResultatAnnulation {
  commandeAnnulee: boolean;
  factureAnnulee: number | null;
  codeFacture: string | null;
  reglementsAnnules: number;
  montantRembourse: number;
  lignesStockReintegrees: number;
  avertissements: string[];
}

export const annulationService = {
  /**
   * Point d'entrée unique : annule une commande quel que soit son circuit.
   * Remplace l'ancienne suppression définitive — rien n'est effacé, tout
   * est marqué « annulé » et reste consultable.
   */
  async annulerCommande(
    idCommande: number,
    utilisateur?: string,
    motif?: string
  ): Promise<ResultatAnnulation> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT type_commande FROM commandes WHERE idCommande = ?`,
      [idCommande]
    );
    if (!rows.length) throw new Error(`Commande #${idCommande} introuvable.`);

    return String(rows[0].type_commande).toUpperCase() === 'REVENDEUR'
      ? annulationService.annulerCommandeRevendeur(idCommande, utilisateur, motif)
      : annulationService.annulerCommandeStandard(idCommande, utilisateur, motif);
  },

  /**
   * Annulation d'une commande REVENDEUR.
   * Différence avec le circuit standard : le stock était sorti du magasin
   * central vers le revendeur. L'annulation doit donc faire l'inverse des
   * deux côtés — remettre au central ET retirer du stock revendeur.
   */
  async annulerCommandeRevendeur(
    idCommande: number,
    utilisateur?: string,
    motif?: string
  ): Promise<ResultatAnnulation> {
    const db = await getDb();
    const avertissements: string[] = [];
    const resultat: ResultatAnnulation = {
      commandeAnnulee: false,
      factureAnnulee: null,
      codeFacture: null,
      reglementsAnnules: 0,
      montantRembourse: 0,
      lignesStockReintegrees: 0,
      avertissements,
    };

    const commandeRows = await db.select<any[]>(
      `SELECT idCommande, idClient, code_commande, est_annule, statut
       FROM commandes WHERE idCommande = ?`,
      [idCommande]
    );
    if (!commandeRows.length) throw new Error(`Commande #${idCommande} introuvable.`);
    const commande = commandeRows[0];
    if (commande.est_annule === 1 || commande.statut === 'ANNULEE') {
      throw new Error('Cette commande est déjà annulée.');
    }

    const idRevendeur = commande.idClient;
    const details = await db.select<any[]>(
      `SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?`,
      [idCommande]
    );

    for (const d of details) {
      const quantite = d.qte_commande || 0;

      // Retour au stock central
      const prod = await db.select<any[]>(
        `SELECT qte_stock FROM products WHERE idProduit = ?`, [d.idProduit]
      );
      if (prod.length) {
        const avant = prod[0].qte_stock || 0;
        await db.execute(
          `UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?`,
          [quantite, d.idProduit]
        );
        await db.execute(
          `INSERT INTO mouvements_stock (idProduit, type_mouvement, quantite, stock_avant, stock_apres, reference, notes, idCommande)
           VALUES (?, 'ANNULATION_COMMANDE', ?, ?, ?, ?, ?, ?)`,
          [d.idProduit, quantite, avant, avant + quantite, `CMD-${idCommande}`,
           `Annulation de la commande revendeur #${idCommande}`, idCommande]
        );
        resultat.lignesStockReintegrees++;
      } else {
        avertissements.push(`Produit #${d.idProduit} introuvable : stock central non réintégré.`);
      }

      // Retrait du stock revendeur (jamais en dessous de zéro)
      try {
        await db.execute(
          `UPDATE stock_revendeur
           SET qte_stock = CASE WHEN qte_stock >= ? THEN qte_stock - ? ELSE 0 END
           WHERE idRevendeur = ? AND idProduit = ?`,
          [quantite, quantite, idRevendeur, d.idProduit]
        );
      } catch (e) {
        avertissements.push(`Stock revendeur non ajusté pour le produit #${d.idProduit}.`);
      }
    }

    // Factures revendeur + règlements associés
    const factures = await db.select<any[]>(
      `SELECT idFactureRevendeur, code_facture, statut
       FROM factures_revendeur WHERE idCommande = ?`,
      [idCommande]
    );

    for (const facture of factures) {
      if (facture.statut === 'ANNULEE') {
        avertissements.push(`Facture ${facture.code_facture} déjà annulée.`);
        continue;
      }

      let reglements: any[] = [];
      try {
        reglements = await db.select<any[]>(
          `SELECT idReglement, montant, mode_reglement, COALESCE(statut,'VALIDE') AS statut
           FROM reglements_revendeur WHERE idFactureRevendeur = ?`,
          [facture.idFactureRevendeur]
        );
      } catch {
        // Table absente sur certaines installations : on continue sans bloquer
      }

      for (const reglement of reglements) {
        if (reglement.statut === 'ANNULE') continue;

        await db.execute(
          `UPDATE reglements_revendeur
           SET statut = 'ANNULE', est_annule = 1,
               date_annulation = datetime('now'), annule_par = ?
           WHERE idReglement = ?`,
          [utilisateur || null, reglement.idReglement]
        );
        resultat.reglementsAnnules++;
        resultat.montantRembourse += reglement.montant || 0;

        try {
          await journalCaisseService.ajouterSortie({
            categorie: 'AUTRE_SORTIE',
            designation: `Annulation règlement revendeur — facture ${facture.code_facture}`,
            montant: reglement.montant || 0,
            reference: facture.code_facture,
            idReference: facture.idFactureRevendeur,
            modePaiement: reglement.mode_reglement || undefined,
            notes: `Contrepassation suite à l'annulation de la commande #${idCommande}${motif ? ` — ${motif}` : ''}`,
            force: true,
          });
        } catch (e) {
          avertissements.push(`Sortie de caisse non enregistrée pour le règlement #${reglement.idReglement} : ${e}`);
        }
      }

      await db.execute(
        `UPDATE factures_revendeur
         SET statut = 'ANNULEE', est_annule = 1,
             date_annulation = datetime('now'), annule_par = ?, motif_annulation = ?
         WHERE idFactureRevendeur = ?`,
        [utilisateur || null, motif || `Annulation de la commande #${idCommande}`, facture.idFactureRevendeur]
      );

      resultat.factureAnnulee = facture.idFactureRevendeur;
      resultat.codeFacture = facture.code_facture;
    }

    if (!factures.length) {
      avertissements.push('Aucune facture revendeur liée à cette commande.');
    }

    await db.execute(
      `UPDATE commandes
       SET est_annule = 1, statut = 'ANNULEE',
           date_annulation = datetime('now'), annule_par = ?
       WHERE idCommande = ?`,
      [utilisateur || null, idCommande]
    );
    resultat.commandeAnnulee = true;

    return resultat;
  },
  /**
   * Annule une commande standard et propage l'annulation à la facture,
   * aux règlements et au journal de caisse.
   */
  async annulerCommandeStandard(
    idCommande: number,
    utilisateur?: string,
    motif?: string
  ): Promise<ResultatAnnulation> {
    const db = await getDb();
    const avertissements: string[] = [];

    const resultat: ResultatAnnulation = {
      commandeAnnulee: false,
      factureAnnulee: null,
      codeFacture: null,
      reglementsAnnules: 0,
      montantRembourse: 0,
      lignesStockReintegrees: 0,
      avertissements,
    };

    // --- Garde-fou : commande déjà annulée ? -------------------------------
    const commandeRows = await db.select<any[]>(
      `SELECT idCommande, est_annule, statut FROM commandes WHERE idCommande = ?`,
      [idCommande]
    );
    if (!commandeRows.length) {
      throw new Error(`Commande #${idCommande} introuvable.`);
    }
    if (commandeRows[0].est_annule === 1 || commandeRows[0].statut === 'ANNULEE') {
      throw new Error('Cette commande est déjà annulée.');
    }

    // --- 1. Réintégration du stock ----------------------------------------
    const details = await db.select<any[]>(
      `SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?`,
      [idCommande]
    );

    for (const d of details) {
      const prod = await db.select<any[]>(
        `SELECT qte_stock FROM products WHERE idProduit = ?`,
        [d.idProduit]
      );
      if (!prod.length) {
        avertissements.push(`Produit #${d.idProduit} introuvable : stock non réintégré.`);
        continue;
      }
      const avant = prod[0].qte_stock || 0;
      const quantite = d.qte_commande || 0;
      const apres = avant + quantite;

      await db.execute(
        `UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?`,
        [quantite, d.idProduit]
      );
      await db.execute(
        `INSERT INTO mouvements_stock (idProduit, type_mouvement, quantite, stock_avant, stock_apres, reference, notes, idCommande)
         VALUES (?, 'ANNULATION_COMMANDE', ?, ?, ?, ?, ?, ?)`,
        [
          d.idProduit,
          quantite,
          avant,
          apres,
          `CMD-${idCommande}`,
          `Annulation de la commande #${idCommande}`,
          idCommande,
        ]
      );
      resultat.lignesStockReintegrees++;
    }

    // --- 2. Annulation de la facture liée ---------------------------------
    const factures = await db.select<any[]>(
      `SELECT idFacture, code_facture, montant_ttc, montant_regle, statut
       FROM factures WHERE idCommande = ?`,
      [idCommande]
    );

    for (const facture of factures) {
      if (facture.statut === 'ANNULEE') {
        avertissements.push(`Facture ${facture.code_facture} déjà annulée.`);
        continue;
      }

      // --- 3. Annulation des règlements de cette facture ------------------
      const reglements = await db.select<any[]>(
        `SELECT idReglement, code_reglement, montant, mode_reglement,
                COALESCE(statut, 'VALIDE') AS statut
         FROM reglements WHERE idFacture = ?`,
        [facture.idFacture]
      );

      for (const reglement of reglements) {
        if (reglement.statut === 'ANNULE') continue;

        await db.execute(
          `UPDATE reglements
           SET statut = 'ANNULE',
               est_annule = 1,
               date_annulation = datetime('now'),
               annule_par = ?
           WHERE idReglement = ?`,
          [utilisateur || null, reglement.idReglement]
        );

        resultat.reglementsAnnules++;
        resultat.montantRembourse += reglement.montant || 0;

        // --- 4. Sortie de caisse compensatoire ---------------------------
        // On neutralise l'encaissement d'origine sans le supprimer :
        // le journal conserve l'entrée puis la sortie, la piste d'audit
        // reste complète et le solde revient à sa valeur correcte.
        try {
          await journalCaisseService.ajouterSortie({
            categorie: 'AUTRE_SORTIE',
            designation: `Annulation règlement ${reglement.code_reglement || ''} — facture ${facture.code_facture}`.trim(),
            montant: reglement.montant || 0,
            reference: facture.code_facture,
            idReference: facture.idFacture,
            modePaiement: reglement.mode_reglement || undefined,
            notes: `Contrepassation suite à l'annulation de la commande #${idCommande}${motif ? ` — ${motif}` : ''}`,
            // force : l'annulation doit aboutir même si le solde de caisse
            // courant est insuffisant (fonds déjà sortis, poste différent...).
            force: true,
          });
        } catch (e) {
          avertissements.push(
            `Sortie de caisse non enregistrée pour le règlement ${reglement.code_reglement || reglement.idReglement} : ${e}`
          );
        }
      }

      // Marquer la facture annulée et remettre le montant réglé à zéro
      await db.execute(
        `UPDATE factures
         SET statut = 'ANNULEE',
             est_annule = 1,
             montant_regle = 0,
             date_annulation = datetime('now'),
             annule_par = ?,
             motif_annulation = ?
         WHERE idFacture = ?`,
        [utilisateur || null, motif || `Annulation de la commande #${idCommande}`, facture.idFacture]
      );

      resultat.factureAnnulee = facture.idFacture;
      resultat.codeFacture = facture.code_facture;
    }

    if (!factures.length) {
      avertissements.push('Aucune facture liée à cette commande.');
    }

    // --- 5. Annulation de la commande elle-même ---------------------------
    await db.execute(
      `UPDATE commandes
       SET est_annule = 1,
           statut = 'ANNULEE',
           date_annulation = datetime('now'),
           annule_par = ?
       WHERE idCommande = ?`,
      [utilisateur || null, idCommande]
    );
    resultat.commandeAnnulee = true;

    return resultat;
  },

  /**
   * Annulation d'UN règlement précis (sans toucher à la commande/facture entière).
   * - marque le règlement « ANNULE » (il reste visible pour l'audit),
   * - recalcule le montant réglé et le statut de la facture (hors règlements annulés),
   * - poste une SORTIE de contrepassation en caisse (l'encaissement d'origine est
   *   ainsi neutralisé : le journal garde l'entrée puis la sortie).
   * Idempotent : ne recrée pas la contrepassation si elle existe déjà.
   */
  async annulerReglement(
    idReglement: number,
    utilisateur?: string,
    motif?: string
  ): Promise<{ montant: number; avertissements: string[] }> {
    const db = await getDb();
    const avertissements: string[] = [];

    const rows = await db.select<any[]>(
      `SELECT r.idReglement, r.code_reglement, r.montant, r.mode_reglement, r.idFacture,
              COALESCE(r.statut, 'VALIDE') AS statut,
              f.code_facture, f.montant_ttc, f.statut AS facture_statut
       FROM reglements r
       LEFT JOIN factures f ON f.idFacture = r.idFacture
       WHERE r.idReglement = ?`,
      [idReglement]
    );
    if (!rows.length) throw new Error('Règlement introuvable.');
    const reg = rows[0];
    if (reg.statut === 'ANNULE') throw new Error('Ce règlement est déjà annulé.');

    // 1. Marquer le règlement annulé (conservé pour l'audit).
    await db.execute(
      `UPDATE reglements
       SET statut = 'ANNULE', est_annule = 1,
           date_annulation = datetime('now'), annule_par = ?
       WHERE idReglement = ?`,
      [utilisateur || null, idReglement]
    );

    // 2. Recalcul de la facture (en excluant les règlements annulés).
    if (reg.idFacture && reg.facture_statut !== 'ANNULEE') {
      const t = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant), 0) AS total
         FROM reglements
         WHERE idFacture = ? AND COALESCE(statut, 'VALIDE') <> 'ANNULE'`,
        [reg.idFacture]
      );
      const totalValide = Number(t[0]?.total || 0);
      const ttc = Number(reg.montant_ttc || 0);
      let statut = 'EN_ATTENTE';
      if (totalValide > 0 && totalValide < ttc) statut = 'PARTIELLEMENT_REGLEE';
      else if (ttc > 0 && totalValide >= ttc) statut = 'REGLEE';
      await db.execute(
        `UPDATE factures SET montant_regle = ?, statut = ? WHERE idFacture = ?`,
        [totalValide, statut, reg.idFacture]
      );
    }

    // 3. Contrepassation en caisse (SORTIE), idempotente.
    const deja = await db.select<any[]>(
      `SELECT COUNT(*) AS n FROM journal_caisse
       WHERE type_mouvement = 'SORTIE' AND reference = ?
         AND notes LIKE 'CONTREPASSATION REGLEMENT%'`,
      [reg.code_reglement]
    );
    if ((deja[0]?.n || 0) === 0) {
      try {
        await journalCaisseService.ajouterSortie({
          categorie: 'AUTRE_SORTIE',
          designation: `Annulation règlement ${reg.code_reglement || ''} — facture ${reg.code_facture || ''}`.trim(),
          montant: Number(reg.montant) || 0,
          reference: reg.code_reglement,
          idReference: reg.idFacture,
          modePaiement: reg.mode_reglement || undefined,
          notes: `CONTREPASSATION REGLEMENT ${reg.code_reglement}${motif ? ' — ' + motif : ''}${utilisateur ? ' (par ' + utilisateur + ')' : ''}`,
          force: true,
        });
      } catch (e) {
        avertissements.push(`Sortie de caisse non enregistrée : ${e}`);
      }
    }

    return { montant: Number(reg.montant) || 0, avertissements };
  },
};

export default annulationService;
