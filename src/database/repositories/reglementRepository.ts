// src/database/repositories/reglementRepository.ts
import { getDb } from '../db';

export interface Reglement {
  idReglement: number;
  code_reglement: string;
  idClient: number | null;
  idFacture: number | null;
  idDecompte: number | null;
  date_reglement: string;
  montant: number;
  mode_reglement: string;
  reference: string | null;
  observation: string | null;
}

// Type pour la création (sans idReglement, date_reglement et code_reglement)
export type CreateReglementInput = Omit<Reglement, 'idReglement' | 'date_reglement' | 'code_reglement'>;

export const reglementRepository = {
  getAll: async (): Promise<Reglement[]> => {
    const db = await getDb();
    const reglements = await db.select<any[]>(`
      SELECT r.*, c.nom_complet as client_nom
      FROM reglements r
      LEFT JOIN clients c ON r.idClient = c.idClient
      ORDER BY r.date_reglement DESC
    `);
    return reglements as Reglement[];
  },

  // CORRECTION: Utiliser CreateReglementInput
  create: async (reglement: CreateReglementInput): Promise<number> => {
    const db = await getDb();
    
    await db.execute('BEGIN TRANSACTION');
    
    try {
      const code_reglement = `REG-${Date.now()}`;
      
      await db.execute(`
        INSERT INTO reglements (
          code_reglement, idClient, idFacture, idDecompte,
          date_reglement, montant, mode_reglement, reference, observation
        ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
      `, [
        code_reglement, 
        reglement.idClient, 
        reglement.idFacture, 
        reglement.idDecompte,
        reglement.montant, 
        reglement.mode_reglement, 
        reglement.reference, 
        reglement.observation
      ]);
      
      const result = await db.select<{ id: number }[]>(`SELECT last_insert_rowid() as id`);
      const reglementId = result[0]?.id || 0;
      
      // Mettre à jour le statut de la facture si nécessaire
      if (reglement.idFacture) {
        // Vérifier le montant total réglé pour cette facture
        const totalRegle = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant), 0) as total
          FROM reglements
          WHERE idFacture = ?
        `, [reglement.idFacture]);
        
        const facture = await db.select<any[]>(`
          SELECT montant_ttc FROM factures WHERE idFacture = ?
        `, [reglement.idFacture]);
        
        if (facture.length > 0) {
          const montantRestant = facture[0].montant_ttc - totalRegle[0].total;
          let nouveauStatut = 'PARTIELLEMENT_REGLEE';
          if (montantRestant <= 0) {
            nouveauStatut = 'REGLEE';
          }
          await db.execute(`UPDATE factures SET statut = ? WHERE idFacture = ?`, [nouveauStatut, reglement.idFacture]);
        }
      }
      
      await db.execute('COMMIT');
      return reglementId;
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  },

  getByFactureId: async (idFacture: number): Promise<Reglement[]> => {
    const db = await getDb();
    const reglements = await db.select<any[]>(`
      SELECT * FROM reglements WHERE idFacture = ? ORDER BY date_reglement DESC
    `, [idFacture]);
    return reglements as Reglement[];
  },

  getByClientId: async (idClient: number): Promise<Reglement[]> => {
    const db = await getDb();
    const reglements = await db.select<any[]>(`
      SELECT r.*, f.code_facture
      FROM reglements r
      LEFT JOIN factures f ON r.idFacture = f.idFacture
      WHERE r.idClient = ?
      ORDER BY r.date_reglement DESC
    `, [idClient]);
    return reglements as Reglement[];
  },

  getTotalByPeriod: async (startDate: string, endDate: string): Promise<number> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM reglements
      WHERE date(date_reglement) BETWEEN ? AND ?
    `, [startDate, endDate]);
    return result[0]?.total || 0;
  }
};