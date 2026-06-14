// src/database/repositories/mouvementRepository.ts
import { getDb } from '../db';

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

export const mouvementRepository = {
  // Créer un mouvement de stock
  create: async (data: Omit<MouvementStock, 'idMouvement' | 'date_mouvement'>): Promise<number> => {
    const db = await getDb();
    const result = await db.execute(`
      INSERT INTO mouvements_stock (
        idProduit, type_mouvement, quantite, stock_avant, stock_apres,
        prix_unitaire, reference, notes, idLot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.idProduit,
      data.type_mouvement,
      data.quantite,
      data.stock_avant,
      data.stock_apres,
      data.prix_unitaire || null,
      data.reference || null,
      data.notes || null,
      data.idLot || null
    ]);
    
    return Number(result.lastInsertId);
  },

  // Récupérer les mouvements d'un produit
  getByProduct: async (idProduit: number, limit: number = 100): Promise<MouvementStock[]> => {
    const db = await getDb();
    const mouvements = await db.select<any[]>(`
      SELECT 
        m.idMouvement,
        m.idProduit,
        m.type_mouvement,
        m.quantite,
        m.stock_avant,
        m.stock_apres,
        m.prix_unitaire,
        m.reference,
        m.notes,
        m.date_mouvement,
        m.idLot,
        l.code_lot
      FROM mouvements_stock m
      LEFT JOIN lots_stock l ON m.idLot = l.idLot
      WHERE m.idProduit = ?
      ORDER BY m.date_mouvement DESC
      LIMIT ?
    `, [idProduit, limit]);
    
    return mouvements as MouvementStock[];
  },

  // Récupérer tous les mouvements récents
  getRecent: async (limit: number = 50): Promise<MouvementStock[]> => {
    const db = await getDb();
    const mouvements = await db.select<any[]>(`
      SELECT 
        m.idMouvement,
        m.idProduit,
        p.code_produit,
        p.designation,
        m.type_mouvement,
        m.quantite,
        m.stock_avant,
        m.stock_apres,
        m.prix_unitaire,
        m.reference,
        m.notes,
        m.date_mouvement,
        m.idLot
      FROM mouvements_stock m
      JOIN products p ON m.idProduit = p.idProduit
      ORDER BY m.date_mouvement DESC
      LIMIT ?
    `, [limit]);
    
    return mouvements as MouvementStock[];
  },

  // Annuler un mouvement
  annuler: async (idMouvement: number, motif: string): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      UPDATE mouvements_stock 
      SET notes = COALESCE(notes, '') || ' | ANNULÉ: ' || ?
      WHERE idMouvement = ?
    `, [motif, idMouvement]);
  }
};