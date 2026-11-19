import type { TransactionAction, TransactionContext, TransactionFilters, TransactionPage,
  TransactionPagination, TransactionPaymentState, TransactionServiceContract, TransactionView } from '../../services/transactionContracts.ts';
import { PrestationAdapterError } from '../../services/adapters/prestationPersistence.ts';

export interface PrestationListFilters {
  recherche: string;
  statuts: TransactionPaymentState[];
  dateDebut: string;
  dateFin: string;
  afficherSupprimees: boolean;
}
export const initialPrestationFilters: PrestationListFilters = {
  recherche: '', statuts: [], dateDebut: '', dateFin: '', afficherSupprimees: false,
};
export const prestationStatuses = {
  PAYEE: { label: 'Payée', color: 'green' },
  PARTIELLE: { label: 'Partielle', color: 'orange' },
  IMPAYEE: { label: 'Impayée', color: 'gray' },
  ANNULEE: { label: 'Annulée', color: 'orange' },
} as const;
export type PrestationListReader = Pick<TransactionServiceContract, 'listView'>;

/** Chaque statut est filtré en base. Seules la fusion triée et la pagination sont locales. */
export async function loadPrestationPage(service: PrestationListReader, filters: PrestationListFilters,
  pagination: TransactionPagination, ctx: TransactionContext): Promise<TransactionPage> {
  if (filters.dateDebut && filters.dateFin && filters.dateDebut > filters.dateFin) {
    throw new PrestationAdapterError('INVALID_INPUT', 'La date de début doit précéder la date de fin.');
  }
  const base: TransactionFilters = { origin: 'prestation', recherche: filters.recherche,
    dateDebut: filters.dateDebut || undefined, dateFin: filters.dateFin || undefined,
    afficherSupprimees: filters.afficherSupprimees };
  const statuses = [...new Set(filters.statuts)];
  const queryForStatus = (status?: TransactionPaymentState): TransactionFilters => ({ ...base,
    ...(status === 'ANNULEE' ? { etatCommercial: 'ANNULEE' }
      : status ? { etatCommercial: 'ACTIVE', etatPaiement: status } : {}),
  });
  if (statuses.length <= 1) return service.listView(queryForStatus(statuses[0]), pagination, ctx);
  const needed = pagination.page * pagination.pageSize;
  const groups: { total: number; items: TransactionView[] }[] = [];
  for (const etatPaiement of statuses) {
    const query = queryForStatus(etatPaiement);
    const first = await service.listView(query, { page: 1, pageSize: Math.min(100, needed) }, ctx);
    const items = [...first.items];
    for (let page = 2; items.length < Math.min(first.total, needed); page++) {
      const next = await service.listView(query, { page, pageSize: first.pageSize }, ctx);
      if (!next.items.length) break; // La base a pu évoluer entre deux lectures.
      items.push(...next.items);
    }
    groups.push({ total: first.total, items });
  }
  const items = groups.flatMap(group => group.items).sort((a, b) =>
    b.dates.creation.localeCompare(a.dates.creation) || b.ref.id - a.ref.id);
  return { ...pagination, total: groups.reduce((total, group) => total + group.total, 0),
    items: items.slice((pagination.page - 1) * pagination.pageSize, needed) };
}

export function prestationActionHint(action: TransactionAction, stage: '3.5' | '3.6'): string {
  return !action.autorisee || !action.disponible
    ? action.raisonBlocage || 'Action indisponible.' : `À venir (${stage})`;
}
export function prestationListError(error: unknown): string {
  if (error instanceof PrestationAdapterError) {
    if (error.code === 'MIGRATION_REQUIRED') return 'La migration des prestations doit être appliquée manuellement avant de consulter cette liste.';
    if (error.code === 'TRANSACTION_UNAVAILABLE') return error.message;
    if (error.code === 'FORBIDDEN') return 'Votre session ne permet pas de consulter ces prestations. Vérifiez les droits et la correspondance du compte local.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Impossible de charger les prestations. Réessayez.';
}
export function prestationState(row: TransactionView): TransactionPaymentState {
  return row.etatCommercial === 'ANNULEE' ? 'ANNULEE' : row.etatPaiement;
}
