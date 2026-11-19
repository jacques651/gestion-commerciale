import type { TransactionContext, TransactionFilters, TransactionOrigin, TransactionServiceContract, TransactionView } from './transactionContracts.ts';
export type ConsolidatedFilters = Omit<TransactionFilters, 'origin'> & { origin?: TransactionOrigin };
export async function readAllTransactions(service: Pick<TransactionServiceContract, 'listView'>,
  filters: ConsolidatedFilters, ctx: TransactionContext): Promise<TransactionView[]> {
  const rows: TransactionView[] = [];
  for (const origin of filters.origin ? [filters.origin] : ['vente', 'prestation'] as const) {
    for (let page = 1; ; page++) {
      const result = await service.listView({ ...filters, origin }, { page, pageSize: 100 }, ctx);
      rows.push(...result.items);
      if (!result.items.length || page * result.pageSize >= result.total) break;
    }
  }
  return [...new Map(rows.map(row => [`${row.ref.origin}:${row.ref.id}`, row])).values()]
    .sort((a, b) => b.dates.creation.localeCompare(a.dates.creation) || b.ref.origin.localeCompare(a.ref.origin) || b.ref.id - a.ref.id);
}
export function transactionTotals(rows: readonly TransactionView[]) {
  const unique = [...new Map(rows.map(row => [`${row.ref.origin}:${row.ref.id}`, row])).values()].filter(row => !row.dates.suppression);
  const active = unique.filter(row => row.etatCommercial === 'ACTIVE');
  const facture = active.reduce((sum, row) => sum + row.montantFacture, 0);
  const encaisseBrut = unique.reduce((sum, row) => sum + row.montantEncaisse, 0);
  const rembourse = unique.reduce((sum, row) => sum + row.montantRembourse, 0);
  const restantDu = active.reduce((sum, row) => sum + row.restantDu, 0);
  const recouvreActif = active.reduce((sum, row) => sum + Math.max(0, row.montantEncaisse - row.montantRembourse), 0);
  return { facture, encaisseBrut, rembourse, encaisseNet: encaisseBrut - rembourse, restantDu,
    recouvrement: facture > 0 ? recouvreActif / facture * 100 : 0, nombre: unique.length };
}
export function totalsByOrigin(rows: readonly TransactionView[]) {
  return { vente: transactionTotals(rows.filter(row => row.origin === 'vente')),
    prestation: transactionTotals(rows.filter(row => row.origin === 'prestation')), total: transactionTotals(rows) };
}
export function monthlyTransactionTotals(rows: readonly TransactionView[]) {
  const months = [...new Set(rows.map(row => row.dates.creation.slice(0, 7)))].sort();
  return months.map(mois => ({ mois, ...transactionTotals(rows.filter(row => row.dates.creation.startsWith(mois))) }));
}
export const transactionExportHeaders = ['Origine', 'Code', 'Date', 'Client', 'État commercial', 'État paiement', 'Facturé', 'Encaissé', 'Remboursé', 'Restant dû'];
export function transactionExportRows(rows: readonly TransactionView[]): (string | number)[][] {
  return rows.map(row => [row.origin === 'vente' ? 'Vente' : 'Prestation', row.code, row.dates.creation,
    row.client.nom ?? '·', row.etatCommercial, row.etatPaiement, row.montantFacture, row.montantEncaisse, row.montantRembourse, row.restantDu]);
}
export function transactionCsv(rows: readonly TransactionView[]): string {
  return [transactionExportHeaders, ...transactionExportRows(rows)].map(row => row.map(value =>
    `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
}
