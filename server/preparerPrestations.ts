/** Préparation MANUELLE et sauvegardée d’une base existante, jamais appelée au démarrage. */
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { migratePrestationsV1, type PrestationMigrationConnection, type MigrationSqlValue } from '../src/database/migration_prestations_v1.ts';

export async function preparerPrestations(sourceFile: string, backupDirectory: string, testCopy = false) {
  const source = path.resolve(sourceFile);
  if (!existsSync(source)) throw new Error('Base introuvable : ' + source + '. Aucune base vide ne sera créée.');
  mkdirSync(backupDirectory, { recursive: true });
  const saved = path.join(backupDirectory, 'web-avant-prestations-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0,8) + '.db');
  const input = new DatabaseSync(source, { readOnly: true });
  try { await backup(input, saved); } finally { input.close(); }
  const target = testCopy ? saved : source;
  const db = new DatabaseSync(target);
  const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
    let tableCount = 0;
    const report = await migratePrestationsV1({ async transaction(work) {
      db.exec('BEGIN IMMEDIATE');
      try {
        // Relevé sous verrou d’écriture : aucune autre session ne peut changer ces lignes pendant le contrôle.
        const oldTables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
          .map(({ name }) => ({ name, columns: (db.prepare(`PRAGMA table_info(${quote(name)})`).all() as { name: string }[])
            .map(col => col.name).filter(col => name !== 'journal_caisse' || !['origin', 'origin_id', 'idJournalContrepasse'].includes(col)) }));
        tableCount = oldTables.length;
        const hashes = () => Object.fromEntries(oldTables.map(({name, columns}) => {
          const rows = db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(name)}`).all().map(row => JSON.stringify(row)).sort();
          return [name, { count: rows.length, hash: createHash('sha256').update(rows.join('\n')).digest('hex') }];
        }));
        const before = hashes();
        const connection: PrestationMigrationConnection = {
          async select<Row extends object>(sql: string, params: readonly MigrationSqlValue[] = []) { return db.prepare(sql).all(...params) as Row[]; },
          async execute(sql, params = []) { db.prepare(sql).run(...params); },
        };
        const result = await work(connection);
        if (JSON.stringify(before) !== JSON.stringify(hashes())) throw new Error('Les données historiques ont changé : préparation annulée.');
        db.exec('COMMIT'); return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } });
    const evidence = { mode: testCopy ? 'copie de test' : 'application manuelle', source, target, backup: saved,
      historiquesPreserves: true, tablesControlees: tableCount, ...report };
    const reportPath = saved + '.rapport.json';
    writeFileSync(reportPath, JSON.stringify(evidence, null, 2));
    return { ...evidence, rapport: reportPath };
  } finally { db.close(); }
}
