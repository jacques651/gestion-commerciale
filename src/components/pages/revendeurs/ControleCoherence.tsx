// src/components/pages/revendeurs/ControleCoherence.tsx
// Contrôle de cohérence du stock revendeur : compare le stock AFFICHÉ
// (stock_revendeur.qte_stock) au SOLDE DES MOUVEMENTS (mouvements_revendeur),
// et signale les stocks négatifs. Un bouton aligne le stock sur les mouvements
// (source de vérité), avec trace d'audit — jamais de suppression.
import React, { useEffect, useState } from 'react';
import {
  Stack, Card, Text, Group, SimpleGrid, ThemeIcon, Loader, Center, Table,
  Badge, ScrollArea, Button, Alert,
} from '@mantine/core';
import {
  IconChecks, IconAlertTriangle, IconArrowsShuffle, IconRefresh, IconMoodCheck,
} from '@tabler/icons-react';
import { getDb } from '../../../database/db';
import { PageHeader } from '../../common/PageHeader';
import { revendeurAuditService } from '../../../services/revendeurAuditService';
import StockRevendeurService from '../../../services/StockRevendeurService';
import { notifications } from '@mantine/notifications';
import { confirm } from '../../../utils/confirm';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('fr-FR');
const round = (v: any) => Math.round((Number(v) || 0) * 100) / 100;

// Solde des mouvements = source de vérité. Convention de signe :
//  ENTREE / ANNULATION_DECOMPTE / ajustements (signés) = +   ;  DECOMPTE / SORTIE = -
const SQL = `
  SELECT s.idRevendeur, s.idProduit, c.NomComplet, p.designation, p.code_produit,
         s.qte_stock AS affiche,
         COALESCE((
           SELECT SUM(CASE
             WHEN lower(m.type_mouvement) LIKE 'entr%' THEN m.qte_mouvement
             WHEN m.type_mouvement IN ('ANNULATION_DECOMPTE','AJUSTEMENT_ENTREE') THEN m.qte_mouvement
             WHEN m.type_mouvement IN ('DECOMPTE','SORTIE','AJUSTEMENT_SORTIE','ANNULATION_REAPPRO') OR lower(m.type_mouvement) LIKE 'sort%' THEN -m.qte_mouvement
             ELSE m.qte_mouvement
           END)
           FROM mouvements_revendeur m
           WHERE m.idRevendeur = s.idRevendeur AND m.idProduit = s.idProduit
         ), 0) AS ledger
  FROM stock_revendeur s
  JOIN clients c ON c.idClient = s.idRevendeur
  JOIN products p ON p.idProduit = s.idProduit
`;

