/** Tests SQLite reels, sans dependance ajoutee et sans base de travail. Node >= 24. */
import {
  migratePrestationsV1, PRESTATIONS_MIGRATION_ID,
  type MigrationSqlValue, type PrestationMigrationConnection, type PrestationMigrationDatabase,
} from '../src/database/migration_prestations_v1.ts';

// Contrats minimaux des modules natifs : le projet ne depend pas de @types/node.
// Cette frontiere est typee explicitement pour verifier egalement ces tests en strict.
interface TestContext { after(cleanup: () => void): void; }
interface TestApi { test(name: string, work: (context: TestContext) => Promise<void> | void): void; }
interface AssertApi {
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  ok(value: unknown, message?: string): asserts value;
  rejects(work: () => Promise<unknown>, error: RegExp): Promise<void>;
  throws(work: () => unknown, error?: RegExp): void;
}
interface FsApi {
  readFileSync(path: string | URL, encoding: 'utf8'): string;
  writeFileSync(path: string, data: string): void;
  mkdtempSync(prefix: string): string;
}
interface SqliteStatement {
  all(...parameters: MigrationSqlValue[]): Record<string, MigrationSqlValue>[];
  get(...parameters: MigrationSqlValue[]): Record<string, MigrationSqlValue> | undefined;
  run(...parameters: MigrationSqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
interface SqliteConnection {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}
interface SqliteApi { DatabaseSync: new (path: string) => SqliteConnection; }

async function nativeModule<T>(specifier: string): Promise<T> {
  const module: unknown = await import(specifier);
  return module as T;
}

const { test } = await nativeModule<TestApi>('node:test');
const assert: AssertApi = await nativeModule<AssertApi>('node:assert/strict');
const fs = await nativeModule<FsApi>('node:fs');
const { join } = await nativeModule<{ join(...parts: string[]): string }>('node:path');
const { tmpdir } = await nativeModule<{ tmpdir(): string }>('node:os');
const { DatabaseSync } = await nativeModule<SqliteApi>('node:sqlite');

function projectSchema(): string {
  const source = fs.readFileSync(new URL('../src/database/db.ts', import.meta.url), 'utf8');
  const sql = source.match(/const SCHEMA_SQL = `([\s\S]*?)`;/)?.[1];
  if (!sql) throw new Error('Le schema reel du projet est introuvable.');
  return sql;
}

function fixture(context: TestContext, seed = true) {
  const directory = fs.mkdtempSync(join(tmpdir(), 'gc-prestations-v1-'));
  const file = join(directory, 'test.db');
  const sqlite = new DatabaseSync(file);
  context.after(() => sqlite.close());
  // Lecture du vrai SCHEMA_SQL sans importer db.ts, qui ouvrirait l'application.
  sqlite.exec(projectSchema());
  if (seed) {
    sqlite.exec(`
      INSERT INTO ventes (idVente, code_vente, nom_prenom, montant_ht, montant_ttc)
        VALUES (7, 'VTE-007', 'Client de test', 1000, 1000);
      INSERT INTO ventes_prestations (idVentePrestation, code_facture, client_nom, montant_total, montant_paye)
        VALUES (7, 'PRE-007', 'Client de test', 250, 250);
    `);
  }
  const trace = { transactions: 0, commits: 0, rollbacks: 0, sql: [] as string[] };
  let failure: RegExp | null = null;
  const connection: PrestationMigrationConnection = {
    async select<Row extends object>(sql: string, parameters: readonly MigrationSqlValue[] = []): Promise<Row[]> {
      trace.sql.push(sql);
      return sqlite.prepare(sql).all(...parameters) as unknown as Row[];
    },
    async execute(sql: string, parameters: readonly MigrationSqlValue[] = []): Promise<void> {
      trace.sql.push(sql);
      if (failure?.test(sql)) throw new Error('Echec simule de la migration');
      sqlite.prepare(sql).run(...parameters);
    },
  };
  const driver: PrestationMigrationDatabase = {
    async transaction<T>(work: (connection: PrestationMigrationConnection) => Promise<T>): Promise<T> {
      trace.transactions += 1;
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(connection);
        sqlite.exec('COMMIT');
        trace.commits += 1;
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        trace.rollbacks += 1;
        throw error;
      }
    },
  };
  const journal = (id: number, reference: string | null, sourceId: number | null,
    type = 'ENTREE', category = 'VENTE_COMPTOIR', notes: string | null = null): void => {
    sqlite.prepare(`INSERT INTO journal_caisse
      (idJournal, code_journal, type_mouvement, categorie, designation, montant, solde_apres, reference, idReference, notes)
      VALUES (?, ?, ?, ?, 'Operation de test', 100, 100, ?, ?, ?)`)
      .run(id, `J-${id}`, type, category, reference, sourceId, notes);
  };
  return { sqlite, driver, trace, journal, directory, file,
    failOn(sql: RegExp): void { failure = sql; },
    persist(name: string, report: unknown): void {
      fs.writeFileSync(join(directory, `${name}.json`), JSON.stringify(report, null, 2));
      console.log(`Preuve migration : ${join(directory, `${name}.json`)}`);
    },
  };
}

function columnNames(sqlite: SqliteConnection, table: string): string[] {
  return sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name));
}

