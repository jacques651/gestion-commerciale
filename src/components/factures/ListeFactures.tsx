// src/components/factures/ListeFactures.tsx
import React, { useState, useMemo } from 'react';
import {
  Table, Button, Group, Badge, ActionIcon, Stack, Title, Card, Text, Tooltip,
  Pagination, Select, Grid, Box, Loader, Paper, Flex, ThemeIcon, SimpleGrid,
  TextInput, Modal, Divider, Avatar} from '@mantine/core';
import {
  IconEye, IconPrinter, IconDownload, IconSearch, IconRefresh, IconX,
  IconFileInvoice, IconCalendar, IconBuildingStore,
  IconTruck, IconCurrencyFrank} from '@tabler/icons-react';
import { useFactures } from '../../hooks/useFactures';
import { FactureStandard } from './FactureStandard';
import { FactureRevendeur } from './FactureRevendeur';

export const ListeFactures: React.FC = () => {
  const { factures, loading, refresh } = useFactures();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchClient, setSearchClient] = useState('');
  const [typeFacture, setTypeFacture] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string | null>(null);
  const [dateFin, setDateFin] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [factureModalOpened, setFactureModalOpened] = useState(false);

  const itemsPerPage = 10;

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const getTypeFactureLabel = (facture: any) => {
    const type = facture.type_commande || facture.type_facture || facture.commande?.type_commande;
    if (type === 'REVENDEUR' || type === 'revendeur') return 'Revendeur';
    return 'Standard';
  };

  const isRevendeur = (facture: any): boolean => {
    const type = facture.type_commande || facture.type_facture || facture.commande?.type_commande;
    return type === 'REVENDEUR' || type === 'revendeur';
  };

  const datesDisponibles = useMemo(() => {
    const dates = factures.map(facture => {
      const dateStr = facture.date_facture || facture.DateFacture;
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
    }).filter(date => date !== null);

    const uniqueDates = [...new Set(dates)];
    return uniqueDates.sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/');
      const [dayB, monthB, yearB] = b.split('/');
      const dateA = new Date(`${yearA}-${monthA}-${dayA}`);
      const dateB = new Date(`${yearB}-${monthB}-${dayB}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [factures]);

  const stringToDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return isNaN(date.getTime()) ? null : date;
  };

  const filteredFactures = useMemo(() => {
    let filtered = [...factures];

    if (searchClient) {
      filtered = filtered.filter(facture =>
        (facture.client_nom || facture.nom_client || '').toLowerCase().includes(searchClient.toLowerCase())
      );
    }

    if (typeFacture && typeFacture !== 'all') {
      filtered = filtered.filter(facture => {
        const type = getTypeFactureLabel(facture).toLowerCase();
        return type === typeFacture.toLowerCase();
      });
    }

    const dateDebutObj = stringToDate(dateDebut);
    const dateFinObj = stringToDate(dateFin);

    if (dateDebutObj || dateFinObj) {
      filtered = filtered.filter(facture => {
        const dateFacture = new Date(facture.date_facture || facture.DateFacture);

        if (dateDebutObj) {
          const debut = new Date(dateDebutObj);
          debut.setHours(0, 0, 0, 0);
          if (dateFacture < debut) return false;
        }

        if (dateFinObj) {
          const fin = new Date(dateFinObj);
          fin.setHours(23, 59, 59, 999);
          if (dateFacture > fin) return false;
        }

        return true;
      });
    }

    return filtered;
  }, [factures, searchClient, typeFacture, dateDebut, dateFin]);

  const resetFilters = () => {
    setSearchClient('');
    setTypeFacture(null);
    setDateDebut(null);
    setDateFin(null);
    setCurrentPage(1);
  };

  const handleViewFacture = (facture: any) => {
    setSelectedFacture(facture);
    setFactureModalOpened(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Statistiques
  const stats = {
    total: factures.length,
    montantTotal: factures.reduce((sum, f) => sum + (f.montant_ttc || f.MontantTTC || 0), 0),
    revendeurs: factures.filter(f => getTypeFactureLabel(f) === 'Revendeur').length,
    standards: factures.filter(f => getTypeFactureLabel(f) === 'Standard').length
  };

  const totalPages = Math.ceil(filteredFactures.length / itemsPerPage);
  const paginatedFactures = filteredFactures.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading && factures.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des factures...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE ATTRACTIF */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconFileInvoice size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Factures</Title>
                  <Text c="gray.3" size="sm">Gérez et suivez toutes vos factures</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                size="md"
                variant="light"
                color="white"
                leftSection={<IconRefresh size={18} />}
                onClick={refresh}
              >
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
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Factures standard</Text>
                  <Text c="white" fw={700} size="xl">{stats.standards}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconTruck size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Factures revendeurs</Text>
                  <Text c="white" fw={700} size="xl">{stats.revendeurs}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="yellow" variant="light" size="lg">
                  <IconCurrencyFrank size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Montant total</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(stats.montantTotal)} F</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* SECTION RECHERCHE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group>
              <IconSearch size={20} color="#1b365d" />
              <Title order={3} size="h4">Rechercher</Title>
            </Group>
            <Button variant="light" color="gray" onClick={resetFilters} size="xs" leftSection={<IconX size={14} />}>
              Réinitialiser
            </Button>
          </Group>

          <Grid >
            <Grid.Col span={4}>
              <TextInput
                label="Nom du client"
                placeholder="Rechercher par nom..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                leftSection={<IconSearch size={16} />}
                size="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Type de facture"
                placeholder="Tous les types"
                value={typeFacture}
                onChange={setTypeFacture}
                data={[
                  { value: 'all', label: 'Tous les types' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'revendeur', label: 'Revendeur' },
                ]}
                size="md"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Date de début"
                placeholder="Sélectionner"
                value={dateDebut}
                onChange={setDateDebut}
                data={datesDisponibles}
                size="md"
                clearable
                searchable
                leftSection={<IconCalendar size={14} />}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Button
                fullWidth
                mt="auto"
                size="md"
                variant="filled"
                color="adminBlue"
                onClick={() => setCurrentPage(1)}
                leftSection={<IconSearch size={16} />}
              >
                Rechercher
              </Button>
            </Grid.Col>
          </Grid>
        </Card>

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Paper bg="gray.0" p="md" style={{ borderBottom: '1px solid #e5e7eb' }}>
            <Flex justify="space-between" align="center">
              <Group>
                <IconFileInvoice size={20} color="#1b365d" />
                <Title order={3} size="h4">Liste des factures</Title>
                <Badge size="lg" variant="light" color="blue">{filteredFactures.length} factures</Badge>
              </Group>
              <Button variant="subtle" rightSection={<IconDownload size={16} />} size="sm">
                Exporter
              </Button>
            </Flex>
          </Paper>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',}}>
                  <Table.Th w={60}>N°</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th w={120}>Date facture</Table.Th>
                  <Table.Th w={110}>Type</Table.Th>
                  <Table.Th w={150}>Montant HT</Table.Th>
                  <Table.Th w={150}>CodeFacture</Table.Th>
                  <Table.Th ta="center" w={160}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFactures.map((facture, index) => {
                  const typeLabel = getTypeFactureLabel(facture);
                  return (
                    <Table.Tr key={facture.idFacture || facture.id}>
                      <Table.Td fw={500}>{index + 1}</Table.Td>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar size="md" radius="xl" color="blue">
                            {(facture.client_nom || facture.nom_client || 'C').charAt(0).toUpperCase()}
                          </Avatar>
                          <Text fw={500} size="sm">{facture.client_nom || facture.nom_client || '-'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {new Date(facture.date_facture || facture.DateFacture).toLocaleDateString('fr-FR')}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="md"
                          color={typeLabel === 'Revendeur' ? 'green' : 'blue'}
                          variant="light"
                          leftSection={typeLabel === 'Revendeur' ? <IconTruck size={12} /> : <IconBuildingStore size={12} />}
                        >
                          {typeLabel}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600} c="adminBlue">{formatMontant(facture.montant_ht || facture.MontantHT)} FCFA</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{facture.code_facture || facture.CodeFacture}</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap="xs" justify="center">
                          <Tooltip label="Voir détails">
                            <ActionIcon
                              variant="light"
                              color="adminBlue"
                              size="lg"
                              onClick={() => handleViewFacture(facture)}
                            >
                              <IconEye size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Imprimer">
                            <ActionIcon variant="light" color="teal" size="lg">
                              <IconPrinter size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Télécharger">
                            <ActionIcon variant="light" color="blue" size="lg">
                              <IconDownload size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>

          {filteredFactures.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconFileInvoice size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucune facture trouvée</Text>
              <Button mt="md" variant="light" onClick={refresh} leftSection={<IconRefresh size={16} />}>
                Actualiser
              </Button>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL FACTURE */}
      <Modal
        opened={factureModalOpened}
        onClose={() => setFactureModalOpened(false)}
        title={`Facture ${selectedFacture?.code_facture || selectedFacture?.CodeFacture || ''}`}
        size="xl"
        fullScreen
      >
        {selectedFacture && (
          <>
            <Group justify="flex-end" mb="md">
              <Button
                variant="outline"
                onClick={() => setFactureModalOpened(false)}
                leftSection={<IconX size={16} />}
              >
                Fermer
              </Button>
              <Button
                variant="filled"
                color="adminBlue"
                leftSection={<IconPrinter size={16} />}
                onClick={handlePrint}
              >
                Imprimer
              </Button>
            </Group>

            <Divider mb="md" />

            {isRevendeur(selectedFacture) ? (
              <FactureRevendeur facture={selectedFacture} />
            ) : (
              <FactureStandard facture={selectedFacture} />
            )}
          </>
        )}
      </Modal>
    </>
  );
};

export default ListeFactures;