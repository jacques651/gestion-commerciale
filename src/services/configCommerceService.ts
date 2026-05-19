// src/services/configCommerceService.ts
import { getDb } from '../database/db';

export interface CommerceParametres {
  tva_default: number;
  devise: string;
  gestion_stock: boolean;
  gestion_commandes: boolean;
  gestion_factures: boolean;
  gestion_reglements: boolean;
  multi_magasins: boolean;
  lots_tracabilite: boolean;
  remises_auto: boolean;
}

export interface TypeCommerce {
  id_type_commerce: number;
  code_type: string;
  libelle: string;
  description: string;
  parametres_par_defaut: string;
  est_actif: number;
}

export interface CommerceConfig {
  id: number;
  id_type_commerce: number;
  modules_actifs: string;
  parametres: string;
  updated_at: string;
}

export const configCommerceService = {
  // Récupérer tous les types de commerce disponibles
  getTypesCommerce: async (): Promise<TypeCommerce[]> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT * FROM config_types_commerce WHERE est_actif = 1
    `);
    return result as TypeCommerce[];
  },

  // Récupérer la configuration actuelle
  getCurrentConfig: async (): Promise<CommerceConfig | null> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT * FROM config_commerce WHERE id = 1
    `);
    return (result[0] as CommerceConfig) || null;
  },

  // Récupérer la configuration complète avec paramètres parsés
  getFullConfig: async (): Promise<{ type: TypeCommerce | null; parametres: CommerceParametres | null } | null> => {
    const db = await getDb();
    
    const configResult = await db.select<any[]>(`
      SELECT * FROM config_commerce WHERE id = 1
    `);
    
    if (!configResult || configResult.length === 0) {
      return null;
    }
    
    const config = configResult[0] as CommerceConfig;
    
    const typeResult = await db.select<any[]>(`
      SELECT * FROM config_types_commerce WHERE id_type_commerce = ?
    `, [config.id_type_commerce]);
    
    const type = typeResult[0] as TypeCommerce || null;
    
    let parametres: CommerceParametres | null = null;
    try {
      parametres = JSON.parse(config.parametres || '{}');
    } catch (e) {
      console.error('Erreur parsing parametres', e);
    }
    
    return { type, parametres };
  },

  // Sauvegarder la configuration
  saveConfig: async (id_type_commerce: number, parametres: CommerceParametres): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      INSERT OR REPLACE INTO config_commerce (id, id_type_commerce, modules_actifs, parametres, updated_at)
      VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id_type_commerce, JSON.stringify([]), JSON.stringify(parametres)]);
  },

  // Appliquer la configuration (active/désactive des fonctionnalités)
  applyConfig: async (typeCommerceId: number): Promise<Record<string, boolean>> => {
    const db = await getDb();
    
    // Récupérer la configuration du type de commerce
    const typeResult = await db.select<any[]>(`
      SELECT * FROM config_types_commerce WHERE id_type_commerce = ?
    `, [typeCommerceId]);
    
    if (!typeResult || typeResult.length === 0) {
      throw new Error('Type de commerce non trouvé');
    }
    
    const typeConfig = typeResult[0] as TypeCommerce;
    let parametres: CommerceParametres = {
      tva_default: 18,
      devise: 'FCFA',
      gestion_stock: true,
      gestion_commandes: true,
      gestion_factures: true,
      gestion_reglements: true,
      multi_magasins: false,
      lots_tracabilite: false,
      remises_auto: false,
    };
    
    try {
      const parsedParams = JSON.parse(typeConfig.parametres_par_defaut || '{}');
      parametres = { ...parametres, ...parsedParams };
    } catch (e) {
      console.error('Erreur parsing paramètres par défaut', e);
    }
    
    // Mettre à jour la configuration générale
    await db.execute(`
      UPDATE config_generale SET 
        taux_tva_default = ?,
        devise = ?
      WHERE id_config = 1
    `, [parametres.tva_default, parametres.devise]);
    
    // Activer/désactiver les modules selon le type de commerce
    const modules = {
      VENTES: true,
      STOCK: parametres.gestion_stock !== false,
      COMMANDES: parametres.gestion_commandes !== false,
      FACTURES: parametres.gestion_factures !== false,
      REGLEMENTS: parametres.gestion_reglements !== false,
      MULTI_MAGASINS: parametres.multi_magasins || false,
      LOTS: parametres.lots_tracabilite || false,
    };
    
    for (const [moduleName, isActive] of Object.entries(modules)) {
      await db.execute(`
        INSERT OR REPLACE INTO config_modules (code_module, est_actif)
        VALUES (?, ?)
      `, [moduleName, isActive ? 1 : 0]);
    }
    
    // Sauvegarder la configuration
    await configCommerceService.saveConfig(typeCommerceId, parametres);
    
    return modules;
  },

  // Vérifier si un module est actif
  isModuleActive: async (moduleName: string): Promise<boolean> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT est_actif FROM config_modules WHERE code_module = ?
    `, [moduleName]);
    
    if (result && result.length > 0) {
      return result[0].est_actif === 1;
    }
    
    // Par défaut, tous les modules sont actifs sauf mention contraire
    const inactiveDefault = ['MULTI_MAGASINS', 'LOTS'];
    return !inactiveDefault.includes(moduleName);
  },

  // Récupérer la configuration générale
  getGeneralConfig: async (): Promise<{ taux_tva_default: number; devise: string }> => {
    const db = await getDb();
    const result = await db.select<any[]>(`
      SELECT taux_tva_default, devise FROM config_generale WHERE id_config = 1
    `);
    
    if (result && result.length > 0) {
      return {
        taux_tva_default: result[0].taux_tva_default || 18,
        devise: result[0].devise || 'FCFA',
      };
    }
    
    return { taux_tva_default: 18, devise: 'FCFA' };
  },
};