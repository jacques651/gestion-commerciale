/**
 * Export metier transactionService, distinct du helper SQL TransactionService.ts.
 * Windows ne permet pas de creer un fichier distinct nomme transactionService.ts.
 * Routage uniquement : aucune lecture SQL, aucun calcul, aucune regle de droits.
 */
import { venteAdapter } from './adapters/venteAdapter.ts';
import { prestationAdapter } from './adapters/prestationAdapter.ts';
import { createPrestationWebAdapter } from './adapters/prestationWebAdapter.ts';
import { TransactionError, type TransactionOrigin, type TransactionServiceContract } from './transactionContracts.ts';
import { createVenteReadProjection } from './venteReadProjection.ts';
import { createTransactionReadQueries } from './transactionReadSource.ts';
import { readAllTransactions } from './transactionConsolidation.ts';
import type { ConsolidatedFilters } from './transactionConsolidation.ts';
import type { TransactionContext } from './transactionContracts.ts';

// Les types demandes restent tous accessibles depuis le module de facade.
export * from './transactionContracts.ts';

export interface TransactionAdapters {
  vente: TransactionServiceContract;
  prestation: TransactionServiceContract;
}

/** Injection pour la future implementation ; les adaptateurs actuels sont des stubs. */
export function createTransactionService(adapters: TransactionAdapters): TransactionServiceContract {
  const adapterFor = (origin: TransactionOrigin): TransactionServiceContract => {
    switch (origin) {
      case 'vente': return adapters.vente;
      case 'prestation': return adapters.prestation;
      default: throw new TransactionError('Origine de transaction non prise en charge.', 'UNSUPPORTED_ORIGIN');
    }
  };

  // Aucun catch : les instances d'erreurs des adaptateurs sont propagees intactes.
  return {
    create: (input, ctx) => adapterFor(input.origin).create(input, ctx),
    update: (ref, modifications, versionAttendue, ctx) =>
      adapterFor(ref.origin).update(ref, modifications, versionAttendue, ctx),
    cancel: (ref, motif, traitementFinancier, cleOperation, ctx) =>
      adapterFor(ref.origin).cancel(ref, motif, traitementFinancier, cleOperation, ctx),
    delete: (ref, motif, mode, ctx) => adapterFor(ref.origin).delete(ref, motif, mode, ctx),
    getView: (ref, ctx) => adapterFor(ref.origin).getView(ref, ctx),
    listView: (filtres, pagination, ctx) => adapterFor(filtres.origin).listView(filtres, pagination, ctx),
  };
}

const venteRead = createVenteReadProjection();
const baseService = createTransactionService({
  vente: {
    create: (...args) => venteAdapter.create(...args), update: (...args) => venteAdapter.update(...args),
    cancel: (...args) => venteAdapter.cancel(...args), delete: (...args) => venteAdapter.delete(...args),
    getView: venteRead.getView, listView: venteRead.listView,
  },
  prestation: typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window) ? createPrestationWebAdapter() : prestationAdapter,
});
export const transactionService = {
  ...baseService,
  listAll: (filters: ConsolidatedFilters, ctx: TransactionContext) => readAllTransactions(baseService, filters, ctx),
  ...createTransactionReadQueries(),
};
