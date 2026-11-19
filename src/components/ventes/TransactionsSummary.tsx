import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Select, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TransactionOrigin, TransactionView } from '../../services/transactionContracts';
import { monthlyTransactionTotals, totalsByOrigin, transactionCsv } from '../../services/transactionConsolidation';
import { printTransactionExport } from '../../utils/transactionExport';
import { saveText } from '../../utils/fileExport';
export const originLabel = (origin?: string | null) => origin === 'vente' ? 'Vente' : origin === 'prestation' ? 'Prestation' : '·';
export function OriginBadge({ origin }: { origin?: string | null }) {
  return origin === 'vente' || origin === 'prestation' ? <Badge variant="light" color={origin === 'vente' ? 'blue' : 'teal'} size="xs">{originLabel(origin)}</Badge>
    : <Text span className="tk-empty">·</Text>;
}
export interface TransactionsSummaryProps { rows: readonly TransactionView[]; loading?: boolean; error?: string | null;
  charts?: boolean; title?: string; filterOrigin?: boolean; metrics?: boolean; }
const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
export default function TransactionsSummary({ rows, loading = false, error, charts = false,
  title = 'Ventes et prestations — consolidation', filterOrigin = true, metrics = true }: TransactionsSummaryProps) {
  const [origin, setOrigin] = useState<TransactionOrigin | null>(null); const [exportError, setExportError] = useState<string | null>(null);
  const selected = rows.filter(row => !origin || row.origin === origin); const totals = totalsByOrigin(selected);
  const exportData = async (pdf: boolean) => {
    setExportError(null);
    try { if (pdf) await printTransactionExport(selected); else await saveText('\ufeff' + transactionCsv(selected), 'transactions-ventes-prestations.csv'); }
    catch (reason: unknown) { setExportError(reason instanceof Error ? reason.message : 'Export impossible.'); }
  };
  return <Card withBorder p="sm" aria-label={title}>
    <Stack gap="sm">
      <Group justify="space-between"><Text fw={700} className="tk-card-title">{title}</Text>
        <Group gap="xs">{filterOrigin && <Select aria-label="Origine des transactions" placeholder="Toutes les origines" clearable size="xs"
          data={[{ value: 'vente', label: 'Vente' }, { value: 'prestation', label: 'Prestation' }]} value={origin} onChange={value => setOrigin(value as TransactionOrigin | null)} />}
          <Button size="xs" variant="default" disabled={loading || Boolean(error) || !selected.length} onClick={() => void exportData(false)}>CSV consolidé</Button>
          <Button size="xs" variant="default" disabled={loading || Boolean(error) || !selected.length} onClick={() => void exportData(true)}>Imprimer / PDF consolidé</Button>
        </Group>
      </Group>
      <Text size="xs" c="dimmed">Période selon la date de transaction ; encaissements et remboursements cumulés. Annulées exclues du facturé et des impayés. Le solde de caisse reste calculé par le journal.</Text>
      {exportError && <Alert color="red" role="alert">{exportError}</Alert>}
      {error ? <Alert color="red" title="Consolidation indisponible" role="alert">{error}</Alert> : loading ? <Skeleton height="2em" /> : <>
        {metrics && <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {[['CA facturé', fmt(totals.total.facture)], ['Encaissements nets', fmt(totals.total.encaisseNet)],
            ['Impayés', fmt(totals.total.restantDu)], ['Recouvrement', `${totals.total.recouvrement.toFixed(1)} %`]].map(([label, value]) =>
            <Card key={label} className="tk-kpi" p="sm"><Text className="tk-kpi-label">{label}</Text><Text className="tk-kpi-value" fw={700}>{value}</Text></Card>)}
        </SimpleGrid>}
        <Table verticalSpacing="xs" horizontalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>Origine</Table.Th><Table.Th>Facturé</Table.Th><Table.Th>Encaissé brut</Table.Th><Table.Th>Remboursé</Table.Th><Table.Th>Restant dû</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{(['vente', 'prestation'] as const).map(key => <Table.Tr key={key}><Table.Td><OriginBadge origin={key} /></Table.Td>
            <Table.Td>{fmt(totals[key].facture)}</Table.Td><Table.Td>{fmt(totals[key].encaisseBrut)}</Table.Td><Table.Td>{fmt(totals[key].rembourse)}</Table.Td><Table.Td>{fmt(totals[key].restantDu)}</Table.Td></Table.Tr>)}
            <Table.Tr><Table.Td>Total</Table.Td><Table.Td>{fmt(totals.total.facture)}</Table.Td><Table.Td>{fmt(totals.total.encaisseBrut)}</Table.Td><Table.Td>{fmt(totals.total.rembourse)}</Table.Td><Table.Td>{fmt(totals.total.restantDu)}</Table.Td></Table.Tr>
          </Table.Tbody>
        </Table>
        {!selected.length && <Text className="tk-empty" ta="center">·</Text>}
        {charts && selected.length > 0 && <>
          <Text size="sm" fw={600}>Évolution par mois de transaction</Text>
          <ResponsiveContainer width="100%" height={200}><BarChart data={monthlyTransactionTotals(selected)}>
            <CartesianGrid vertical={false} stroke="var(--tk-border)" /><XAxis dataKey="mois" stroke="currentColor" /><YAxis stroke="currentColor" />
            <Tooltip contentStyle={{ background: 'var(--mantine-color-body)', color: 'var(--mantine-color-text)' }} /><Legend />
            <Bar dataKey="facture" name="Facturé" fill="var(--mantine-color-blue-6)" />
            <Bar dataKey="encaisseNet" name="Encaissé net" fill="var(--mantine-color-teal-6)" />
            <Bar dataKey="restantDu" name="Impayé" fill="var(--mantine-color-orange-6)" />
          </BarChart></ResponsiveContainer>
        </>}
      </>}
    </Stack>
  </Card>;
}
