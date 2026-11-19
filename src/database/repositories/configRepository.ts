// src/database/repositories/configRepository.ts
import { getDb } from '../db';

export interface Config {
  tva_actif: boolean;
  taux_tva: number;
  id_config: number;
  nom_application: string;
  version: string;
  devise: string;
  symbole_devise: string;
  taux_tva_default: number;
  date_format: string;
  nombre_decimales: number;
  separateur_milliers: string;
  theme: string;
  langue: string;
}

export interface TVAConfig {
  tva_actif: boolean;
  taux_tva: number;
}

class ConfigRepository {
  async getConfig(): Promise<Config> {
    const db = await getDb();
    const result = await db.select<Config[]>(
      'SELECT * FROM config_generale WHERE id_config = 1'
    );
    
    if (result.length === 0) {
      // Créer la configuration par défaut
      await this.createDefaultConfig();
      return this.getConfig();
    }
    
    return result[0];
  }

  private async createDefaultConfig(): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO config_generale (
        id_config, nom_application, version, devise, symbole_devise,
        taux_tva_default, date_format, nombre_decimales, separateur_milliers,
        theme, langue
      ) VALUES (1, 'Gestion Commerciale Pro', '3.0.0', 'FCFA', 'CFA', 18, 'DD/MM/YYYY', 2, ' ', 'light', 'fr')`
    );
  }

  async getTVAConfig(): Promise<TVAConfig> {
    try {
      const config = await this.getConfig();
      // Vérifier si la TVA est activée dans les paramètres
      const db = await getDb();
      const paramResult = await db.select<any[]>(
        `SELECT valeur FROM config_parametres 
         WHERE categorie = 'TVA' AND code_param = 'tva_actif'`
      );
      
      const tvaActif = paramResult.length > 0 ? paramResult[0].valeur !== '0' : true;
      
      return {
        tva_actif: tvaActif,
        taux_tva: config.taux_tva_default || 18
      };
    } catch (error) {
      console.error('Erreur chargement config TVA:', error);
      return { tva_actif: true, taux_tva: 18 };
    }
  }

  async updateConfig(data: Partial<Config> & { tva_actif?: boolean; taux_tva?: number }): Promise<void> {
    const db = await getDb();
    
    // Mettre à jour la config générale
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = ['nom_application', 'version', 'devise', 'symbole_devise', 
                          'taux_tva_default', 'date_format', 'nombre_decimales', 
                          'separateur_milliers', 'theme', 'langue'];
    
    for (const key of allowedFields) {
      if (data[key as keyof Config] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key as keyof Config]);
      }
    }

    if (data.taux_tva !== undefined) {
      // Si taux_tva est fourni, on le mappe vers taux_tva_default
      const idx = fields.indexOf('taux_tva_default');
      if (idx !== -1) {
        values[idx] = data.taux_tva;
      } else {
        fields.push('taux_tva_default = ?');
        values.push(data.taux_tva);
      }
    }

    if (fields.length > 0) {
      values.push(1);
      await db.execute(
        `UPDATE config_generale SET ${fields.join(', ')} WHERE id_config = 1`,
        values
      );
    }

    // Mettre à jour le statut TVA dans les paramètres
    if (data.tva_actif !== undefined) {
      await db.execute(
        `INSERT OR REPLACE INTO config_parametres (categorie, code_param, valeur, description)
         VALUES ('TVA', 'tva_actif', ?, 'Activation de la TVA')`,
        [data.tva_actif ? '1' : '0']
      );
    }
  }

  async getParametre(categorie: string, code: string): Promise<string | null> {
    const db = await getDb();
    const result = await db.select<any[]>(
      `SELECT valeur FROM config_parametres 
       WHERE categorie = ? AND code_param = ?`,
      [categorie, code]
    );
    return result.length > 0 ? result[0].valeur : null;
  }

  async setParametre(categorie: string, code: string, valeur: string, description?: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT OR REPLACE INTO config_parametres (categorie, code_param, valeur, description)
       VALUES (?, ?, ?, ?)`,
      [categorie, code, valeur, description || null]
    );
  }
}

export const configRepository = new ConfigRepository();