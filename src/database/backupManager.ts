// src/database/backupManager.ts

import { getDb } from './db';
import { DatabaseVersionManager } from './versionManager';

export interface BackupInfo {
  id: string;
  timestamp: string;
  version: number;
  size: number;
  tables: string[];
}

export class BackupManager {
  // Supprimer la constante inutilisée ou l'utiliser
  // private static readonly BACKUP_DIR = 'backups';
  
  static async createBackup(): Promise<BackupInfo> {
    try {
      const db = await getDb();
      const version = await DatabaseVersionManager.getCurrentVersion();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `backup_${timestamp}_v${version.version}`;
      
      // Exporter toutes les tables
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      
      const backupData: Record<string, any[]> = {};
      
      for (const table of tables) {
        const data = await db.select<any[]>(`SELECT * FROM ${table.name}`);
        backupData[table.name] = data;
      }
      
      // Sauvegarder en JSON
      const backupJson = JSON.stringify(backupData, null, 2);
      
      // Sauvegarder dans localStorage (pour les petites bases)
      try {
        localStorage.setItem(`backup_${backupId}`, backupJson);
      } catch (e) {
        console.warn('Impossible de sauvegarder dans localStorage, taille trop grande');
        // Fallback: sauvegarder dans un blob
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      // Enregistrer la sauvegarde
      const backups = this.getBackupList();
      backups.push({
        id: backupId,
        timestamp: new Date().toISOString(),
        version: version.version,
        size: backupJson.length,
        tables: tables.map(t => t.name)
      });
      localStorage.setItem('backup_list', JSON.stringify(backups));
      
      return {
        id: backupId,
        timestamp: new Date().toISOString(),
        version: version.version,
        size: backupJson.length,
        tables: tables.map(t => t.name)
      };
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      throw error;
    }
  }
  
  static getBackupList(): BackupInfo[] {
    try {
      const data = localStorage.getItem('backup_list');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  
  static async restoreBackup(backupId: string): Promise<void> {
    try {
      const backupJson = localStorage.getItem(`backup_${backupId}`);
      if (!backupJson) {
        throw new Error('Backup non trouvé');
      }
      
      const backupData = JSON.parse(backupJson) as Record<string, any[]>;
      const db = await getDb();
      
      // Commencer une transaction
      await db.execute('BEGIN TRANSACTION');
      
      // Supprimer les tables existantes (sauf version et système)
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        AND name != 'database_version'
      `);
      
      for (const table of tables) {
        await db.execute(`DROP TABLE IF EXISTS ${table.name}`);
      }
      
      // Recréer les tables et insérer les données
      for (const [tableName, rows] of Object.entries(backupData)) {
        if (tableName === 'database_version') continue;
        
        if (rows.length === 0) continue;
        
        // Récupérer la structure de la table
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        
        // Créer la table
        const createSQL = `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            ${columns.map(col => `${col} TEXT`).join(', ')}
          )
        `;
        await db.execute(createSQL);
        
        // Insérer les données
        for (const row of rows) {
          const values = columns.map(col => row[col] !== undefined ? row[col] : null);
          await db.execute(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
      }
      
      await db.execute('COMMIT');
      
    } catch (error) {
      // Annuler la transaction en cas d'erreur
      try {
        const db = await getDb();
        await db.execute('ROLLBACK');
      } catch (e) {}
      
      console.error('Erreur restauration:', error);
      throw error;
    }
  }
}