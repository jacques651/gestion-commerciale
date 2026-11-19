// src/components/pages/revendeurs/FicheRevendeur.tsx
// Fiche revendeur unique : toutes les informations d'un revendeur regroupées
// dans un seul écran à onglets (Vue d'ensemble, Stock, Décomptes, Factures,
// Règlements, Historique). Évite d'avoir à chercher dans 5 écrans séparés.
import React, { useEffect, useState } from 'react';
import {
  Stack, Card, Title, Text, Group, Select, Tabs, Table, Badge, SimpleGrid,
  ThemeIcon, Loader, Center, Paper, ScrollArea, Avatar,
} from '@mantine/core';
import {
  IconUser, IconPackage, IconReceipt, IconFileInvoice, IconCash,
  IconHistory, IconChartBar, IconPhone, IconBuildingStore, IconAlertTriangle,
} from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { getDb } from '../../../database/db';
import { PageHeader } from '../../common/PageHeader';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('fr-FR');
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const sel = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  try { const db = await getDb(); return await db.select<T[]>(sql, params); }
  catch (e) { console.error('FicheRevendeur query:', e); return []; }
};

const statutColor = (s: string) => {
  const l = String(s || '').toLowerCase();
  if (l.includes('regl') || l === 'paye') return 'green';
  if (l.includes('valid')) return 'blue';
  if (l.includes('annul')) return 'red';
  if (l.includes('attente') || l.includes('brouillon')) return 'orange';
  return 'gray';
};

