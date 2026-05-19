// src/utils/codeGenerator.ts
import { getDb } from '../database/db';

export const generateCommandeCode = async (): Promise<string> => {
  const db = await getDb();
  
  const result = await db.select<any[]>(`
    SELECT code_commande FROM commandes 
    ORDER BY idCommande DESC LIMIT 1
  `);
  
  const currentYear = new Date().getFullYear();
  
  if (result.length === 0) {
    return `C_000001/${currentYear}`;
  }
  
  const lastCode = result[0].code_commande;
  const match = lastCode.match(/C_(\d+)/);
  
  if (match) {
    const lastNumber = parseInt(match[1]);
    const nextNumber = lastNumber + 1;
    return `C_${nextNumber.toString().padStart(6, '0')}/${currentYear}`;
  }
  
  return `C_000001/${currentYear}`;
};

export const generateFactureCode = async (): Promise<string> => {
  const db = await getDb();
  
  const result = await db.select<any[]>(`
    SELECT code_facture FROM factures 
    ORDER BY idFacture DESC LIMIT 1
  `);
  
  const currentYear = new Date().getFullYear();
  
  if (result.length === 0) {
    return `F_000001/${currentYear}`;
  }
  
  const lastCode = result[0].code_facture;
  const match = lastCode.match(/F_(\d+)/);
  
  if (match) {
    const lastNumber = parseInt(match[1]);
    const nextNumber = lastNumber + 1;
    return `F_${nextNumber.toString().padStart(6, '0')}/${currentYear}`;
  }
  
  return `F_000001/${currentYear}`;
};