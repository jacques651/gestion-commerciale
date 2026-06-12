// src/services/codeGeneratorService.ts
import { getDb } from '../database/db';

// Format: CL-0001, CL-0002, ...
export const getNextClientCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_client FROM clients 
    WHERE code_client LIKE 'CL-%' 
    ORDER BY idClient DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'CL-0001';
  }
  
  const lastCode = result[0].code_client;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `CL-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: PROD-0001, PROD-0002, ...
export const getNextProductCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_produit FROM products 
    WHERE code_produit LIKE 'PROD-%' 
    ORDER BY idProduit DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'PROD-0001';
  }
  
  const lastCode = result[0].code_produit;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `PROD-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: CMD-0001, CMD-0002, ...
export const getNextCommandeCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_commande FROM commandes 
    WHERE code_commande LIKE 'CMD-%' 
    ORDER BY idCommande DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'CMD-0001';
  }
  
  const lastCode = result[0].code_commande;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `CMD-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: FAC-0001, FAC-0002, ... (pour les factures standard)
export const getNextFactureCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_facture FROM factures 
    WHERE code_facture LIKE 'FAC-%' 
    ORDER BY idFacture DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'FAC-0001';
  }
  
  const lastCode = result[0].code_facture;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `FAC-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: FR-0001, FR-0002, ... (pour les factures revendeur)
export const getNextFactureRevendeurCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_facture FROM factures_revendeur 
    WHERE code_facture LIKE 'FR-%' 
    ORDER BY idFactureRevendeur DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'FR-0001';
  }
  
  const lastCode = result[0].code_facture;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `FR-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: VTE-0001, VTE-0002, ...
export const getNextVenteCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_vente FROM ventes 
    WHERE code_vente LIKE 'VTE-%' 
    ORDER BY idVente DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'VTE-0001';
  }
  
  const lastCode = result[0].code_vente;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `VTE-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: REG-0001, REG-0002, ...
export const getNextReglementCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_reglement FROM reglements 
    WHERE code_reglement LIKE 'REG-%' 
    ORDER BY idReglement DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'REG-0001';
  }
  
  const lastCode = result[0].code_reglement;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `REG-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: DCP-0001, DCP-0002, ... (pour les décomptes)
export const getNextDecompteCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_decompte FROM decomptes 
    WHERE code_decompte LIKE 'DCP-%' 
    ORDER BY idDecompte DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'DCP-0001';
  }
  
  const lastCode = result[0].code_decompte;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `DCP-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: RCP-0001, RCP-0002, ... (pour les reçus de vente)
export const getNextRecuVenteCode = async (): Promise<string> => {
  const db = await getDb();
  // Utiliser la même séquence que les règlements ou une séquence séparée
  const result = await db.select<any[]>(`
    SELECT code_reglement FROM reglements 
    WHERE code_reglement LIKE 'RCP-%' 
    ORDER BY idReglement DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'RCP-0001';
  }
  
  const lastCode = result[0].code_reglement;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `RCP-${nextNumber.toString().padStart(4, '0')}`;
};

// Format: DC-0001, DC-0002, ... (pour les décomptes - ancien format)
export const generateDecompteCode = async (): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT code_decompte FROM decomptes 
    WHERE code_decompte LIKE 'DC-%' 
    ORDER BY idDecompte DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return 'DC-1';
  }
  
  const lastCode = result[0].code_decompte;
  const lastNumber = parseInt(lastCode.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `DC-${nextNumber}`;
};

// Fonction générique pour générer un code avec préfixe et compteur
export const generateCode = async (
  table: string,
  column: string,
  prefix: string,
  padLength: number = 4
): Promise<string> => {
  const db = await getDb();
  const result = await db.select<any[]>(`
    SELECT ${column} FROM ${table} 
    WHERE ${column} LIKE '${prefix}-%' 
    ORDER BY id DESC LIMIT 1
  `);
  
  if (result.length === 0) {
    return `${prefix}-${'0'.repeat(padLength)}1`;
  }
  
  const lastCode = result[0][column];
  const match = lastCode.match(/\d+$/);
  if (!match) {
    return `${prefix}-${'0'.repeat(padLength)}1`;
  }
  
  const lastNumber = parseInt(match[0]);
  const nextNumber = lastNumber + 1;
  return `${prefix}-${nextNumber.toString().padStart(padLength, '0')}`;
};

// Exemple d'utilisation de la fonction générique
export const getNextCode = async (
  prefix: string,
  table: string,
  column: string
): Promise<string> => {
  return generateCode(table, column, prefix);
};