/**
 * Sous-etape 3.1 uniquement : schema additif et identification prudente du journal.
 * Aucun branchement au demarrage, aucun mouvement financier ni changement de stock.
 *
 * Le pilote doit fournir UNE connexion reservee pendant toute la transaction.
 * L'interface volontairement distincte du pool getDb() interdit de supposer que
 * plusieurs appels SQL independants partagent une transaction native Tauri.
 */

export type MigrationSqlValue = string | number | bigint | null | Uint8Array;

export interface PrestationMigrationConnection {
  select<Row extends object>(sql: string, parameters?: readonly MigrationSqlValue[]): Promise<Row[]>;
  execute(sql: string, parameters?: readonly MigrationSqlValue[]): Promise<void>;
}

export interface PrestationMigrationDatabase {
  /** BEGIN/COMMIT/ROLLBACK et reservation de connexion sont a la charge du pilote. */
  transaction<T>(work: (connection: PrestationMigrationConnection) => Promise<T>): Promise<T>;
}

export type MigrationOrigin = 'vente' | 'prestation';
export type MigrationIssueCode =
  | 'MISSING_REFERENCE'
  | 'MISSING_SOURCE_ID'
  | 'SOURCE_NOT_FOUND'
  | 'AMBIGUOUS_REFERENCE'
  | 'SOURCE_ID_CONFLICT'
  | 'EXISTING_ORIGIN_CONFLICT';

export interface PrestationMigrationIssue {
  journalId: number;
  reference: string | null;
  code: MigrationIssueCode;
  message: string;
}

export interface PrestationMigrationReport {
  migrationId: string;
  version: number;
  alreadyApplied: boolean;
  addedColumns: string[];
  createdTables: string[];
  originsBackfilled: Record<MigrationOrigin, number>;
  issues: PrestationMigrationIssue[];
  integrityCheck: 'ok';
}

interface ColumnInfo { name: string; type: string; }
interface JournalRow {
  idJournal: number;
  reference: string | null;
  idReference: number | null;
  origin: string | null;
  origin_id: number | null;
}
interface SourceRow { origin: MigrationOrigin; source_id: number; }

export const PRESTATIONS_MIGRATION_VERSION = 1;
export const PRESTATIONS_MIGRATION_ID = 'prestations_v1';

const ADDED_COLUMNS = {
  ventes_prestations: {
    date_annulation: 'DATETIME',
    annule_par: 'TEXT',
    motif_annulation: 'TEXT',
    updated_at: 'DATETIME',
    version: 'INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)',
    deleted_at: 'DATETIME',
    deleted_by: 'INTEGER REFERENCES utilisateurs(id)',
  },
  ventes: {
    version: 'INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)',
    updated_at: 'DATETIME',
  },
  journal_caisse: {
    origin: "TEXT CHECK (origin IS NULL OR origin IN ('vente', 'prestation'))",
    origin_id: 'INTEGER CHECK (origin_id IS NULL OR origin_id > 0)',
    idJournalContrepasse: 'INTEGER REFERENCES journal_caisse(idJournal)',
  },
} as const;

