// src/database/repositories/productRepository.ts
import { getDb } from '../db';

export interface Product {
  idProduit: number;
  code_produit: string;
  categorie: string;
  designation: string;
  unite_base: string;
  prix_achat_base: number;
  prix_vente_detail: number;
  prix_vente_gros: number;
  seuil_alerte: number;
  commission_pourcentage: number;
  qte_stock: number;
  date_entree: string;
  est_supprime: number;
}

export type CreateProductInput = Omit<Product, 'idProduit' | 'date_entree' | 'est_supprime'>;

export const productRepository = {
  getAll: async (): Promise<Product[]> => {
    const db = await getDb();
    try {
      const products = await db.select<any[]>(`
        SELECT 
          idProduit,
          code_produit,
          categorie,
          designation,
          unite_base,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          seuil_alerte,
          commission_pourcentage,
          qte_stock,
          date_entree,
          est_supprime
        FROM products 
        WHERE est_supprime = 0 
        ORDER BY designation
      `);
      return products as Product[];
    } catch (error) {
      console.error('Erreur getAll produits:', error);
      return [];
    }
  },

  getById: async (id: number): Promise<Product | null> => {
    const db = await getDb();
    try {
      const products = await db.select<any[]>(`
        SELECT 
          idProduit,
          code_produit,
          categorie,
          designation,
          unite_base,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          seuil_alerte,
          commission_pourcentage,
          qte_stock,
          date_entree,
          est_supprime
        FROM products 
        WHERE idProduit = ? AND est_supprime = 0
      `, [id]);
      return products[0] as Product || null;
    } catch (error) {
      console.error('Erreur getById produit:', error);
      return null;
    }
  },

  search: async (term: string): Promise<Product[]> => {
    const db = await getDb();
    try {
      const products = await db.select<any[]>(`
        SELECT 
          idProduit,
          code_produit,
          categorie,
          designation,
          prix_vente_detail,
          qte_stock
        FROM products 
        WHERE (designation LIKE ? OR code_produit LIKE ? OR categorie LIKE ?)
        AND est_supprime = 0
        ORDER BY designation
        LIMIT 50
      `, [`%${term}%`, `%${term}%`, `%${term}%`]);
      return products as Product[];
    } catch (error) {
      console.error('Erreur search produits:', error);
      return [];
    }
  },

  create: async (product: CreateProductInput): Promise<number> => {
    const db = await getDb();
    try {
      const result = await db.execute(`
        INSERT INTO products (
          code_produit,
          categorie,
          designation,
          unite_base,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          seuil_alerte,
          commission_pourcentage,
          qte_stock,
          est_supprime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.code_produit,
        product.categorie || '',
        product.designation,
        product.unite_base || 'pièce',
        product.prix_achat_base || 0,
        product.prix_vente_detail || 0,
        product.prix_vente_gros || 0,
        product.seuil_alerte || 0,
        product.commission_pourcentage || 0,
        product.qte_stock || 0,
        0
      ]);
      
      const lastId = result.lastInsertId;
      return typeof lastId === 'number' ? lastId : Number(lastId);
    } catch (error) {
      console.error('Erreur create produit:', error);
      throw error;
    }
  },

  update: async (id: number, product: Partial<CreateProductInput>): Promise<void> => {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    
    const allowedFields = [
      'code_produit', 'categorie', 'designation', 'unite_base',
      'prix_achat_base', 'prix_vente_detail', 'prix_vente_gros',
      'seuil_alerte', 'commission_pourcentage', 'qte_stock'
    ];
    
    Object.entries(product).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return;
    
    values.push(id);
    await db.execute(`
      UPDATE products SET ${fields.join(', ')} WHERE idProduit = ?
    `, values);
  },

  updateStock: async (id: number, quantity: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?
    `, [quantity, id]);
  },

  checkStock: async (id: number, quantity: number): Promise<boolean> => {
    const db = await getDb();
    const result = await db.select<{ stock: number }[]>(`
      SELECT qte_stock as stock FROM products WHERE idProduit = ?
    `, [id]);
    return (result[0]?.stock || 0) >= quantity;
  },

  delete: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`UPDATE products SET est_supprime = 1 WHERE idProduit = ?`, [id]);
  },

  getStockAlert: async (): Promise<Product[]> => {
    const db = await getDb();
    const products = await db.select<any[]>(`
      SELECT 
        idProduit,
        code_produit,
        designation,
        qte_stock,
        seuil_alerte
      FROM products 
      WHERE qte_stock <= seuil_alerte 
      AND est_supprime = 0
      ORDER BY qte_stock ASC
    `);
    return products as Product[];
  }
};