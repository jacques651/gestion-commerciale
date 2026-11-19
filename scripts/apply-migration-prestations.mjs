// scripts/apply-migration-prestations.mjs
// Applique manuellement la migration prestations 3.1 sur la base réelle.
// Usage : npx tsx scripts/apply-migration-prestations.mjs
//   ou  : npm run migrate:prestations
// Surcharge du chemin : $env:GC_DB_PATH = "C:\...\fichier.db"

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const ROOT        = path.resolve(__dirname, '..');
const LOG_FILE    = path.join(ROOT, '.migration-prestations.log');
const BACKUP_DIR  = path.join(ROOT, 'backups');

function dbPath() {
  if (process.env.GC_DB_PATH) return process.env.GC_DB_PATH;
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'com.user.gestion-commerciale', 'gestion-commerciale.db');
}

function log(line) {
  const stamp = new Date().toISOString();
  const entry = `${stamp} | ${line}`;
  fs.appendFileSync(LOG_FILE, entry + '\n', 'utf8');
  console.log(entry);
}

function fail(msg) {
  log('ERREUR : ' + msg);
  process.exit(1);
}

function backupDatabase(dbFile) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest  = path.join(BACKUP_DIR, `gestion-commerciale.db.bak-${stamp}`);
  
  const src = new Database(dbFile, { readonly: true });
  try {
    src.backup(dest);
  } finally {
    src.close();
  }
  
  log(`Sauvegarde : ${dest}`);
  return dest;
}

function isMigrationApplied(db) {
  const hasTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='prestation_migrations'"
  ).get();
  if (!hasTable) return false;
  const row = db.prepare(
    "SELECT 1 FROM prestation_migrations WHERE migration_id = ?"
  ).get('prestations_v1');
  return !!row;
}

function buildAdapter(db) {
  const runQuery = (sql, params) => {
    const stmt = db.prepare(sql);
    return Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
  };
  const allQuery = (sql, params) => {
    const stmt = db.prepare(sql);
    return Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
  };

  const adapter = {
    select: (sql, params = []) => allQuery(sql, params),
    execute: (sql, params = []) => {
      if (params && params.length) runQuery(sql, params);
      else db.exec(sql);
    },
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) => {
      const info = runQuery(sql, params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    },
    all: (sql, params = []) => allQuery(sql, params),
    get: (sql, params = []) => {
      const stmt = db.prepare(sql);
      return Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
    },
    pragma: (stmt, options) => db.pragma(stmt, options),
    transaction: async (fn) => {
      db.exec('BEGIN');
      try {
        const result = await fn(adapter);
        db.exec('COMMIT');
        return result;
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
        throw e;
      }
    },
  };
  return adapter;
}

async function main() {
  const dbFile = dbPath();
  log(`Base cible : ${dbFile}`);

  if (!fs.existsSync(dbFile)) fail(`Base introuvable : ${dbFile}`);

  // 1. Ouvrir la base d'abord pour vérifier si la migration est nécessaire
  const db = new Database(dbFile);
  db.pragma('foreign_keys = ON');
  let dbMigrate = null;

  try {
    if (isMigrationApplied(db)) {
      log('Migration prestations_v1 déjà appliquée — rien à faire.');
      db.close();
      return; // On sort proprement SANS faire de sauvegarde inutile
    }

    // 2. Si la migration n'est PAS appliquée, on sauvegarde maintenant
    db.close(); // Fermer provisoirement pour sauvegarder proprement
    backupDatabase(dbFile);
    
    // Réouvrir la base pour la migration
    dbMigrate = new Database(dbFile);
    dbMigrate.pragma('foreign_keys = ON');

    let migrationModule;
    try {
      migrationModule = await import('../src/database/migration_prestations_v1.ts');
    } catch (e) {
      fail(
        'Impossible d\'importer src/database/migration_prestations_v1.ts. ' +
        'Lancez avec : npx tsx scripts/apply-migration-prestations.mjs'
      );
    }

    const applyMigration = migrationModule.migratePrestationsV1;
    if (typeof applyMigration !== 'function') {
      fail('Fonction migratePrestationsV1 introuvable dans migration_prestations_v1.ts.');
    }

    const adapter = buildAdapter(dbMigrate);
    log('Début de la migration prestations_v1…');
    const result = await applyMigration(adapter);
    log('Migration terminée : ' + JSON.stringify(result ?? {}));

    const integrity = dbMigrate.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') fail(`integrity_check a échoué : ${integrity}`);
    log('PRAGMA integrity_check : ok');
    
    dbMigrate.close();
  } catch (e) {
    log('Exception pendant la migration : ' + (e?.stack || e));
    process.exitCode = 1;
    if (dbMigrate?.open) dbMigrate.close();
    if (db.open) db.close();
  }
}

main();