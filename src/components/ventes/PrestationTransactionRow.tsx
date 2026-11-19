import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { Pencil, Trash2, XCircle } from 'lucide-react';
import type { TransactionRef, TransactionView } from '../../services/transactionContracts';
import { OriginBadge } from './TransactionsSummary';
export default function PrestationTransactionRow({ row, index, onAction }: { row: Extract<TransactionView, { origin: 'prestation' }>;
  index: number; onAction: (mode: 'update' | 'cancel' | 'delete', ref: TransactionRef) => void }) {
  return <Table.Tr className={row.etatCommercial === 'ANNULEE' ? 'tk-row-muted' : undefined}>
    <Table.Td>{index}</Table.Td><Table.Td><Text size="sm" fw={600}>{row.code}</Text><Badge size="xs" variant="light">{row.etatPaiement}</Badge></Table.Td>
    <Table.Td>{row.client.nom || 'Client comptoir'}</Table.Td><Table.Td><OriginBadge origin="prestation" /></Table.Td>
    <Table.Td>Service</Table.Td><Table.Td>{new Date(row.dates.creation).toLocaleDateString('fr-FR')}</Table.Td><Table.Td ta="right">{row.montantFacture.toLocaleString('fr-FR')} FCFA</Table.Td>
    <Table.Td><Group gap="xs" justify="center">{([
      ['modifier', 'update', 'Modifier', Pencil], ['annuler', 'cancel', 'Annuler', XCircle], ['supprimer', 'delete', 'Supprimer', Trash2],
    ] as const).map(([key, mode, label, Icon]) => {
      const action = row.actionsAutorisees[key]; const enabled = action.autorisee && action.disponible;
      return <Tooltip key={mode} label={enabled ? label : action.raisonBlocage || 'Action indisponible.'}><span>
        <ActionIcon variant="subtle" disabled={!enabled} aria-label={`${label} ${row.code}`} onClick={() => onAction(mode, row.ref)}><Icon size={16} /></ActionIcon>
      </span></Tooltip>;
    })}</Group></Table.Td>
  </Table.Tr>;
}
