// src/services/StockService.ts

import { getDb } from "../database/db";
import MouvementService from "./MouvementService";

export default class StockService {

  static async increaseStock(
    idProduit: number,
    quantite: number,
    motif = "Réapprovisionnement"
  ): Promise<{ success: boolean; message?: string; stockAvant?: number; stockApres?: number }> {
    try {
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
        return { success: false, message: "Produit introuvable" };
      }

      const stockAvant = Number(produit[0].qte_stock);
      const stockApres = stockAvant + quantite;

      await db.execute(
        `
        UPDATE products
        SET qte_stock = ?
        WHERE idProduit = ?
        `,
        [stockApres, idProduit]
      );

      await MouvementService.create({
        idProduit,
        typeMouvement: "ENTREE",
        quantite,
        stockAvant,
        stockApres,
        motif
      });

      return { success: true, stockAvant, stockApres };

    } catch (error: any) {
      console.error('❌ Erreur increaseStock:', error);
      return { success: false, message: error?.message || 'Erreur lors de l\'augmentation du stock' };
    }
  }

  static async decreaseStock(
    idProduit: number,
    quantite: number,
    motif = "Sortie stock"
  ): Promise<{ success: boolean; message?: string; stockAvant?: number; stockApres?: number }> {
    try {
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
        return { success: false, message: "Produit introuvable" };
      }

      const stockAvant = Number(produit[0].qte_stock);

      if (stockAvant < quantite) {
        return { 
          success: false, 
          message: `Stock insuffisant. Disponible: ${stockAvant}, Demandé: ${quantite}` 
        };
      }

      const stockApres = stockAvant - quantite;

      await db.execute(
        `
        UPDATE products
        SET qte_stock = ?
        WHERE idProduit = ?
        `,
        [stockApres, idProduit]
      );

      await MouvementService.create({
        idProduit,
        typeMouvement: "SORTIE",
        quantite,
        stockAvant,
        stockApres,
        motif
      });

      return { success: true, stockAvant, stockApres };

    } catch (error: any) {
      console.error('❌ Erreur decreaseStock:', error);
      return { success: false, message: error?.message || 'Erreur lors de la diminution du stock' };
    }
  }

  // ✅ Méthode utilitaire pour vérifier le stock
  static async getStock(idProduit: number): Promise<number> {
    try {
      const db = await getDb();
      const produit = await db.select<any[]>(
        `SELECT qte_stock FROM products WHERE idProduit = ?`,
        [idProduit]
      );
      return produit.length ? Number(produit[0].qte_stock) : 0;
    } catch (error) {
      console.error('❌ Erreur getStock:', error);
      return 0;
    }
  }

  // ✅ Méthode pour vérifier si le stock est suffisant
  static async hasEnoughStock(idProduit: number, quantite: number): Promise<boolean> {
    try {
      const stock = await this.getStock(idProduit);
      return stock >= quantite;
    } catch (error) {
      console.error('❌ Erreur hasEnoughStock:', error);
      return false;
    }
  }
}