function schemaSnapshot(sqlite: SqliteConnection): Record<string, MigrationSqlValue>[] {
  return sqlite.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all();
}

test('base existante : ajouts prevus, donnees et table reglements inchangees', async context => {
  const f = fixture(context);
  f.journal(1, 'VTE-007', 7);
  f.journal(2, 'PRE-007', 7); // Meme id, deux origines distinctes.
  const originalReglements = f.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'reglements'").get();
  const originalSale = f.sqlite.prepare('SELECT code_vente, montant_ht, montant_ttc FROM ventes WHERE idVente = 7').get();
  const originalCash = f.sqlite.prepare('SELECT idJournal, montant, solde_apres, categorie FROM journal_caisse ORDER BY idJournal').all();
  const report = await migratePrestationsV1(f.driver);

  assert.equal(report.migrationId, PRESTATIONS_MIGRATION_ID);
  assert.equal(report.alreadyApplied, false);
  assert.equal(report.addedColumns.length, 12);
  assert.equal(report.createdTables.length, 4);
  assert.deepEqual(report.originsBackfilled, { vente: 1, prestation: 1 });
  assert.deepEqual(report.issues, []);
  assert.deepEqual(columnNames(f.sqlite, 'ventes_prestations').slice(-7),
    ['date_annulation', 'annule_par', 'motif_annulation', 'updated_at', 'version', 'deleted_at', 'deleted_by']);
  assert.deepEqual(columnNames(f.sqlite, 'ventes').slice(-2), ['version', 'updated_at']);
  assert.deepEqual(columnNames(f.sqlite, 'journal_caisse').slice(-3), ['origin', 'origin_id', 'idJournalContrepasse']);
  assert.deepEqual(f.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'reglements'").get(), originalReglements);
  assert.deepEqual(f.sqlite.prepare('SELECT code_vente, montant_ht, montant_ttc FROM ventes WHERE idVente = 7').get(), originalSale);
  assert.deepEqual(f.sqlite.prepare('SELECT idJournal, montant, solde_apres, categorie FROM journal_caisse ORDER BY idJournal').all(), originalCash);
  assert.equal(f.sqlite.prepare('SELECT version FROM ventes WHERE idVente = 7').get()?.version, 1);
  assert.equal(f.sqlite.prepare('SELECT version FROM ventes_prestations WHERE idVentePrestation = 7').get()?.version, 1);
  assert.ok(f.sqlite.prepare('SELECT updated_at FROM ventes WHERE idVente = 7').get()?.updated_at);
  for (const table of ['reglements_prestations', 'transaction_operations', 'prestation_decompte_commission']) {
    assert.equal(f.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, 0);
  }
  assert.equal(f.sqlite.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  assert.deepEqual([f.trace.transactions, f.trace.commits, f.trace.rollbacks], [1, 1, 0]);
  f.persist('premier-passage', report);
});

test('relance : aucun doublon ni changement de schema ou d encaissement', async context => {
  const f = fixture(context);
  f.journal(1, 'PRE-007', 7);
  await migratePrestationsV1(f.driver);
  const schema = schemaSnapshot(f.sqlite);
  const marker = f.sqlite.prepare('SELECT * FROM prestation_migrations').all();
  const cash = f.sqlite.prepare('SELECT * FROM journal_caisse').all();
  const second = await migratePrestationsV1(f.driver);
  assert.equal(second.alreadyApplied, true);
  assert.deepEqual(second.addedColumns, []);
  assert.deepEqual(second.createdTables, []);
  assert.deepEqual(second.originsBackfilled, { vente: 0, prestation: 0 });
  assert.deepEqual(schemaSnapshot(f.sqlite), schema);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM prestation_migrations').all(), marker);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM journal_caisse').all(), cash);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM prestation_migrations').get()?.n, 1);
  f.persist('relance', second);
});

