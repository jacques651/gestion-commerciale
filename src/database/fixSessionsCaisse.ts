// src/database/fixSessionsCaisse.ts

import { getDb } from "./db";


export async function fixSessionsCaisseTable() {
  try {
    const db = await getDb();
    console.log('🔧 Correction de la table sessions_caisse...');

    // Vérifier les colonnes existantes
    const columns = await db.select<any[]>(`PRAGMA table_info(sessions_caisse)`);
    const columnNames = columns.map(c => c.name);
    
    console.log('📋 Colonnes actuelles:', columnNames.join(', '));

    // Colonnes à ajouter si elles n'existent pas
    const columnsToAdd = [
      { name: 'solde_initial', type: 'REAL DEFAULT 0' },
      { name: 'solde_ouverture', type: 'REAL DEFAULT 0' },
      { name: 'solde_calcule', type: 'REAL' },
      { name: 'solde_declare', type: 'REAL' },
      { name: 'ecart', type: 'REAL DEFAULT 0' },
      { name: 'total_entrees', type: 'REAL DEFAULT 0' },
      { name: 'total_sorties', type: 'REAL DEFAULT 0' },
      { name: 'total_ventes', type: 'REAL DEFAULT 0' },
      { name: 'total_reglements', type: 'REAL DEFAULT 0' },
      { name: 'total_decomptes', type: 'REAL DEFAULT 0' },
      { name: 'total_charges', type: 'REAL DEFAULT 0' },
      { name: 'notes_ouverture', type: 'TEXT' },
      { name: 'notes_fermeture', type: 'TEXT' },
      { name: 'idUtilisateur', type: 'INTEGER' },
    ];

    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        try {
          await db.execute(`ALTER TABLE sessions_caisse ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Colonne ${col.name} ajoutée`);
        } catch (error) {
          console.log(`⚠️ Erreur ajout colonne ${col.name}:`, error);
        }
      } else {
        console.log(`ℹ️ Colonne ${col.name} déjà existante`);
      }
    }

    // Vérifier que la colonne code_session existe
    if (!columnNames.includes('code_session')) {
      await db.execute(`ALTER TABLE sessions_caisse ADD COLUMN code_session TEXT UNIQUE NOT NULL DEFAULT 'SESSION-' || datetime('now')`);
      console.log('✅ Colonne code_session ajoutée');
    }

    // Vérifier que la colonne nom_operateur existe
    if (!columnNames.includes('nom_operateur')) {
      await db.execute(`ALTER TABLE sessions_caisse ADD COLUMN nom_operateur TEXT NOT NULL DEFAULT 'Opérateur'`);
      console.log('✅ Colonne nom_operateur ajoutée');
    }

    // Mettre à jour les colonnes existantes
    await db.execute(`
      UPDATE sessions_caisse 
      SET 
        solde_initial = COALESCE(solde_initial, 0),
        solde_ouverture = COALESCE(solde_ouverture, 0),
        total_entrees = COALESCE(total_entrees, 0),
        total_sorties = COALESCE(total_sorties, 0),
        ecart = COALESCE(ecart, 0)
      WHERE 1=1
    `);

    console.log('✅ Table sessions_caisse corrigée avec succès');
    
    // Vérifier la structure finale
    const finalColumns = await db.select<any[]>(`PRAGMA table_info(sessions_caisse)`);
    console.log('📋 Structure finale:', finalColumns.map(c => c.name).join(', '));

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    throw error;
  }
}

// Exécuter la correction
fixSessionsCaisseTable();