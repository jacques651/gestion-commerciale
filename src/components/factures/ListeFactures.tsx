// src/components/factures/ListeFactures.tsx
import React, { useState, useMemo } from 'react';
import {
  Table, Button, Group, Badge, ActionIcon, Stack, Title, Card, Text, Tooltip,
  Pagination, Select, Grid, Box, Loader, Paper, Flex, ThemeIcon, SimpleGrid,
  TextInput, Modal, Divider, Avatar
} from '@mantine/core';
import {
  IconEye, IconPrinter, IconDownload, IconSearch, IconRefresh, IconX,
  IconFileInvoice, IconCalendar, IconBuildingStore,
  IconTruck, IconCurrencyFrank
} from '@tabler/icons-react';
import { useFactures } from '../../hooks/useFactures';
import { factureRepository } from '../../database/repositories/factureRepository';
import { factureRevendeurRepository } from '../../database/repositories/factureRevendeurRepository';
import { FactureStandard } from './FactureStandard';
import { FactureRevendeur } from './FactureRevendeur';
import { notifications } from '@mantine/notifications';

export const ListeFactures: React.FC = () => {
  const { factures, loading, refresh } = useFactures();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchClient, setSearchClient] = useState('');
  const [typeFacture, setTypeFacture] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string | null>(null);
  const [dateFin, setDateFin] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [factureModalOpened, setFactureModalOpened] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const itemsPerPage = 10;

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  // ✅ Déterminer le type de facture
  const getTypeFactureLabel = (facture: any): string => {
    // Si c'est une facture revendeur (provient de factures_revendeur)
    if (facture.idFactureRevendeur !== undefined) {
      return 'Revendeur';
    }
    // Si c'est une facture standard avec type_commande
    if (facture.type_commande === 'REVENDEUR') {
      return 'Revendeur';
    }
    return 'Standard';
  };

  // ✅ Vérifier si c'est une facture revendeur
  const isRevendeurFacture = (facture: any): boolean => {
    return facture.idFactureRevendeur !== undefined || facture.type_commande === 'REVENDEUR';
  };

  // ✅ Charger les détails selon le type
  const handleViewFacture = async (facture: any) => {
    try {
      setLoadingDetails(true);
      
      let completeFacture = null;
      
      if (isRevendeurFacture(facture)) {
        // Facture revendeur
        const factureId = facture.idFactureRevendeur;
        if (factureId) {
          completeFacture = await factureRevendeurRepository.getById(factureId);
        }
      } else {
        // Facture standard
        const factureId = facture.idFacture;
        if (factureId) {
          completeFacture = await factureRepository.getById(factureId);
        }
      }
      
      if (completeFacture) {
        setSelectedFacture(completeFacture);
        setFactureModalOpened(true);
      } else {
        // Fallback : afficher une notification d'erreur
        notifications.show({
          title: 'Erreur',
          message: 'Impossible de charger les détails de la facture',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Erreur chargement facture:', error);
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors du chargement',
        color: 'red'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (facture: any) => {
    try {
      let completeFacture = null;
      
      if (isRevendeurFacture(facture)) {
        const factureId = facture.idFactureRevendeur;
        if (factureId) {
          completeFacture = await factureRevendeurRepository.getById(factureId);
        }
      } else {
        const factureId = facture.idFacture;
        if (factureId) {
          completeFacture = await factureRepository.getById(factureId);
        }
      }
      
      if (completeFacture) {
        const dataStr = JSON.stringify(completeFacture, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const codeFacture = completeFacture.code_facture || completeFacture.code_facture_revendeur || 'facture';
        const exportFileDefaultName = `${codeFacture}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        notifications.show({
          title: 'Succès',
          message: 'Facture téléchargée avec succès',
          color: 'green'
        });
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de télécharger la facture',
        color: 'red'
      });
    }
  };

  // ✅ Extraire les dates disponibles pour les filtres
  const datesDisponibles = useMemo(() => {
    const dates = factures
      .map(facture => {
        const dateStr = facture.date_facture;
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
      })
      .filter(date => date !== null);

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

  // ✅ Filtrer les factures
  const filteredFactures = useMemo(() => {
    let filtered = [...factures];

    // Filtre par nom du client
    if (searchClient) {
      filtered = filtered.filter(facture =>
        (facture.NomComplet || '').toLowerCase().includes(searchClient.toLowerCase())
      );
    }

    // Filtre par type
    if (typeFacture && typeFacture !== 'all') {
      filtered = filtered.filter(facture => {
        const type = getTypeFactureLabel(facture).toLowerCase();
        return type === typeFacture.toLowerCase();
      });
    }

    // Filtre par date
    const dateDebutObj = stringToDate(dateDebut);
    const dateFinObj = stringToDate(dateFin);

    if (dateDebutObj || dateFinObj) {
      filtered = filtered.filter(facture => {
        const dateFacture = new Date(facture.date_facture);

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

  // ✅ Statistiques
  const stats = {
    total: factures.length,
    montantTotal: factures.reduce((sum, f: any) => sum + (f.montant_ttc || 0), 0),
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
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
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
                  <Text c="white" fw={700} size="xl">{formatMontant(stats.montantTotal)} FCFA</Text>
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

          <Grid>
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
              <Select
                label="Date de fin"
                placeholder="Sélectionner"
                value={dateFin}
                onChange={setDateFin}
                data={datesDisponibles}
                size="md"
                clearable
                searchable
                leftSection={<IconCalendar size={14} />}
              />
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
            </Flex>
          </Paper>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th w={60}>N°</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th w={120}>Date facture</Table.Th>
                  <Table.Th w={110}>Type</Table.Th>
                  <Table.Th w={150}>Montant TTC</Table.Th>
                  <Table.Th w={150}>Code Facture</Table.Th>
                  <Table.Th ta="center" w={160}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFactures.map((facture: any, index) => {
                  const typeLabel = getTypeFactureLabel(facture);
                  const uniqueKey = facture.idFacture || facture.idFactureRevendeur;
                  const clientName = facture.NomComplet || '-';
                  const codeFacture = facture.code_facture || '-';

                  return (
                    <Table.Tr key={uniqueKey}>
                      <Table.Td fw={500}>
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </Table.Td>

                      <Table.Td>
                        <Group gap="sm">
                          <Avatar size="md" radius="xl" color="blue">
                            {clientName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Text fw={500} size="sm">
                            {clientName}
                          </Text>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        {facture.date_facture
                          ? new Date(facture.date_facture).toLocaleDateString("fr-FR")
                          : "-"}
                      </Table.Td>

                      <Table.Td>
                        <Badge
                          size="md"
                          color={typeLabel === "Revendeur" ? "green" : "blue"}
                          variant="light"
                          leftSection={typeLabel === "Revendeur" ? <IconTruck size={12} /> : <IconBuildingStore size={12} />}
                        >
                          {typeLabel}
                        </Badge>
                      </Table.Td>

                      <Table.Td>
                        <Text fw={600} c="blue">
                          {formatMontant(facture.montant_ttc)} FCFA
                        </Text>
                      </Table.Td>

                      <Table.Td>
                        <Text fw={500} size="sm">
                          {codeFacture}
                        </Text>
                      </Table.Td>

                      <Table.Td ta="center">
                        <Group gap="xs" justify="center">
                          <Tooltip label="Voir détails">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="lg"
                              onClick={() => handleViewFacture(facture)}
                              loading={loadingDetails}
                            >
                              <IconEye size={18} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Imprimer">
                            <ActionIcon
                              variant="light"
                              color="teal"
                              size="lg"
                              onClick={handlePrint}
                            >
                              <IconPrinter size={18} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label="Télécharger">
                            <ActionIcon
                              variant="light"
                              color="grape"
                              size="lg"
                              onClick={() => handleDownload(facture)}
                            >
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
        title={`Facture ${selectedFacture?.code_facture || ''}`}
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
                color="blue"
                leftSection={<IconPrinter size={16} />}
                onClick={handlePrint}
              >
                Imprimer
              </Button>
            </Group>

            <Divider mb="md" />

            {loadingDetails ? (
              <Flex justify="center" py={60}>
                <Loader size="xl" />
              </Flex>
            ) : isRevendeurFacture(selectedFacture) ? (
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