export const ControleCoherence: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [aligning, setAligning] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const data = await db.select<any[]>(SQL);
      setRows(data);
    } catch (e) {
      console.error('Contrôle cohérence:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { charger(); }, []);

  const ecarts = rows.filter(r => round(r.affiche) !== round(r.ledger));
  const negatifs = rows.filter(r => Number(r.affiche) < 0);

  const alignerTout = async () => {
    if (ecarts.length === 0) return;
    if (!await confirm(
      `Aligner ${ecarts.length} ligne(s) de stock sur le solde des mouvements ? Le stock affiché sera corrigé pour correspondre à l'historique. Opération tracée (aucune suppression).`,
      'Alignement sur les mouvements'
    )) return;
    setAligning(true);
    try {
      const db = await getDb();
      const corrections: any[] = [];
      for (const r of ecarts) {
        await StockRevendeurService.ajuster(
          r.idRevendeur,
          r.idProduit,
          Number(r.ledger) || 0,
          'Alignement de cohérence sur le solde des mouvements'
        );
        corrections.push({ idRevendeur: r.idRevendeur, idProduit: r.idProduit, avant: r.affiche, apres: r.ledger });
      }
      try {
        await revendeurAuditService.tracer({
          action: 'CORRECTION_COHERENCE_STOCK',
          entite: 'STOCK',
          details: { nb: corrections.length, corrections },
        });
      } catch { /* audit best-effort */ }
      notifications.show({ title: 'Stock aligné', message: `${corrections.length} ligne(s) corrigée(s) sur les mouvements (tracé).`, color: 'teal' });
      await charger();
    } catch (e: any) {
      notifications.show({ title: 'Erreur', message: e?.message || 'Alignement impossible', color: 'red' });
    } finally {
      setAligning(false);
    }
  };

  if (loading) return <Center py={80}><Loader size="lg" /></Center>;

  const toutOk = ecarts.length === 0 && negatifs.length === 0;

  return (
    <Stack gap="md" p="md">
      <PageHeader title="Contrôle de cohérence — stock revendeur" subtitle="Stock affiché vs solde des mouvements" icon={<IconChecks size={22} />} />

      <Group justify="space-between">
        <SimpleGrid cols={{ base: 1, sm: 3 }} style={{ flex: 1 }}>
          <Kpi label="Lignes contrôlées" value={String(rows.length)} color="blue" icon={<IconChecks size={18} />} />
          <Kpi label="Écarts détectés" value={String(ecarts.length)} color={ecarts.length ? 'orange' : 'green'} icon={<IconArrowsShuffle size={18} />} />
          <Kpi label="Stock négatif" value={String(negatifs.length)} color={negatifs.length ? 'red' : 'green'} icon={<IconAlertTriangle size={18} />} />
        </SimpleGrid>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={charger}>Actualiser</Button>
          <Button color="teal" leftSection={<IconArrowsShuffle size={16} />} onClick={alignerTout} loading={aligning} disabled={ecarts.length === 0}>
            Aligner sur les mouvements
          </Button>
        </Group>
      </Group>

      {toutOk && (
        <Alert color="green" variant="light" icon={<IconMoodCheck size={18} />}>
          Tout est cohérent : le stock affiché correspond au solde des mouvements, et aucun stock n'est négatif.
        </Alert>
      )}

      {negatifs.length > 0 && (
        <Card withBorder radius="lg" p="md">
          <Text fw={700} c="red.7" mb="xs">Stock négatif ({negatifs.length})</Text>
          <ScrollArea.Autosize mah={220}>
            <Table striped fz="sm">
              <Table.Thead><Table.Tr><Table.Th>Revendeur</Table.Th><Table.Th>Produit</Table.Th><Table.Th ta="right">Stock</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {negatifs.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{r.NomComplet}</Table.Td>
                    <Table.Td>{r.designation}</Table.Td>
                    <Table.Td ta="right"><Badge color="red" variant="light">{fmt(r.affiche)}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Card>
      )}

      <Card withBorder radius="lg" p={0}>
        <ScrollArea.Autosize mah={520}>
          <Table striped highlightOnHover stickyHeader fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Revendeur</Table.Th>
                <Table.Th>Produit</Table.Th>
                <Table.Th ta="right">Stock affiché</Table.Th>
                <Table.Th ta="right">Solde mouvements</Table.Th>
                <Table.Th ta="right">Écart</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ecarts.length === 0 ? (
                <Table.Tr><Table.Td colSpan={5}><Center py={30}><Text c="dimmed" size="sm">Aucun écart entre le stock affiché et les mouvements.</Text></Center></Table.Td></Table.Tr>
              ) : ecarts.map((r, i) => {
                const ecart = round(r.affiche) - round(r.ledger);
                return (
                  <Table.Tr key={i}>
                    <Table.Td>{r.NomComplet}</Table.Td>
                    <Table.Td>{r.designation} <Text span size="xs" c="dimmed">({r.code_produit})</Text></Table.Td>
                    <Table.Td ta="right">{fmt(r.affiche)}</Table.Td>
                    <Table.Td ta="right">{fmt(r.ledger)}</Table.Td>
                    <Table.Td ta="right"><Badge color={ecart > 0 ? 'orange' : 'red'} variant="filled">{ecart > 0 ? '+' : ''}{fmt(ecart)}</Badge></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </Card>

      <Text size="xs" c="dimmed">
        Convention : le solde des mouvements fait foi. Entrées et annulations de décompte ajoutent au stock,
        décomptes et sorties le diminuent, les ajustements/imports sont pris avec leur signe.
      </Text>
    </Stack>
  );
};

const Kpi: React.FC<{ label: string; value: string; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <Card withBorder p="sm" radius="md">
    <Group gap="sm">
      <ThemeIcon color={color} variant="light" size="lg" radius="md">{icon}</ThemeIcon>
      <div><Text size="xs" c="dimmed">{label}</Text><Text fw={700} size="lg">{value}</Text></div>
    </Group>
  </Card>
);

export default ControleCoherence;
