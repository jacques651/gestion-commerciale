import {
  TransactionNotImplementedError,
  type CancellationResult, type CreateTransaction, type DeletionResult,
  type TraitementFinancier, type TransactionContext, type TransactionFilters,
  type TransactionModifications, type TransactionPage, type TransactionPagination,
  type TransactionRef, type TransactionServiceContract, type TransactionView,
} from '../transactionContracts.ts';

/** Nom demande par le contrat 3.2. Aucun appel aux hooks ni aux services existants. */
export interface VenteAdapterAdapter extends TransactionServiceContract {}

export class VenteAdapter implements VenteAdapterAdapter {
  async create(_input: CreateTransaction, _ctx: TransactionContext): Promise<TransactionView> {
    throw new TransactionNotImplementedError('vente');
  }

  async update(_ref: TransactionRef, _modifications: TransactionModifications, _versionAttendue: number, _ctx: TransactionContext): Promise<TransactionView> {
    throw new TransactionNotImplementedError('vente');
  }

  async cancel(_ref: TransactionRef, _motif: string, _traitementFinancier: TraitementFinancier, _cleOperation: string, _ctx: TransactionContext): Promise<CancellationResult> {
    throw new TransactionNotImplementedError('vente');
  }

  async delete(_ref: TransactionRef, _motif: string, _mode: 'soft', _ctx: TransactionContext): Promise<DeletionResult> {
    throw new TransactionNotImplementedError('vente');
  }

  async getView(_ref: TransactionRef, _ctx: TransactionContext): Promise<TransactionView> {
    throw new TransactionNotImplementedError('vente');
  }

  async listView(_filtres: TransactionFilters, _pagination: TransactionPagination, _ctx: TransactionContext): Promise<TransactionPage> {
    throw new TransactionNotImplementedError('vente');
  }
}

export const venteAdapter: VenteAdapterAdapter = new VenteAdapter();