const NEW_TABLES = {
  prestation_migrations: `CREATE TABLE IF NOT EXISTS prestation_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    migration_id TEXT NOT NULL UNIQUE,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    report_json TEXT NOT NULL
  )`,
  transaction_operations: `CREATE TABLE IF NOT EXISTS transaction_operations (
    idOperation INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_key TEXT NOT NULL UNIQUE,
    origin TEXT NOT NULL CHECK (origin IN ('vente', 'prestation')),
    origin_id INTEGER NOT NULL CHECK (origin_id > 0),
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'cancel', 'delete')),
    idUtilisateur INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_operation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motif TEXT,
    description TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    CHECK (action NOT IN ('cancel', 'delete') OR
      (motif IS NOT NULL AND length(trim(motif)) > 0))
  )`,
  reglements_prestations: `CREATE TABLE IF NOT EXISTS reglements_prestations (
    idReglementPrestation INTEGER PRIMARY KEY AUTOINCREMENT,
    code_reglement TEXT NOT NULL UNIQUE,
    idVentePrestation INTEGER NOT NULL REFERENCES ventes_prestations(idVentePrestation),
    montant REAL NOT NULL CHECK (montant > 0),
    date_reglement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mode_paiement TEXT NOT NULL,
    mode_paiement_detail TEXT,
    statut TEXT NOT NULL DEFAULT 'VALIDE' CHECK (statut IN ('VALIDE', 'ANNULE')),
    idUtilisateur INTEGER NOT NULL REFERENCES utilisateurs(id),
    idSession INTEGER REFERENCES sessions_caisse(idSession),
    idJournal INTEGER REFERENCES journal_caisse(idJournal),
    operation_key TEXT NOT NULL REFERENCES transaction_operations(operation_key),
    date_annulation DATETIME,
    annule_par TEXT,
    motif_annulation TEXT,
    observations TEXT
  )`,
  // Reserve au schema : aucune association, commission ou operation de stock ici.
  prestation_decompte_commission: `CREATE TABLE IF NOT EXISTS prestation_decompte_commission (
    idLiaison INTEGER PRIMARY KEY AUTOINCREMENT,
    idVentePrestation INTEGER NOT NULL REFERENCES ventes_prestations(idVentePrestation),
    idDecompte INTEGER NOT NULL REFERENCES decomptes(idDecompte),
    montant_base REAL NOT NULL CHECK (montant_base >= 0),
    taux_commission REAL NOT NULL CHECK (taux_commission BETWEEN 0 AND 100),
    montant_commission REAL NOT NULL CHECK (montant_commission >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (idVentePrestation, idDecompte)
  )`,
} as const;

const REQUIRED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  ventes: ['idVente', 'code_vente'],
  ventes_prestations: ['idVentePrestation', 'code_facture'],
  journal_caisse: ['idJournal', 'reference', 'idReference', 'type_mouvement', 'categorie', 'notes'],
  utilisateurs: ['id'],
  sessions_caisse: ['idSession'],
  decomptes: ['idDecompte'],
};

const NEW_TABLE_COLUMNS: Readonly<Record<keyof typeof NEW_TABLES, readonly string[]>> = {
  prestation_migrations: ['version', 'migration_id', 'applied_at', 'report_json'],
  transaction_operations: ['idOperation', 'operation_key', 'origin', 'origin_id', 'action',
    'idUtilisateur', 'date_operation', 'motif', 'description', 'before_json', 'after_json'],
  reglements_prestations: ['idReglementPrestation', 'code_reglement', 'idVentePrestation',
    'montant', 'date_reglement', 'mode_paiement', 'mode_paiement_detail', 'statut',
    'idUtilisateur', 'idSession', 'idJournal', 'operation_key', 'date_annulation',
    'annule_par', 'motif_annulation', 'observations'],
  prestation_decompte_commission: ['idLiaison', 'idVentePrestation', 'idDecompte',
    'montant_base', 'taux_commission', 'montant_commission', 'created_at'],
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_prestations_v1_journal_origin ON journal_caisse(origin, origin_id)',
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_prestations_v1_contrepassation
    ON journal_caisse(idJournalContrepasse) WHERE idJournalContrepasse IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_prestations_v1_reglement_journal
    ON reglements_prestations(idJournal) WHERE idJournal IS NOT NULL`,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_prestations_v1_operation_key ON transaction_operations(operation_key)',
  'CREATE INDEX IF NOT EXISTS idx_prestations_v1_reglement_source ON reglements_prestations(idVentePrestation, statut)',
  'CREATE INDEX IF NOT EXISTS idx_prestations_v1_operations_source ON transaction_operations(origin, origin_id, date_operation)',
  'CREATE INDEX IF NOT EXISTS idx_prestations_v1_decompte ON prestation_decompte_commission(idDecompte)',
] as const;

function identifier(value: string): string {
  // Les noms ne proviennent jamais de l'interface utilisateur.
  return `"${value.replace(/"/g, '""')}"`;
}

async function columns(connection: PrestationMigrationConnection, table: string): Promise<ColumnInfo[]> {
  return connection.select<ColumnInfo>(`PRAGMA table_info(${identifier(table)})`);
}

