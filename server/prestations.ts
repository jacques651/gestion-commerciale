/** Point d’entrée TypeScript compilé pour le serveur portable, sans dépendances npm à l’exécution. */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { PrestationAdapter } from '../src/services/adapters/prestationAdapter.ts';
import { PrestationAdapterError, type PrestationConnection, type PrestationDatabase } from '../src/services/adapters/prestationPersistence.ts';
import type { TransactionContext } from '../src/services/transactionContracts.ts';
import type { PrestationWebRequest } from '../src/services/adapters/prestationWebAdapter.ts';

function context(value: unknown): value is TransactionContext {
  if (!value || typeof value !== 'object') return false;
  const ctx = value as Record<string, unknown>;
  return Number.isSafeInteger(ctx.utilisateurId) && Number(ctx.utilisateurId) > 0 && ctx.espaceId === null
    && typeof ctx.role === 'string' && ['admin', 'gestionnaire', 'caissier', 'commercial'].includes(ctx.role);
}

/** Une commande métier HTTP = une connexion et une transaction ; aucun bail SQL exposé au navigateur. */
export function createPrestationApi(dbPath: string) {
  async function run<T>(read: boolean, work: (connection: PrestationConnection) => Promise<T>): Promise<T> {
    if (!existsSync(dbPath)) throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Base web introuvable ; aucune nouvelle base créée.');
    const db = new DatabaseSync(dbPath, { readOnly: read });
    let begun = false;
    try {
      db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
      if (read) db.exec('PRAGMA query_only=ON;');
      db.exec(read ? 'BEGIN DEFERRED' : 'BEGIN IMMEDIATE'); begun = true;
      const connection: PrestationConnection = {
        async select<Row extends object>(sql: string, params = []) { return db.prepare(sql).all(...params) as Row[]; },
        async execute(sql, params = []) {
          const result = db.prepare(sql).run(...params);
          return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
        },
      };
      const result = await work(connection);
      db.exec('COMMIT'); begun = false;
      return result;
    } finally {
      if (begun) { try { db.exec('ROLLBACK'); } catch { /* conserver l’erreur métier initiale */ } }
      db.close();
    }
  }
  const persistence: PrestationDatabase = {
    transaction: (_ctx, _action, work) => run(false, work), read: (_ctx, work) => run(true, work),
  };
  const adapter = new PrestationAdapter(persistence);
  return async (body: unknown): Promise<unknown> => {
    if (!body || typeof body !== 'object') throw new PrestationAdapterError('INVALID_INPUT', 'Commande de prestation invalide.');
    const envelope = body as Record<string, unknown>;
    if (!context(envelope.ctx)) throw new PrestationAdapterError('FORBIDDEN', 'Session de prestation invalide.');
    if (!envelope.args || typeof envelope.args !== 'object' || Array.isArray(envelope.args)) throw new PrestationAdapterError('INVALID_INPUT', 'Paramètres de prestation invalides.');
    const request = body as PrestationWebRequest;
    const args = envelope.args as Record<string, unknown>;
    // Interdit le routage d’une vente vers cet endpoint, avant tout accès à la base.
    const source = request.operation === 'create' ? args.input : request.operation === 'listView' ? args.filters : args.ref;
    if (!source || typeof source !== 'object' || (source as Record<string, unknown>).origin !== 'prestation') {
      throw new PrestationAdapterError('INVALID_INPUT', 'Origine prestation requise.');
    }
    switch (request.operation) {
      case 'create': return adapter.create(request.args.input, request.ctx);
      case 'update': return adapter.update(request.args.ref, request.args.modifications, request.args.versionAttendue, request.ctx);
      case 'cancel': return adapter.cancel(request.args.ref, request.args.motif, request.args.traitementFinancier, request.args.cleOperation, request.ctx);
      case 'delete': return adapter.delete(request.args.ref, request.args.motif, request.args.mode, request.ctx);
      case 'getView': return adapter.getView(request.args.ref, request.ctx);
      case 'listView': return adapter.listView(request.args.filters, request.args.pagination, request.ctx);
      default: throw new PrestationAdapterError('INVALID_INPUT', 'Opération de prestation inconnue.');
    }
  };
}

export { preparerPrestations } from './preparerPrestations.ts';

/**
 * État de la migration prestations 3.1 d'une base existante (lecture seule).
 * - absente : aucun fichier ; nouvelle : schéma de base pas encore créé ;
 * - a-jour : prestations_v1 enregistrée ; a-preparer : schéma présent, migration absente.
 */
export function etatMigrationPrestations(dbPath: string): 'absente' | 'nouvelle' | 'a-jour' | 'a-preparer' {
  if (!existsSync(dbPath)) return 'absente';
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const table = (name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
    if (!table('journal_caisse') || !table('ventes_prestations')) return 'nouvelle';
    if (!table('prestation_migrations')) return 'a-preparer';
    const row = db.prepare('SELECT migration_id FROM prestation_migrations WHERE version = 1').get() as { migration_id?: string } | undefined;
    return row?.migration_id === 'prestations_v1' ? 'a-jour' : 'a-preparer';
  } finally { db.close(); }
}
