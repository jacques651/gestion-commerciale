import type { TransactionContext, TransactionRef } from './transactionContracts.ts';
import { PrestationAdapterError } from './adapters/prestationPersistence.ts';
import { PERMISSIONS } from '../types/permissions.ts';
export type ReadValue = string | number | null;
export interface TransactionReadSource { select<Row extends object>(sql: string, params?: readonly ReadValue[]): Promise<Row[]>; }
export const transactionReadSource: TransactionReadSource = {
  async select<Row extends object>(sql: string, params: readonly ReadValue[] = []) {
    const db = await (await import('../database/db.ts')).getDb();
    return db.select<Row[]>(sql, [...params]);
  },
};
export async function authorizeTransactionRead(source: TransactionReadSource, ctx: TransactionContext): Promise<void> {
  if (!Number.isSafeInteger(ctx.utilisateurId) || ctx.utilisateurId <= 0 || ctx.espaceId !== null
    || !PERMISSIONS.find(item => item.id === 'ventes.view')?.defaultRoles.includes(ctx.role)) {
    throw new PrestationAdapterError('FORBIDDEN', 'Votre session ne permet pas cette consultation.');
  }
  const [actor] = await source.select<{ role: string; est_actif: number }>('SELECT role, est_actif FROM utilisateurs WHERE id = ?', [ctx.utilisateurId]);
  if (!actor || actor.est_actif !== 1 || actor.role.toLowerCase() !== ctx.role) {
    throw new PrestationAdapterError('FORBIDDEN', 'Acteur absent, inactif ou rôle incohérent avec la base locale.');
  }
}
export async function readColumns(source: TransactionReadSource, table: 'ventes' | 'journal_caisse'): Promise<Set<string>> {
  return new Set((await source.select<{ name: string }>(`PRAGMA table_info(${table})`)).map(row => row.name));
}
export interface TransactionJournalView {
  idJournal: number; code_journal: string; date_journal: string; type_mouvement: string; categorie: string;
  montant: number; designation: string; reference: string | null; idReference: number | null;
  origin: 'vente' | 'prestation' | null; origin_id: number | null; idJournalContrepasse: number | null;
  operation: TransactionRef | null; contrepassationId: number | null; nom_utilisateur: string | null;
}
export interface TransactionActivity {
  idOperation: number; operation_key: string; origin: 'prestation'; origin_id: number; action: string;
  date_operation: string; motif: string | null; description: string; acteur: string; code: string;
}
export function createTransactionReadQueries(source: TransactionReadSource = transactionReadSource) {
  return {
    async readJournal(ids: readonly number[], ctx: TransactionContext): Promise<TransactionJournalView[]> {
      await authorizeTransactionRead(source, ctx);
      if (!ids.length) return [];
      if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new PrestationAdapterError('INVALID_INPUT', 'Référence de journal invalide.');
      const columns = await readColumns(source, 'journal_caisse');
      const hasOrigin = columns.has('origin') && columns.has('origin_id');
      const hasInverse = columns.has('idJournalContrepasse');
      const result: TransactionJournalView[] = [];
      for (let offset = 0; offset < ids.length; offset += 400) {
        const batch = ids.slice(offset, offset + 400);
        const rows = await source.select<Omit<TransactionJournalView, 'operation'>>(`SELECT j.*,
          ${hasOrigin ? 'j.origin, j.origin_id' : 'NULL AS origin, NULL AS origin_id'},
          ${hasInverse ? 'j.idJournalContrepasse, inverse.idJournal AS contrepassationId' : 'NULL AS idJournalContrepasse, NULL AS contrepassationId'}, u.nom AS nom_utilisateur
          FROM journal_caisse j LEFT JOIN utilisateurs u ON u.id = j.idUtilisateur
          ${hasInverse ? 'LEFT JOIN journal_caisse inverse ON inverse.idJournalContrepasse = j.idJournal' : ''}
          WHERE j.idJournal IN (${batch.map(() => '?').join(',')})`, batch);
        result.push(...rows.map(row => ({ ...row,
          origin: row.origin === 'vente' || row.origin === 'prestation' ? row.origin : null,
          operation: (row.origin === 'vente' || row.origin === 'prestation') && Number.isSafeInteger(row.origin_id) && Number(row.origin_id) > 0
            ? { origin: row.origin, id: Number(row.origin_id) } : null,
        })));
      }
      return result;
    },
    async readPrestationActivity(ctx: TransactionContext): Promise<TransactionActivity[]> {
      await authorizeTransactionRead(source, ctx);
      const [exists] = await source.select<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='transaction_operations'");
      if (!exists?.n) return [];
      return source.select<TransactionActivity>(`SELECT o.idOperation, o.operation_key, o.origin, o.origin_id, o.action,
        o.date_operation, o.motif, o.description, COALESCE(u.nom, 'Acteur #' || o.idUtilisateur) AS acteur,
        COALESCE(v.code_facture, 'Prestation #' || o.origin_id) AS code
        FROM transaction_operations o LEFT JOIN utilisateurs u ON u.id=o.idUtilisateur
        LEFT JOIN ventes_prestations v ON v.idVentePrestation=o.origin_id
        WHERE o.origin='prestation' ORDER BY o.date_operation DESC, o.idOperation DESC`);
    },
  };
}
