// src/services/codeGeneratorService.ts
import { getDb } from '../database/db';

// ✅ Fonction utilitaire pour vérifier l'unicité d'un code
const ensureUniqueCode = async (
  table: string,
  column: string,
  baseCode: string
): Promise<string> => {
  try {
    const db = await getDb();
    let code = baseCode;
    let isUnique = false;
    let attempt = 0;
    const maxAttempts = 50;

    while (!isUnique && attempt < maxAttempts) {
      // Vérifier si le code existe déjà
      const result = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`,
        [code]
      );

      if (result[0]?.count === 0) {
        isUnique = true;
      } else {
        // Générer un nouveau code avec suffixe aléatoire
        const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const parts = baseCode.split('-');
        const prefix = parts[0];
        const sequence = parts[1] || '00000';
        code = `${prefix}-${sequence}${random}`;
        attempt++;
      }
    }

    // Si toujours pas unique, utiliser timestamp
    if (!isUnique) {
      const parts = baseCode.split('-');
      const prefix = parts[0];
      code = `${prefix}-${Date.now()}`;
    }

    return code;
  } catch (error) {
    console.error(`Erreur vérification unicité pour ${table}:`, error);
    const parts = baseCode.split('-');
    return `${parts[0]}-${Date.now()}`;
  }
};

// ✅ Fonction pour générer le prochain numéro séquentiel
const getNextSequence = async (
  table: string,
  column: string,
  prefix: string
): Promise<number> => {
  try {
    const db = await getDb();
    // Récupérer le dernier code de la table avec le préfixe donné
    const results = await db.select<{ max_code: string }[]>(`
      SELECT ${column} as max_code 
      FROM ${table} 
      WHERE ${column} LIKE '${prefix}-%' 
      ORDER BY ${column} DESC 
      LIMIT 1
    `);

    if (results.length > 0 && results[0].max_code) {
      const match = results[0].max_code.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        return parseInt(match[1]) + 1;
      }
    }
    
    return 1;
  } catch (error) {
    console.error(`Erreur récupération séquence pour ${table}:`, error);
    return 1;
  }
};

// =====================================================
// 1. FACTURES - FCT-00001
// =====================================================
export const generateFactureCode = async (): Promise<string> => {
  try {
    const prefix = 'FCT';
    const nextSeq = await getNextSequence('factures', 'code_facture', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('factures', 'code_facture', baseCode);
  } catch (error) {
    console.error('Erreur génération code facture:', error);
    return `FCT-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 2. COMMANDES - CMD-00001
// =====================================================
export const generateCommandeCode = async (): Promise<string> => {
  try {
    const prefix = 'CMD';
    const nextSeq = await getNextSequence('commandes', 'code_commande', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('commandes', 'code_commande', baseCode);
  } catch (error) {
    console.error('Erreur génération code commande:', error);
    return `CMD-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 3. DÉCOMPTES - DCT-00001
// =====================================================
export const generateDecompteCode = async (): Promise<string> => {
  try {
    const prefix = 'DCT';
    const nextSeq = await getNextSequence('decomptes', 'code_decompte', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('decomptes', 'code_decompte', baseCode);
  } catch (error) {
    console.error('Erreur génération code décompte:', error);
    return `DCT-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 4. RÈGLEMENTS - RGL-00001
// =====================================================
export const generateReglementCode = async (): Promise<string> => {
  try {
    const prefix = 'RGL';
    const nextSeq = await getNextSequence('reglements', 'code_reglement', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('reglements', 'code_reglement', baseCode);
  } catch (error) {
    console.error('Erreur génération code règlement:', error);
    return `RGL-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 5. PRODUITS - PRD-00001
// =====================================================
export const generateProductCode = async (): Promise<string> => {
  try {
    const prefix = 'PRD';
    const nextSeq = await getNextSequence('products', 'code_produit', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('products', 'code_produit', baseCode);
  } catch (error) {
    console.error('Erreur génération code produit:', error);
    return `PRD-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 6. FACTURES REVENDEURS - FCR-00001
// =====================================================
export const generateFactureRevendeurCode = async (): Promise<string> => {
  try {
    const prefix = 'FCR';
    const nextSeq = await getNextSequence('factures_revendeur', 'code_facture', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('factures_revendeur', 'code_facture', baseCode);
  } catch (error) {
    console.error('Erreur génération code facture revendeur:', error);
    return `FCR-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 7. CRÉDITS - CRD-00001
// =====================================================
export const generateCreditCode = async (): Promise<string> => {
  try {
    const prefix = 'CRD';
    const nextSeq = await getNextSequence('credits', 'code_credit', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('credits', 'code_credit', baseCode);
  } catch (error) {
    console.error('Erreur génération code crédit:', error);
    return `CRD-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 8. REMBOURSEMENTS - RMB-00001
// =====================================================
export const generateRemboursementCode = async (): Promise<string> => {
  try {
    const prefix = 'RMB';
    const nextSeq = await getNextSequence('remboursements', 'code_remboursement', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('remboursements', 'code_remboursement', baseCode);
  } catch (error) {
    console.error('Erreur génération code remboursement:', error);
    return `RMB-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 9. CLIENTS - CLT-00001
// =====================================================
export const generateClientCode = async (): Promise<string> => {
  try {
    const prefix = 'CLT';
    const nextSeq = await getNextSequence('clients', 'code_client', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('clients', 'code_client', baseCode);
  } catch (error) {
    console.error('Erreur génération code client:', error);
    return `CLT-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 10. FACTURE STANDARD - FST-00001
// =====================================================
export const generateFactureStandardCode = async (): Promise<string> => {
  try {
    const prefix = 'FST';
    const nextSeq = await getNextSequence('factures', 'code_facture', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('factures', 'code_facture', baseCode);
  } catch (error) {
    console.error('Erreur génération code facture standard:', error);
    return `FST-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 11. JOURNAL - JRN-00001
// =====================================================
export const generateJournalCode = async (): Promise<string> => {
  try {
    const prefix = 'JRN';
    const nextSeq = await getNextSequence('journal_caisse', 'code_journal', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('journal_caisse', 'code_journal', baseCode);
  } catch (error) {
    console.error('Erreur génération code journal:', error);
    return `JRN-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 12. CHARGES - CHG-00001
// =====================================================
export const generateChargeCode = async (): Promise<string> => {
  try {
    const prefix = 'CHG';
    const nextSeq = await getNextSequence('charges_fonctionnement', 'code_charge', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('charges_fonctionnement', 'code_charge', baseCode);
  } catch (error) {
    console.error('Erreur génération code charge:', error);
    return `CHG-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// 13. VENTES - VNT-00001
// =====================================================
export const generateVenteCode = async (): Promise<string> => {
  try {
    const prefix = 'VNT';
    const nextSeq = await getNextSequence('ventes', 'code_vente', prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
    return await ensureUniqueCode('ventes', 'code_vente', baseCode);
  } catch (error) {
    console.error('Erreur génération code vente:', error);
    return `VNT-${String(Date.now()).slice(-5)}`;
  }
};

// =====================================================
// FONCTION GÉNÉRIQUE
// =====================================================

/**
 * Génère un code unique pour n'importe quelle table
 * @param table Nom de la table
 * @param column Nom de la colonne contenant le code
 * @param prefix Préfixe du code (ex: FCT, CMD, DCT)
 * @param length Longueur du numéro séquentiel (défaut: 5)
 * @returns Code unique
 */
export const generateCode = async (
  table: string,
  column: string,
  prefix: string,
  length: number = 5
): Promise<string> => {
  try {
    const nextSeq = await getNextSequence(table, column, prefix);
    const baseCode = `${prefix}-${String(nextSeq).padStart(length, '0')}`;
    return await ensureUniqueCode(table, column, baseCode);
  } catch (error) {
    console.error(`Erreur génération code pour ${table}:`, error);
    return `${prefix}-${String(Date.now()).slice(-length)}`;
  }
};

// =====================================================
// EXPORT PAR DÉFAUT
// =====================================================

export default {
  generateFactureCode,
  generateCommandeCode,
  generateDecompteCode,
  generateReglementCode,
  generateProductCode,
  generateFactureRevendeurCode,
  generateCreditCode,
  generateRemboursementCode,
  generateClientCode,
  generateFactureStandardCode,
  generateJournalCode,
  generateChargeCode,
  generateVenteCode,
  generateCode,
};