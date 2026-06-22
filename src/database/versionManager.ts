// src/database/versionManager.ts

import { getDb } from './db';

export interface DatabaseVersion {
  version: number;
  lastMigration: string;
  status: 'OK' | 'MIGRATION_NEEDED' | 'ERROR';
  tables: string[];
}

export class DatabaseVersionManager {
  private static readonly CURRENT_VERSION = 3; // Incrémentez à chaque changement de schéma
  
  static async getCurrentVersion(): Promise<DatabaseVersion> {
    try {
      const db = await getDb();
      
      // Vérifier si la table version existe
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='database_version'
      `);
      
      if (tables.length === 0) {
        // Créer la table de version
        await db.execute(`
          CREATE TABLE IF NOT EXISTS database_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL,
            last_migration TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Version initiale
        await db.execute(`
          INSERT INTO database_version (id, version, last_migration)
          VALUES (1, 1, 'Initial creation')
        `);
        
        return {
          version: 1,
          lastMigration: 'Initial creation',
          status: 'MIGRATION_NEEDED',
          tables: await this.getTableList()
        };
      }
      
      const result = await db.select<{ version: number; last_migration: string }[]>(`
        SELECT version, last_migration FROM database_version WHERE id = 1
      `);
      
      const version = result[0]?.version || 1;
      
      return {
        version,
        lastMigration: result[0]?.last_migration || 'Unknown',
        status: version < this.CURRENT_VERSION ? 'MIGRATION_NEEDED' : 'OK',
        tables: await this.getTableList()
      };
      
    } catch (error) {
      console.error('Erreur version:', error);
      return {
        version: 0,
        lastMigration: 'Error',
        status: 'ERROR',
        tables: []
      };
    }
  }
  
  static async getTableList(): Promise<string[]> {
    try {
      const db = await getDb();
      const result = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      return result.map(t => t.name);
    } catch {
      return [];
    }
  }
  
  static async updateVersion(version: number, migration: string): Promise<void> {
    const db = await getDb();
    await db.execute(`
      UPDATE database_version 
      SET version = ?, last_migration = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [version, migration]);
  }
  
  static getCurrentVersionNumber(): number {
    return this.CURRENT_VERSION;
  }
}