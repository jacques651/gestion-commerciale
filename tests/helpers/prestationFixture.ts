import { migratePrestationsV1, type PrestationMigrationConnection, type PrestationMigrationDatabase } from '../../src/database/migration_prestations_v1.ts';
import { PrestationAdapter } from '../../src/services/adapters/prestationAdapter.ts';
import type { PrestationConnection, PrestationDatabase, PrestationSqlValue } from '../../src/services/adapters/prestationPersistence.ts';
import type { CreatePrestation, TransactionContext } from '../../src/services/transactionContracts.ts';

export interface TestContext { after(cleanup: () => void): void; }
interface TestApi { test(name: string, fn: (ctx: TestContext) => Promise<void>): void; }
interface AssertApi {
  equal(a: unknown, b: unknown, message?: string): void;
  deepEqual(a: unknown, b: unknown, message?: string): void;
  ok(value: unknown, message?: string): asserts value;
  rejects(fn: () => Promise<unknown>, expected?: RegExp | ((error: unknown) => boolean)): Promise<void>;
}
interface Statement {
  all(...params: readonly unknown[]): Record<string, unknown>[];
  get(...params: readonly unknown[]): Record<string, unknown> | undefined;
  run(...params: readonly unknown[]): { changes: number; lastInsertRowid: number };
}
interface Sqlite { exec(sql: string): void; prepare(sql: string): Statement; close(): void; }
async function native<T>(name: string): Promise<T> { const result: unknown = await import(name); return result as T; }
export const { test } = await native<TestApi>('node:test');
export const assert: AssertApi = await native<AssertApi>('node:assert/strict');
const fs = await native<{ readFileSync(path: URL, encoding: string): string; mkdtempSync(prefix: string): string; writeFileSync(path: string, data: string): void }>('node:fs');
const { join } = await native<{ join(...parts: string[]): string }>('node:path');
const { tmpdir } = await native<{ tmpdir(): string }>('node:os');
const { DatabaseSync } = await native<{ DatabaseSync: new (path: string) => Sqlite }>('node:sqlite');

export const admin: TransactionContext = { utilisateurId: 1, espaceId: null, role: 'admin' };
export const manager: TransactionContext = { utilisateurId: 2, espaceId: null, role: 'gestionnaire' };
export const cash = { code: 'ESPECES', libelle: 'Espèces', categorie: 'ESPECES' as const };
let nextKey = 0;
export function input(paid = 0, price = 100, quantity = 1): CreatePrestation {
  return { origin: 'prestation', versionInitiale: 1, cleOperation: `test-${++nextKey}`,
    client: { idClient: null, nom: 'Client test', contact: '00000000' },
    paiement: { montantPaye: paid, moyenPaiement: paid ? cash : null },
    lines: [{ origin: 'prestation', designation: 'Réparation', quantite: quantity, prixUnitaire: price, unite: 'intervention' }] };
}

export async function fixture(ctx: TestContext) {
  const directory = fs.mkdtempSync(join(tmpdir(), 'gc-prestation-adapter-'));
  const db = new DatabaseSync(join(directory, 'test.db'));
  ctx.after(() => {
    assert.equal(db.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.close();
  });
  const source = fs.readFileSync(new URL('../../src/database/db.ts', import.meta.url), 'utf8');
  const schema = source.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1];
  if (!schema) throw new Error('Schéma réel introuvable');
  db.exec(schema);
  // Colonne du referentiel deja ajoutee par l'initialisation existante du projet.
  db.exec(`ALTER TABLE journal_caisse ADD COLUMN mode_paiement_detail TEXT;
    INSERT INTO utilisateurs(id, nom, login, mot_de_passe_hash, role, est_actif) VALUES(2,'Gestionnaire test','gestionnaire-test','-', 'GESTIONNAIRE',1);
    INSERT INTO sessions_caisse(code_session,nom_operateur,idUtilisateur,statut) VALUES('TEST','Admin test',1,'OUVERTE');
    INSERT INTO ventes(code_vente, montant_ttc) VALUES('VENTE-INCHANGEABLE',1234);`);
  let failure: RegExp | null = null;
  const trace = { selects: [] as string[], writes: [] as string[], commits: 0, rollbacks: 0 };
  const connection: PrestationConnection = {
    async select<Row extends object>(sql: string, params: readonly PrestationSqlValue[] = []): Promise<Row[]> {
      trace.selects.push(sql); return db.prepare(sql).all(...params) as unknown as Row[];
    },
    async execute(sql, params = []) {
      trace.writes.push(sql);
      if (failure?.test(sql)) throw new Error('Erreur simulée au milieu de l’opération');
      const result = db.prepare(sql).run(...params);
      return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
    },
  };
  async function transaction<T>(work: () => Promise<T>, read = false): Promise<T> {
    db.exec(read ? 'BEGIN DEFERRED' : 'BEGIN IMMEDIATE');
    try { const value = await work(); db.exec('COMMIT'); trace.commits++; return value; }
    catch (error) { db.exec('ROLLBACK'); trace.rollbacks++; throw error; }
  }
  const migration: PrestationMigrationDatabase = {
    transaction: work => transaction(() => work({
      select: connection.select,
      execute: async (sql, params) => { db.prepare(sql).run(...params ?? []); },
    } satisfies PrestationMigrationConnection)),
  };
  await migratePrestationsV1(migration);
  trace.selects.length = 0; trace.writes.length = 0;
  const persistence: PrestationDatabase = {
    transaction: (_ctx, _action, work) => transaction(() => work(connection)),
    read: (_ctx, work) => transaction(() => work(connection), true),
  };
  const adapter = new PrestationAdapter(persistence);
  const snapshot = () => Object.fromEntries(['ventes_prestations', 'vente_prestation_details', 'reglements_prestations', 'journal_caisse', 'transaction_operations', 'products', 'ventes', 'reglements', 'credits', 'decomptes']
    .map(table => [table, db.prepare(`SELECT * FROM ${table}`).all()]));
  return { adapter, db, directory, trace, snapshot,
    failOn(pattern: RegExp | null) { failure = pattern; },
    count(table: string) { return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n); },
    evidence(name: string, value: unknown) {
      const path = join(directory, `${name}.json`);
      fs.writeFileSync(path, JSON.stringify(value, null, 2)); console.log(`Preuve prestations : ${path}`);
    },
  };
}
