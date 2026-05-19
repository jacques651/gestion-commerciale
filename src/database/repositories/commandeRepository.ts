// src/database/repositories/commandeRepository.ts
import { getDb } from '../db';

export interface Commande {
  DateCommande: string;
  facture: any;
  Facture: any;
  MontantHT: number;
  idCommande: number;
  code_commande: string;
  idClient: number;
  type_commande: string;
  date_commande: string;
  adresse_livraison: string | null;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_remise: number;
  montant_net: number;
  statut: string;
  source: string;
  notes: string | null;
  signature_base64: string | null;
  code_facture: string | null;
  date_facture: string | null;
  client_nom?: string;
  client_societe?: string;
  client_tel?: string;
  client_email?: string;
  client_adresse?: string;
  client_ville?: string;
}

export interface CommandeDetail {
  idDetail: number;
  idCommande: number;
  idProduit: number;
  idConditionnement: number | null;
  qte_commande: number;
  prix_unitaire_vente: number;
  remise: number;
  produit_designation?: string;
  code_produit?: string;
  categorie?: string;
}

export type CreateCommandeInput = {
  code_commande: string;
  idClient: number;
  type_commande?: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_remise?: number;
  montant_net?: number;
  statut?: string;
  source?: string;
  notes?: string;
  adresse_livraison?: string;
};

export type CreateCommandeDetailInput = {
  idProduit: number;
  qte_commande: number;
  prix_unitaire_vente: number;
  remise?: number;
  idConditionnement?: number | null;
};

