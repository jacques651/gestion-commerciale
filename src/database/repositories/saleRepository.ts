// src/database/repositories/saleRepository.ts
import { getDb } from '../db';

export interface Sale {
  idVente: number;
  code_vente: string;
  idClient: number | null;
  nom_prenom: string;
  contact: string | null;
  date_vente: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  type_vente: string;
  observation: string | null;
}

export interface SaleDetail {
  idDetail: number;
  idVente: number;
  idProduit: number;
  quantite: number;
  prix_unitaire_ht: number;
  prix_unitaire_ttc: number;
  remise_percent: number;
  tva_taux: number;
}

export type CreateSaleDetailInput = Omit<SaleDetail, 'idDetail' | 'idVente'>;
export type CreateSaleInput = Omit<Sale, 'idVente' | 'date_vente'>;

export const saleRepository = {
  getAll: async (): Promise<Sale[]> => {
    const db = await getDb();
    const sales = await db.select<any[]>(`
      SELECT 
        v.*,
        COALESCE(
          CASE 
            WHEN cl.nom IS NOT NULL AND cl.prenom IS NOT NULL THEN cl.nom || ' ' || cl.prenom
            WHEN cl.raison_sociale IS NOT NULL THEN cl.raison_sociale
            ELSE NULL
          END,
          v.nom_prenom
        ) as client_nom
      FROM ventes v
      LEFT JOIN clients cl ON v.idClient = cl.idClient
      ORDER BY v.date_vente DESC
    `);
    return sales as Sale[];
  },

  getById: async (id: number): Promise<any> => {
    const db = await getDb();
    
    const sales = await db.select<any[]>(`
      SELECT 
        v.*,
        COALESCE(
          CASE 
            WHEN cl.nom IS NOT NULL AND cl.prenom IS NOT NULL THEN cl.nom || ' ' || cl.prenom
            WHEN cl.raison_sociale IS NOT NULL THEN cl.raison_sociale
            ELSE NULL
          END,
          v.nom_prenom
        ) as client_nom
      FROM ventes v
      LEFT JOIN clients cl ON v.idClient = cl.idClient
      WHERE v.idVente = ?
    `, [id]);
    
    if (sales.length === 0) return null;
    
    const details = await db.select<any[]>(`
      SELECT 
        vd.idDetail,
        vd.idVente,
        vd.idProduit,
        vd.quantite,
        vd.prix_unitaire_ht,
        vd.prix_unitaire_ttc,
        vd.remise_percent,
        vd.tva_taux,
        p.designation as produit_nom,
        p.code_produit
      FROM vente_details vd
      JOIN products p ON vd.idProduit = p.idProduit
      WHERE vd.idVente = ?
    `, [id]);
    
    return {
      ...sales[0],
      details: details
    };
  },

  create: async (sale: CreateSaleInput, details: CreateSaleDetailInput[]): Promise<number> => {
    const db = await getDb();
    let transactionActive = false;
    
    try {
      // CORRECTION: Utiliser execute pour BEGIN TRANSACTION
      await db.execute('BEGIN TRANSACTION');
      transactionActive = true;
      
      // 1. Insérer la vente
      const result = await db.execute(`
        INSERT INTO ventes (
          code_vente, idClient, nom_prenom, contact,
          montant_ht, montant_tva, montant_ttc, type_vente, observation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sale.code_vente, 
        sale.idClient, 
        sale.nom_prenom,
        sale.contact, 
        sale.montant_ht,
        sale.montant_tva,
        sale.montant_ttc,
        sale.type_vente,
        sale.observation
      ]);
      
      const venteId = result.lastInsertId;
      
      if (!venteId) {
        throw new Error('Impossible de récupérer l\'ID de la vente');
      }
      
      // 2. Insérer les détails
      for (const detail of details) {
        await db.execute(`
          INSERT INTO vente_details (
            idVente, idProduit, quantite, 
            prix_unitaire_ht, prix_unitaire_ttc, 
            remise_percent, tva_taux
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          venteId, 
          detail.idProduit, 
          detail.quantite,
          detail.prix_unitaire_ht,
          detail.prix_unitaire_ttc,
          detail.remise_percent || 0,
          detail.tva_taux || 18
        ]);
        
        // Mettre à jour le stock
        await db.execute(`
          UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?
        `, [detail.quantite, detail.idProduit]);
      }
      
      await db.execute('COMMIT');
      transactionActive = false;
      return Number(venteId);
      
    } catch (error) {
      console.error('❌ Erreur lors de la création de la vente:', error);
      
      // CORRECTION: Vérifier si une transaction est active avant de faire ROLLBACK
      if (transactionActive) {
        try {
          await db.execute('ROLLBACK');
        } catch (rollbackError) {
          console.error('Erreur lors du rollback:', rollbackError);
        }
      }
      throw error;
    }
  },

  getTodaySales: async (): Promise<{ total: number; count: number }> => {
    const db = await getDb();
    const results = await db.select<any[]>(`
      SELECT 
        COALESCE(SUM(montant_ttc), 0) as total,
        COUNT(*) as count
      FROM ventes
      WHERE date(date_vente) = date('now')
    `);
    return { total: results[0]?.total || 0, count: results[0]?.count || 0 };
  },

  getSalesByPeriod: async (startDate: string, endDate: string): Promise<any[]> => {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT 
        date(date_vente) as date,
        COUNT(*) as nb_ventes,
        SUM(montant_ttc) as total
      FROM ventes
      WHERE date(date_vente) BETWEEN ? AND ?
      GROUP BY date(date_vente)
      ORDER BY date(date_vente)
    `, [startDate, endDate]);
  },

  getTopProducts: async (limit: number = 10): Promise<any[]> => {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT 
        p.idProduit,
        p.designation,
        p.code_produit,
        SUM(vd.quantite) as quantite_vendue,
        SUM(vd.quantite * vd.prix_unitaire_ht) as chiffre_affaires
      FROM vente_details vd
      JOIN products p ON vd.idProduit = p.idProduit
      GROUP BY p.idProduit
      ORDER BY quantite_vendue DESC
      LIMIT ?
    `, [limit]);
  }
};