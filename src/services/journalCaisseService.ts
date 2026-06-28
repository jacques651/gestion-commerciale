// src/services/journalCaisseService.ts

import { getDb } from "../database/db";

interface ChargeData {
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: string;
  reference_paiement?: string;
  notes?: string;
}

class JournalCaisseService {

  private async getNextCodeJournal(db: any): Promise<string> {
    const count = await db.select(`
      SELECT COUNT(*) as count FROM journal_caisse
    `);
    const countValue = (count as any[])[0]?.count || 0;
    return `JRN-${String(countValue + 1).padStart(4, '0')}`;
  }

  private async calculerSolde(db: any): Promise<number> {
    const result = await db.select(`
      SELECT 
        COALESCE(SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE 0 END), 0) as total_entrees,
        COALESCE(SUM(CASE WHEN type_mouvement = 'SORTIE' THEN montant ELSE 0 END), 0) as total_sorties
      FROM journal_caisse
    `);
    return (result[0]?.total_entrees || 0) - (result[0]?.total_sorties || 0);
  }

  async ajouterEntree(data: {
    categorie: 'VENTE_COMPTOIR' | 'REGLEMENT_FACTURE' | 'DECOMPTE_REVENDEUR' | 'AUTRE_ENTREE';
    designation: string;
    montant: number;
    reference?: string;
    idReference?: number;
    notes?: string;
  }): Promise<number> {
    const db = await getDb();
    const soldeActuel = await this.calculerSolde(db);
    const nouveauSolde = soldeActuel + data.montant;
    const codeJournal = await this.getNextCodeJournal(db);

    const result = await db.execute(`
      INSERT INTO journal_caisse (
        code_journal, date_journal, type_mouvement, categorie,
        designation, montant, solde_apres, reference, idReference, notes
      ) VALUES (?, datetime('now'), 'ENTREE', ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeJournal,
      data.categorie,
      data.designation,
      data.montant,
      nouveauSolde,
      data.reference || null,
      data.idReference || null,
      data.notes || null
    ]);

    return Number(result.lastInsertId);
  }

  async ajouterSortie(data: {
    categorie: 'CHARGE_FONCTIONNEMENT' | 'AUTRE_SORTIE';
    designation: string;
    montant: number;
    reference?: string;
    idReference?: number;
    notes?: string;
  }): Promise<number> {
    const db = await getDb();
    const soldeActuel = await this.calculerSolde(db);
    
    if (data.montant > soldeActuel) {
      throw new Error(`Solde insuffisant. Solde actuel: ${soldeActuel.toLocaleString()} FCFA`);
    }
    
    const nouveauSolde = soldeActuel - data.montant;
    const codeJournal = await this.getNextCodeJournal(db);

    const result = await db.execute(`
      INSERT INTO journal_caisse (
        code_journal, date_journal, type_mouvement, categorie,
        designation, montant, solde_apres, reference, idReference, notes
      ) VALUES (?, datetime('now'), 'SORTIE', ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeJournal,
      data.categorie,
      data.designation,
      data.montant,
      nouveauSolde,
      data.reference || null,
      data.idReference || null,
      data.notes || null
    ]);

    return Number(result.lastInsertId);
  }