test('historique ambigu : ni id seul, ni prefixe, ni reference partagee ne sont attribues', async context => {
  const f = fixture(context);
  f.journal(1, null, 7);
  f.journal(2, 'PRE-007', null);
  f.journal(3, 'PRE-007', 99);
  f.journal(4, 'PRE-INCONNUE', 7);
  f.sqlite.exec(`INSERT INTO ventes (idVente, code_vente) VALUES (8, 'PARTAGEE');
    INSERT INTO ventes_prestations (idVentePrestation, code_facture) VALUES (8, 'PARTAGEE');`);
  f.journal(5, 'PARTAGEE', 8);
  const report = await migratePrestationsV1(f.driver);
  assert.deepEqual(report.issues.map(issue => issue.code),
    ['MISSING_REFERENCE', 'MISSING_SOURCE_ID', 'SOURCE_ID_CONFLICT', 'SOURCE_NOT_FOUND', 'AMBIGUOUS_REFERENCE']);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM journal_caisse WHERE origin IS NOT NULL OR origin_id IS NOT NULL').get()?.n, 0);
  const stored = JSON.parse(String(f.sqlite.prepare('SELECT report_json FROM prestation_migrations').get()?.report_json)) as { issues: unknown[] };
  assert.equal(stored.issues.length, 5);
  f.persist('rapprochements-refuses', report);
});

test('colonnes deja presentes : valeurs existantes conservees, conflit signale', async context => {
  const f = fixture(context);
  f.sqlite.exec(`ALTER TABLE ventes ADD COLUMN version INTEGER DEFAULT 1;
    ALTER TABLE ventes ADD COLUMN updated_at DATETIME;
    UPDATE ventes SET version = 9, updated_at = '2020-01-02 03:04:05';
    ALTER TABLE journal_caisse ADD COLUMN origin TEXT;
    ALTER TABLE journal_caisse ADD COLUMN origin_id INTEGER;`);
  f.journal(1, 'PRE-007', 7);
  f.journal(2, 'VTE-007', 7);
  f.sqlite.exec("UPDATE journal_caisse SET origin = 'vente', origin_id = 7 WHERE idJournal = 1;");
  const report = await migratePrestationsV1(f.driver);
  assert.equal(report.addedColumns.length, 8);
  assert.equal(report.issues[0]?.code, 'EXISTING_ORIGIN_CONFLICT');
  assert.equal(f.sqlite.prepare('SELECT origin FROM journal_caisse WHERE idJournal = 1').get()?.origin, 'vente');
  assert.equal(f.sqlite.prepare('SELECT version FROM ventes WHERE idVente = 7').get()?.version, 9);
  assert.equal(f.sqlite.prepare('SELECT updated_at FROM ventes WHERE idVente = 7').get()?.updated_at, '2020-01-02 03:04:05');
});

test('rollback integral apres un echec de DDL, sans marqueur de version', async context => {
  const f = fixture(context);
  const before = schemaSnapshot(f.sqlite);
  f.failOn(/CREATE TABLE IF NOT EXISTS transaction_operations/);
  await assert.rejects(() => migratePrestationsV1(f.driver), /Echec simule/);
  assert.deepEqual(schemaSnapshot(f.sqlite), before);
  assert.deepEqual([f.trace.commits, f.trace.rollbacks], [0, 1]);
});

test('rollback apres rapprochement : aucune origine partiellement modifiee', async context => {
  const f = fixture(context);
  f.journal(1, 'PRE-007', 7);
  const before = schemaSnapshot(f.sqlite);
  f.failOn(/INSERT INTO prestation_migrations/);
  await assert.rejects(() => migratePrestationsV1(f.driver), /Echec simule/);
  assert.deepEqual(schemaSnapshot(f.sqlite), before);
  assert.equal(columnNames(f.sqlite, 'journal_caisse').includes('origin'), false);
  assert.equal(f.sqlite.prepare('SELECT reference FROM journal_caisse WHERE idJournal = 1').get()?.reference, 'PRE-007');
});

test('cle d operation unique, motif obligatoire et references de reglement controles', async context => {
  const f = fixture(context);
  f.journal(1, 'PRE-007', 7);
  await migratePrestationsV1(f.driver);
  const operation = f.sqlite.prepare(`INSERT INTO transaction_operations
    (operation_key, origin, origin_id, action, idUtilisateur, description, motif)
    VALUES (?, 'prestation', 7, ?, 1, 'Operation de test', ?)`);
  operation.run('paiement-unique', 'create', null);
  assert.throws(() => operation.run('paiement-unique', 'create', null), /UNIQUE/);
  assert.throws(() => operation.run('annulation-sans-motif', 'cancel', null), /CHECK/);
  const payment = f.sqlite.prepare(`INSERT INTO reglements_prestations
    (code_reglement, idVentePrestation, montant, mode_paiement, idUtilisateur, idJournal, operation_key)
    VALUES (?, ?, ?, 'ESPECES', 1, ?, 'paiement-unique')`);
  payment.run('RP-1', 7, 100, 1);
  assert.throws(() => payment.run('RP-2', 7, 100, 1), /UNIQUE/);
  assert.throws(() => payment.run('RP-3', 999, 100, null), /FOREIGN KEY/);
  assert.throws(() => payment.run('RP-4', 7, -10, null), /CHECK/);
  assert.throws(() => f.sqlite.exec("UPDATE journal_caisse SET origin = 'inconnue' WHERE idJournal = 1"), /CHECK/);
});

