import type { TransactionContext } from '../transactionContracts.ts';

export type PrestationSqlValue = string | number | null;
export type PrestationOperation = 'read' | 'create' | 'update' | 'cancel' | 'delete';
export interface PrestationConnection {
  select<Row extends object>(sql: string, parameters?: readonly PrestationSqlValue[]): Promise<Row[]>;
  execute(sql: string, parameters?: readonly PrestationSqlValue[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
}
export interface PrestationDatabase {
  /** Le pilote conserve UNE connexion et assure BEGIN/COMMIT/ROLLBACK. */
  transaction<T>(ctx: TransactionContext, action: PrestationOperation, work: (db: PrestationConnection) => Promise<T>): Promise<T>;
  read<T>(ctx: TransactionContext, work: (db: PrestationConnection) => Promise<T>): Promise<T>;
}

export type PrestationErrorCode = 'INVALID_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' | 'VERSION_CONFLICT'
  | 'ALREADY_CANCELLED' | 'DELETED' | 'PAYMENT_EXISTS' | 'FINANCIAL_CHANGE_AFTER_PAYMENT'
  | 'DECOMPTE_LINKED' | 'REFUND_REQUIRED' | 'REFUND_MISMATCH' | 'OPERATION_CONFLICT'
  | 'HISTORY_UNRESOLVED' | 'TRANSACTION_UNAVAILABLE' | 'MIGRATION_REQUIRED';

export class PrestationAdapterError extends Error {
  readonly code: PrestationErrorCode;
  constructor(code: PrestationErrorCode, message: string) {
    super(message);
    this.name = 'PrestationAdapterError';
    this.code = code;
  }
}
