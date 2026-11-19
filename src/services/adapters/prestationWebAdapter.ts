import type { TransactionServiceContract, TransactionContext } from '../transactionContracts.ts';
import { PrestationAdapterError, type PrestationErrorCode } from './prestationPersistence.ts';

type Methods = keyof TransactionServiceContract;
type Args = {
  create: { input: Parameters<TransactionServiceContract['create']>[0] };
  update: { ref: Parameters<TransactionServiceContract['update']>[0]; modifications: Parameters<TransactionServiceContract['update']>[1]; versionAttendue: number };
  cancel: { ref: Parameters<TransactionServiceContract['cancel']>[0]; motif: string; traitementFinancier: Parameters<TransactionServiceContract['cancel']>[2]; cleOperation: string };
  delete: { ref: Parameters<TransactionServiceContract['delete']>[0]; motif: string; mode: 'soft' };
  getView: { ref: Parameters<TransactionServiceContract['getView']>[0] };
  listView: { filters: Parameters<TransactionServiceContract['listView']>[0]; pagination: Parameters<TransactionServiceContract['listView']>[1] };
};
export type PrestationWebRequest = { [K in Methods]: { operation: K; args: Args[K]; ctx: TransactionContext } }[Methods];
export type PrestationWebTransport = <T>(request: PrestationWebRequest) => Promise<T>;

async function httpTransport<T>(request: PrestationWebRequest, baseUrl?: string, token?: string): Promise<T> {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiToken = token ?? env?.VITE_API_TOKEN;
  if (apiToken) headers['x-gc-token'] = apiToken;
  let response: Response;
  try {
    response = await fetch(`${baseUrl ?? env?.VITE_API_BASE ?? ''}/api/prestations`, { method: 'POST', headers, body: JSON.stringify(request) });
  } catch { throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Le serveur web des prestations est inaccessible. Vérifiez son démarrage.'); }
  if (response.status === 404) throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Le serveur web doit être redémarré avec la version prenant en charge les prestations.');
  let payload: { result?: T; error?: string; code?: PrestationErrorCode };
  try { payload = await response.json(); }
  catch { throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Réponse du serveur de prestations invalide.'); }
  if (!response.ok) throw new PrestationAdapterError(payload.code || 'TRANSACTION_UNAVAILABLE', payload.error || 'Opération de prestation refusée.');
  if (!('result' in payload)) throw new PrestationAdapterError('TRANSACTION_UNAVAILABLE', 'Le serveur n’a pas renvoyé la prestation complète.');
  return payload.result as T;
}

export function createPrestationHttpTransport(baseUrl: string, token = ''): PrestationWebTransport {
  return <T>(request: PrestationWebRequest) => httpTransport<T>(request, baseUrl, token);
}

/** Même contrat métier : les contrôles et la transaction s’exécutent intégralement sur Node. */
export function createPrestationWebAdapter(post: PrestationWebTransport = httpTransport): TransactionServiceContract {
  return {
    create: (input, ctx) => post({ operation: 'create', args: { input }, ctx }),
    update: (ref, modifications, versionAttendue, ctx) => post({ operation: 'update', args: { ref, modifications, versionAttendue }, ctx }),
    cancel: (ref, motif, traitementFinancier, cleOperation, ctx) => post({ operation: 'cancel', args: { ref, motif, traitementFinancier, cleOperation }, ctx }),
    delete: (ref, motif, mode, ctx) => post({ operation: 'delete', args: { ref, motif, mode }, ctx }),
    getView: (ref, ctx) => post({ operation: 'getView', args: { ref }, ctx }),
    listView: (filters, pagination, ctx) => post({ operation: 'listView', args: { filters, pagination }, ctx }),
  };
}