test('contrepassation historique : origine identifiee sans inventer le lien financier', async context => {
  const f = fixture(context);
  f.journal(1, 'VTE-007', 7);
  f.journal(2, 'VTE-007', 7, 'SORTIE', 'AUTRE_SORTIE', 'CONTREPASSATION vente VTE-007');
  f.journal(3, 'PRE-007', 7, 'ENTREE', 'AUTRE_ENTREE');
  const report = await migratePrestationsV1(f.driver);
  assert.deepEqual(report.originsBackfilled, { vente: 2, prestation: 0 });
  assert.equal(f.sqlite.prepare('SELECT idJournalContrepasse FROM journal_caisse WHERE idJournal = 2').get()?.idJournalContrepasse, null);
  assert.equal(f.sqlite.prepare('SELECT origin FROM journal_caisse WHERE idJournal = 3').get()?.origin, null);
  f.sqlite.exec('UPDATE journal_caisse SET idJournalContrepasse = 1 WHERE idJournal = 2');
  assert.throws(() => f.sqlite.exec('UPDATE journal_caisse SET idJournalContrepasse = 1 WHERE idJournal = 3'), /UNIQUE/);
});

test('reprise possible de nouvelles lignes historiques, sans rejouer la migration de schema', async context => {
  const f = fixture(context);
  await migratePrestationsV1(f.driver);
  f.journal(1, 'PRE-007', 7);
  const report = await migratePrestationsV1(f.driver);
  assert.equal(report.alreadyApplied, true);
  assert.deepEqual(report.originsBackfilled, { vente: 0, prestation: 1 });
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM prestation_migrations').get()?.n, 1);
});

test('prerequis absents ou cles etrangeres desactivees : refus sans DDL', async context => {
  const f = fixture(context);
  f.sqlite.exec('DROP TABLE journal_caisse');
  const before = schemaSnapshot(f.sqlite);
  await assert.rejects(() => migratePrestationsV1(f.driver), /schéma incompatible dans journal_caisse/);
  assert.deepEqual(schemaSnapshot(f.sqlite), before);
  const off = fixture(context);
  off.sqlite.exec('PRAGMA foreign_keys = OFF');
  const offBefore = schemaSnapshot(off.sqlite);
  await assert.rejects(() => migratePrestationsV1(off.driver), /activer les clés étrangères/);
  assert.deepEqual(schemaSnapshot(off.sqlite), offBefore);
});

test('schema additif preexistant incomplet : rollback au lieu de masquer l incompatibilite', async context => {
  const f = fixture(context);
  f.sqlite.exec('CREATE TABLE transaction_operations (idOperation INTEGER PRIMARY KEY)');
  const before = schemaSnapshot(f.sqlite);
  await assert.rejects(() => migratePrestationsV1(f.driver), /schéma incompatible dans transaction_operations/);
  assert.deepEqual(schemaSnapshot(f.sqlite), before);
});

test('index homonyme incorrect : refus et rollback plutot qu une fausse garantie d unicite', async context => {
  const f = fixture(context);
  f.sqlite.exec('CREATE INDEX uq_prestations_v1_contrepassation ON journal_caisse(idReference)');
  const before = schemaSnapshot(f.sqlite);
  await assert.rejects(() => migratePrestationsV1(f.driver), /index d'unicité incompatible/);
  assert.deepEqual(schemaSnapshot(f.sqlite), before);
});

test('aucun appel de stock, credit ou decompte : tables reservees vides', async context => {
  const f = fixture(context);
  const stock = f.sqlite.prepare('SELECT * FROM products').all();
  const credits = f.sqlite.prepare('SELECT * FROM credits').all();
  const decomptes = f.sqlite.prepare('SELECT * FROM decomptes').all();
  await migratePrestationsV1(f.driver);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM products').all(), stock);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM credits').all(), credits);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM decomptes').all(), decomptes);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM prestation_decompte_commission').get()?.n, 0);
});
