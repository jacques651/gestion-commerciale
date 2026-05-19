// src/services/importService.ts
import * as XLSX from 'xlsx';
import { getDb } from '../database/db';

export interface ImportResult {
  success: number;
  errors: string[];
}

export const importProductsFromExcel = async (file: File): Promise<ImportResult> => {
  const results: ImportResult = { success: 0, errors: [] };
  const db = await getDb();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        for (const row of rows) {
          try {
            const product = {
              code_produit: row.code_produit || row.Code || `IMP-${Date.now()}-${results.success}`,
              designation: row.designation || row.Nom || 'Produit importé',
              categorie: row.categorie || row.Catégorie || 'Divers',
              unite_base: row.unite_base || 'pièce',
              prix_achat_base: Number(row.prix_achat_base || row.PrixAchat || 0),
              prix_vente_detail: Number(row.prix_vente_detail || row.PrixVente || 0),
              prix_vente_gros: Number(row.prix_vente_gros || 0),
              seuil_alerte: Number(row.seuil_alerte || row.SeuilAlerte || 5),
              commission_pourcentage: Number(row.commission_pourcentage || 0),
              qte_stock: Number(row.qte_stock || row.Stock || 0),
            };
            
            // Vérifier si le produit existe déjà
            const existing = await db.select<any[]>(
              'SELECT idProduit FROM products WHERE code_produit = ?',
              [product.code_produit]
            );
            
            if (existing.length > 0) {
              await db.execute(`
                UPDATE products SET 
                  designation = ?, categorie = ?, unite_base = ?,
                  prix_achat_base = ?, prix_vente_detail = ?, prix_vente_gros = ?,
                  seuil_alerte = ?, commission_pourcentage = ?, qte_stock = ?
                WHERE code_produit = ?
              `, [
                product.designation, product.categorie, product.unite_base,
                product.prix_achat_base, product.prix_vente_detail, product.prix_vente_gros,
                product.seuil_alerte, product.commission_pourcentage, product.qte_stock,
                product.code_produit
              ]);
            } else {
              await db.execute(`
                INSERT INTO products (
                  code_produit, designation, categorie, unite_base,
                  prix_achat_base, prix_vente_detail, prix_vente_gros,
                  seuil_alerte, commission_pourcentage, qte_stock, est_supprime
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `, [
                product.code_produit, product.designation, product.categorie, product.unite_base,
                product.prix_achat_base, product.prix_vente_detail, product.prix_vente_gros,
                product.seuil_alerte, product.commission_pourcentage, product.qte_stock
              ]);
            }
            
            results.success++;
          } catch (error) {
            results.errors.push(`Erreur ligne: ${(row as any).code_produit || 'inconnu'}`);
          }
        }
        
        resolve(results);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsArrayBuffer(file);
  });
};

export const exportProductsToExcel = async (): Promise<void> => {
  const db = await getDb();
  const products = await db.select<any[]>(`
    SELECT code_produit, designation, categorie, unite_base,
           prix_achat_base, prix_vente_detail, qte_stock, seuil_alerte
    FROM products WHERE est_supprime = 0
  `);
  
  const ws = XLSX.utils.json_to_sheet(products);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produits');
  
  XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
};