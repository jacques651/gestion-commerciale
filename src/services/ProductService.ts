// src/services/ProductService.ts

import { getDb } from "../database/db";

export interface ProductDto {

  idProduit?: number;

  code_produit: string;

  designation: string;

  categorie?: string;

  unite_base?: string;

  prix_achat_base: number;

  prix_vente_detail: number;

  prix_vente_gros: number;

  commission_pourcentage: number;

  qte_stock: number;

  seuil_alerte?: number;

  date_entree?: string;

  est_supprime?: number;
}

export default class ProductService {

  /**
   * Créer un produit
   */
  static async createProduct(
    product: ProductDto
  ): Promise<number> {

    const db = await getDb();

    await db.execute(
      `
      INSERT INTO products
      (
        code_produit,
        designation,
        categorie,
        unite_base,
        prix_achat_base,
        prix_vente_detail,
        prix_vente_gros,
        commission_pourcentage,
        qte_stock,
        seuil_alerte
      )
      VALUES
      (
        ?,?,?,?,?,?,?,?,?,?
      )
      `,
      [
        product.code_produit,
        product.designation,
        product.categorie ?? null,
        product.unite_base ?? null,
        product.prix_achat_base,
        product.prix_vente_detail,
        product.prix_vente_gros,
        product.commission_pourcentage,
        product.qte_stock,
        product.seuil_alerte ?? 0
      ]
    );

    const result = await db.select(
      `
      SELECT last_insert_rowid() AS id
      `
    ) as { id:number }[];

    return result[0].id;
  }

  /**
   * Modifier un produit
   */
  static async updateProduct(
    idProduit: number,
    product: ProductDto
  ): Promise<void> {

    const db = await getDb();

    await db.execute(
      `
      UPDATE products
      SET
        code_produit = ?,
        designation = ?,
        categorie = ?,
        unite_base = ?,
        prix_achat_base = ?,
        prix_vente_detail = ?,
        prix_vente_gros = ?,
        commission_pourcentage = ?,
        seuil_alerte = ?
      WHERE idProduit = ?
      `,
      [
        product.code_produit,
        product.designation,
        product.categorie ?? null,
        product.unite_base ?? null,
        product.prix_achat_base,
        product.prix_vente_detail,
        product.prix_vente_gros,
        product.commission_pourcentage,
        product.seuil_alerte ?? 0,
        idProduit
      ]
    );
  }

  /**
   * Suppression logique
   */
  static async deleteProduct(
    idProduit: number
  ): Promise<void> {

    const db = await getDb();

    await db.execute(
      `
      UPDATE products
      SET est_supprime = 1
      WHERE idProduit = ?
      `,
      [idProduit]
    );
  }

  /**
   * Obtenir un produit
   */
  static async getProductById(
    idProduit: number
  ): Promise<ProductDto | null> {

    const db = await getDb();

    const result = await db.select(
      `
      SELECT *
      FROM products
      WHERE idProduit = ?
      `,
      [idProduit]
    ) as ProductDto[];

    return result.length > 0
      ? result[0]
      : null;
  }

  /**
   * Tous les produits
   */
  static async getAllProducts()
  : Promise<ProductDto[]> {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM products
      WHERE est_supprime = 0
      ORDER BY designation
      `
    ) as ProductDto[];
  }

  /**
   * Produits en alerte
   */
  static async getProduitsAlerte()
  : Promise<ProductDto[]> {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM products
      WHERE
      qte_stock <= seuil_alerte
      AND est_supprime = 0
      `
    ) as ProductDto[];
  }

  /**
   * Recherche
   */
  static async rechercher(
    texte: string
  ): Promise<ProductDto[]> {

    const db = await getDb();

    return await db.select(
      `
      SELECT *
      FROM products
      WHERE
        designation LIKE ?
        OR code_produit LIKE ?
        OR categorie LIKE ?
      AND est_supprime = 0
      ORDER BY designation
      `,
      [
        `%${texte}%`,
        `%${texte}%`,
        `%${texte}%`
      ]
    ) as ProductDto[];
  }

  /**
   * Vérifier disponibilité stock
   */
  static async verifierStock(
    idProduit: number,
    quantite: number
  ): Promise<boolean> {

    const produit =
      await this.getProductById(
        idProduit
      );

    if (!produit) {
      return false;
    }

    return (
      produit.qte_stock >=
      quantite
    );
  }

  /**
   * Valeur du stock
   */
  static async getValeurStock()
  : Promise<number> {

    const db = await getDb();

    const result = await db.select(
      `
      SELECT
      SUM(
        qte_stock *
        prix_achat_base
      ) as total
      FROM products
      WHERE est_supprime = 0
      `
    ) as { total:number }[];

    return result[0]?.total ?? 0;
  }

}