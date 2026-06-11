// src/services/StockRevendeurService.ts

import { getDb } from "../database/db";

export default class StockRevendeurService {

  static async increaseStock(
    idRevendeur: number,
    idProduit: number,
    quantite: number
  ) {

    const db = await getDb();

    const stock = await db.select<any[]>(
      `
      SELECT *
      FROM stock_revendeur
      WHERE idRevendeur = ?
      AND idProduit = ?
      `,
      [
        idRevendeur,
        idProduit
      ]
    );

    if (!stock.length) {

      await db.execute(
        `
        INSERT INTO stock_revendeur
        (
          idRevendeur,
          idProduit,
          qte_stock
        )
        VALUES
        (
          ?,
          ?,
          ?
        )
        `,
        [
          idRevendeur,
          idProduit,
          quantite
        ]
      );

    } else {

      await db.execute(
        `
        UPDATE stock_revendeur
        SET qte_stock =
        qte_stock + ?
        WHERE idRevendeur = ?
        AND idProduit = ?
        `,
        [
          quantite,
          idRevendeur,
          idProduit
        ]
      );
    }
  }

  static async decreaseStock(
    idRevendeur: number,
    idProduit: number,
    quantite: number
  ) {

    const db = await getDb();

    const stock = await db.select<any[]>(
      `
      SELECT qte_stock
      FROM stock_revendeur
      WHERE idRevendeur = ?
      AND idProduit = ?
      `,
      [
        idRevendeur,
        idProduit
      ]
    );

    if (!stock.length) {
      throw new Error(
        "Produit absent du stock revendeur"
      );
    }

    const stockActuel =
      Number(stock[0].qte_stock);

    if (stockActuel < quantite) {
      throw new Error(
        "Stock revendeur insuffisant"
      );
    }

    await db.execute(
      `
      UPDATE stock_revendeur
      SET qte_stock =
      qte_stock - ?
      WHERE idRevendeur = ?
      AND idProduit = ?
      `,
      [
        quantite,
        idRevendeur,
        idProduit
      ]
    );
  }
}