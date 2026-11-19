// src/services/configCommerceService.ts
import { getDb } from '../database/db';

export interface CommerceParametres {
  tva_default: number;
  tva_active: boolean;
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

  // ✅ Récupérer la config TVA complète
  getTVAConfig: async (): Promise<{ active: boolean; taux: number }> => {
    const db = await getDb();
    
    // 1. Lire la configuration générale
    const generalResult = await db.select<any[]>(`
      SELECT taux_tva_default FROM config_generale WHERE id_config = 1
    `);
    const taux = generalResult[0]?.taux_tva_default || 18;
    
    // 2. Lire la configuration de l'atelier (tva_active)
    const atelierResult = await db.select<any[]>(`
      SELECT tva_active FROM configuration_atelier WHERE id = 1
    `);
    
    // Si tva_active existe, l'utiliser, sinon par défaut activée
    let active = true;
    if (atelierResult && atelierResult.length > 0) {
      active = atelierResult[0].tva_active === 1;
    }
    
    return { active, taux };
  },

  // ✅ Mettre à jour la TVA
  updateTVA: async (active: boolean, taux?: number): Promise<void> => {
    const db = await getDb();
    
    // 1. Mettre à jour tva_active dans configuration_atelier
    await db.execute(`
      INSERT OR REPLACE INTO configuration_atelier (id, tva_active, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
    `, [active ? 1 : 0]);
    
    // 2. Si un taux est fourni, mettre à jour config_generale
    if (taux !== undefined) {
      await db.execute(`
        UPDATE config_generale SET taux_tva_default = ? WHERE id_config = 1
      `, [taux]);
    }
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
    
    // ✅ Récupérer tva_active depuis configuration_atelier
    if (parametres) {
      const atelierResult = await db.select<any[]>(`
        SELECT tva_active FROM configuration_atelier WHERE id = 1
      `);
      if (atelierResult && atelierResult.length > 0) {
        parametres.tva_active = atelierResult[0].tva_active === 1;
      } else {
        parametres.tva_active = true; // Par défaut
      }
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

  // Appliquer la configuration
  applyConfig: async (typeCommerceId: number): Promise<Record<string, boolean>> => {
    const db = await getDb();
    
    const typeResult = await db.select<any[]>(`
      SELECT * FROM config_types_commerce WHERE id_type_commerce = ?
    `, [typeCommerceId]);
    
    if (!typeResult || typeResult.length === 0) {
      throw new Error('Type de commerce non trouvé');
    }
    
    const typeConfig = typeResult[0] as TypeCommerce;
    let parametres: CommerceParametres = {
      tva_default: 18,
      tva_active: true,
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
    
    // Activer/désactiver les modules
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

  // ✅ NOUVEAU : Mettre à jour la TVA depuis l'interface
  setTVAConfig: async (active: boolean, taux?: number): Promise<void> => {
    const db = await getDb();
    
    // 1. Mettre à jour config_generale si taux fourni
    if (taux !== undefined) {
      await db.execute(`
        UPDATE config_generale SET taux_tva_default = ? WHERE id_config = 1
      `, [taux]);
    }
    
    // 2. Mettre à jour configuration_atelier
    const atelierExists = await db.select<any[]>(`
      SELECT id FROM configuration_atelier WHERE id = 1
    `);
    
    if (atelierExists && atelierExists.length > 0) {
      await db.execute(`
        UPDATE configuration_atelier SET tva_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `, [active ? 1 : 0]);
    } else {
      await db.execute(`
        INSERT INTO configuration_atelier (id, tva_active, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
      `, [active ? 1 : 0]);
    }
  },

  // ✅ NOUVEAU : Taux de commission par défaut (dynamique / configurable)
  // Stocké dans config_parametres (categorie COMMERCIAL, code taux_commission_defaut)
  getCommissionDefaut: async (): Promise<number> => {
    const db = await getDb();
    try {
      const result = await db.select<any[]>(`
        SELECT valeur FROM config_parametres
        WHERE categorie = 'COMMERCIAL' AND code_param = 'taux_commission_defaut'
      `);
      if (result && result.length > 0 && result[0].valeur != null && result[0].valeur !== '') {
        const n = Number(result[0].valeur);
        return Number.isFinite(n) ? n : 60;
      }
    } catch (e) {
      console.error('Erreur lecture taux_commission_defaut', e);
    }
    return 60; // valeur de repli si non configuré
  },

  setCommissionDefaut: async (taux: number): Promise<void> => {
    const db = await getDb();
    await db.execute(`
      INSERT INTO config_parametres (categorie, code_param, valeur, type_valeur, description)
      VALUES ('COMMERCIAL', 'taux_commission_defaut', ?, 'number', 'Taux de commission par défaut des revendeurs')
      ON CONFLICT(categorie, code_param) DO UPDATE SET valeur = excluded.valeur
    `, [String(taux)]);
  }
};