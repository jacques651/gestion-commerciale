// src/components/pages/revendeurs/AlertesRevendeurs.tsx
// Tableau de bord revendeurs ACTIONNABLE : des cartes d'alerte cliquables
// (décomptes en attente, factures non réglées, commissions à payer, stock
// faible, revendeurs inactifs). Cliquer une carte affiche la liste concernée,
// chaque ligne mène à la fiche du revendeur.
import React, { useEffect, useState } from 'react';
import {
  Stack, Card, Text, Group, SimpleGrid, ThemeIcon, Loader, Center, Table,
  Badge, ScrollArea, Button, Paper,
} from '@mantine/core';
import {
  IconReceipt, IconFileInvoice, IconCash, IconPackage, IconUserOff,
  IconChevronRight, IconAlertTriangle, IconDashboard,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../../database/db';
import { PageHeader } from '../../common/PageHeader';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('fr-FR');
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const sel = async <T = any>(q: string, p: any[] = []): Promise<T[]> => {
  try { const db = await getDb(); return await db.select<T[]>(q, p); }
  catch (e) { console.error('Alertes query:', e); return []; }
};

const SEUIL_STOCK_FAIBLE = 5;
const JOURS_INACTIVITE = 30;

type Cat = 'decomptes' | 'factures' | 'stock' | 'inactifs';

export const AlertesRevendeurs: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [decomptes, setDecomptes] = useState<any[]>([]);
  const [factures, setFactures] = useState<any[]>([]);
  const [stockFaible, setStockFaible] = useState<any[]>([]);
  const [inactifs, setInactifs] = useState<any[]>([]);
  const [cat, setCat] = useState<Cat>('decomptes');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [dec, fac, stk, revs] = await Promise.all([
        sel(`SELECT d.idDecompte, d.code_decompte, d.date_decompte, d.montant_net, d.idClient, c.NomComplet
             FROM decomptes d JOIN clients c ON c.idClient = d.idClient
             WHERE lower(COALESCE(d.statut,'brouillon')) NOT IN ('paye','annule')
             ORDER BY d.date_decompte`),
        sel(`SELECT f.idFactureRevendeur, f.code_facture, f.date_facture, f.montant_ttc, f.commission, f.idRevendeur, c.NomComplet
             FROM factures_revendeur f JOIN clients c ON c.idClient = f.idRevendeur
             WHERE lower(COALESCE(f.statut,'')) NOT LIKE '%regl%' AND lower(COALESCE(f.statut,'')) NOT LIKE '%annul%'
             ORDER BY f.date_facture`),
        sel(`SELECT s.idProduit, p.designation, s.qte_stock, s.idRevendeur, c.NomComplet
             FROM stock_revendeur s
             JOIN products p ON p.idProduit = s.idProduit
             JOIN clients c ON c.idClient = s.idRevendeur
             WHERE s.qte_stock > 0 AND s.qte_stock <= ${SEUIL_STOCK_FAIBLE}
             ORDER BY s.qte_stock`),
        sel(`SELECT c.idClient, c.NomComplet,
                    (SELECT MAX(m.date_mouvement) FROM mouvements_revendeur m WHERE m.idRevendeur = c.idClient) AS derniere
             FROM clients c WHERE c.TypeClient = 'revendeur' ORDER BY c.NomComplet`),
      ]);
      const limite = Date.now() - JOURS_INACTIVITE * 86400000;
      const inact = revs.filter((r: any) => !r.derniere || new Date(r.derniere).getTime() < limite);
      setDecomptes(dec); setFactures(fac); setStockFaible(stk); setInactifs(inact);
      setLoading(false);
    })();
  }, []);

  const totalDu = factures.reduce((s, f) => s + (Number(f.montant_ttc) || 0), 0);
  const totalCommission = factures.reduce((s, f) => s + (Number(f.commission) || 0), 0);
  const ouvrirFiche = (idClient: number) => navigate(`/revendeurs/fiche?rev=${idClient}`);

  if (loading) return <Center py={80}><Loader size="lg" /></Center>;

  return (
    <Stack gap="md" p="md">
      <PageHeader title="Tableau de bord revendeurs" subtitle="Alertes et actions à mener" icon={<IconDashboard size={22} />} />

      <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }}>
        <AlertCard active={cat === 'decomptes'} onClick={() => setCat('decomptes')} color="orange"
          icon={<IconReceipt size={20} />} label="Décomptes en attente" value={String(decomptes.length)} />
        <AlertCard active={cat === 'factures'} onClick={() => setCat('factures')} color="red"
          icon={<IconFileInvoice size={20} />} label="Factures non réglées" value={String(factures.length)} sub={`${fmt(totalDu)} F dus`} />
        <AlertCard active={false} onClick={() => setCat('factures')} color="grape"
          icon={<IconCash size={20} />} label="Commissions à payer" value={`${fmt(totalCommission)} F`} />
        <AlertCard active={cat === 'stock'} onClick={() => setCat('stock')} color="yellow"
          icon={<IconPackage size={20} />} label="Stock faible" value={String(stockFaible.length)} sub={`≤ ${SEUIL_STOCK_FAIBLE}`} />
        <AlertCard active={cat === 'inactifs'} onClick={() => setCat('inactifs')} color="gray"
          icon={<IconUserOff size={20} />} label="Revendeurs inactifs" value={String(inactifs.length)} sub={`> ${JOURS_INACTIVITE} j`} />
      </SimpleGrid>

      {/* Liste de la catégorie sélectionnée */}
      {cat === 'decomptes' && (
        <Liste headers={['Date', 'Code', 'Revendeur', 'Net', '']} empty={decomptes.length === 0} emptyMsg="Aucun décompte en attente.">
          {decomptes.map((d, i) => (
            <Table.Tr key={i} style={{ cursor: 'pointer' }} onClick={() => ouvrirFiche(d.idClient)}>
              <Table.Td>{fmtDate(d.date_decompte)}</Table.Td>
              <Table.Td>{d.code_decompte}</Table.Td>
              <Table.Td>{d.NomComplet}</Table.Td>
              <Table.Td ta="right"><b>{fmt(d.montant_net)} F</b></Table.Td>
              <Table.Td ta="right"><IconChevronRight size={14} color="#adb5bd" /></Table.Td>
            </Table.Tr>
          ))}
        </Liste>
      )}

      {cat === 'factures' && (
        <Liste headers={['Date', 'Code', 'Revendeur', 'Montant', 'Commission', '']} empty={factures.length === 0} emptyMsg="Aucune facture non réglée.">
          {factures.map((f, i) => (
            <Table.Tr key={i} style={{ cursor: 'pointer' }} onClick={() => ouvrirFiche(f.idRevendeur)}>
              <Table.Td>{fmtDate(f.date_facture)}</Table.Td>
              <Table.Td>{f.code_facture}</Table.Td>
              <Table.Td>{f.NomComplet}</Table.Td>
              <Table.Td ta="right"><b>{fmt(f.montant_ttc)} F</b></Table.Td>
              <Table.Td ta="right">{fmt(f.commission)} F</Table.Td>
              <Table.Td ta="right"><IconChevronRight size={14} color="#adb5bd" /></Table.Td>
            </Table.Tr>
          ))}
        </Liste>
      )}

      {cat === 'stock' && (
        <Liste headers={['Produit', 'Revendeur', 'Qté restante', '']} empty={stockFaible.length === 0} emptyMsg="Aucun stock faible.">
          {stockFaible.map((s, i) => (
            <Table.Tr key={i} style={{ cursor: 'pointer' }} onClick={() => ouvrirFiche(s.idRevendeur)}>
              <Table.Td>{s.designation}</Table.Td>
              <Table.Td>{s.NomComplet}</Table.Td>
              <Table.Td ta="right"><Badge color="red" variant="light">{fmt(s.qte_stock)}</Badge></Table.Td>
              <Table.Td ta="right"><IconChevronRight size={14} color="#adb5bd" /></Table.Td>
            </Table.Tr>
          ))}
        </Liste>
      )}

      {cat === 'inactifs' && (
        <Liste headers={['Revendeur', 'Dernière activité', '']} empty={inactifs.length === 0} emptyMsg="Aucun revendeur inactif.">
          {inactifs.map((r, i) => (
            <Table.Tr key={i} style={{ cursor: 'pointer' }} onClick={() => ouvrirFiche(r.idClient)}>
              <Table.Td>{r.NomComplet}</Table.Td>
              <Table.Td>{r.derniere ? fmtDate(r.derniere) : <Badge color="gray" variant="light">Jamais</Badge>}</Table.Td>
              <Table.Td ta="right"><IconChevronRight size={14} color="#adb5bd" /></Table.Td>
            </Table.Tr>
          ))}
        </Liste>
      )}
    </Stack>
  );
};

