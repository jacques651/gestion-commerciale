// src/services/backupService.ts
import { getDb } from '../database/db';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export const backupDatabase = async (): Promise<string | null> => {
  try {
    const db = await getDb();
    
    // Générer un nom de fichier avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.db`;
    
    // Créer une sauvegarde
    await db.execute(`VACUUM INTO '${filename}'`);
    
    // Lire le fichier de backup
    const backupData = await readFile(filename, { baseDir: BaseDirectory.AppData });
    
    // Sauvegarder dans le dossier de l'application
    const backupPath = await save({
      title: 'Sauvegarder la base de données',
      defaultPath: filename,
      filters: [{ name: 'Database', extensions: ['db'] }],
    });
    
    if (backupPath) {
      await writeFile(backupPath, backupData);
      return backupPath;
    }
    
    return null;
    
  } catch (error) {
    console.error('Erreur backup:', error);
    throw error;
  }
};

export const restoreDatabase = async (): Promise<boolean> => {
  try {
    const filePath = await open({
      title: 'Restaurer la base de données',
      filters: [{ name: 'Database', extensions: ['db'] }],
    });
    
    if (!filePath) return false;
    
    const backupData = await readFile(filePath);
    
    // Sauvegarder l'ancienne base
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const oldBackup = `backup_before_restore_${timestamp}.db`;
    const db = await getDb();
    await db.execute(`VACUUM INTO '${oldBackup}'`);
    
    // Restaurer la nouvelle base (nécessite un redémarrage)
    await writeFile('gestion-commerciale.db', backupData);
    
    return true;
    
  } catch (error) {
    console.error('Erreur restore:', error);
    throw error;
  }
};