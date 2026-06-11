// src/services/StockService.ts

import { getDb } from "../database/db";
import MouvementService from "./MouvementService";

export default class StockService {

  static async increaseStock(
    idProduit: number,
    quantite: number,
    motif = "Réapprovisionnement"
  ) {

    const db = await getDb();

    const produit = await db.select<any[]>(
      `
      SELECT qte_stock
      FROM products
      WHERE idProduit = ?
      `,
      [idProduit]
    );

    if (!produit.length) {
      throw new Error("Produit introuvable");
    }

    const stockAvant = Number(
      produit[0].qte_stock
    );

    const stockApres =
      stockAvant + quantite;

    await db.execute(
      `
      UPDATE products
      SET qte_stock = ?
      WHERE idProduit = ?
      `,
      [
        stockApres,
        idProduit
      ]
    );

    await MouvementService.create({
      idProduit,
      typeMouvement: "ENTREE",
      quantite,
      stockAvant,
      stockApres,
      motif
    });
  }

  static async decreaseStock(
    idProduit: number,
    quantite: number,
    motif = "Sortie stock"
  ) {

    const db = await getDb();

    const produit = await db.select<any[]>(
      `
      SELECT qte_stock
      FROM products
      WHERE idProduit = ?
      `,
      [idProduit]
    );

    if (!produit.length) {
      throw new Error("Produit introuvable");
    }

    const stockAvant = Number(
      produit[0].qte_stock
    );

    if (stockAvant < quantite) {
      throw new Error(
        "Stock insuffisant"
      );
    }

    const stockApres =
      stockAvant - quantite;

    await db.execute(
      `
      UPDATE products
      SET qte_stock = ?
      WHERE idProduit = ?
      `,
      [
        stockApres,
        idProduit
      ]
    );

    await MouvementService.create({
      idProduit,
      typeMouvement: "SORTIE",
      quantite,
      stockAvant,
      stockApres,
      motif
    });
  }
}