async function requireColumns(
  connection: PrestationMigrationConnection, table: string, required: readonly string[],
): Promise<void> {
  const names = new Set((await columns(connection, table)).map(column => column.name));
  const missing = required.filter(name => !names.has(name));
  if (missing.length) {
    throw new Error(`Migration prestations : schéma incompatible dans ${table} (absent : ${missing.join(', ')}). Initialiser le schéma de base avant cette migration.`);
  }
}

async function checkIntegrity(connection: PrestationMigrationConnection): Promise<void> {
  const rows = await connection.select<{ integrity_check: string }>('PRAGMA integrity_check');
  if (rows.length !== 1 || rows[0].integrity_check !== 'ok') {
    throw new Error(`Migration prestations : intégrité SQLite invalide (${rows.map(row => row.integrity_check).join('; ')}).`);
  }
  const foreignKeys = await connection.select<{ table: string; rowid: number | null }>('PRAGMA foreign_key_check');
  if (foreignKeys.length) {
    throw new Error(`Migration prestations : ${foreignKeys.length} référence(s) étrangère(s) invalide(s).`);
  }
}

async function checkUniqueIndexes(connection: PrestationMigrationConnection): Promise<void> {
  // IF NOT EXISTS ne garantit pas qu'un index homonyme ait la bonne definition.
  const expected = [
    { table: 'journal_caisse', name: 'uq_prestations_v1_contrepassation', column: 'idJournalContrepasse', partial: true },
    { table: 'reglements_prestations', name: 'uq_prestations_v1_reglement_journal', column: 'idJournal', partial: true },
    { table: 'transaction_operations', name: 'uq_prestations_v1_operation_key', column: 'operation_key', partial: false },
  ];
  for (const index of expected) {
    const indexes = await connection.select<{ name: string; unique: number; partial: number }>(
      `PRAGMA index_list(${identifier(index.table)})`,
    );
    const actual = indexes.find(candidate => candidate.name === index.name);
    const members = await connection.select<{ name: string | null }>(`PRAGMA index_info(${identifier(index.name)})`);
    const [definition] = await connection.select<{ sql: string | null }>(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?", [index.name],
    );
    const sql = definition?.sql?.replace(/[\s"\[\]]/g, '').toLowerCase() ?? '';
    if (actual?.unique !== 1 || actual.partial !== Number(index.partial)
      || members.length !== 1 || members[0].name !== index.column
      || (index.partial && !sql.endsWith(`where${index.column}isnotnull`.toLowerCase()))) {
      throw new Error(`Migration prestations : index d'unicité incompatible (${index.name}).`);
    }
  }
}

async function backfillOrigins(
  connection: PrestationMigrationConnection, report: PrestationMigrationReport,
): Promise<void> {
  // Une reference textuelle seule, un prefixe PRE- seul ou un id seul ne suffit pas.
  // Les contrepassations historiques de ventes sont reconnaissables par leur note.
  // Leur ancien lien financier n'est pas deduit : idJournalContrepasse reste intact.
  const journals = await connection.select<JournalRow>(`
    SELECT idJournal, reference, idReference, origin, origin_id FROM journal_caisse
    WHERE (categorie = 'VENTE_COMPTOIR' AND type_mouvement = 'ENTREE')
       OR (categorie = 'AUTRE_SORTIE' AND type_mouvement = 'SORTIE'
           AND notes LIKE 'CONTREPASSATION vente %')
    ORDER BY idJournal
  `);
  for (const journal of journals) {
    const issue = (code: MigrationIssueCode, message: string): void => {
      report.issues.push({ journalId: journal.idJournal, reference: journal.reference, code, message });
    };
    if (!journal.reference?.trim()) {
      issue('MISSING_REFERENCE', 'Origine conservée : référence métier absente.');
      continue;
    }
    if (!Number.isSafeInteger(journal.idReference) || Number(journal.idReference) <= 0) {
      issue('MISSING_SOURCE_ID', 'Origine conservée : identifiant métier absent ou invalide.');
      continue;
    }
    const sources = await connection.select<SourceRow>(`
      SELECT 'vente' AS origin, idVente AS source_id FROM ventes WHERE code_vente = ?
      UNION ALL
      SELECT 'prestation' AS origin, idVentePrestation AS source_id
      FROM ventes_prestations WHERE code_facture = ?
    `, [journal.reference, journal.reference]);
    if (!sources.length) {
      issue('SOURCE_NOT_FOUND', 'Origine conservée : aucune opération ne porte exactement cette référence.');
      continue;
    }
    if (sources.length !== 1) {
      issue('AMBIGUOUS_REFERENCE', 'Origine conservée : référence partagée par plusieurs opérations.');
      continue;
    }
    const source = sources[0];
    if (source.source_id !== journal.idReference) {
      issue('SOURCE_ID_CONFLICT', 'Origine conservée : référence et identifiant désignent des opérations différentes.');
      continue;
    }
    if ((journal.origin !== null && journal.origin !== source.origin)
      || (journal.origin_id !== null && journal.origin_id !== source.source_id)) {
      issue('EXISTING_ORIGIN_CONFLICT', 'Origine existante conservée : conflit avec le rapprochement historique.');
      continue;
    }
    if (journal.origin === source.origin && journal.origin_id === source.source_id) continue;
    await connection.execute('UPDATE journal_caisse SET origin = ?, origin_id = ? WHERE idJournal = ?',
      [source.origin, source.source_id, journal.idJournal]);
    report.originsBackfilled[source.origin] += 1;
  }
}

/**
 * Migration autonome, non appelee par les ecrans ni par le demarrage actuel.
 * Le rapport expose les rapprochements refuses ; il est conserve au premier passage
 * dans prestation_migrations. Aucun ancien reglement/encaissement n'est recree.
 */
export async function migratePrestationsV1(database: PrestationMigrationDatabase): Promise<PrestationMigrationReport> {
  return database.transaction(async connection => {
    const [foreignKeys] = await connection.select<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (foreignKeys?.foreign_keys !== 1) {
      throw new Error('Migration prestations : activer les clés étrangères avant la transaction.');
    }
    for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
      await requireColumns(connection, table, required);
    }
    await checkIntegrity(connection);

    const report: PrestationMigrationReport = {
      migrationId: PRESTATIONS_MIGRATION_ID, version: PRESTATIONS_MIGRATION_VERSION,
      alreadyApplied: false, addedColumns: [], createdTables: [],
      originsBackfilled: { vente: 0, prestation: 0 }, issues: [], integrityCheck: 'ok',
    };
    for (const [table, additions] of Object.entries(ADDED_COLUMNS)) {
      const existing = new Set((await columns(connection, table)).map(column => column.name));
      for (const [name, definition] of Object.entries(additions)) {
        if (existing.has(name)) continue;
        await connection.execute(`ALTER TABLE ${identifier(table)} ADD COLUMN ${identifier(name)} ${definition}`);
        report.addedColumns.push(`${table}.${name}`);
      }
      // SQLite interdit CURRENT_TIMESTAMP comme valeur par defaut d'un ALTER ADD.
      // Seule la NOUVELLE colonne est renseignee, sans modifier l'historique metier.
      if (report.addedColumns.includes(`${table}.updated_at`)) {
        await connection.execute(`UPDATE ${identifier(table)} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      }
    }
    for (const [table, sql] of Object.entries(NEW_TABLES)) {
      const existed = (await columns(connection, table)).length > 0;
      await connection.execute(sql);
      await requireColumns(connection, table, NEW_TABLE_COLUMNS[table as keyof typeof NEW_TABLES]);
      if (!existed) report.createdTables.push(table);
    }
    for (const sql of INDEXES) await connection.execute(sql);
    await checkUniqueIndexes(connection);

    const [previous] = await connection.select<{ migration_id: string }>(
      'SELECT migration_id FROM prestation_migrations WHERE version = ?', [PRESTATIONS_MIGRATION_VERSION],
    );
    if (previous && previous.migration_id !== PRESTATIONS_MIGRATION_ID) {
      throw new Error('Migration prestations : la version 1 est déjà attribuée à une autre migration.');
    }
    report.alreadyApplied = previous !== undefined;
    await backfillOrigins(connection, report);
    await checkIntegrity(connection);
    if (!report.alreadyApplied) {
      await connection.execute(`INSERT INTO prestation_migrations (version, migration_id, report_json) VALUES (?, ?, ?)`,
        [report.version, report.migrationId, JSON.stringify(report)]);
    }
    return report;
  });
}