export const FicheRevendeur: React.FC = () => {
  const [revendeurs, setRevendeurs] = useState<any[]>([]);
  const [idRevendeur, setIdRevendeur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<any[]>([]);
  const [decomptes, setDecomptes] = useState<any[]>([]);
  const [factures, setFactures] = useState<any[]>([]);
  const [reglements, setReglements] = useState<any[]>([]);
  const [historique, setHistorique] = useState<any[]>([]);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    (async () => {
      const list = await sel(`SELECT idClient, NomComplet, Societe, Tel FROM clients WHERE TypeClient='revendeur' ORDER BY NomComplet`);
      setRevendeurs(list);
      // Pré-sélection via ?rev=<idClient> (depuis le tableau de bord/alertes).
      const rev = searchParams.get('rev');
      if (rev && list.some((r: any) => String(r.idClient) === rev)) setIdRevendeur(rev);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!idRevendeur) return;
    const id = Number(idRevendeur);
    let annule = false;
    (async () => {
      setLoading(true);
      const [st, dec, fac, reg, hist] = await Promise.all([
        sel(`SELECT s.idProduit, p.designation, p.code_produit, s.qte_stock, s.prix_achat, s.prix_vente
             FROM stock_revendeur s JOIN products p ON p.idProduit = s.idProduit
             WHERE s.idRevendeur = ? AND s.qte_stock <> 0 ORDER BY p.designation`, [id]),
        sel(`SELECT idDecompte, code_decompte, date_decompte, montant_vente, montant_commission, montant_net,
                    COALESCE(statut,'brouillon') AS statut
             FROM decomptes WHERE idClient = ? ORDER BY date_decompte DESC`, [id]),
        sel(`SELECT idFactureRevendeur, code_facture, date_facture, montant_ttc, commission,
                    COALESCE(statut,'EN_ATTENTE') AS statut
             FROM factures_revendeur WHERE idRevendeur = ? ORDER BY date_facture DESC`, [id]),
        sel(`SELECT idReglement, date_reglement, montant, mode_reglement, reference
             FROM reglements_revendeur WHERE idClient = ? ORDER BY date_reglement DESC`, [id]),
        sel(`SELECT m.date_mouvement, m.type_mouvement, m.qte_mouvement, m.code_facture, p.designation
             FROM mouvements_revendeur m JOIN products p ON p.idProduit = m.idProduit
             WHERE m.idRevendeur = ? ORDER BY m.date_mouvement DESC LIMIT 300`, [id]),
      ]);
      if (annule) return;
      setStock(st); setDecomptes(dec); setFactures(fac); setReglements(reg); setHistorique(hist);
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [idRevendeur]);

  const revendeur = revendeurs.find(r => String(r.idClient) === idRevendeur);

  // --- KPIs de la vue d'ensemble ---
  const valeurStock = stock.reduce((s, x) => s + (Number(x.qte_stock) || 0) * (Number(x.prix_vente) || 0), 0);
  const decomptesNonPayes = decomptes.filter(d => d.statut !== 'paye' && d.statut !== 'annule').length;
  const facturesNonReglees = factures.filter(f => statutColor(f.statut) !== 'green' && !String(f.statut).toLowerCase().includes('annul'));
  const totalDu = facturesNonReglees.reduce((s, f) => s + (Number(f.montant_ttc) || 0), 0);
  const commissionTotale = factures
    .filter(f => !String(f.statut).toLowerCase().includes('annul'))
    .reduce((s, f) => s + (Number(f.commission) || 0), 0);
  const derniereActivite = historique[0]?.date_mouvement;

  return (
    <Stack gap="md" p="md">
      <PageHeader title="Fiche revendeur" subtitle="Toutes les informations d'un revendeur en un seul endroit" icon={<IconUser size={22} />} />

      <Card withBorder radius="lg" p="md">
        <Select
          label="Revendeur"
          placeholder="Choisir un revendeur"
          data={revendeurs.map(r => ({ value: String(r.idClient), label: `${r.NomComplet}${r.Societe ? ' — ' + r.Societe : ''}` }))}
          value={idRevendeur}
          onChange={setIdRevendeur}
          searchable
          size="md"
          leftSection={<IconBuildingStore size={16} />}
        />
        {revendeur && (
          <Group mt="sm" gap="lg">
            <Group gap="xs"><Avatar color="orange" radius="xl">{(revendeur.NomComplet || 'R').charAt(0)}</Avatar>
              <div><Text fw={700}>{revendeur.NomComplet}</Text>
                <Group gap={4}><IconPhone size={12} /><Text size="xs" c="dimmed">{revendeur.Tel || '—'}</Text></Group>
              </div>
            </Group>
          </Group>
        )}
      </Card>

      {!idRevendeur ? (
        <Center py={60}><Text c="dimmed">Sélectionnez un revendeur pour afficher sa fiche.</Text></Center>
      ) : loading ? (
        <Center py={60}><Loader /></Center>
      ) : (
        <Tabs defaultValue="apercu" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="apercu" leftSection={<IconChartBar size={14} />}>Vue d'ensemble</Tabs.Tab>
            <Tabs.Tab value="stock" leftSection={<IconPackage size={14} />}>Stock ({stock.length})</Tabs.Tab>
            <Tabs.Tab value="decomptes" leftSection={<IconReceipt size={14} />}>Décomptes ({decomptes.length})</Tabs.Tab>
            <Tabs.Tab value="factures" leftSection={<IconFileInvoice size={14} />}>Factures ({factures.length})</Tabs.Tab>
            <Tabs.Tab value="reglements" leftSection={<IconCash size={14} />}>Règlements ({reglements.length})</Tabs.Tab>
            <Tabs.Tab value="historique" leftSection={<IconHistory size={14} />}>Historique ({historique.length})</Tabs.Tab>
          </Tabs.List>

          {/* VUE D'ENSEMBLE */}
          <Tabs.Panel value="apercu" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Kpi label="Valeur du stock" value={`${fmt(valeurStock)} F`} color="teal" icon={<IconPackage size={18} />} sub={`${stock.length} produit(s)`} />
              <Kpi label="Montant dû (factures)" value={`${fmt(totalDu)} F`} color="red" icon={<IconFileInvoice size={18} />} sub={`${facturesNonReglees.length} non réglée(s)`} />
              <Kpi label="Commission cumulée" value={`${fmt(commissionTotale)} F`} color="grape" icon={<IconCash size={18} />} sub={`${factures.length} facture(s)`} />
              <Kpi label="Décomptes en attente" value={String(decomptesNonPayes)} color="orange" icon={<IconReceipt size={18} />} sub={`${decomptes.length} au total`} />
            </SimpleGrid>
            <Text size="xs" c="dimmed" mt="sm">Dernière activité : {fmtDate(derniereActivite)}</Text>
          </Tabs.Panel>

          {/* STOCK */}
          <Tabs.Panel value="stock" pt="md">
            <TableWrap headers={['Produit', 'Code', 'Qté', 'Prix vente', 'Valeur']} empty={stock.length === 0} emptyMsg="Aucun stock pour ce revendeur.">
              {stock.map((s, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{s.designation}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{s.code_produit}</Text></Table.Td>
                  <Table.Td ta="right"><Badge color={Number(s.qte_stock) <= 5 ? 'red' : 'gray'} variant="light">{fmt(s.qte_stock)}</Badge></Table.Td>
                  <Table.Td ta="right">{fmt(s.prix_vente)} F</Table.Td>
                  <Table.Td ta="right"><b>{fmt((Number(s.qte_stock) || 0) * (Number(s.prix_vente) || 0))} F</b></Table.Td>
                </Table.Tr>
              ))}
            </TableWrap>
          </Tabs.Panel>

          {/* DÉCOMPTES */}
          <Tabs.Panel value="decomptes" pt="md">
            <TableWrap headers={['Date', 'Code', 'Vente', 'Commission', 'Net', 'Statut']} empty={decomptes.length === 0} emptyMsg="Aucun décompte.">
              {decomptes.map((d, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{fmtDate(d.date_decompte)}</Table.Td>
                  <Table.Td>{d.code_decompte}</Table.Td>
                  <Table.Td ta="right">{fmt(d.montant_vente)} F</Table.Td>
                  <Table.Td ta="right">{fmt(d.montant_commission)} F</Table.Td>
                  <Table.Td ta="right"><b>{fmt(d.montant_net)} F</b></Table.Td>
                  <Table.Td><Badge size="xs" variant="light" color={statutColor(d.statut)}>{d.statut}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </TableWrap>
          </Tabs.Panel>

          {/* FACTURES */}
          <Tabs.Panel value="factures" pt="md">
            <TableWrap headers={['Date', 'Code', 'Montant', 'Commission', 'Statut']} empty={factures.length === 0} emptyMsg="Aucune facture.">
              {factures.map((f, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{fmtDate(f.date_facture)}</Table.Td>
                  <Table.Td>{f.code_facture}</Table.Td>
                  <Table.Td ta="right"><b>{fmt(f.montant_ttc)} F</b></Table.Td>
                  <Table.Td ta="right">{fmt(f.commission)} F</Table.Td>
                  <Table.Td><Badge size="xs" variant="light" color={statutColor(f.statut)}>{f.statut}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </TableWrap>
          </Tabs.Panel>

          {/* RÈGLEMENTS */}
          <Tabs.Panel value="reglements" pt="md">
            <TableWrap headers={['Date', 'Montant', 'Mode', 'Référence']} empty={reglements.length === 0} emptyMsg="Aucun règlement.">
              {reglements.map((r, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{fmtDate(r.date_reglement)}</Table.Td>
                  <Table.Td ta="right"><b>{fmt(r.montant)} F</b></Table.Td>
                  <Table.Td>{r.mode_reglement || '—'}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{r.reference || '—'}</Text></Table.Td>
                </Table.Tr>
              ))}
            </TableWrap>
          </Tabs.Panel>

          {/* HISTORIQUE */}
          <Tabs.Panel value="historique" pt="md">
            <TableWrap headers={['Date', 'Produit', 'Type', 'Qté', 'Réf. facture']} empty={historique.length === 0} emptyMsg="Aucun mouvement.">
              {historique.map((m, i) => {
                const entree = String(m.type_mouvement || '').toLowerCase().startsWith('entr');
                return (
                  <Table.Tr key={i}>
                    <Table.Td>{fmtDate(m.date_mouvement)}</Table.Td>
                    <Table.Td>{m.designation}</Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color={entree ? 'green' : 'red'}>{m.type_mouvement}</Badge></Table.Td>
                    <Table.Td ta="right">{fmt(m.qte_mouvement)}</Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{m.code_facture || '—'}</Text></Table.Td>
                  </Table.Tr>
                );
              })}
            </TableWrap>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
};

const Kpi: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode; sub?: string }> = ({ label, value, color, icon, sub }) => (
  <Paper withBorder p="md" radius="md">
    <Group gap="sm">
      <ThemeIcon color={color} variant="light" size="lg" radius="md">{icon}</ThemeIcon>
      <div>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text fw={700} size="lg">{value}</Text>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
      </div>
    </Group>
  </Paper>
);

const TableWrap: React.FC<{ headers: string[]; empty: boolean; emptyMsg: string; children: React.ReactNode }> = ({ headers, empty, emptyMsg, children }) => (
  <Card withBorder radius="lg" p={0}>
    <ScrollArea.Autosize mah={480}>
      <Table striped highlightOnHover stickyHeader fz="sm">
        <Table.Thead>
          <Table.Tr>{headers.map((h, i) => <Table.Th key={i} ta={i === 0 || i === 1 ? undefined : 'right'}>{h}</Table.Th>)}</Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {empty ? (
            <Table.Tr><Table.Td colSpan={headers.length}>
              <Center py={30}><Group gap="xs" c="dimmed"><IconAlertTriangle size={16} /><Text size="sm">{emptyMsg}</Text></Group></Center>
            </Table.Td></Table.Tr>
          ) : children}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  </Card>
);

export default FicheRevendeur;
