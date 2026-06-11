// src/components/factures/ListeFacturesRevendeur.tsx
import React, { useState, useEffect } from 'react';
import {
  Table, Button, Group, Badge, ActionIcon, Stack, Title, Card, Text, Tooltip,
  Pagination, Modal, Divider, TextInput, Paper, Box, SimpleGrid,
  Loader, ThemeIcon, Flex
} from '@mantine/core';
import {
  IconEye, IconPrinter, IconDownload, IconSearch, IconRefresh, IconFileInvoice,
  IconTruck, IconCurrencyFrank, IconReceipt
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

interface FactureRevendeur {
  idFactureRevendeur: number;
  code_facture: string;
  idRevendeur: number;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  commission: number;
  statut: string;
  client_nom?: string;
  client_societe?: string;
}

export const ListeFacturesRevendeur: React.FC = () => {
  const [factures, setFactures] = useState<FactureRevendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<FactureRevendeur | null>(null);
  const itemsPerPage = 10;

  const chargerFactures = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<any[]>(`
        SELECT 
          fr.*,
          cl.NomComplet as client_nom,
          cl.Societe as client_societe
        FROM factures_revendeur fr
        LEFT JOIN clients cl ON fr.idRevendeur = cl.idClient
        ORDER BY fr.date_facture DESC
      `);
      setFactures(result || []);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerFactures();
  }, []);

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'EN_ATTENTE': return <Badge color="orange" variant="light">En attente</Badge>;
      case 'PAYEE': return <Badge color="green" variant="light">Payée</Badge>;
      case 'ANNULEE': return <Badge color="red" variant="light">Annulée</Badge>;
      default: return <Badge color="gray" variant="light">{statut}</Badge>;
    }
  };

  const facturesFiltrees = factures.filter(f =>
    f.code_facture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.client_nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );
