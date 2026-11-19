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
    const db = await getDb();
    try {
      const backupJson = localStorage.getItem(`backup_${backupId}`);
      if (!backupJson) {
        throw new Error('Sauvegarde introuvable');
      }

      const backupData = JSON.parse(backupJson) as Record<string, any[]>;

      // Désactiver les clés étrangères pour toute la durée de la restauration
      await db.execute('PRAGMA foreign_keys = OFF');
      await db.execute('BEGIN TRANSACTION');

      // Récupérer toutes les tables existantes
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        AND name != 'database_version'
      `);

      // Vider toutes les tables (sans les supprimer — le schéma est conservé)
      for (const table of tables) {
        await db.execute(`DELETE FROM ${table.name}`);
      }

      // Réinsérer les données de la sauvegarde
      for (const [tableName, rows] of Object.entries(backupData)) {
        if (tableName === 'database_version') continue;
        if (!rows || rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        for (const row of rows) {
          const values = columns.map(col => row[col] !== undefined ? row[col] : null);
          try {
            await db.execute(sql, values);
          } catch (e) {
            console.warn(`Ligne ignorée dans ${tableName}:`, e);
          }
        }
      }

      await db.execute('COMMIT');

    } catch (error) {
      try { await db.execute('ROLLBACK'); } catch (_) {}
      console.error('Erreur restauration:', error);
      throw error;
    } finally {
      // Toujours réactiver les clés étrangères
      try { await db.execute('PRAGMA foreign_keys = ON'); } catch (_) {}
    }
  }
}