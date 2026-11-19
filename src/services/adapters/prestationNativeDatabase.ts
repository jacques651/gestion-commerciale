import { PrestationAdapterError, type PrestationConnection, type PrestationDatabase,
  type PrestationOperation, type PrestationSqlValue } from './prestationPersistence.ts';
import type { TransactionContext } from '../transactionContracts.ts';

async function withConnection<T>(ctx: TransactionContext, action: PrestationOperation,
  work: (db: PrestationConnection) => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Un pilote transactionnel réservé est requis. Aucun repli sur le pool SQL non atomique.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  let token: string;
  try { token = await invoke<string>('prestation_begin', { ctx, action }); }
  catch (error) {
    const message = String(error);
    throw new PrestationAdapterError(message.startsWith('FORBIDDEN:') ? 'FORBIDDEN' : 'TRANSACTION_UNAVAILABLE', message);
  }
  const connection: PrestationConnection = {
    select: <Row extends object>(sql: string, parameters: readonly PrestationSqlValue[] = []) =>
      invoke<Row[]>('prestation_query', { token, sql, parameters }),
    execute: (sql, parameters = []) => invoke('prestation_execute', { token, sql, parameters }),
  };
  try {
    const result = await work(connection);
    await invoke('prestation_finish', { token, commit: true });
    return result;
  } catch (error) {
    try { await invoke('prestation_finish', { token, commit: false }); } catch { /* conserver l'erreur initiale */ }
    throw error;
  }
}

export const prestationNativeDatabase: PrestationDatabase = {
  transaction: withConnection,
  read: (ctx, work) => withConnection(ctx, 'read', work),
};
