import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Box, Button, Card, Checkbox, Group, MultiSelect,
  Pagination, ScrollArea, SimpleGrid, Skeleton, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { Eye, Pencil, Printer, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { transactionService, type TransactionContext, type TransactionPage, type TransactionPaymentState,
  type TransactionRef } from '../../services/transactionFacade.ts';
import TkFilters from '../TkFilters';
import { loadPrestationPage, prestationActionHint, prestationListError, prestationState,
  prestationStatuses, type PrestationListFilters, type PrestationListReader } from './prestationListModel.ts';

interface ListePrestationsProps {
  ctx: TransactionContext | null;
  filtres: PrestationListFilters;
  onFiltresChange: (filters: PrestationListFilters) => void;
  revision?: number;
  onActualiser?: () => void;
  onVoir?: (ref: TransactionRef) => void;
  onModifier?: (ref: TransactionRef) => void;
  onAnnuler?: (ref: TransactionRef) => void;
  onSupprimer?: (ref: TransactionRef) => void;
  onImprimer?: (ref: TransactionRef) => void;
  /** Injection réservée aux tests : le composant n'accède jamais directement à SQLite. */
  service?: PrestationListReader;
}
const formatAmount = (amount: number) => `${amount.toLocaleString('fr-FR')} FCFA`;

export default function ListePrestations({ ctx, filtres, onFiltresChange, revision = 0,
  onActualiser, onVoir, onModifier, onAnnuler, onSupprimer, onImprimer, service = transactionService }: ListePrestationsProps) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<TransactionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 5;
  const utilisateurId = ctx?.utilisateurId;
  const role = ctx?.role;
  const espaceId = ctx?.espaceId;

  useEffect(() => {
    let current = true;
    setLoading(true); setError(null); setResult(null);
    if (!ctx) { setError('Connectez-vous pour consulter les prestations.'); setLoading(false); return; }
    loadPrestationPage(service, filtres, { page, pageSize }, ctx).then(data => {
      if (!current) return;
      if (page > 1 && page > Math.max(1, Math.ceil(data.total / pageSize))) { setPage(1); return; }
      setResult(data);
    }).catch((reason: unknown) => { if (current) setError(prestationListError(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [service, filtres, page, revision, refresh, utilisateurId, role, espaceId]);

  const change = (patch: Partial<PrestationListFilters>) => {
    setPage(1); onFiltresChange({ ...filtres, ...patch });
  };
  const reload = () => { setRefresh(value => value + 1); onActualiser?.(); };
  const statuses = Object.entries(prestationStatuses).map(([value, status]) => ({ value, label: status.label }));
  return <Stack gap="sm">
    <TkFilters defaultOpen active={[
      { label: 'Recherche', value: filtres.recherche },
      { label: 'Statuts', value: filtres.statuts.map(status => prestationStatuses[status].label).join(', ') },
      { label: 'Du', value: filtres.dateDebut }, { label: 'Au', value: filtres.dateFin },
      { label: 'Supprimées', value: filtres.afficherSupprimees ? 'Incluses' : '' },
    ]}>
      <Card withBorder padding="sm">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
          <TextInput label="Recherche" placeholder="Code, client, téléphone ou service" leftSection={<Search size={16} />}
            value={filtres.recherche} onChange={event => change({ recherche: event.currentTarget.value })} size="sm" />
          <MultiSelect label="Statut" placeholder="Tous les statuts" data={statuses} clearable
            value={filtres.statuts} onChange={values => change({ statuts: values as TransactionPaymentState[] })} size="sm" />
          <TextInput type="date" label="Date de début" value={filtres.dateDebut}
            onInput={event => change({ dateDebut: event.currentTarget.value })} size="sm" />
          <TextInput type="date" label="Date de fin" value={filtres.dateFin}
            onInput={event => change({ dateFin: event.currentTarget.value })} size="sm" />
        </SimpleGrid>
        {ctx?.role === 'admin' && <Checkbox mt="sm" label="Afficher les supprimées" checked={filtres.afficherSupprimees}
          onChange={event => change({ afficherSupprimees: event.currentTarget.checked })} />}
      </Card>
    </TkFilters>

    <Card withBorder padding="sm" aria-label="Liste des prestations" aria-busy={loading}>
      <Group justify="space-between" mb="sm">
        <Group gap="sm"><Text className="tk-card-title" fw={700}>Liste des prestations</Text>
          {!loading && result && <Badge variant="light" color="blue">{result.total} prestation{result.total > 1 ? 's' : ''}</Badge>}
        </Group>
        <Tooltip label="Actualiser"><ActionIcon variant="light" aria-label="Actualiser les prestations" onClick={reload} loading={loading}>
          <RefreshCw size={16} />
        </ActionIcon></Tooltip>
      </Group>
      {error ? <Alert title="Chargement impossible" color="red" role="alert">
        <Text size="sm">{error}</Text><Button variant="subtle" size="sm" onClick={reload}>Réessayer</Button>
      </Alert> : <>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="sm" miw={920}>
            <Table.Thead><Table.Tr>
              <Table.Th>Code / origine</Table.Th><Table.Th>Date ↓</Table.Th><Table.Th>Client</Table.Th>
              <Table.Th>Désignation</Table.Th><Table.Th ta="right">Facturé</Table.Th><Table.Th ta="right">Encaissé</Table.Th>
              <Table.Th ta="right">Restant dû</Table.Th><Table.Th>Statut</Table.Th><Table.Th ta="center">Actions</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {loading ? Array.from({ length: 5 }, (_, index) => <Table.Tr key={index}>
                {Array.from({ length: 9 }, (_, column) => <Table.Td key={column}><Skeleton height="1em" /></Table.Td>)}
              </Table.Tr>) : result?.items.map(row => <Table.Tr key={`${row.ref.origin}:${row.ref.id}`}
                className={row.dates.suppression || row.etatCommercial === 'ANNULEE' ? 'tk-row-muted' : undefined}>
                <Table.Td><Text size="sm" fw={700}>{row.code}</Text><Badge variant="light" color="blue" size="xs">Prestation</Badge>
                  {row.dates.suppression && <Badge variant="light" color="gray" size="xs">Supprimée</Badge>}</Table.Td>
                <Table.Td>{new Date(row.dates.creation).toLocaleDateString('fr-FR')}</Table.Td>
                <Table.Td><Text size="sm">{row.client.nom || 'Client comptoir'}</Text>
                  {row.client.contact && <Text size="xs" c="dimmed">{row.client.contact}</Text>}</Table.Td>
                <Table.Td>{row.lines[0]?.designation || '·'}{row.lines.length > 1 && <Text size="xs" c="dimmed">+ {row.lines.length - 1} service(s)</Text>}</Table.Td>
                <Table.Td ta="right" className="tk-num">{formatAmount(row.montantFacture)}</Table.Td>
                <Table.Td ta="right" className="tk-num">{formatAmount(row.montantEncaisse)}</Table.Td>
                <Table.Td ta="right" className="tk-num">{formatAmount(row.restantDu)}</Table.Td>
                <Table.Td><Badge variant="light" color={prestationStatuses[prestationState(row)].color}>{prestationState(row)}</Badge></Table.Td>
                <Table.Td><Group gap="xs" justify="center" wrap="nowrap">
                  {([
                    ['modifier', 'Modifier', Pencil, '3.5'], ['annuler', 'Annuler', XCircle, '3.6'],
                    ['supprimer', 'Supprimer', Trash2, '3.6'],
                  ] as const).map(([action, label, Icon, stage]) => {
                    const permission = row.actionsAutorisees[action];
                    const callback = action === 'modifier' ? onModifier : action === 'annuler' ? onAnnuler : onSupprimer;
                    const enabled = Boolean(callback) && permission.autorisee && permission.disponible;
                    const hint = permission.autorisee && permission.disponible
                      ? callback ? `${label} la prestation.` : 'Action indisponible.' : prestationActionHint(permission, stage);
                    return <Tooltip key={action} label={hint}><span tabIndex={0} title={hint} aria-label={`${label} : ${hint}`}>
                      <ActionIcon variant="subtle" disabled={!enabled} aria-label={`${label} ${row.code}`}
                        onClick={() => { if (enabled) callback?.(row.ref); }}><Icon size={16} /></ActionIcon>
                    </span></Tooltip>;
                  })}
                  {onVoir && <Tooltip label="Voir le reçu"><ActionIcon variant="subtle" aria-label={`Voir ${row.code}`} onClick={() => onVoir(row.ref)}><Eye size={16} /></ActionIcon></Tooltip>}
                  {onImprimer && <Tooltip label="Imprimer le reçu"><ActionIcon variant="subtle" aria-label={`Imprimer le reçu ${row.code}`} onClick={() => onImprimer(row.ref)}><Printer size={16} /></ActionIcon></Tooltip>}
                </Group></Table.Td>
              </Table.Tr>)}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {!loading && result?.total === 0 && <Box ta="center" py="sm"><Text className="tk-empty" aria-label="Aucune prestation trouvée">·</Text></Box>}
        {!loading && result && result.total > 0 && <Group justify="space-between" mt="sm">
          <Text size="xs" c="dimmed">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, result.total)} sur {result.total}</Text>
          <Pagination size="sm" value={page} onChange={setPage} total={Math.max(1, Math.ceil(result.total / pageSize))} />
        </Group>}
      </>}
    </Card>
  </Stack>;
}
