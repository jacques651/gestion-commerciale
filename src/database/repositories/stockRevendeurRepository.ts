// src/database/repositories/stockRevendeurRepository.ts

import { getDb } from "../db";

export interface StockRevendeur {
  idStockRevendeur: number;
  idProduit: number;
  idRevendeur: number;
  qte_stock: number;
}

export interface ProduitRevendeurComplet {
  idStockRevendeur: number;
  idProduit: number;
  idRevendeur: number;
  qte_stock: number;
  code_produit: string;
  designation: string;
  categorie: string;
  unite_base: string;
  prix_achat_base: number;
  prix_vente_gros: number;
  commission_pourcentage: number;
}

export const stockRevendeurRepository = {

  /**
   * Stock complet d'un revendeur avec catégorie et unité
   */
  async getByRevendeur(idRevendeur: number): Promise<ProduitRevendeurComplet[]> {
    const db = await getDb();

    const results = await db.select<any[]>(`
      SELECT
        sr.idStockRevendeur,
        sr.idProduit,
        sr.idRevendeur,
        sr.qte_stock,
        p.code_produit,
        p.designation,
        p.categorie,
        p.unite_base,
        COALESCE(NULLIF(sr.prix_achat, 0), p.prix_achat_base) AS prix_achat_base,
        COALESCE(NULLIF(sr.prix_vente, 0), p.prix_vente_gros) AS prix_vente_gros,
        COALESCE(sr.commission_pourcentage, 0) AS commission_pourcentage
      FROM stock_revendeur sr
      INNER JOIN products p ON p.idProduit = sr.idProduit
      WHERE sr.idRevendeur = ?
      AND sr.qte_stock > 0
      ORDER BY p.designation ASC
    `, [idRevendeur]);

    return results.map(item => ({
      idStockRevendeur: item.idStockRevendeur,
      idProduit: item.idProduit,
      idRevendeur: item.idRevendeur,
      qte_stock: item.qte_stock || 0,
      code_produit: item.code_produit || '',
      designation: item.designation || 'Produit sans nom',
      categorie: item.categorie || 'Non catégorisé',
      unite_base: item.unite_base || 'pièce',
      prix_achat_base: item.prix_achat_base || 0,
      prix_vente_gros: item.prix_vente_gros || 0,
      commission_pourcentage: item.commission_pourcentage || 0
    }));
  },

  /**
   * Stock d'un produit chez un revendeur
   */
  async getProduitRevendeur(idRevendeur: number, idProduit: number) {
    const db = await getDb();

    const result = await db.select<any[]>(`
      SELECT *
      FROM stock_revendeur
      WHERE idRevendeur = ?
      AND idProduit = ?
    `, [idRevendeur, idProduit]);

    return result[0] || null;
  },

  /**
   * Ajouter du stock (commande revendeur)
   */
  async approvisionner(idRevendeur: number, idProduit: number, quantite: number) {
    const db = await getDb();

    const existant = await this.getProduitRevendeur(idRevendeur, idProduit);

    if (existant) {
      await db.execute(`
        UPDATE stock_revendeur
        SET qte_stock = qte_stock + ?
        WHERE idStockRevendeur = ?
      `, [quantite, existant.idStockRevendeur]);
    } else {
      await db.execute(`
        INSERT INTO stock_revendeur (idProduit, idRevendeur, qte_stock)
        VALUES (?, ?, ?)
      `, [idProduit, idRevendeur, quantite]);
    }
  },

  /**
   * Décompte - Retirer du stock
   */
  async retirer(idRevendeur: number, idProduit: number, quantite: number) {
    const db = await getDb();

    const stock = await this.getProduitRevendeur(idRevendeur, idProduit);

    if (!stock) {
      throw new Error("Stock revendeur introuvable");
    }

    if (stock.qte_stock < quantite) {
      throw new Error("Stock insuffisant");
    }

    await db.execute(`
      UPDATE stock_revendeur
      SET qte_stock = qte_stock - ?
      WHERE idStockRevendeur = ?
    `, [quantite, stock.idStockRevendeur]);
  },

  /**
   * Quantité disponible
   */
  async getQuantiteDisponible(idRevendeur: number, idProduit: number): Promise<number> {
    const stock = await this.getProduitRevendeur(idRevendeur, idProduit);
    return stock ? Number(stock.qte_stock) : 0;
  },

  /**
   * Vérifier disponibilité
   */
  async verifierDisponibilite(idRevendeur: number, idProduit: number, quantite: number): Promise<boolean> {
    const disponible = await this.getQuantiteDisponible(idRevendeur, idProduit);
    return disponible >= quantite;
  },

  /**
   * Supprimer une ligne vide
   */
  async nettoyerStockVide() {
    const db = await getDb();
    await db.execute(`
      DELETE FROM stock_revendeur
      WHERE qte_stock <= 0
    `);
  },

  /**
   * Historique des mouvements d'un revendeur
   */
  async getHistorique(idRevendeur: number) {
    const db = await getDb();

    return await db.select<any[]>(`
      SELECT
        mr.*,
        p.code_produit,
        p.designation,
        p.categorie,
        p.unite_base,
        c.code_commande,
        d.code_decompte
      FROM mouvements_revendeur mr
      INNER JOIN products p ON p.idProduit = mr.idProduit
      LEFT JOIN commandes c ON c.idCommande = mr.idCommande
      LEFT JOIN decomptes d ON d.idDecompte = mr.idDecompte
      WHERE mr.idRevendeur = ?
      ORDER BY mr.date_mouvement DESC
    `, [idRevendeur]);
  },

  /**
   * Stock total d'un revendeur
   */
  async getValeurStock(idRevendeur: number) {
    const db = await getDb();

    const result = await db.select<any[]>(`
      SELECT
        SUM(sr.qte_stock * p.prix_achat_base) as valeur
      FROM stock_revendeur sr
      INNER JOIN products p ON p.idProduit = sr.idProduit
      WHERE sr.idRevendeur = ?
    `, [idRevendeur]);

    return Number(result[0]?.valeur || 0);
  },

  /**
   * Récupérer un produit complet avec ses infos
   */
  async getProduitComplet(idRevendeur: number, idProduit: number): Promise<ProduitRevendeurComplet | null> {
    const db = await getDb();

    const result = await db.select<any[]>(`
      SELECT
        sr.idStockRevendeur,
        sr.idProduit,
        sr.idRevendeur,
        sr.qte_stock,
        p.code_produit,
        p.designation,
        p.categorie,
        p.unite_base,
        COALESCE(NULLIF(sr.prix_achat, 0), p.prix_achat_base) AS prix_achat_base,
        COALESCE(NULLIF(sr.prix_vente, 0), p.prix_vente_gros) AS prix_vente_gros,
        COALESCE(sr.commission_pourcentage, 0) AS commission_pourcentage
      FROM stock_revendeur sr
      INNER JOIN products p ON p.idProduit = sr.idProduit
      WHERE sr.idRevendeur = ?
      AND sr.idProduit = ?
    `, [idRevendeur, idProduit]);

    if (result.length === 0) return null;

    const item = result[0];
    return {
      idStockRevendeur: item.idStockRevendeur,
      idProduit: item.idProduit,
      idRevendeur: item.idRevendeur,
      qte_stock: item.qte_stock || 0,
      code_produit: item.code_produit || '',
      designation: item.designation || 'Produit sans nom',
      categorie: item.categorie || 'Non catégorisé',
      unite_base: item.unite_base || 'pièce',
      prix_achat_base: item.prix_achat_base || 0,
      prix_vente_gros: item.prix_vente_gros || 0,
      commission_pourcentage: item.commission_pourcentage || 0
    };
  }
};