const AlertCard: React.FC<{ active: boolean; onClick: () => void; color: string; icon: React.ReactNode; label: string; value: string; sub?: string }> =
  ({ active, onClick, color, icon, label, value, sub }) => (
    <Card withBorder radius="md" p="md" onClick={onClick}
      style={{ cursor: 'pointer', borderColor: active ? `var(--mantine-color-${color}-5)` : undefined, borderWidth: active ? 2 : 1 }}>
      <Group gap="sm">
        <ThemeIcon color={color} variant="light" size="lg" radius="md">{icon}</ThemeIcon>
        <div>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text fw={700} size="lg">{value}</Text>
          {sub && <Text size="xs" c="dimmed">{sub}</Text>}
        </div>
      </Group>
    </Card>
  );

const Liste: React.FC<{ headers: string[]; empty: boolean; emptyMsg: string; children: React.ReactNode }> = ({ headers, empty, emptyMsg, children }) => (
  <Card withBorder radius="lg" p={0}>
    <ScrollArea.Autosize mah={520}>
      <Table striped highlightOnHover stickyHeader fz="sm">
        <Table.Thead><Table.Tr>{headers.map((h, i) => <Table.Th key={i} ta={i >= headers.length - 2 ? 'right' : undefined}>{h}</Table.Th>)}</Table.Tr></Table.Thead>
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

export default AlertesRevendeurs;
