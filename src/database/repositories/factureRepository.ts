// src/database/repositories/factureRepository.ts
import { getDb } from '../db';

export interface Facture {
  idFacture: number;
  code_facture: string;
  idCommande: number;
  idClient?: number;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  type_facture: 'STANDARD' | 'REVENDEUR';
  statut: 'EN_ATTENTE' | 'PARTIELLEMENT_REGLEE' | 'REGLEE' | 'ANNULEE';
}

export interface FactureWithDetails extends Facture {
  nom_client: string | undefined;
  DateFacture: string;
  id: number;
  MontantHT: number;
  CodeFacture: string;
  commande_code?: string;
  client_nom?: string;
  client_societe?: string;
  client_tel?: string;
  montant_regle?: number;
  montant_restant?: number;
  commission_totale?: number;
  benefice_total?: number;
}

export const factureRepository = {
  getAll: async (): Promise<Facture[]> => {
    const db = await getDb();
    const factures = await db.select<any[]>(`
      SELECT 
        f.*,
        cl.NomComplet as client_nom,
        c.code_commande as code_commande
      FROM factures f
      LEFT JOIN clients cl ON f.idClient = cl.idClient
      LEFT JOIN commandes c ON f.idCommande = c.idCommande
      ORDER BY f.date_facture DESC
    `);
    return factures as Facture[];
  },

getById: async (id: number): Promise<FactureWithDetails | null> => {
  const db = await getDb();
  try {
    // Version simplifiée SANS la sous-requête
    const factures = await db.select<any[]>(`
      SELECT 
        f.*,
        c.code_commande as commande_code,
        c.type_commande,
        cl.NomComplet as client_nom,
        cl.Societe as client_societe,
        cl.Adresse as client_adresse,
        cl.Tel as client_tel,
        cl.Email as client_email,
        cl.Ville as client_ville,
        cl.TypeClient as client_type
      FROM factures f
      JOIN commandes c ON f.idCommande = c.idCommande
      LEFT JOIN clients cl ON c.idClient = cl.idClient
      WHERE f.idFacture = ?
    `, [id]);

    if (factures.length === 0) return null;

    const commandeId = factures[0].idCommande;
    const typeCommande = factures[0].type_commande;

    const details = await db.select<any[]>(`
      SELECT 
        cd.*,
        p.designation as produit_nom,
        p.code_produit,
        p.categorie
      FROM commande_details cd
      LEFT JOIN products p ON cd.idProduit = p.idProduit
      WHERE cd.idCommande = ?
    `, [commandeId]);

    let benefice_total = 0;
    let commission_totale = 0;

    if (typeCommande === 'REVENDEUR') {
      benefice_total = details.reduce((sum, d) => {
        return sum + ((d.prix_unitaire_vente - (d.prix_achat_base || 0)) * d.qte_commande);
      }, 0);

      commission_totale = details.reduce((sum, d) => {
        const benefice = (d.prix_unitaire_vente - (d.prix_achat_base || 0)) * d.qte_commande;
        return sum + (benefice * ((d.commission_pourcentage || 0) / 100));
      }, 0);
    }

    return {
      ...factures[0],
      montant_regle: 0,
      montant_restant: factures[0].montant_ttc || 0,
      benefice_total,
      commission_totale,
      details: details.map(d => ({
        ...d,
        quantite: d.qte_commande,
        prix_vente: d.prix_unitaire_vente,
        total: d.prix_unitaire_vente * d.qte_commande,
        benefice: typeCommande === 'REVENDEUR' ? (d.prix_unitaire_vente - (d.prix_achat_base || 0)) * d.qte_commande : 0,
        commission: typeCommande === 'REVENDEUR' ? ((d.prix_unitaire_vente - (d.prix_achat_base || 0)) * d.qte_commande * ((d.commission_pourcentage || 0) / 100)) : 0
      }))
    };
  } catch (error) {
    console.error('Erreur getById facture:', error);
    return null;
  }
},

  createFromCommande: async (idCommande: number): Promise<number> => {
    const db = await getDb();

    try {
      const commande = await db.select<any[]>(`
        SELECT 
          c.idCommande, 
          c.idClient, 
          c.type_commande, 
          c.montant_ht, 
          c.montant_ttc,
          cl.TypeClient as client_type
        FROM commandes c
        LEFT JOIN clients cl ON c.idClient = cl.idClient
        WHERE c.idCommande = ?
      `, [idCommande]);

      if (commande.length === 0) {
        throw new Error('Commande non trouvée');
      }

      const cmd = commande[0];
      
      // Générer un code facture unique
      const year = new Date().getFullYear();
      const lastFacture = await db.select<any[]>(`
        SELECT code_facture FROM factures 
        WHERE code_facture LIKE 'F-${year}-%'
        ORDER BY idFacture DESC LIMIT 1
      `);
      
      let nextNumber = 1;
      if (lastFacture.length > 0) {
        const lastCode = lastFacture[0].code_facture;
        const match = lastCode.match(/F-\d+-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const codeFacture = `F-${year}-${nextNumber.toString().padStart(6, '0')}`;
      const dateFacture = new Date().toISOString().split('T')[0];
      
      const typeFacture = cmd.type_commande === 'REVENDEUR' || cmd.client_type === 'revendeur' 
        ? 'REVENDEUR' 
        : 'STANDARD';

      const result = await db.execute(`
        INSERT INTO factures (
          code_facture, 
          idCommande, 
          idClient, 
          date_facture, 
          montant_ht, 
          montant_ttc, 
          statut, 
          type_facture
        ) VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?)
      `, [
        codeFacture, 
        idCommande, 
        cmd.idClient,
        dateFacture,
        cmd.montant_ht || 0, 
        cmd.montant_ttc || 0, 
        typeFacture
      ]);

      await db.execute(`
        UPDATE commandes SET 
          code_facture = ?, 
          date_facture = ?,
          statut = 'FACTUREE'
        WHERE idCommande = ?
      `, [codeFacture, dateFacture, idCommande]);

      if (typeFacture === 'REVENDEUR') {
        await db.execute(`
          UPDATE produits_revendeur SET code_facture = ?
          WHERE idCommande = ?
        `, [codeFacture, idCommande]);
      }

      return Number(result.lastInsertId);
      
    } catch (error: any) {
      console.error('Erreur createFromCommande:', error?.message);
      throw error;
    }
  },

  updateStatus: async (id: number, statut: Facture['statut']): Promise<void> => {
    const db = await getDb();
    try {
      await db.execute(`UPDATE factures SET statut = ? WHERE idFacture = ?`, [statut, id]);
    } catch (error) {
      console.error('Erreur updateStatus:', error);
      throw error;
    }
  },

  getUnpaidInvoices: async (): Promise<Facture[]> => {
    const db = await getDb();
    const factures = await db.select<any[]>(`
      SELECT 
        f.*,
        cl.NomComplet as client_nom,
        c.code_commande as code_commande
      FROM factures f
      LEFT JOIN clients cl ON f.idClient = cl.idClient
      LEFT JOIN commandes c ON f.idCommande = c.idCommande
      WHERE f.statut != 'REGLEE' 
      ORDER BY f.date_facture DESC
    `);
    return factures as Facture[];
  },

  getByPeriod: async (startDate: string, endDate: string): Promise<Facture[]> => {
    const db = await getDb();
    try {
      return await db.select<any[]>(`
        SELECT * FROM factures
        WHERE date(date_facture) BETWEEN ? AND ?
        ORDER BY date_facture DESC
      `, [startDate, endDate]);
    } catch (error) {
      console.error('Erreur getByPeriod:', error);
      return [];
    }
  },

  getCA: async (startDate: string, endDate: string): Promise<number> => {
    const db = await getDb();
    try {
      const result = await db.select<any[]>(`
        SELECT COALESCE(SUM(montant_ttc), 0) as total
        FROM factures
        WHERE date(date_facture) BETWEEN ? AND ?
        AND statut != 'ANNULEE'
      `, [startDate, endDate]);
      return result[0]?.total || 0;
    } catch (error) {
      console.error('Erreur getCA:', error);
      return 0;
    }
  }
};