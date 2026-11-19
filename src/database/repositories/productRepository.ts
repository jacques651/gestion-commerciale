// src/database/repositories/productRepository.ts
import { getDb } from '../db';

export interface Product {
  [x: string]: number | string | undefined;
  idProduit: number;
  code_produit: string;
  reference?: string; // Référence de l'article (champ optionnel)
  designation: string;
  categorie: string;
  unite_base: string;
  contenu_unite?: number;
  prix_achat_base: number;
  prix_vente_detail: number;
  prix_vente_gros: number;
  qte_stock: number;
  seuil_alerte: number;
  prix_moyen_pondere: number;
  methode_gestion_stock: string;
  date_entree: string;
  est_supprime: number;
  // Champs d'annulation (remplace la suppression) : l'article reste visible mais exclu du stock
  est_annule?: number;
  date_annulation?: string;
  annule_par?: string;
  motif_annulation?: string;
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
          reference,
          designation,
          categorie,
          unite_base,
          contenu_unite,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          qte_stock,
          seuil_alerte,
          prix_moyen_pondere,
          methode_gestion_stock,
          date_entree,
          est_supprime,
          est_annule,
          date_annulation,
          annule_par,
          motif_annulation
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
          reference,
          designation,
          categorie,
          unite_base,
          contenu_unite,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          qte_stock,
          seuil_alerte,
          prix_moyen_pondere,
          methode_gestion_stock,
          date_entree,
          est_supprime,
          est_annule,
          date_annulation,
          annule_par,
          motif_annulation
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
          reference,
          designation,
          categorie,
          prix_vente_detail,
          qte_stock
        FROM products
        WHERE (designation LIKE ? OR code_produit LIKE ? OR categorie LIKE ? OR reference LIKE ?)
        AND est_supprime = 0
        AND COALESCE(est_annule, 0) = 0
        ORDER BY designation
        LIMIT 50
      `, [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);
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
          reference,
          designation,
          categorie,
          unite_base,
          contenu_unite,
          prix_achat_base,
          prix_vente_detail,
          prix_vente_gros,
          qte_stock,
          seuil_alerte,
          prix_moyen_pondere,
          methode_gestion_stock,
          est_supprime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.code_produit,
        product.reference || null,
        product.designation,
        product.categorie || '',
        product.unite_base || 'pièce',
        product.contenu_unite || 1,
        product.prix_achat_base || 0,
        product.prix_vente_detail || 0,
        product.prix_vente_gros || 0,
        product.qte_stock || 0,
        product.seuil_alerte ?? 5,
        product.prix_moyen_pondere || 0,
        product.methode_gestion_stock || 'PMP',
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
      'code_produit', 'reference', 'designation', 'categorie', 'unite_base', 'contenu_unite',
      'prix_achat_base', 'prix_vente_detail', 'prix_vente_gros',
      'qte_stock', 'seuil_alerte', 'prix_moyen_pondere', 
      'methode_gestion_stock'
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

  // Annuler un produit (au lieu de le supprimer) : il reste visible et tracé,
  // mais est exclu du stock et des listes de sélection.
  annuler: async (id: number, motif?: string, par?: string): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE products
       SET est_annule = 1,
           date_annulation = datetime('now'),
           annule_par = ?,
           motif_annulation = ?
       WHERE idProduit = ?`,
      [par || null, motif || null, id]
    );
  },

  // Rétablir un produit annulé
  restaurer: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute(
      `UPDATE products
       SET est_annule = 0,
           date_annulation = NULL,
           annule_par = NULL,
           motif_annulation = NULL
       WHERE idProduit = ?`,
      [id]
    );
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
      AND COALESCE(est_annule, 0) = 0
      ORDER BY qte_stock ASC
    `);
    return products as Product[];
  }
};
