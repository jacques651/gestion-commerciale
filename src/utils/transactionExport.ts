import type { TransactionView } from '../services/transactionContracts.ts';
import { transactionExportHeaders, transactionExportRows } from '../services/transactionConsolidation.ts';
export function transactionExportHtml(rows: readonly TransactionView[], css = ''): string {
  const escape = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Transactions — Ventes et prestations</title><style>${css}</style></head>
    <body><main class="print-area"><h1>Ventes et prestations</h1><p>Montants en FCFA. Encaissements bruts et remboursements présentés séparément.</p>
    <table><thead><tr>${transactionExportHeaders.map(label => `<th>${escape(label)}</th>`).join('')}</tr></thead>
    <tbody>${transactionExportRows(rows).map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></main></body></html>`;
}
export async function printTransactionExport(rows: readonly TransactionView[]): Promise<void> {
  const [{ printHtml }, { construireCssImpression }] = await Promise.all([import('./fileExport'), import('./printFormats')]);
  const html = transactionExportHtml(rows);
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? '';
  printHtml(body, 'Transactions — Ventes et prestations', construireCssImpression({ format: 'A4', orientation: 'landscape' }));
}
