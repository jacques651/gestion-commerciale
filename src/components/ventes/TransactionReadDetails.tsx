import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Skeleton, Stack, Table, Text } from '@mantine/core';
import { transactionService, type TransactionContext, type TransactionRef, type TransactionView } from '../../services/transactionFacade';
import type { TransactionJournalView } from '../../services/transactionReadSource';
import { OriginBadge } from './TransactionsSummary';
export function TransactionReadDetails({ transactionRef, ctx, onClose }: { transactionRef: TransactionRef; ctx: TransactionContext; onClose: () => void }) {
  const [row, setRow] = useState<TransactionView | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let current = true; transactionService.getView(transactionRef, ctx).then(row => { if (current) setRow(row); })
    .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Lecture impossible.'); }); return () => { current = false; };
  }, [transactionRef.origin, transactionRef.id, ctx]);
  return <Modal opened centered size="lg" onClose={onClose} title="Opération liée">
    {error ? <Alert color="red">{error}</Alert> : !row ? <Skeleton height="2em" /> : <Stack gap="sm">
      <Group><OriginBadge origin={row.origin} /><Text fw={700}>{row.code}</Text></Group><Text>{row.client.nom || 'Client comptoir'}</Text>
      <Text>{row.etatCommercial} · {row.etatPaiement}</Text>
      <Text>Facturé : {row.montantFacture.toLocaleString('fr-FR')} FCFA · Encaissé : {row.montantEncaisse.toLocaleString('fr-FR')} FCFA · Remboursé : {row.montantRembourse.toLocaleString('fr-FR')} FCFA</Text>
      <Table><Table.Tbody>{row.lines.map((line, index) => <Table.Tr key={index}><Table.Td>{line.designation}</Table.Td><Table.Td>{line.quantite}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
      <Button variant="default" onClick={onClose}>Fermer</Button>
    </Stack>}
  </Modal>;
}
export function JournalOriginCell({ row, ctx }: { row?: TransactionJournalView; ctx: TransactionContext | null }) {
  const [operation, setOperation] = useState<TransactionRef | null>(null);
  const [journal, setJournal] = useState<TransactionJournalView | null>(null); const [error, setError] = useState<string | null>(null);
  const openJournal = async (id: number) => {
    if (!ctx) return;
    try { const [entry] = await transactionService.readJournal([id], ctx); if (!entry) throw new Error('Écriture introuvable.'); setJournal(entry); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Lecture impossible.'); }
  };
  if (!row) return <Text span className="tk-empty">·</Text>;
  return <div onClick={event=>event.stopPropagation()}>
    <Group gap="xs" wrap="wrap"><OriginBadge origin={row.origin} />
      {row.operation && ctx && <Button size="xs" variant="subtle" onClick={event => { event.stopPropagation(); setOperation(row.operation); }}>Opération #{row.operation.id}</Button>}
      {row.idJournalContrepasse && <Button size="xs" variant="subtle" onClick={event => { event.stopPropagation(); void openJournal(row.idJournalContrepasse!); }}>Origine caisse #{row.idJournalContrepasse}</Button>}
      {row.contrepassationId && <Button size="xs" variant="subtle" onClick={event => { event.stopPropagation(); void openJournal(row.contrepassationId!); }}>Contrepassation #{row.contrepassationId}</Button>}
    </Group>
    {operation && ctx && <TransactionReadDetails transactionRef={operation} ctx={ctx} onClose={() => setOperation(null)} />}
    {(journal || error) && <Modal opened centered size="lg" title="Écriture de caisse liée" onClose={() => { setJournal(null); setError(null); }}>
      {error ? <Alert color="red">{error}</Alert> : journal && <Stack gap="sm"><Group><OriginBadge origin={journal.origin} /><Text fw={700}>{journal.code_journal} · #{journal.idJournal}</Text></Group>
        <Text>{journal.date_journal} · {journal.designation}</Text><Text>{journal.type_mouvement} · {journal.montant.toLocaleString('fr-FR')} FCFA</Text>
        <Text>{journal.idJournalContrepasse ? `Contrepasse l’écriture #${journal.idJournalContrepasse}` : 'Écriture d’origine'}</Text>
        <Button variant="default" onClick={() => setJournal(null)}>Fermer</Button></Stack>}
    </Modal>}
  </div>;
}
