// src/database/repositories/lotRepository.ts
import { getDb } from '../db';

export interface LotStock {
  idLot: number;
  idProduit: number;
  code_lot: string;
  quantite_entree: number;
  quantite_restante: number;
  prix_achat_unitaire: number;
  prix_vente_unitaire: number;
  date_entree: string;
  date_expiration?: string;
  reference_facture?: string;
  idFournisseur?: number;
  notes?: string;
  est_supprime: number;
  created_at: string;
}

export interface MouvementStock {
  idMouvement: number;
  idProduit: number;
  type_mouvement: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'PERTE';
  quantite: number;
  stock_avant: number;
  stock_apres: number;
  prix_unitaire?: number;
  reference?: string;
  notes?: string;
  date_mouvement: string;
  idLot?: number;
}

export interface SortieLot {
  idSortieLot: number;
  idLot: number;
  idMouvement: number;
  quantite_sortie: number;
  prix_vente_unitaire: number;
}

export const lotRepository = {
  // Générer un code de lot unique
  generateLotCode: (idProduit: number): string => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `LOT-${idProduit}-${dateStr}-${timeStr}`;
  },

  // Ajouter un nouveau lot (entrée de stock)
  createLot: async (data: {
    idProduit: number;
    quantite_entree: number;
    prix_achat_unitaire: number;
    prix_vente_unitaire: number;
    date_entree: string;
    reference_facture?: string;
    idFournisseur?: number;
    notes?: string;
  }): Promise<number> => {
    const db = await getDb();
    const codeLot = lotRepository.generateLotCode(data.idProduit);
    
    const result = await db.execute(`
      INSERT INTO lots_stock (
        idProduit, code_lot, quantite_entree, quantite_restante,
        prix_achat_unitaire, prix_vente_unitaire, date_entree,
        reference_facture, idFournisseur, notes, est_supprime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      data.idProduit,
      codeLot,
      data.quantite_entree,
      data.quantite_entree,
      data.prix_achat_unitaire,
      data.prix_vente_unitaire,
      data.date_entree,
      data.reference_facture || null,
      data.idFournisseur || null,
      data.notes || null
    ]);
    
    return Number(result.lastInsertId);
  },

  // Récupérer tous les lots d'un produit
  getLotsByProduct: async (idProduit: number): Promise<LotStock[]> => {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        idLot, idProduit, code_lot, quantite_entree, quantite_restante,
        prix_achat_unitaire, prix_vente_unitaire, date_entree,
        date_expiration, reference_facture, idFournisseur, notes,
        est_supprime, created_at
      FROM lots_stock 
      WHERE idProduit = ? AND est_supprime = 0
      ORDER BY date_entree ASC
    `, [idProduit]);
    
    return (result as any[]) as LotStock[];
  },

  // Récupérer les lots avec stock restant (FIFO)
  getAvailableLots: async (idProduit: number): Promise<LotStock[]> => {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        idLot, idProduit, code_lot, quantite_entree, quantite_restante,
        prix_achat_unitaire, prix_vente_unitaire, date_entree,
        date_expiration, reference_facture, idFournisseur, notes
      FROM lots_stock 
      WHERE idProduit = ? AND quantite_restante > 0 AND est_supprime = 0
      ORDER BY date_entree ASC
    `, [idProduit]);
    
    return (result as any[]) as LotStock[];
  },

  // Mettre à jour la quantité restante d'un lot
  updateLotQuantity: async (idLot: number, quantiteSortie: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      UPDATE lots_stock 
      SET quantite_restante = quantite_restante - ?
      WHERE idLot = ?
    `, [quantiteSortie, idLot]);
  },

  // Enregistrer une sortie de lot
  createSortieLot: async (data: {
    idLot: number;
    idMouvement: number;
    quantite_sortie: number;
    prix_vente_unitaire: number;
  }): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      INSERT INTO sorties_lots (idLot, idMouvement, quantite_sortie, prix_vente_unitaire)
      VALUES (?, ?, ?, ?)
    `, [data.idLot, data.idMouvement, data.quantite_sortie, data.prix_vente_unitaire]);
  },

  // Récupérer l'historique des prix d'un produit
  getHistoriquePrix: async (idProduit: number, limit: number = 50): Promise<any[]> => {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        h.idHistorique,
        h.idProduit,
        h.date_changement,
        h.ancien_prix_achat,
        h.nouveau_prix_achat,
        h.ancien_prix_vente,
        h.nouveau_prix_vente,
        h.motif,
        l.code_lot,
        l.reference_facture
      FROM historique_prix h
      LEFT JOIN lots_stock l ON h.idLot = l.idLot
      WHERE h.idProduit = ?
      ORDER BY h.date_changement DESC
      LIMIT ?
    `, [idProduit, limit]);
    
    return result as any[];
  },

  // Recalculer le PMP et le stock total d'un produit
  recalculerPMP: async (idProduit: number): Promise<{ stockTotal: number; pmp: number }> => {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        COALESCE(SUM(quantite_restante), 0) as stock_total,
        CASE 
          WHEN COALESCE(SUM(quantite_restante), 0) > 0 
          THEN ROUND(SUM(quantite_restante * prix_achat_unitaire) / SUM(quantite_restante), 2)
          ELSE 0
        END as pmp
      FROM lots_stock 
      WHERE idProduit = ? AND est_supprime = 0
    `, [idProduit]);
    
    const data = (result as any[])[0] || { stock_total: 0, pmp: 0 };
    return {
      stockTotal: Number(data.stock_total) || 0,
      pmp: Number(data.pmp) || 0
    };
  },

  // Annuler un lot (suppression logique)
  annulerLot: async (idLot: number, motif: string): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      UPDATE lots_stock 
      SET est_supprime = 1, notes = ? 
      WHERE idLot = ?
    `, [motif, idLot]);
  },

  // Statistiques des lots
  getStatistiques: async (): Promise<{
    totalLots: number;
    lotsActifs: number;
    valeurStock: number;
    nombreProduits: number;
  }> => {
    const db = await getDb();
    const result = await db.select(`
      SELECT 
        COUNT(DISTINCT idLot) as totalLots,
        SUM(CASE WHEN quantite_restante > 0 THEN 1 ELSE 0 END) as lotsActifs,
        ROUND(SUM(quantite_restante * prix_achat_unitaire), 2) as valeurStock,
        COUNT(DISTINCT idProduit) as nombreProduits
      FROM lots_stock
      WHERE est_supprime = 0
    `);
    
    const data = (result as any[])[0] || { totalLots: 0, lotsActifs: 0, valeurStock: 0, nombreProduits: 0 };
    return {
      totalLots: Number(data.totalLots) || 0,
      lotsActifs: Number(data.lotsActifs) || 0,
      valeurStock: Number(data.valeurStock) || 0,
      nombreProduits: Number(data.nombreProduits) || 0
    };
  }
};