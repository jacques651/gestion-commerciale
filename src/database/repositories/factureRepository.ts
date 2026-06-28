// src/database/repositories/factureRepository.ts

import { getDb } from "../db";

export interface Facture {
  NomComplet: string;
  client_nom: string;
  idFacture: number;
  code_facture: string;
  idClient: number;
  idCommande: number;
  date_facture: string;
  montant_ttc: number;
  montant_regle: number;
  statut: string;
}

export const factureRepository = {

  async getAll(): Promise<any[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT
        f.*,
        c.NomComplet,
        c.Societe,
        cmd.code_commande
      FROM factures f
      LEFT JOIN clients c ON c.idClient = f.idClient
      LEFT JOIN commandes cmd ON cmd.idCommande = f.idCommande
      ORDER BY f.idFacture DESC
    `);
  },

  async getById(idFacture: number) {
    const db = await getDb();
    const facture = await db.select<any[]>(`
      SELECT
        f.*,
        c.NomComplet,
        c.Societe,
        c.Tel,
        c.Adresse,
        cmd.code_commande,
        cmd.type_commande
      FROM factures f
      INNER JOIN clients c ON c.idClient = f.idClient
      INNER JOIN commandes cmd ON cmd.idCommande = f.idCommande
      WHERE f.idFacture = ?
    `, [idFacture]);

    if (facture.length === 0) {
      return null;
    }

    // ✅ Récupérer les détails avec les bons noms de colonnes
    const details = await db.select<any[]>(`
      SELECT
        fd.idDetailFacture,
        fd.idProduit,
        fd.qte,
        fd.prix_unitaire,
        p.code_produit,
        p.designation,
        p.categorie,
        p.unite_base,
        p.prix_achat_base,
        p.prix_vente_gros
      FROM facture_details fd
      INNER JOIN products p ON p.idProduit = fd.idProduit
      WHERE fd.idFacture = ?
    `, [idFacture]);

    return {
      ...facture[0],
      details
    };
  },

  // ✅ Générer un code facture unique
  async generateCode(): Promise<string> {
    const db = await getDb();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const prefix = `FAC-${year}${month}${day}-`;
    
    const result = await db.select<any[]>(`
      SELECT COUNT(*) as count FROM factures 
      WHERE code_facture LIKE ?
    `, [prefix + '%']);
    
    const count = (result[0]?.count || 0) + 1;
    return `${prefix}${String(count).padStart(4, '0')}`;
  },

  // ✅ Créer une facture à partir d'une commande - VERSION CORRIGÉE
  async createFromCommande(idCommande: number): Promise<number> {
    const db = await getDb();

    // 1. Vérifier que la commande existe
    const commande = await db.select<any[]>(`
      SELECT 
        c.*,
        cl.NomComplet,
        cl.Societe,
        cl.Tel,
        cl.Adresse
      FROM commandes c
      INNER JOIN clients cl ON cl.idClient = c.idClient
      WHERE c.idCommande = ?
    `, [idCommande]);

    if (commande.length === 0) {
      throw new Error("Commande introuvable");
    }

    const cmd = commande[0];

    // 2. Vérifier si une facture existe déjà
    const existe = await db.select<any[]>(`
      SELECT idFacture, code_facture
      FROM factures
      WHERE idCommande = ?
    `, [idCommande]);

    if (existe.length > 0) {
      return Number(existe[0].idFacture);
    }

    // 3. Récupérer les détails de la commande
    const details = await db.select<any[]>(`
      SELECT 
        cd.idProduit,
        cd.qte_commande,
        cd.prix_unitaire_vente,
        p.designation,
        p.code_produit,
        p.categorie,
        p.unite_base,
        p.prix_achat_base,
        p.prix_vente_gros
      FROM commande_details cd
      INNER JOIN products p ON p.idProduit = cd.idProduit
      WHERE cd.idCommande = ?
    `, [idCommande]);

    if (details.length === 0) {
      throw new Error("Aucun produit dans la commande");
    }

    // 4. Générer le code facture
    const codeFacture = await this.generateCode();

    // 5. Calculer les montants
    const montantHT = details.reduce((sum, d) => sum + (d.prix_unitaire_vente * d.qte_commande), 0);
    const tva = montantHT * 0.18;
    const montantTTC = montantHT + tva;

    // 6. Insérer la facture (colonnes réelles de la table)
    const result = await db.execute(`
      INSERT INTO factures (
        code_facture,
        idClient,
        idCommande,
        date_facture,
        montant_ht,
        montant_tva,
        montant_ttc,
        montant_regle,
        statut
      ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
    `, [
      codeFacture,
      cmd.idClient,
      idCommande,
      montantHT,
      tva,
      montantTTC,
      0,
      'EN_ATTENTE',
    ]);

    const idFacture = Number(result.lastInsertId);

    // 7. ✅ Insérer les détails de la facture - UTILISE LES BONNES COLONNES
    for (const detail of details) {
      await db.execute(`
        INSERT INTO facture_details (
          idFacture,
          idProduit,
          qte,
          prix_unitaire
        ) VALUES (?, ?, ?, ?)
      `, [
        idFacture,
        detail.idProduit,
        detail.qte_commande,
        detail.prix_unitaire_vente
      ]);
    }

    // 8. Mettre à jour la commande avec le code facture
    await db.execute(`
      UPDATE commandes SET code_facture = ? WHERE idCommande = ?
    `, [codeFacture, idCommande]);

    return idFacture;
  },

  async updateStatus(idFacture: number, statut: string) {
    const db = await getDb();
    await db.execute(`
      UPDATE factures
      SET statut = ?
      WHERE idFacture = ?
    `, [statut, idFacture]);
  },

  async getUnpaidInvoices() {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT *
      FROM factures
      WHERE statut <> 'REGLEE'
      ORDER BY idFacture DESC
    `);
  },

  async delete(idFacture: number) {
    const db = await getDb();

    // Supprimer d'abord les détails
    await db.execute(`
      DELETE FROM facture_details WHERE idFacture = ?
    `, [idFacture]);

    // Puis la facture
    await db.execute(`
      DELETE FROM factures WHERE idFacture = ?
    `, [idFacture]);
  },

  // ✅ Récupérer les détails d'une facture
  async getDetails(idFacture: number): Promise<any[]> {
    const db = await getDb();
    
    return await db.select<any[]>(`
      SELECT 
        fd.*,
        p.designation,
        p.code_produit,
        p.categorie,
        p.unite_base
      FROM facture_details fd
      INNER JOIN products p ON p.idProduit = fd.idProduit
      WHERE fd.idFacture = ?
    `, [idFacture]);
  },

  // ✅ Vérifier si une facture existe pour une commande
  async getByCommande(idCommande: number): Promise<any> {
    const db = await getDb();
    
    const result = await db.select<any[]>(`
      SELECT * FROM factures WHERE idCommande = ?
    `, [idCommande]);
    
    return result.length > 0 ? result[0] : null;
  }
};