/** Banc isolé : données en mémoire, aucun import de session ni accès SQLite. */
import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Group, MantineProvider, Modal, Stack, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '../src/styles/theme-kit.css';
import '../src/styles/theme-gestion-commerciale.css';
import { theme } from '../src/theme';
import FormulairePrestation, { type PrestationFormResources } from '../src/components/ventes/FormulairePrestation';
import ListePrestations from '../src/components/ventes/ListePrestations';
import { initialPrestationFilters } from '../src/components/ventes/prestationListModel';
import type { PrestationView } from '../src/components/ventes/prestationFormModel';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence';
import type { CreatePrestation, TransactionContext, TransactionRef, TransactionServiceContract, TransactionView } from '../src/services/transactionContracts';

const cash = { code: 'ESPECES', categorie: 'ESPECES' as const, libelle: 'Espèces' };
const ctx: TransactionContext = { utilisateurId: 1, role: 'admin', espaceId: null };
const resources: PrestationFormResources = { async loadClients() { return [{ idClient: 10, NomComplet: 'Client exemple', Tel: '12345678' }]; },
  async loadPaymentMethods() { return [cash]; } };
const permitted = { autorisee: true, disponible: true, raisonBlocage: null };
function fromInput(input: CreatePrestation, id: number): PrestationView {
  const total = input.lines.reduce((sum, line) => sum + line.quantite * line.prixUnitaire, 0);
  return { origin: 'prestation', ref: { origin: 'prestation', id }, code: `PRE-TEST-${id}`, version: 1,
    client: input.client, lines: input.lines, observations: input.observations ?? null,
    dates: { creation: '2026-11-17 10:00:00', modification: null, annulation: null, suppression: null },
    montantFacture: total, montantEncaisse: input.paiement.montantPaye, montantRembourse: 0, restantDu: total - input.paiement.montantPaye,
    etatCommercial: 'ACTIVE', etatPaiement: input.paiement.montantPaye >= total ? 'PAYEE' : input.paiement.montantPaye > 0 ? 'PARTIELLE' : 'IMPAYEE',
    documents: {}, actionsAutorisees: { modifier: permitted, annuler: permitted, supprimer: permitted } };
}
function seed(id: number, paid: number): PrestationView {
  return fromInput({ origin: 'prestation', versionInitiale: 1, cleOperation: 'seed', client: { idClient: null, nom: 'Client comptoir', contact: null },
    lines: [{ origin: 'prestation', designation: 'Réparation', quantite: 1, prixUnitaire: 100, unite: 'prestation' }],
    paiement: { montantPaye: paid, moyenPaiement: paid ? cash : null } }, id);
}
function Preview() {
  const [dark, setDark] = useState(false); const [scenario, setScenario] = useState('normal');
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'update'; transactionRef: TransactionRef } | null>(null);
  const [busy, setBusy] = useState(false); const [filters, setFilters] = useState(initialPrestationFilters);
  const [revision, setRevision] = useState(0); const [calls, setCalls] = useState(0);
  const store = useRef<PrestationView[]>([seed(1, 100), seed(2, 0)]);
  const service = useMemo<TransactionServiceContract>(() => ({
    async getView(ref) { await new Promise(resolve => setTimeout(resolve, 650));
      if (scenario === 'vide') return null as unknown as TransactionView;
      if (scenario === 'erreur') throw new PrestationAdapterError('NOT_FOUND', 'Prestation introuvable.');
      const row = store.current.find(item => item.ref.id === ref.id); if (!row) throw new Error('Introuvable'); return structuredClone(row);
    },
    async create(input) { setCalls(value => value + 1); await new Promise(resolve => setTimeout(resolve, 900));
      if (input.origin !== 'prestation') throw new Error('Origine inattendue');
      const row = fromInput(input, store.current.length + 1); store.current.unshift(row); return row;
    },
    async update(ref, modifications, version) { setCalls(value => value + 1); await new Promise(resolve => setTimeout(resolve, 900));
      const row = store.current.find(item => item.ref.id === ref.id)!;
      if (scenario === 'conflit' || row.version !== version) throw new PrestationAdapterError('VERSION_CONFLICT', 'Conflit de version');
      if (modifications.origin !== 'prestation') throw new Error('Origine inattendue');
      if (modifications.lines) row.lines = modifications.lines;
      if (modifications.client) row.client = modifications.client;
      if (modifications.paiement) row.montantEncaisse = modifications.paiement.montantPaye;
      row.montantFacture = row.lines.reduce((sum, line) => sum + line.quantite * line.prixUnitaire, 0);
      row.restantDu = row.montantFacture - row.montantEncaisse; row.observations = modifications.observations ?? row.observations;
      row.version++; return structuredClone(row);
    },
    async listView(_query, pagination) { return { ...pagination, total: store.current.length,
      items: store.current.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize) }; },
    async cancel() { throw new Error('Hors test'); }, async delete() { throw new Error('Hors test'); },
  }), [scenario]);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  return <MantineProvider theme={theme} forceColorScheme={dark ? 'dark' : 'light'}><Notifications />
    <Stack p="md" gap="sm"><Text fw={700}>Banc isolé — aucune base connectée — appels d’écriture : {calls}</Text>
      <Group><Button onClick={() => setForm({ mode: 'create' })}>Nouvelle prestation</Button>
        <Button variant="default" onClick={() => setDark(value => !value)}>Mode {dark ? 'clair' : 'sombre'}</Button>
        {['normal', 'conflit', 'vide', 'erreur'].map(value => <Button key={value} variant="default" onClick={() => setScenario(value)}>{value}</Button>)}
      </Group>
      <ListePrestations ctx={ctx} filtres={filters} onFiltresChange={setFilters} service={service} revision={revision}
        onModifier={transactionRef => setForm({ mode: 'update', transactionRef })} />
      <Modal opened={form !== null} centered size="xl" title={form?.mode === 'update' ? 'Modifier la prestation' : 'Nouvelle prestation'}
        onClose={() => { if (!busy) setForm(null); }} closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy}>
        {form && <FormulairePrestation {...form} key={form.mode === 'update' ? form.transactionRef.id : 'create'} ctx={ctx}
          service={service} resources={resources} onBusyChange={setBusy} onCancel={() => setForm(null)}
          onSuccess={() => { setForm(null); setRevision(value => value + 1); }} />}
      </Modal>
    </Stack>
  </MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
