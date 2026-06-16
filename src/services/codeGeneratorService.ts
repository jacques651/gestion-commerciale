// src/services/codeGeneratorService.ts
import { getDb } from '../database/db';

// Génération code produit (PROD-0001, PROD-0002, ...)
export const generateProductCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const products = await db.select<{ code_produit: string }[]>(`
      SELECT code_produit FROM products WHERE code_produit LIKE 'PROD-%'
    `);
    
    const numbers = products
      .map(p => {
        const match = p.code_produit?.match(/^PROD-(\d{4})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `PROD-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Erreur génération code produit:', error);
    return `PROD-${String(Date.now()).slice(-4)}`;
  }
};

// Génération code décompte (DCP-0001, DCP-0002, ...)
export const generateDecompteCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const decomptes = await db.select<{ code_decompte: string }[]>(`
      SELECT code_decompte FROM decomptes WHERE code_decompte LIKE 'DCP-%'
    `);
    
    const numbers = decomptes
      .map(d => {
        const match = d.code_decompte?.match(/^DCP-(\d{4})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `DCP-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Erreur génération code décompte:', error);
    return `DCP-${String(Date.now()).slice(-4)}`;
  }
};

// Génération code facture (FACT-0001, FACT-0002, ...)
export const generateFactureCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const factures = await db.select<{ code_facture: string }[]>(`
      SELECT code_facture FROM factures WHERE code_facture LIKE 'FACT-%'
    `);
    
    const numbers = factures
      .map(f => {
        const match = f.code_facture?.match(/^FACT-(\d{4})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `FACT-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Erreur génération code facture:', error);
    return `FACT-${String(Date.now()).slice(-4)}`;
  }
};

// Génération code facture revendeur (FR-0001, FR-0002, ...)
export const generateFactureRevendeurCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const factures = await db.select<{ code_facture: string }[]>(`
      SELECT code_facture FROM factures_revendeur WHERE code_facture LIKE 'FR-%'
    `);
    
    const numbers = factures
      .map(f => {
        const match = f.code_facture?.match(/^FR-(\d{4})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `FR-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Erreur génération code facture revendeur:', error);
    return `FR-${String(Date.now()).slice(-4)}`;
  }
};

// Génération code commande (CMD-0001, CMD-0002, ...)
export const generateCommandeCode = async (): Promise<string> => {
  try {
    const db = await getDb();
    const commandes = await db.select<{ code_commande: string }[]>(`
      SELECT code_commande FROM commandes WHERE code_commande LIKE 'CMD-%'
    `);
    
    const numbers = commandes
      .map(c => {
        const match = c.code_commande?.match(/^CMD-(\d{4})$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    
    return `CMD-${String(nextNum).padStart(4, '0')}`;
  } catch (error) {
    console.error('Erreur génération code commande:', error);
    return `CMD-${String(Date.now()).slice(-4)}`;
  }
};