  async ajouterVenteComptoir(data: {
    montant: number;
    idVente: number;
    codeVente: string;
    clientNom?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'VENTE_COMPTOIR',
      designation: `Vente comptoir ${data.codeVente}${data.clientNom ? ` - ${data.clientNom}` : ''}`,
      montant: data.montant,
      reference: data.codeVente,
      idReference: data.idVente,
      notes: `Vente au comptoir enregistrée le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  async ajouterReglementFacture(data: {
    montant: number;
    idFacture: number;
    codeFacture: string;
    clientNom?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'REGLEMENT_FACTURE',
      designation: `Règlement facture ${data.codeFacture}${data.clientNom ? ` - ${data.clientNom}` : ''}`,
      montant: data.montant,
      reference: data.codeFacture,
      idReference: data.idFacture,
      notes: `Règlement de facture enregistré le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  // ✅ CORRECTION : Décompte revendeur = ENTRÉE (pas sortie)
  async ajouterDecompteRevendeur(data: {
    montant: number;
    idDecompte: number;
    codeDecompte: string;
    revendeurNom?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'DECOMPTE_REVENDEUR',
      designation: `Décompte revendeur ${data.codeDecompte}${data.revendeurNom ? ` - ${data.revendeurNom}` : ''}`,
      montant: data.montant,
      reference: data.codeDecompte,
      idReference: data.idDecompte,
      notes: `Décompte revendeur enregistré le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  async ajouterCharge(data: ChargeData): Promise<{ idJournal: number; idCharge: number }> {
    const db = await getDb();
    
    // Ajouter au journal de caisse
    const idJournal = await this.ajouterSortie({
      categorie: 'CHARGE_FONCTIONNEMENT',
      designation: data.designation,
      montant: data.montant,
      reference: data.reference_paiement,
      notes: data.notes
    });

    // Générer le code charge
    const chargeCount = await db.select(`
      SELECT COUNT(*) as count FROM charges_fonctionnement
    `);
    const countValue = (chargeCount as any[])[0]?.count || 0;
    const codeCharge = `CHG-${String(countValue + 1).padStart(4, '0')}`;

    // Insérer la charge
    const result = await db.execute(`
      INSERT INTO charges_fonctionnement (
        code_charge, date_charge, designation, montant,
        beneficiaire, categorie_charge, reference_paiement,
        idJournal, notes
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeCharge,
      data.designation,
      data.montant,
      data.beneficiaire,
      data.categorie_charge,
      data.reference_paiement || null,
      idJournal,
      data.notes || null
    ]);

    return { idJournal, idCharge: Number(result.lastInsertId) };
  }

  async getSoldeActuel(): Promise<number> {
    const db = await getDb();
    return this.calculerSolde(db);
  }

  async getMouvementsDuJour(date: string): Promise<any[]> {
    const db = await getDb();
    const startDate = date + ' 00:00:00';
    const endDate = date + ' 23:59:59';
    
    const result = await db.select(`
      SELECT * FROM journal_caisse 
      WHERE date_journal >= ? AND date_journal <= ?
      ORDER BY idJournal ASC
    `, [startDate, endDate]);
    return result as any[];
  }

  async getChargesDuJour(date: string): Promise<any[]> {
    const db = await getDb();
    const startDate = date + ' 00:00:00';
    const endDate = date + ' 23:59:59';
    
    const result = await db.select(`
      SELECT * FROM charges_fonctionnement 
      WHERE date_charge >= ? AND date_charge <= ?
      ORDER BY date_charge DESC
    `, [startDate, endDate]);
    return result as any[];
  }

  async getRecapJournalier(date: string): Promise<any> {
    const db = await getDb();
    const startDate = date + ' 00:00:00';
    const endDate = date + ' 23:59:59';
    
    // Vérifier si le récapitulatif existe
    const recapResult = await db.select(`
      SELECT * FROM recapitulatif_journalier 
      WHERE date_recap = ?
    `, [date]);
    
    if ((recapResult as any[]).length > 0) {
      return (recapResult as any[])[0];
    }
    
    // Sinon, le calculer
    const initial = await db.select(`
      SELECT solde_apres as solde 
      FROM journal_caisse 
      WHERE date_journal < ?
      ORDER BY idJournal DESC 
      LIMIT 1
    `, [startDate]);
    
    const initSolde = (initial as any[])[0]?.solde || 0;
    
    const mouvements = await db.select(`
      SELECT type_mouvement, categorie, SUM(montant) as total
      FROM journal_caisse
      WHERE date_journal >= ? AND date_journal <= ?
      GROUP BY type_mouvement, categorie
    `, [startDate, endDate]);
    
    let totalEntrees = 0, totalSorties = 0;
    let totalVentesComptoir = 0, totalReglementsFactures = 0;
    let totalDecomptesRevendeurs = 0, totalCharges = 0;
    
    for (const m of (mouvements as any[])) {
      if (m.type_mouvement === 'ENTREE') {
        totalEntrees += m.total;
        if (m.categorie === 'VENTE_COMPTOIR') totalVentesComptoir += m.total;
        if (m.categorie === 'REGLEMENT_FACTURE') totalReglementsFactures += m.total;
        if (m.categorie === 'DECOMPTE_REVENDEUR') totalDecomptesRevendeurs += m.total;
      } else if (m.type_mouvement === 'SORTIE') {
        totalSorties += m.total;
        if (m.categorie === 'CHARGE_FONCTIONNEMENT') totalCharges += m.total;
      }
    }
    
    const soldeFinal = initSolde + totalEntrees - totalSorties;
    
    const newRecap = {
      date_recap: date,
      solde_initial: initSolde,
      total_entrees: totalEntrees,
      total_sorties: totalSorties,
      solde_final: soldeFinal,
      total_ventes_comptoir: totalVentesComptoir,
      total_reglements_factures: totalReglementsFactures,
      total_decomptes_revendeurs: totalDecomptesRevendeurs,
      total_charges: totalCharges
    };
    
    // Sauvegarder le récapitulatif
    await db.execute(`
      INSERT OR REPLACE INTO recapitulatif_journalier (
        date_recap, solde_initial, total_entrees, total_sorties, solde_final,
        total_ventes_comptoir, total_reglements_factures, total_decomptes_revendeurs, total_charges
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      date, initSolde, totalEntrees, totalSorties, soldeFinal,
      totalVentesComptoir, totalReglementsFactures, totalDecomptesRevendeurs, totalCharges
    ]);
    
    return newRecap;
  }
}

export const journalCaisseService = new JournalCaisseService();