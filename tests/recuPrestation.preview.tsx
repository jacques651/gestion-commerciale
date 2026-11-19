/** Banc visuel sans base connectée, servi avec transactionIntegration.vite.ts. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Button, Group, MantineProvider, Stack, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '../src/styles/theme-kit.css';
import '../src/styles/theme-gestion-commerciale.css';
import { theme } from '../src/theme';
import RecuPrestation from '../src/components/ventes/RecuPrestation';
import GestionPrestations from '../src/components/ventes/GestionPrestations';
import type { PrestationReceiptView } from '../src/components/ventes/prestationReceiptModel';
import type { TransactionServiceContract } from '../src/services/transactionContracts';
import { previewRows } from './transactionIntegration.previewData';
import { useGlobalModalDrag } from '../src/hooks/useDraggable';

for (const row of previewRows) if (row.origin === 'prestation') row.documents.recuPrestation = { idVentePrestation: row.ref.id, code: row.code };
const partial = previewRows.find((row): row is PrestationReceiptView => row.origin === 'prestation' && row.ref.id === 1)!;
const scenarios: Record<string, PrestationReceiptView> = {};
for (const [index, name] of ['Payée', 'Partielle', 'Impayée', 'Annulée', 'Anonyme', 'Plusieurs lignes', 'Incomplète', 'Erreur lecture'].entries()) {
  const view = structuredClone(partial); view.ref.id = index + 10; view.code = `PRE-APERÇU-${index + 10}`;
  view.documents.recuPrestation = { idVentePrestation: view.ref.id, code: view.code };
  if (name === 'Payée') { view.montantEncaisse = 100; view.restantDu = 0; view.etatPaiement = 'PAYEE'; }
  if (name === 'Impayée') { view.montantEncaisse = 0; view.restantDu = 100; view.etatPaiement = 'IMPAYEE'; }
  if (name === 'Annulée') { view.etatCommercial = 'ANNULEE'; view.etatPaiement = 'ANNULEE'; view.montantRembourse = 40; view.restantDu = 0; }
  if (name === 'Anonyme') view.client = { idClient: null, nom: null, contact: null };
  if (name === 'Plusieurs lignes') view.lines = [{ origin: 'prestation', designation: 'Réparation', quantite: 2, prixUnitaire: 30, unite: 'intervention' },
    { origin: 'prestation', designation: 'Entretien', quantite: 4, prixUnitaire: 10, unite: 'heure' }];
  if (name === 'Incomplète') view.lines = [];
  scenarios[name] = view;
}
const ctx = { utilisateurId: 1, role: 'admin' as const, espaceId: null };
function Preview() {
  const [dark, setDark] = useState(false); const [selected, setSelected] = useState<string | null>(null); useGlobalModalDrag();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const service: Pick<TransactionServiceContract, 'getView'> = { async getView() {
    if (selected === 'Erreur lecture') throw new Error('Accès au reçu refusé — erreur simulée');
    return structuredClone(scenarios[selected!]);
  } };
  return <MantineProvider theme={theme} forceColorScheme={dark ? 'dark' : 'light'}><Notifications /><MemoryRouter>
    <Stack gap="sm" p="sm"><Text fw={700}>Reçu 3.8 — banc isolé, aucune base connectée</Text>
      <Group gap="xs"><Button size="xs" onClick={() => setDark(value => !value)}>Mode {dark ? 'clair' : 'sombre'}</Button>
        {Object.keys(scenarios).map(name => <Button size="xs" variant="default" key={name} onClick={() => setSelected(name)}>{name}</Button>)}
      </Group><GestionPrestations /></Stack>
    {selected && <RecuPrestation key={selected} transactionRef={scenarios[selected].ref} ctx={ctx} service={service} onClose={() => setSelected(null)} />}
  </MemoryRouter></MantineProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
