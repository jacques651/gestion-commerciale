import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Badge, Box, Button, Card, Group, NumberInput, Pagination, Select,
  SimpleGrid, Skeleton, Stack, Table, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Save, Trash2 } from 'lucide-react';
import { transactionService, type TransactionContext, type TransactionRef, type TransactionView } from '../../services/transactionFacade.ts';
import type { MoyenPaiement } from '../../services/journalCaisseService.ts';
import { PrestationAdapterError } from '../../services/adapters/prestationPersistence.ts';
import { buildPrestationCreate, buildPrestationUpdate, draftFromPrestation, draftTotal, emptyPrestationDraft,
  emptyPrestationLine, prestationFormError, PrestationSubmission, type DraftLine, type PaymentChoice,
  type PrestationFormService, type PrestationView } from './prestationFormModel.ts';

export interface PrestationClientChoice { idClient: number; NomComplet: string; Tel: string | null; est_annule?: number; }
export interface PrestationFormResources {
  loadClients(): Promise<PrestationClientChoice[]>;
  loadPaymentMethods(): Promise<MoyenPaiement[]>;
}
const defaultResources: PrestationFormResources = {
  loadClients: async () => (await import('../../database/repositories/clientRepository')).clientRepository.getAll(),
  loadPaymentMethods: async () => (await import('../../services/journalCaisseService')).journalCaisseService.getMoyensPaiement(),
};
type FormMode = { mode: 'create'; transactionRef?: never } | { mode: 'update'; transactionRef: TransactionRef };
export type FormulairePrestationProps = FormMode & {
  ctx: TransactionContext | null;
  onSuccess: (view: TransactionView) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  service?: PrestationFormService;
  resources?: PrestationFormResources;
};
const amount = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

