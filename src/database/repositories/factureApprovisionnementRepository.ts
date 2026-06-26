// src/database/repositories/factureApprovisionnementRepository.ts
import { getDb } from '../db';

export interface FactureApprovisionnement {
  idFactureAppro: number;
  code_facture: string;
  idRevendeur: number;
  idDecompte: number;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
}

export const factureApprovisionnementRepository = {
  // Générer un code unique
  async generateCode(): Promise<string> {
    const db = await getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const prefix = `APP-${year}${month}${day}-`;
    
    const result = await db.select<any[]>(`
      SELECT COUNT(*) as count FROM factures_approvisionnement 
      WHERE code_facture LIKE ?
    `, [prefix + '%']);
    
    const count = (result[0]?.count || 0) + 1;
    return `${prefix}${String(count).padStart(4, '0')}`;
  },

  // Créer une facture d'approvisionnement
  async createFromDecompte(
    idDecompte: number,
    idRevendeur: number,
    details: any[],
    codeRecu: string
  ): Promise<number> {
    const db = await getDb();

    try {
      // Calculer les montants
      let montantHT = 0;
      let montantTTC = 0;
      
      for (const detail of details) {
        // Seulement les produits réapprovisionnés
        if (detail.quantiteReapprovisionnee > 0) {
          montantHT += detail.prix_achat * detail.quantiteReapprovisionnee;
        }
      }
      
      montantTTC = montantHT * 1.18;

      // Générer le code facture
      const codeFacture = await this.generateCode();

      // Insérer la facture
      const result = await db.execute(`
        INSERT INTO factures_approvisionnement (
          code_facture,
          idRevendeur,
          idDecompte,
          date_facture,
          montant_ht,
          montant_ttc,
          statut,
          reference_decompte
        ) VALUES (?, ?, ?, datetime('now'), ?, ?, 'EN_ATTENTE', ?)
      `, [
        codeFacture,
        idRevendeur,
        idDecompte,
        montantHT,
        montantTTC,
        codeRecu
      ]);

      const idFactureAppro = Number(result.lastInsertId);

      // Insérer les détails de la facture
      for (const detail of details) {
        if (detail.quantiteReapprovisionnee > 0) {
          await db.execute(`
            INSERT INTO factures_approvisionnement_details (
              idFactureAppro,
              idProduit,
              quantite,
              prix_achat,
              prix_vente,
              total_ht,
              total_ttc
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            idFactureAppro,
            detail.idProduit,
            detail.quantiteReapprovisionnee,
            detail.prix_achat,
            detail.prix_vente,
            detail.prix_achat * detail.quantiteReapprovisionnee,
            detail.prix_achat * detail.quantiteReapprovisionnee * 1.18
          ]);
        }
      }

      console.log(`✅ Facture d'approvisionnement ${codeFacture} créée`);
      return idFactureAppro;

    } catch (error) {
      console.error('❌ Erreur création facture approvisionnement:', error);
      throw error;
    }
  },

  // Récupérer toutes les factures d'approvisionnement
  async getAll(): Promise<any[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT 
        fa.*,
        cl.NomComplet as revendeur_nom,
        cl.Societe as revendeur_societe,
        d.code_decompte as reference_decompte
      FROM factures_approvisionnement fa
      LEFT JOIN clients cl ON fa.idRevendeur = cl.idClient
      LEFT JOIN decomptes d ON fa.idDecompte = d.idDecompte
      ORDER BY fa.date_facture DESC
    `);
  },

  // Récupérer une facture par ID
  async getById(id: number): Promise<any> {
    const db = await getDb();
    
    const facture = await db.select<any[]>(`
      SELECT 
        fa.*,
        cl.NomComplet as revendeur_nom,
        cl.Societe as revendeur_societe
      FROM factures_approvisionnement fa
      LEFT JOIN clients cl ON fa.idRevendeur = cl.idClient
      WHERE fa.idFactureAppro = ?
    `, [id]);

    if (facture.length === 0) return null;

    const details = await db.select<any[]>(`
      SELECT 
        fad.*,
        p.designation,
        p.code_produit,
        p.categorie,
        p.unite_base
      FROM factures_approvisionnement_details fad
      INNER JOIN products p ON p.idProduit = fad.idProduit
      WHERE fad.idFactureAppro = ?
    `, [id]);

    return {
      ...facture[0],
      details
    };
  }
};