export const commandeRepository = {
  getAll: async (): Promise<Commande[]> => {
    const db = await getDb();
    const commandes = await db.select<any[]>(`
      SELECT 
        c.*,
        cl.NomComplet as client_nom,
        cl.Societe as client_societe,
        cl.Tel as client_tel,
        cl.Email as client_email,
        cl.Adresse as client_adresse,
        cl.Ville as client_ville
      FROM commandes c
      LEFT JOIN clients cl ON c.idClient = cl.idClient
      ORDER BY c.idCommande DESC
    `);
    return commandes as Commande[];
  },

  getById: async (id: number): Promise<any> => {
    const db = await getDb();

    const commandes = await db.select<any[]>(`
      SELECT 
        c.*,
        cl.NomComplet as client_nom,
        cl.Societe as client_societe,
        cl.Tel as client_tel,
        cl.Email as client_email,
        cl.Adresse as client_adresse,
        cl.Ville as client_ville
      FROM commandes c
      LEFT JOIN clients cl ON c.idClient = cl.idClient
      WHERE c.idCommande = ?
    `, [id]);

    if (commandes.length === 0) return null;

    const details = await db.select<any[]>(`
      SELECT 
        cd.*,
        p.designation as produit_designation,
        p.code_produit,
        p.categorie
      FROM commande_details cd
      LEFT JOIN products p ON cd.idProduit = p.idProduit
      WHERE cd.idCommande = ?
    `, [id]);

    return {
      ...commandes[0],
      details: details
    };
  },


create: async (commande: CreateCommandeInput, details: CreateCommandeDetailInput[]): Promise<number> => {
  const db = await getDb();

  try {
    const result = await db.execute(`
      INSERT INTO commandes (
        code_commande,
        idClient,
        type_commande,
        montant_ht,
        montant_tva,
        montant_ttc,
        montant_remise,
        montant_net,
        statut,
        source,
        notes,
        date_commande
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      commande.code_commande,
      commande.idClient,
      commande.type_commande || 'STANDARD',
      commande.montant_ht,
      commande.montant_tva || 0,
      commande.montant_ttc,
      commande.montant_remise || 0,
      commande.montant_net || commande.montant_ttc,
      commande.statut || 'CONFIRMEE',
      commande.source || 'DIRECT',
      commande.notes || null
    ]);

    const commandeId = result.lastInsertId;

    if (!commandeId) {
      throw new Error('Impossible de récupérer l\'ID de la commande');
    }

    for (const detail of details) {
      await db.execute(`
        INSERT INTO commande_details (
          idCommande,
          idProduit,
          qte_commande,
          prix_unitaire_vente,
          remise
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        commandeId,
        detail.idProduit,
        detail.qte_commande,
        detail.prix_unitaire_vente,
        detail.remise || 0
      ]);

      await db.execute(`
        UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?
      `, [detail.qte_commande, detail.idProduit]);
    }
    
    return Number(commandeId);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erreur création commande';
    console.error('Erreur création commande:', errorMsg);
    throw error;
  }
},


  updateStatus: async (id: number, statut: string): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      UPDATE commandes SET statut = ? WHERE idCommande = ?
    `, [statut, id]);
  },

  cancel: async (id: number): Promise<void> => {
    const db = await getDb();

    const details = await db.select<any[]>(`
      SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?
    `, [id]);

    for (const detail of details) {
      await db.execute(`
        UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?
      `, [detail.qte_commande, detail.idProduit]);
    }

    await db.execute(`
      UPDATE commandes SET statut = 'ANNULEE' WHERE idCommande = ?
    `, [id]);
  },


// src/database/repositories/commandeRepository.ts

delete: async (id: number): Promise<void> => {
  console.log('🔍 Tentative de suppression commande ID:', id);
  const db = await getDb();
  
  try {
    // 1. Vérifier si la commande existe
    const commande = await db.select<any[]>(`
      SELECT idCommande, code_commande FROM commandes WHERE idCommande = ?
    `, [id]);
    
    if (commande.length === 0) {
      console.log('❌ Commande non trouvée');
      throw new Error('Commande non trouvée');
    }
    
    console.log('📦 Commande trouvée:', commande[0].code_commande);
    
    // 2. Récupérer les détails pour restaurer le stock
    const details = await db.select<any[]>(`
      SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?
    `, [id]);
    
    console.log(`📋 ${details.length} détail(s) trouvé(s)`);
    
    // 3. Restaurer le stock
    for (const detail of details) {
      await db.execute(`
        UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?
      `, [detail.qte_commande, detail.idProduit]);
      console.log(`✅ Stock restauré pour produit ${detail.idProduit}: +${detail.qte_commande}`);
    }
    
    // 4. Supprimer les détails
    if (details.length > 0) {
      await db.execute(`DELETE FROM commande_details WHERE idCommande = ?`, [id]);
      console.log('🗑️ Détails supprimés');
    }
    
    // 5. Supprimer la commande
    await db.execute(`DELETE FROM commandes WHERE idCommande = ?`, [id]);
    console.log('✅ Commande supprimée avec succès');
    
  } catch (error: any) {
    const errorMsg = error?.message || 'Erreur lors de la suppression de la commande';
    console.error('❌ Erreur delete commande:', errorMsg);
    throw new Error(errorMsg);
  }
},

  getByClient: async (clientId: number): Promise<Commande[]> => {
    const db = await getDb();
    const commandes = await db.select<any[]>(`
      SELECT 
        c.*,
        cl.NomComplet as client_nom,
        cl.Societe as client_societe,
        cl.Tel as client_tel,
        cl.Email as client_email,
        cl.Adresse as client_adresse,
        cl.Ville as client_ville
      FROM commandes c
      LEFT JOIN clients cl ON c.idClient = cl.idClient
      WHERE c.idClient = ?
      ORDER BY c.date_commande DESC
    `, [clientId]);
    return commandes as Commande[];
  },

  getByStatus: async (statut: string): Promise<Commande[]> => {
    const db = await getDb();
    const commandes = await db.select<any[]>(`
      SELECT 
        c.*,
        cl.NomComplet as client_nom,
        cl.Societe as client_societe,
        cl.Tel as client_tel,
        cl.Email as client_email,
        cl.Adresse as client_adresse,
        cl.Ville as client_ville
      FROM commandes c
      LEFT JOIN clients cl ON c.idClient = cl.idClient
      WHERE c.statut = ?
      ORDER BY c.date_commande DESC
    `, [statut]);
    return commandes as Commande[];
  },

  getTodayCommandes: async (): Promise<{ total: number; count: number }> => {
    const db = await getDb();
    const results = await db.select<any[]>(`
      SELECT 
        COALESCE(SUM(montant_ttc), 0) as total,
        COUNT(*) as count
      FROM commandes
      WHERE date(date_commande) = date('now')
    `);
    return { total: results[0]?.total || 0, count: results[0]?.count || 0 };
  }
};