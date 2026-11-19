import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Group, Modal, Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBriefcase, IconCalendar, IconCash, IconDownload, IconShoppingCart } from '@tabler/icons-react';
import FormulairePrestation from './FormulairePrestation';
import { ModaleAnnulationPrestation, ModaleSuppressionPrestation } from './ModalesPrestation';
import { prestationService } from '../../services/prestationService';
import { PageHeader } from '../common/PageHeader';
import ListePrestations from './ListePrestations';
import RecuPrestation from './RecuPrestation';
import { initialPrestationFilters, loadPrestationPage, type PrestationListFilters } from './prestationListModel';
import { transactionService } from '../../services/transactionFacade';
import { transactionCsv } from '../../services/transactionConsolidation';
import { saveText } from '../../utils/fileExport';
import { useAuth } from '../../contexts/AuthContext';
import type { TransactionContext, TransactionRef } from '../../services/transactionContracts';

const fmt = (montant: number) => Number(montant || 0).toLocaleString('fr-FR');

export default function GestionPrestations() {
  const [ventes, setVentes] = useState<any[]>([]);
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'update'; transactionRef: TransactionRef } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [operation, setOperation] = useState<{ mode: 'cancel' | 'delete'; transactionRef: TransactionRef } | null>(null);
  const { user } = useAuth();
  const ctx = useMemo<TransactionContext | null>(() => user
    ? { utilisateurId: user.id, role: user.role, espaceId: null } : null, [user?.id, user?.role]);
  const [filtres, setFiltres] = useState<PrestationListFilters>(initialPrestationFilters);
  const [revision, setRevision] = useState(0);
  useEffect(() => { setFiltres(initialPrestationFilters); }, [user?.id, user?.role]);
  const [recuRef, setRecuRef] = useState<TransactionRef | null>(null);

  const charger = async () => {
    try {
      setVentes(await prestationService.listSales());
    } catch (error: any) {
      console.error(error);
      notifications.show({ title: 'Erreur', message: error?.message || 'Impossible de charger les prestations.', color: 'red' });
    }
  };

  useEffect(() => { charger(); }, []);

  const prestationsFiltrees = ventes.filter((vente) => {
    const rechercheNormalisee = filtres.recherche.trim().toLocaleLowerCase();
    const texte = [vente.code_facture, vente.NomComplet, vente.client_nom, vente.client_contact, ...(vente.details || []).map((ligne: any) => ligne.designation)].join(' ').toLocaleLowerCase();
    // Ce périmètre local conserve les KPI et l'export existants ; la liste est filtrée en base.
    const date = String(vente.date_vente).slice(0, 10);
    return (!rechercheNormalisee || texte.includes(rechercheNormalisee))
      && (!filtres.statuts.length || filtres.statuts.includes(vente.statut_paiement))
      && (!filtres.dateDebut || date >= filtres.dateDebut) && (!filtres.dateFin || date <= filtres.dateFin)
      && (filtres.afficherSupprimees || !vente.deleted_at);
  });

  const exporter = async () => {
    if (!ctx) return;
    try {
      const rows = [];
      for (let page=1;;page++) {
        const result = await loadPrestationPage(transactionService, filtres, {page,pageSize:100}, ctx);
        rows.push(...result.items);
        if (!result.items.length || page*result.pageSize>=result.total) break;
      }
      await saveText('\ufeff'+transactionCsv(rows), 'prestations-'+new Date().toISOString().slice(0,10)+'.csv');
    } catch (reason: unknown) {
      notifications.show({title:'Export impossible',message:reason instanceof Error?reason.message:'Impossible de lire les prestations.',color:'red'});
    }
  };

  const totalEncaisse = prestationsFiltrees.reduce((total, vente) => total + Number(vente.montant_paye || 0), 0);
  const aujourdHui = new Date().toDateString();
  const prestationsAujourdhui = ventes.filter((vente) => new Date(vente.date_vente).toDateString() === aujourdHui).length;

  return (
    <Box p="md">
      <Stack gap="lg">
        <PageHeader
          title="Prestations de services"
          subtitle="Historique et suivi des lavages, réparations et interventions"
          icon={<IconBriefcase size={20} />}
          color="teal"
          action={{ label: 'Nouvelle prestation', onClick: () => setForm({ mode: 'create' }), color: 'teal' }}
          stats={[
            { label: 'Total prestations', value: ventes.length, icon: <IconBriefcase size={13} /> },
            { label: 'Montant encaissé', value: `${fmt(totalEncaisse)} FCFA`, icon: <IconCash size={13} />, color: '#40c057' },
            { label: 'Prestations payées', value: ventes.filter((vente) => vente.statut_paiement === 'PAYEE').length, icon: <IconShoppingCart size={13} /> },
            { label: "Aujourd'hui", value: prestationsAujourdhui, icon: <IconCalendar size={13} />, color: '#f59f00' },
          ]}
        />

        <Group className="tk-page-tools" justify="flex-end">
          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exporter}>Exporter</Button>
        </Group>
        <ListePrestations ctx={ctx} filtres={filtres} onFiltresChange={setFiltres}
          revision={revision} onActualiser={charger}
          onModifier={transactionRef => setForm({ mode: 'update', transactionRef })}
          onAnnuler={transactionRef => setOperation({ mode: 'cancel', transactionRef })}
          onSupprimer={transactionRef => setOperation({ mode: 'delete', transactionRef })}
          onVoir={setRecuRef}
          onImprimer={setRecuRef} />

      <Modal opened={form !== null} onClose={() => { if (!formBusy) setForm(null); }}
        title={form?.mode === 'update' ? 'Modifier la prestation' : 'Nouvelle prestation'} centered size="xl"
        closeOnClickOutside={!formBusy} closeOnEscape={!formBusy} withCloseButton={!formBusy}>
        {form && <FormulairePrestation key={form.mode === 'update' ? form.transactionRef.id : 'create'}
          {...form} ctx={ctx} onBusyChange={setFormBusy} onCancel={() => setForm(null)}
          onSuccess={() => { setForm(null); setRevision(value => value + 1); void charger(); }} />}
      </Modal>

      {operation?.mode === 'cancel' && <ModaleAnnulationPrestation transactionRef={operation.transactionRef} ctx={ctx}
        onClose={() => setOperation(null)} onSuccess={() => { setOperation(null); setRevision(value => value + 1); void charger(); }} />}
      {operation?.mode === 'delete' && <ModaleSuppressionPrestation transactionRef={operation.transactionRef} ctx={ctx}
        onClose={() => setOperation(null)} onSuccess={() => { setOperation(null); setRevision(value => value + 1); void charger(); }} />}

      {recuRef && <RecuPrestation transactionRef={recuRef} ctx={ctx} onClose={() => setRecuRef(null)} />}
      </Stack>
    </Box>
  );
}