const reinitialiserFactures = async () => {
  try {
    const db = await getDb();

    // Factures revendeurs
    await db.execute(`
      DELETE FROM factures_revendeur
    `);

    // Décomptes
    await db.execute(`
      DELETE FROM decompte_details
    `);

    await db.execute(`
      DELETE FROM decomptes
    `);

    await chargerFactures();
   

    notifications.show({
      title: 'Succès',
      message: 'Factures et décomptes réinitialisés',
      color: 'green'
    });

  } catch (error) {
    console.error(error);

    notifications.show({
      title: 'Erreur',
      message: 'Impossible de réinitialiser les données',
      color: 'red'
    });
  }
};

  const totalPages = Math.ceil(facturesFiltrees.length / itemsPerPage);
  const paginatedFactures = facturesFiltrees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: factures.length,
    totalMontant: factures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0),
    totalCommission: factures.reduce((sum, f) => sum + (f.commission || 0), 0),
    enAttente: factures.filter(f => f.statut === 'EN_ATTENTE').length,
    payees: factures.filter(f => f.statut === 'PAYEE').length
  };

  if (loading && factures.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des factures revendeurs...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* EN-TÊTE */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Stack gap={4}>
            <Group gap="md">
              <ThemeIcon size={50} radius="md" color="white" variant="light">
                <IconFileInvoice size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" style={{ fontSize: '2rem' }}>Factures Revendeurs</Title>
                <Text c="gray.3" size="sm">Gestion des factures et commissions</Text>
              </div>
            </Group>
          </Stack>
          <Group>
            <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={chargerFactures}>
              Actualiser
            </Button>
          </Group>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={4} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconFileInvoice size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total factures</Text>
                <Text c="white" fw={700} size="xl">{stats.total}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconCurrencyFrank size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Montant total</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(stats.totalMontant)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconReceipt size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Commission totale</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(stats.totalCommission)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconTruck size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">En attente</Text>
                <Text c="white" fw={700} size="xl">{stats.enAttente}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* RECHERCHE */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Group justify="space-between">
          <TextInput
            placeholder="Rechercher par code facture ou client..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            size="md"
            style={{ width: 350 }}
          />
          <Button
            variant="filled"
            color="orange"
            leftSection={<IconRefresh size={16} />}
            onClick={async () => {
              setSearchTerm('');
              setCurrentPage(1);

              await chargerFactures();

              notifications.show({
                title: 'Réinitialisation',
                message: 'Liste des factures rechargée',
                color: 'green'
              });
            }}
          >
            Réinitialiser
          </Button>

          <Button
            color="red"
            leftSection={<IconRefresh size={16} />}
            onClick={reinitialiserFactures}
          >
            Vider les factures
          </Button>
        </Group>
      </Card>

      {/* TABLEAU */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)', }}>
                <Table.Th>Code facture</Table.Th>
                <Table.Th>Revendeur</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th ta="right">Montant TTC</Table.Th>
                <Table.Th ta="right">Commission</Table.Th>
                <Table.Th ta="center">Statut</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedFactures.map((f) => (
                <Table.Tr key={f.idFactureRevendeur}>
                  <Table.Td><Text fw={600} size="sm">{f.code_facture}</Text></Table.Td>
                  <Table.Td fw={500}>{f.client_nom || f.client_societe || '-'}</Table.Td>
                  <Table.Td>{new Date(f.date_facture).toLocaleDateString('fr-FR')}</Table.Td>
                  <Table.Td ta="right"><Text fw={700} c="green">{formatMontant(f.montant_ttc)} F</Text></Table.Td>
                  <Table.Td ta="right"><Text c="orange">{formatMontant(f.commission)} F</Text></Table.Td>
                  <Table.Td ta="center">{getStatutBadge(f.statut)}</Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <Tooltip label="Voir détails">
                        <ActionIcon variant="light" color="adminBlue" size="md" onClick={() => { setSelectedFacture(f); setDetailsModalOpen(true); }}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Imprimer">
                        <ActionIcon variant="light" color="teal" size="md">
                          <IconPrinter size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Télécharger">
                        <ActionIcon variant="light" color="blue" size="md">
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        {facturesFiltrees.length === 0 && (
          <Flex justify="center" align="center" direction="column" py={60}>
            <IconFileInvoice size={60} color="#ccc" />
            <Text ta="center" c="dimmed" mt="md">Aucune facture revendeur trouvée</Text>
          </Flex>
        )}

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
          </Group>
        )}
      </Card>

      {/* MODAL DÉTAILS */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => { setDetailsModalOpen(false); setSelectedFacture(null); }}
        title={`Détails facture ${selectedFacture?.code_facture || ''}`}
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        {selectedFacture && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Code facture</Text>
                <Text fw={600}>{selectedFacture.code_facture}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Date</Text>
                <Text>{new Date(selectedFacture.date_facture).toLocaleDateString('fr-FR')}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Revendeur</Text>
                <Text fw={500}>{selectedFacture.client_nom || selectedFacture.client_societe}</Text>
              </Card>
              <Card withBorder p="sm" bg="gray.0">
                <Text size="xs" c="dimmed">Statut</Text>
                {getStatutBadge(selectedFacture.statut)}
              </Card>
              <Card withBorder p="sm" bg="green.0">
                <Text size="xs" c="dimmed">Montant TTC</Text>
                <Text fw={700} c="green" size="lg">{formatMontant(selectedFacture.montant_ttc)} F</Text>
              </Card>
              <Card withBorder p="sm" bg="orange.0">
                <Text size="xs" c="dimmed">Commission</Text>
                <Text fw={600} c="orange" size="lg">{formatMontant(selectedFacture.commission)} F</Text>
              </Card>
            </SimpleGrid>
            <Divider />
            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)}>Fermer</Button>
              <Button color="adminBlue" leftSection={<IconPrinter size={16} />}>Imprimer</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default ListeFacturesRevendeur;