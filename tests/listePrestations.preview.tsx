/** Banc visuel isolé : aucune session, aucune base, aucune écriture métier. */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Group, MantineProvider, Stack, Text } from '@mantine/core';
import '@mantine/core/styles.css';
import '../src/styles/theme-kit.css';
import '../src/styles/theme-gestion-commerciale.css';
import { theme } from '../src/theme';
import ListePrestations from '../src/components/ventes/ListePrestations';
import { initialPrestationFilters, type PrestationListReader } from '../src/components/ventes/prestationListModel';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence';
import type { TransactionAction, TransactionContext, TransactionView } from '../src/services/transactionContracts';

function Preview() {
  const [dark, setDark] = useState(false);
  const [scenario, setScenario] = useState('mixte');
  const [admin, setAdmin] = useState(true);
  const [filters, setFilters] = useState(initialPrestationFilters);
  const ctx: TransactionContext = { utilisateurId: admin ? 1 : 2, role: admin ? 'admin' : 'gestionnaire', espaceId: null };
  const service = useMemo<PrestationListReader>(() => ({ async listView(query, pagination) {
    if (scenario === 'erreur') throw new PrestationAdapterError('MIGRATION_REQUIRED', 'Migration absente');
    if (scenario === 'chargement') await new Promise(resolve => setTimeout(resolve, 2500));
    const rows: TransactionView[] = Array.from({ length: scenario === 'vide' ? 0 : 15 }, (_, index): TransactionView => {
      const cancelled = index % 5 === 3; const deleted = index % 5 === 4;
      const paid = index % 5 === 0 ? 100 : index % 5 === 1 ? 40 : 0;
      const action = (kind: string): TransactionAction => {
        const autorisee = admin || kind === 'modifier';
        const reason = !autorisee ? 'Droits insuffisants.' : deleted ? 'Prestation masquée.'
          : cancelled ? 'Prestation déjà annulée.' : kind === 'supprimer' && paid ? 'Un règlement existe.' : null;
        return { autorisee, disponible: reason === null, raisonBlocage: reason };
      };
      return { origin: 'prestation', ref: { origin: 'prestation', id: index + 1 }, code: `PRE-TEST-${index + 1}`, version: 1,
        client: { idClient: null, nom: `Client ${index + 1}`, contact: null },
        dates: { creation: `2026-11-${String(17 - index).padStart(2, '0')} 10:00:00`, modification: null, annulation: cancelled ? '2026-11-17' : null, suppression: deleted ? '2026-11-17' : null },
        lines: [{ origin: 'prestation', designation: 'Réparation et entretien', quantite: 1, prixUnitaire: 100, unite: 'intervention' }],
        montantFacture: 100, montantEncaisse: paid, montantRembourse: 0, restantDu: cancelled ? 0 : 100 - paid,
        etatCommercial: cancelled ? 'ANNULEE' : 'ACTIVE', etatPaiement: cancelled ? 'ANNULEE' : paid === 100 ? 'PAYEE' : paid ? 'PARTIELLE' : 'IMPAYEE',
        observations: null, documents: {}, actionsAutorisees: { modifier: action('modifier'), annuler: action('annuler'), supprimer: action('supprimer') } };
    }).filter(row => (query.afficherSupprimees || !row.dates.suppression)
      && (!query.etatCommercial || row.etatCommercial === query.etatCommercial)
      && (!query.etatPaiement || row.etatPaiement === query.etatPaiement)
      && (!query.recherche || `${row.code} ${row.client.nom} ${row.lines[0].designation}`.toLowerCase().includes(query.recherche.toLowerCase()))
      && (!query.dateDebut || row.dates.creation.slice(0, 10) >= query.dateDebut)
      && (!query.dateFin || row.dates.creation.slice(0, 10) <= query.dateFin));
    return { ...pagination, total: rows.length, items: rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize) };
  } }), [scenario, admin]);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  return <MantineProvider theme={theme} forceColorScheme={dark ? 'dark' : 'light'}>
    <Stack p="md" gap="sm">
      <Text fw={700}>Banc de test isolé — aucune base connectée</Text>
      <Group><Button onClick={() => setDark(value => !value)}>Mode {dark ? 'clair' : 'sombre'}</Button>
        {['mixte', 'vide', 'erreur', 'chargement'].map(value => <Button key={value} variant="default" onClick={() => { setFilters(initialPrestationFilters); setScenario(value); }}>{value}</Button>)}
        <Button variant="default" onClick={() => { setFilters(initialPrestationFilters); setAdmin(value => !value); }}>{admin ? 'Passer gestionnaire' : 'Passer admin'}</Button>
      </Group>
      <ListePrestations ctx={ctx} filtres={filters} onFiltresChange={setFilters} service={service} />
    </Stack>
  </MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
