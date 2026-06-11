// src/database/repositories/stockRevendeurRepository.ts

import { getDb } from "../db";

export interface StockRevendeur {
  idStockRevendeur: number;

  idProduit: number;

  idRevendeur: number;

  qte_stock: number;
}

export const stockRevendeurRepository = {

  /**
   * Stock complet d'un revendeur
   */
  async getByRevendeur(
    idRevendeur: number
  ) {

    const db = await getDb();

    return await db.select<any[]>(`
      SELECT

        sr.idStockRevendeur,

        sr.idProduit,

        sr.idRevendeur,

        sr.qte_stock,

        p.code_produit,

        p.designation,

        p.prix_achat_base,

        p.prix_vente_gros,

        p.commission_pourcentage

      FROM stock_revendeur sr

      INNER JOIN products p
      ON p.idProduit = sr.idProduit

      WHERE sr.idRevendeur = ?

      ORDER BY p.designation
    `, [idRevendeur]);
  },

  /**
   * Stock d'un produit chez un revendeur
   */
  async getProduitRevendeur(
    idRevendeur: number,
    idProduit: number
  ) {

    const db = await getDb();

    const result =
      await db.select<any[]>(`
        SELECT *
        FROM stock_revendeur
        WHERE idRevendeur = ?
        AND idProduit = ?
      `,
      [
        idRevendeur,
        idProduit
      ]);

    return result[0] || null;
  },

  /**
   * Ajouter du stock
   * (commande revendeur)
   */
  async approvisionner(
    idRevendeur: number,
    idProduit: number,
    quantite: number
  ) {

    const db = await getDb();

    const existant =
      await this.getProduitRevendeur(
        idRevendeur,
        idProduit
      );

    if (existant) {

      await db.execute(`
        UPDATE stock_revendeur
        SET qte_stock =
            qte_stock + ?
        WHERE idStockRevendeur = ?
      `,
      [
        quantite,
        existant.idStockRevendeur
      ]);

    } else {

      await db.execute(`
        INSERT INTO stock_revendeur
        (
          idProduit,
          idRevendeur,
          qte_stock
        )
        VALUES (?, ?, ?)
      `,
      [
        idProduit,
        idRevendeur,
        quantite
      ]);
    }
  },

  /**
   * Décompte
   * Retirer du stock
   */
  async retirer(
    idRevendeur: number,
    idProduit: number,
    quantite: number
  ) {

    const db = await getDb();

    const stock =
      await this.getProduitRevendeur(
        idRevendeur,
        idProduit
      );

    if (!stock) {

      throw new Error(
        "Stock revendeur introuvable"
      );
    }

    if (
      stock.qte_stock <
      quantite
    ) {

      throw new Error(
        "Stock insuffisant"
      );
    }

    await db.execute(`
      UPDATE stock_revendeur
      SET qte_stock =
          qte_stock - ?
      WHERE idStockRevendeur = ?
    `,
    [
      quantite,
      stock.idStockRevendeur
    ]);
  },

  /**
   * Quantité disponible
   */
  async getQuantiteDisponible(
    idRevendeur: number,
    idProduit: number
  ): Promise<number> {

    const stock =
      await this.getProduitRevendeur(
        idRevendeur,
        idProduit
      );

    return stock
      ? Number(stock.qte_stock)
      : 0;
  },

  /**
   * Vérifier disponibilité
   */
  async verifierDisponibilite(
    idRevendeur: number,
    idProduit: number,
    quantite: number
  ): Promise<boolean> {

    const disponible =
      await this.getQuantiteDisponible(
        idRevendeur,
        idProduit
      );

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

  async getHistorique(
  idRevendeur: number
) {

  const db = await getDb();

  return await db.select<any[]>(`

    SELECT

      mr.*,

      p.code_produit,

      p.designation,

      c.code_commande,

      d.code_decompte

    FROM mouvements_revendeur mr

    INNER JOIN products p
      ON p.idProduit = mr.idProduit

    LEFT JOIN commandes c
      ON c.idCommande = mr.idCommande

    LEFT JOIN decomptes d
      ON d.idDecompte = mr.idDecompte

    WHERE mr.idRevendeur = ?

    ORDER BY mr.date_mouvement DESC

  `, [idRevendeur]);
},


  /**
   * Stock total d'un revendeur
   */
  async getValeurStock(
    idRevendeur: number
  ) {

    const db = await getDb();

    const result =
      await db.select<any[]>(`

        SELECT

          SUM(
            sr.qte_stock *
            p.prix_achat_base
          ) as valeur

        FROM stock_revendeur sr

        INNER JOIN products p
        ON p.idProduit = sr.idProduit

        WHERE sr.idRevendeur = ?

      `, [idRevendeur]);

    return Number(
      result[0]?.valeur || 0
    );
  }

  
};
