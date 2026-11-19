// src/components/clients/FicheClient.tsx
// Fiche d'un client avec onglets : Informations + Paiements (traçage de tous
// les encaissements du client, tous modes confondus : règlements de factures
// et ventes au comptoir enregistrées en caisse).
import React, { useEffect, useState } from 'react';
import {
  Modal, Tabs, Stack, Group, Text, Badge, Card, SimpleGrid, Table,
  ScrollArea, Loader, Center, ThemeIcon, Divider,
} from '@mantine/core';
import {
  IconUser, IconCash, IconPhone, IconMail, IconMapPin, IconBuilding,
  IconReceipt, IconBuildingStore,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { Client } from '../../database/repositories/clientRepository';

interface Paiement {
  date: string;
  type: string;        // 'Règlement' | 'Vente comptoir'
  mode: string | null;
  montant: number;
  reference: string | null;
}

interface Props {
  client: Client | null;
  opened: boolean;
  onClose: () => void;
}

const fmtMontant = (v: any) => (Number(v) || 0).toLocaleString('fr-FR');
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const fmtMode = (m?: string | null): string => {
  if (!m) return 'Non précisé';
  const map: Record<string, string> = {
    ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', VIREMENT: 'Virement',
    CHEQUE: 'Chèque', AUTRE: 'Autre', ORANGE_MONEY: 'Orange Money',
    MOOV_MONEY: 'Moov Money', TELECEL_MONEY: 'Telecel Money',
    TELETEL_MONEY: 'Telecel Money', SANK_MONEY: 'Sank Money', WAVE: 'Wave',
  };
  return map[m] || m;
};

const modeColor = (m?: string | null): string => {
  const l = (m || '').toLowerCase();
  if (l.includes('espèce') || l.includes('espece') || l === 'especes') return 'green';
  if (l.includes('orange') || l.includes('moov') || l.includes('telecel') ||
      l.includes('sank') || l.includes('wave') || l.includes('mobile')) return 'violet';
  if (l.includes('virement')) return 'blue';
  if (l.includes('chèque') || l.includes('cheque')) return 'cyan';
  return 'gray';
};

export const FicheClient: React.FC<Props> = ({ client, opened, onClose }) => {
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened || !client?.idClient) return;
    let annule = false;
    (async () => {
      setLoading(true);
      const liste: Paiement[] = [];
      const db = await getDb();

      // 1. Règlements de factures / ventes rattachés au client.
      try {
        const regs = await db.select<any[]>(
          `SELECT date_reglement AS date, montant AS montant,
                  mode_reglement AS mode, code_reglement AS reference
           FROM reglements WHERE idClient = ?`,
          [client.idClient]
        );
        liste.push(...regs.map((r) => ({ ...r, type: 'Règlement' } as Paiement)));
      } catch (e) { console.error('Erreur règlements client:', e); }

      // 2. Ventes au comptoir encaissées en caisse pour ce client.
      try {
        const ventes = await db.select<any[]>(
          `SELECT j.date_journal AS date, j.montant AS montant,
                  COALESCE(j.mode_paiement_detail, j.mode_paiement) AS mode,
                  j.reference AS reference
           FROM journal_caisse j
           JOIN ventes v ON v.idVente = j.idReference
           WHERE j.categorie = 'VENTE_COMPTOIR'
             AND j.type_mouvement = 'ENTREE'
             AND v.idClient = ?`,
          [client.idClient]
        );
        liste.push(...ventes.map((r) => ({ ...r, type: 'Vente comptoir' } as Paiement)));
      } catch (e) { console.error('Erreur ventes comptoir client:', e); }

      liste.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (!annule) { setPaiements(liste); setLoading(false); }
    })();
    return () => { annule = true; };
  }, [opened, client?.idClient]);

  const totalPaye = paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue"><IconUser size={16} /></ThemeIcon>
          <Text fw={700}>{client?.NomComplet || 'Fiche client'}</Text>
          {client?.TypeClient && (
            <Badge color={client.TypeClient === 'revendeur' ? 'orange' : 'blue'} variant="light" size="sm">
              {client.TypeClient === 'revendeur' ? 'Revendeur' : 'Client'}
            </Badge>
          )}
        </Group>
      }
    >
      {client && (
        <Tabs defaultValue="infos">
          <Tabs.List>
            <Tabs.Tab value="infos" leftSection={<IconUser size={14} />}>Informations</Tabs.Tab>
            <Tabs.Tab value="paiements" leftSection={<IconCash size={14} />}>Paiements</Tabs.Tab>
          </Tabs.List>

          {/* ---- INFORMATIONS ---- */}
          <Tabs.Panel value="infos" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <InfoLine icon={<IconPhone size={14} />} label="Téléphone" value={client.Tel} />
              <InfoLine icon={<IconMail size={14} />} label="Email" value={client.Email} />
              <InfoLine icon={<IconBuilding size={14} />} label="Société" value={client.Societe} />
              <InfoLine icon={<IconMapPin size={14} />} label="Ville" value={client.Ville} />
            </SimpleGrid>
          </Tabs.Panel>

          {/* ---- PAIEMENTS ---- */}
          <Tabs.Panel value="paiements" pt="md">
            <Card withBorder p="sm" mb="sm" bg="green.0">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total encaissé ({paiements.length} paiement(s))</Text>
                <Text fw={700} size="lg" c="green.8">{fmtMontant(totalPaye)} F</Text>
              </Group>
            </Card>

            {loading ? (
              <Center py={40}><Loader size="sm" /></Center>
            ) : paiements.length === 0 ? (
              <Center py={30}><Text c="dimmed" size="sm">Aucun paiement enregistré pour ce client.</Text></Center>
            ) : (
              <ScrollArea.Autosize mah={360}>
                <Table striped highlightOnHover withTableBorder stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th ta="right">Montant</Table.Th>
                      <Table.Th>Référence</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paiements.map((p, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{fmtDate(p.date)}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs" variant="light"
                            color={p.type === 'Vente comptoir' ? 'teal' : 'indigo'}
                            leftSection={p.type === 'Vente comptoir'
                              ? <IconBuildingStore size={11} />
                              : <IconReceipt size={11} />}
                          >
                            {p.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color={modeColor(p.mode)}>
                            {fmtMode(p.mode)}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right"><Text fw={600}>{fmtMontant(p.montant)} F</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{p.reference || '—'}</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            )}
          </Tabs.Panel>
        </Tabs>
      )}
    </Modal>
  );
};

const InfoLine: React.FC<{ icon: React.ReactNode; label: string; value?: string | null }> = ({ icon, label, value }) => (
  <Group gap="xs" wrap="nowrap">
    <ThemeIcon variant="light" color="gray" size="sm">{icon}</ThemeIcon>
    <div>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" fw={500}>{value || '—'}</Text>
    </div>
  </Group>
);

export default FicheClient;
