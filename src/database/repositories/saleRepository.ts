// src/database/repositories/saleRepository.ts

import { getDb } from "../db";

export interface Sale {
  idVente: number;
  code_vente: string;
  idClient: number | null;
  nom_prenom: string;
  contact: string | null;
  date_vente: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  type_vente: string;
  observation: string | null;
}

export interface SaleDetail {
  idDetail: number;
  idVente: number;
  idProduit: number;
  quantite: number;
  prix_unitaire_ht: number;
  prix_unitaire_ttc: number;
  remise_percent: number;
  tva_taux: number;
}

export type CreateSaleDetailInput =
  Omit<SaleDetail, "idDetail" | "idVente">;

export type CreateSaleInput =
  Omit<Sale, "idVente" | "date_vente">;

export const saleRepository = {

  async getAll(): Promise<any[]> {
    const db = await getDb();
    const sales = await db.select<any[]>(`
      SELECT
        v.*,
        COALESCE(
          c.NomComplet,
          c.Societe,
          v.nom_prenom
        ) as client_nom
      FROM ventes v
      LEFT JOIN clients c ON c.idClient = v.idClient
      ORDER BY v.date_vente DESC
    `);
    return sales;
  },

  async getById(id: number): Promise<any> {
    const db = await getDb();
    const sales = await db.select<any[]>(`
      SELECT
        v.*,
        COALESCE(
          c.NomComplet,
          c.Societe,
          v.nom_prenom
        ) as client_nom
      FROM ventes v
      LEFT JOIN clients c ON c.idClient = v.idClient
      WHERE v.idVente = ?
    `, [id]);

    if (sales.length === 0) {
      return null;
    }

    const details = await db.select<any[]>(`
      SELECT
        vd.idDetail,
        vd.idVente,
        vd.idProduit,
        vd.quantite,
        vd.prix_unitaire_ht,
        vd.prix_unitaire_ttc,
        vd.remise_percent,
        vd.tva_taux,
        p.designation as produit_nom,
        p.code_produit
      FROM vente_details vd
      INNER JOIN products p ON p.idProduit = vd.idProduit
      WHERE vd.idVente = ?
    `, [id]);

    return {
      ...sales[0],
      details
    };
  },


async create(
  sale: CreateSaleInput,
  details: CreateSaleDetailInput[]
): Promise<number> {
  const db = await getDb();

  try {
    const result = await db.execute(`
      INSERT INTO ventes
      (
        code_vente,
        idClient,
        nom_prenom,
        contact,
        montant_ht,
        montant_tva,
        montant_ttc,
        type_vente,
        observation
      )
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      sale.code_vente,
      sale.idClient || null,
      sale.nom_prenom || 'Client anonyme',
      sale.contact || null,
      sale.montant_ht || 0,
      sale.montant_tva || 0,
      sale.montant_ttc || 0,
      sale.type_vente || 'COMPTOIR',
      sale.observation || null
    ]);

    const venteId = Number(result.lastInsertId);

    if (!venteId) {
      throw new Error("Impossible de récupérer l'ID de la vente");
    }

    for (const detail of details) {
      const stock = await db.select<any[]>(`
        SELECT qte_stock
        FROM products
        WHERE idProduit = ?
      `, [detail.idProduit]);

      if (stock.length === 0) {
        throw new Error("Produit introuvable");
      }

      const disponible = Number(stock[0].qte_stock);

      if (disponible < detail.quantite) {
        throw new Error(`Stock insuffisant pour le produit`);
      }

      await db.execute(`
        INSERT INTO vente_details
        (
          idVente,
          idProduit,
          quantite,
          prix_unitaire_ht,
          prix_unitaire_ttc,
          remise_percent,
          tva_taux
        )
        VALUES (?,?,?,?,?,?,?)
      `, [
        venteId,
        detail.idProduit,
        detail.quantite,
        detail.prix_unitaire_ht,
        detail.prix_unitaire_ttc,
        detail.remise_percent || 0,
        detail.tva_taux || 18
      ]);

      await db.execute(`
        UPDATE products
        SET qte_stock = qte_stock - ?
        WHERE idProduit = ?
      `, [
        detail.quantite,
        detail.idProduit
      ]);

      // ✅ Version CORRECTE pour votre table - sans code_mouvement, avec idCommande
      await db.execute(`
        INSERT INTO mouvements_stock
        (
          idProduit,
          type_mouvement,
          quantite,
          stock_avant,
          stock_apres,
          date_mouvement,
          idCommande
        )
        VALUES (?,?,?,?,?,?,?)
      `, [
        detail.idProduit,
        "VENTE",
        detail.quantite,
        disponible,
        disponible - detail.quantite,
        new Date().toISOString(),
        null
      ]);
    }

    return venteId;

  } catch (error) {
    console.error("ERREUR CREATE", error);
    throw error;
  }
}
,
  async getTodaySales(): Promise<{ total: number; count: number; }> {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT
        COALESCE(SUM(montant_ttc), 0) as total,
        COUNT(*) as count
      FROM ventes
      WHERE DATE(date_vente) = DATE('now')
    `);
    return {
      total: Number(result[0]?.total || 0),
      count: Number(result[0]?.count || 0)
    };
  },

  async getSalesByPeriod(startDate: string, endDate: string): Promise<any[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT
        DATE(date_vente) as date,
        COUNT(*) as nb_ventes,
        SUM(montant_ttc) as total
      FROM ventes
      WHERE DATE(date_vente) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(date_vente)
      ORDER BY DATE(date_vente)
    `, [startDate, endDate]);
  },

  async getTopProducts(limit = 10): Promise<any[]> {
    const db = await getDb();
    return await db.select<any[]>(`
      SELECT
        p.idProduit,
        p.code_produit,
        p.designation,
        SUM(vd.quantite) as quantite_vendue,
        SUM(vd.quantite * vd.prix_unitaire_ht) as chiffre_affaires
      FROM vente_details vd
      INNER JOIN products p ON p.idProduit = vd.idProduit
      GROUP BY p.idProduit
      ORDER BY quantite_vendue DESC
      LIMIT ?
    `, [limit]);
  }
};