export default function FormulairePrestation({ mode, transactionRef, ctx, onSuccess, onCancel,
  onBusyChange, service = transactionService, resources = defaultResources }: FormulairePrestationProps) {
  const [draft, setDraft] = useState(emptyPrestationDraft);
  const [original, setOriginal] = useState<PrestationView | null>(null);
  const [clients, setClients] = useState<PrestationClientChoice[]>([]);
  const [methods, setMethods] = useState<MoyenPaiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);
  const [linePage, setLinePage] = useState(1);
  const submission = useRef(new PrestationSubmission());
  const operationKey = useRef<string | null>(null);
  const utilisateurId = ctx?.utilisateurId; const role = ctx?.role; const espaceId = ctx?.espaceId;

  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError(null); setError(null); setConflict(false); setOriginal(null);
    setDraft(emptyPrestationDraft()); setLinePage(1);
    if (!ctx) { setLoadError('Connectez-vous avant de saisir une prestation.'); setLoading(false); return; }
    (async () => {
      const [availableClients, availableMethods, view] = await Promise.all([
        resources.loadClients(), resources.loadPaymentMethods(),
        mode === 'update' && transactionRef ? service.getView(transactionRef, ctx) : Promise.resolve(null),
      ]);
      if (!current) return;
      setClients(availableClients.filter(client => !client.est_annule)); setMethods(availableMethods);
      if (mode === 'update') {
        if (!view || view.origin !== 'prestation') throw new Error('Cette prestation est introuvable ou inaccessible.');
        setOriginal(view); setDraft(draftFromPrestation(view));
      }
      submission.current = new PrestationSubmission(); operationKey.current = null;
    })().catch((reason: unknown) => { if (current) setLoadError(prestationFormError(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [mode, transactionRef?.id, transactionRef?.origin, utilisateurId, role, espaceId, resources, service, reload]);

  const locked = Boolean(original && original.montantEncaisse > 0);
  const action = original?.actionsAutorisees.modifier;
  const blocked = mode === 'update' && (!action?.autorisee || !action.disponible);
  const total = draftTotal(draft);
  const paid = locked ? original!.montantEncaisse : draft.paiement === 'integral' ? total
    : draft.paiement === 'impaye' ? 0 : Number(draft.montantPartiel) || 0;
  const updateLine = (index: number, patch: Partial<DraftLine>) => setDraft(value => ({ ...value,
    lines: value.lines.map((line, position) => position === index ? { ...line, ...patch } : line) }));
  const selectClient = (id: string | null) => {
    const client = clients.find(item => String(item.idClient) === id);
    setDraft(value => ({ ...value, client: client ? { idClient: client.idClient, nom: client.NomComplet, contact: client.Tel }
      : { idClient: null, nom: '', contact: '' } }));
  };
  const submit = async () => {
    if (!ctx || loading || blocked || conflict || submission.current.busy || submission.current.completed) return;
    setSubmitting(true); onBusyChange?.(true); setError(null);
    let result: TransactionView | undefined;
    try {
      result = await submission.current.run(async () => {
        const key = operationKey.current ??= `prestation:${mode}:${crypto.randomUUID()}`;
        if (mode === 'create') return service.create(buildPrestationCreate(draft, key), ctx);
        if (!original) throw new Error('Rechargez les données de la prestation.');
        return service.update(original.ref, buildPrestationUpdate(draft, original, key), original.version, ctx);
      });
    } catch (reason: unknown) {
      setError(prestationFormError(reason));
      if (reason instanceof PrestationAdapterError && reason.code === 'VERSION_CONFLICT') setConflict(true);
    } finally { setSubmitting(false); onBusyChange?.(false); }
    if (result) {
      notifications.show({ title: mode === 'create' ? 'Prestation enregistrée' : 'Prestation modifiée',
        message: `${result.code} — ${amount(result.montantFacture)} facturés, ${amount(result.restantDu)} restant dû.`, color: 'green' });
      onSuccess(result);
    }
  };

  if (loading) return <Stack gap="sm" aria-label="Chargement du formulaire" aria-busy="true">
    {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height="2em" />)}
  </Stack>;
  if (loadError) return <Stack gap="xs"><Text className="tk-empty" aria-label="Prestation indisponible">·</Text>
    <Alert color="red" title="Formulaire indisponible" role="alert">{loadError}</Alert>
    <Group justify="flex-end"><Button variant="default" onClick={onCancel}>Fermer</Button><Button onClick={() => setReload(value => value + 1)}>Recharger</Button></Group>
  </Stack>;

  const clientOptions = [{ value: '', label: '·' }, ...clients.map(client => ({ value: String(client.idClient), label: client.NomComplet }))];
  if (draft.client.idClient && !clients.some(client => client.idClient === draft.client.idClient)) {
    clientOptions.push({ value: String(draft.client.idClient), label: draft.client.nom || 'Client existant' });
  }
  return <Box component="form" onSubmit={event => { event.preventDefault(); void submit(); }} aria-label={`Formulaire prestation ${mode}`}>
    <Stack gap="xs">
      {error && <Alert color="red" title="Enregistrement impossible" role="alert">{error}
        {conflict && <Button variant="subtle" size="sm" onClick={() => setReload(value => value + 1)}>Recharger les données</Button>}
      </Alert>}
      {blocked && <Alert color="orange" role="alert">{action?.raisonBlocage || 'Modification indisponible.'}</Alert>}
      <fieldset disabled={submitting || blocked} style={{ border: 0, padding: 0, margin: 0 }}>
        <Stack gap="xs">
          <Card className="tk-form-section" withBorder p="xs" radius="md">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              {[
                ['Code', original?.code ?? 'Attribué à l’enregistrement'],
                ['Date', original ? new Date(original.dates.creation).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')],
                ['Version', String(original?.version ?? 1)], ['Statut', original?.etatPaiement ?? 'Nouvelle'],
              ].map(([label, value]) => <Box key={label}><Text size="xs" c="dimmed">{label}</Text><Text size="sm" lineClamp={1}>{value}</Text></Box>)}
            </SimpleGrid>
          </Card>
          <Card className="tk-form-section" withBorder p="xs" radius="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Select label="Client existant" data={clientOptions} searchable clearable value={draft.client.idClient ? String(draft.client.idClient) : ''}
                onChange={selectClient} disabled={locked} size="sm" />
              <TextInput label="Nom du client" placeholder="Facultatif" value={draft.client.nom ?? ''} disabled={locked || draft.client.idClient !== null}
                onChange={event => { const nom = event.currentTarget.value; setDraft(value => ({ ...value, client: { ...value.client, nom } })); }} size="sm" />
              <TextInput label="Téléphone" placeholder="Facultatif" value={draft.client.contact ?? ''} disabled={locked || draft.client.idClient !== null}
                onChange={event => { const contact = event.currentTarget.value; setDraft(value => ({ ...value, client: { ...value.client, contact } })); }} size="sm" />
            </SimpleGrid>
          </Card>
          <Card className="tk-form-section" withBorder p="xs" radius="md">
            <Group justify="space-between" mb="xs"><Text className="tk-card-title" fw={700}>Services réalisés</Text>
              <Button size="xs" variant="light" leftSection={<Plus size={16} />} disabled={locked} onClick={() => {
                setDraft(value => ({ ...value, lines: [...value.lines, emptyPrestationLine()] })); setLinePage(Math.ceil((draft.lines.length + 1) / 2));
              }}>Ajouter une ligne</Button>
            </Group>
            <Table verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead><Table.Tr><Table.Th>Désignation</Table.Th><Table.Th>Quantité</Table.Th><Table.Th>Prix unitaire</Table.Th><Table.Th>Unité</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>{draft.lines.slice((linePage - 1) * 2, linePage * 2).map((line, offset) => {
                const index = (linePage - 1) * 2 + offset;
                return <Table.Tr key={index}>
                  <Table.Td><TextInput aria-label={`Désignation ligne ${index + 1}`} value={line.designation} required size="sm" onChange={event => updateLine(index, { designation: event.currentTarget.value })} /></Table.Td>
                  <Table.Td><NumberInput aria-label={`Quantité ligne ${index + 1}`} value={line.quantite} disabled={locked} min={0} size="sm" onChange={quantite => updateLine(index, { quantite })} /></Table.Td>
                  <Table.Td><NumberInput aria-label={`Prix unitaire ligne ${index + 1}`} value={line.prixUnitaire} disabled={locked} min={0} size="sm" thousandSeparator=" " onChange={prixUnitaire => updateLine(index, { prixUnitaire })} /></Table.Td>
                  <Table.Td><TextInput aria-label={`Unité ligne ${index + 1}`} value={line.unite} disabled={locked} size="sm" onChange={event => updateLine(index, { unite: event.currentTarget.value })} /></Table.Td>
                  <Table.Td><Tooltip label="Retirer cette ligne"><span><ActionIcon aria-label={`Retirer ligne ${index + 1}`} variant="subtle" disabled={locked || draft.lines.length === 1} onClick={() => {
                    setDraft(value => ({ ...value, lines: value.lines.filter((_, position) => position !== index) }));
                    setLinePage(value => Math.min(value, Math.max(1, Math.ceil((draft.lines.length - 1) / 2))));
                  }}><Trash2 size={16} /></ActionIcon></span></Tooltip></Table.Td>
                </Table.Tr>;
              })}</Table.Tbody>
            </Table>
            {draft.lines.length > 2 && <Pagination size="sm" mt="xs" value={linePage} onChange={setLinePage} total={Math.ceil(draft.lines.length / 2)} />}
          </Card>
          <Card className="tk-form-section" withBorder p="xs" radius="md">
            {locked && <Text size="xs" c="dimmed" mb="xs">Déjà encaissée : seules les désignations et les observations restent modifiables.</Text>}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Select label="Paiement" value={draft.paiement} disabled={locked} allowDeselect={false} size="sm"
                data={[{ value: 'integral', label: 'Payé intégral' }, { value: 'partiel', label: 'Partiel' }, { value: 'impaye', label: 'Impayé' }]}
                onChange={value => setDraft(data => ({ ...data, paiement: value as PaymentChoice }))} />
              <NumberInput label="Montant encaissé (FCFA)" className="tk-num" value={locked ? paid : draft.paiement === 'partiel' ? draft.montantPartiel : paid}
                disabled={locked || draft.paiement !== 'partiel'} min={0} max={total} size="sm" thousandSeparator=" "
                onChange={montantPartiel => setDraft(value => ({ ...value, montantPartiel }))} />
              <Select label="Mode de paiement" value={locked ? '__preserved__' : draft.moyenPaiement?.code ?? null}
                data={locked ? [{ value: '__preserved__', label: 'Moyen existant conservé' }] : methods.map(method => ({ value: method.code, label: method.libelle }))}
                disabled={locked || draft.paiement === 'impaye' || total === 0} placeholder="Choisissez un mode" size="sm"
                onChange={code => setDraft(value => ({ ...value, moyenPaiement: methods.find(method => method.code === code) ?? null }))} />
            </SimpleGrid>
            <Textarea label="Observations" value={draft.observations} onChange={event => { const observations = event.currentTarget.value; setDraft(value => ({ ...value, observations })); }} autosize minRows={1} maxRows={1} size="sm" mt="xs" />
          </Card>
        </Stack>
      </fieldset>
      <Group justify="space-between">
        <Group gap="sm"><Badge variant="light" color="blue">Facturé : {amount(total)}</Badge><Text size="sm" className="tk-num">Restant dû : {amount(Math.max(0, total - paid))}</Text></Group>
        <Group gap="sm"><Button type="button" variant="default" disabled={submitting} onClick={onCancel}>Fermer</Button>
          <Button type="submit" leftSection={<Save size={16} />} loading={submitting} disabled={submitting || blocked || conflict || submission.current.completed}>
            {mode === 'create' ? 'Enregistrer' : 'Enregistrer les modifications'}
          </Button>
        </Group>
      </Group>
    </Stack>
  </Box>;
}
