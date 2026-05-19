// src/components/commandes/ListeCommandes.tsx
import React, { useState, useMemo } from 'react';
import {
  Table, Button, Group, Badge, ActionIcon, Stack, Title, Card, Text, Tooltip,
  Pagination, Modal, Divider, TextInput, Select, Grid,
  Paper, Box, SimpleGrid, Loader, Alert, ThemeIcon, Flex, Avatar} from '@mantine/core';
import {
  IconSearch, IconPlus, IconDownload, IconReceipt,
  IconEdit, IconEye, IconPrinter, IconTrash, IconX, IconAlertCircle,
  IconShoppingCart, IconPackage, IconTruck, IconBuildingStore, IconCalendar,
  IconCurrencyFrank, IconFileInvoice
} from '@tabler/icons-react';
import { useCommandes } from '../../hooks/useCommandes';
import { useFactures } from '../../hooks/useFactures';
import { FormulaireCommande } from './FormulaireCommande';
import { FactureStandard } from '../factures/FactureStandard';
import { FactureRevendeur } from '../factures/FactureRevendeur';
import { notifications } from '@mantine/notifications';

export const ListeCommandes: React.FC = () => {
  const { commandes, loading, refresh, getCommandeById, cancelCommande, deleteCommande } = useCommandes();

  const { createFacture, getFactureById } = useFactures();

  // États
  const [modalOpened, setModalOpened] = useState(false);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [factureModalOpened, setFactureModalOpened] = useState(false);
  const [cancelModalOpened, setCancelModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedCommande, setSelectedCommande] = useState<any>(null);
  const [factureData, setFactureData] = useState<any>(null);
  const [loadingFacture, setLoadingFacture] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchNomClient, setSearchNomClient] = useState('');
  const [typeCommande, setTypeCommande] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string | null>(null);
  const [dateFin, setDateFin] = useState<string | null>(null);

  const itemsPerPage = 10;

  // Formatage
  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  // Obtenir toutes les dates uniques des commandes
  const datesDisponibles = useMemo(() => {
    const dates = commandes.map(commande => {
      const dateStr = commande.DateCommande || commande.date_commande;
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
    }).filter(date => date !== null);

    const uniqueDates = [...new Set(dates)];
    return uniqueDates.sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
  }, [commandes]);

  const getCommandeDate = (commande: any): Date | null => {
    const dateStr = commande.DateCommande || commande.date_commande;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const stringToDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return isNaN(date.getTime()) ? null : date;
  };

  const getClientDisplayName = (commande: any) => {
    if (commande.client_nom) return commande.client_nom;
    if (commande.client_societe) return commande.client_societe;
    if (commande.NomComplet) return commande.NomComplet;
    if (commande.Societe) return commande.Societe;
    return 'Client sans nom';
  };

  const getTypeCommandeLabel = (commande: any) => {
    const type = commande.type_commande || commande.client_type;
    if (type === 'REVENDEUR' || type === 'revendeur') return 'Revendeur';
    return 'Standard';
  };

  const isRevendeur = (commande: any): boolean => {
    const type = commande.type_commande || commande.client_type;
    return type === 'REVENDEUR' || type === 'revendeur';
  };

  // Filtrage des commandes
  const filteredCommandes = useMemo(() => {
    let filtered = [...commandes];

    if (searchNomClient) {
      filtered = filtered.filter(commande =>
        getClientDisplayName(commande).toLowerCase().includes(searchNomClient.toLowerCase())
      );
    }

    if (typeCommande && typeCommande !== 'all') {
      filtered = filtered.filter(commande => {
        const type = getTypeCommandeLabel(commande).toLowerCase();
        return type === typeCommande.toLowerCase();
      });
    }

    const dateDebutObj = stringToDate(dateDebut);
    const dateFinObj = stringToDate(dateFin);

    if (dateDebutObj || dateFinObj) {
      filtered = filtered.filter(commande => {
        const commandeDate = getCommandeDate(commande);
        if (!commandeDate) return false;

        if (dateDebutObj) {
          const debut = new Date(dateDebutObj);
          debut.setHours(0, 0, 0, 0);
          if (commandeDate < debut) return false;
        }

        if (dateFinObj) {
          const fin = new Date(dateFinObj);
          fin.setHours(23, 59, 59, 999);
          if (commandeDate > fin) return false;
        }

        return true;
      });
    }

    return filtered;
  }, [commandes, searchNomClient, typeCommande, dateDebut, dateFin]);

  const resetFilters = () => {
    setSearchNomClient('');
    setTypeCommande(null);
    setDateDebut(null);
    setDateFin(null);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
  };

  const handleCancelCommande = async () => {
    if (!selectedCommande) return;
    setLoadingAction(true);
    try {
      await cancelCommande(selectedCommande.idCommande);
      notifications.show({
        title: 'Succès',
        message: `Commande ${selectedCommande.code_commande} annulée avec succès`,
        color: 'orange',
      });
      setCancelModalOpened(false);
      refresh();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'annulation de la commande',
        color: 'red',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteCommande = async () => {
    if (!selectedCommande) return;
    setLoadingAction(true);
    try {
      await deleteCommande(selectedCommande.idCommande);
      notifications.show({
        title: 'Succès',
        message: `Commande ${selectedCommande.code_commande} supprimée avec succès`,
        color: 'green',
      });
      setDeleteModalOpened(false);
      refresh();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la suppression de la commande',
        color: 'red',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleViewFacture = async (commande: any) => {
    setLoadingFacture(true);
    try {
      const commandeComplete = await getCommandeById(commande.idCommande);
      const existingFacture = commande.facture || commande.Facture;

      if (existingFacture) {
        const factureConstruite = {
          ...existingFacture,
          details: commandeComplete?.details || [],
          client_nom: getClientDisplayName(commandeComplete || commande),
          client_societe: commandeComplete?.client_societe || commande.client_societe,
          client_tel: commandeComplete?.client_tel || commande.client_tel,
          client_email: commandeComplete?.client_email || commande.client_email,
          client_adresse: commandeComplete?.client_adresse || commande.client_adresse,
          code_commande: commandeComplete?.code_commande || commande.code_commande,
          date_commande: commandeComplete?.DateCommande || commande.DateCommande,
        };
        setFactureData(factureConstruite);
        setSelectedCommande(commandeComplete || commande);
        setFactureModalOpened(true);
      } else {
        notifications.show({
          title: 'Information',
          message: 'Aucune facture trouvée pour cette commande',
          color: 'blue',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger la facture',
        color: 'red',
      });
    } finally {
      setLoadingFacture(false);
    }
  };


const handleGenerateFacture = async (commande: any) => {
  setLoadingFacture(true);
  try {
    // Récupérer la commande complète
    const commandeComplete = await getCommandeById(commande.idCommande);
    
    if (!commandeComplete) {
      throw new Error('Impossible de charger les détails de la commande');
    }
    
    // Créer la facture via le repository
    const factureId = await createFacture(commande.idCommande);
    
    // Récupérer la facture créée
    const factureComplete = await getFactureById(factureId);
    
    notifications.show({
      title: 'Succès',
      message: `Facture générée avec succès`,
      color: 'green',
    });
    
    setFactureData(factureComplete);
    setSelectedCommande(commandeComplete);
    setFactureModalOpened(true);
    refresh();
    
  } catch (error: any) {
    const errorMessage = error?.message || 'Erreur lors de la génération';
    
    // Vérifier si c'est une erreur de code dupliqué
    if (errorMessage.includes('UNIQUE constraint')) {
      notifications.show({
        title: 'Information',
        message: 'Une facture existe déjà pour cette commande',
        color: 'blue',
      });
    } else {
      notifications.show({
        title: 'Erreur',
        message: errorMessage,
        color: 'red',
      });
    }
  } finally {
    setLoadingFacture(false);
  }
};

  const handleViewDetails = async (commande: any) => {
    try {
      const fullDetails = await getCommandeById(commande.idCommande);
      setSelectedCommande(fullDetails || commande);
      setDetailsModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les détails',
        color: 'red',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalPages = Math.ceil(filteredCommandes.length / itemsPerPage);
  const paginatedCommandes = filteredCommandes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistiques
  const stats = {
    total: commandes.length,
    revendeurs: commandes.filter(c => getTypeCommandeLabel(c) === 'Revendeur').length,
    standards: commandes.filter(c => getTypeCommandeLabel(c) === 'Standard').length,
    totalMontant: commandes.reduce((sum, c) => sum + (c.MontantHT || c.montant_ht || 0), 0)
  };

  if (loading && commandes.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des commandes...</Text>
      </Card>
    );
  }

  return (
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
                <IconShoppingCart size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" style={{ fontSize: '2rem' }}>Commandes</Title>
                <Text c="gray.3" size="sm">Gérez et suivez toutes vos commandes clients</Text>
              </div>
            </Group>
          </Stack>
          <Group>
            <Button
              size="md"
              variant="light"
              color="white"
              leftSection={<IconPlus size={18} />}
              onClick={() => setModalOpened(true)}
            >
              Nouvelle commande
            </Button>
          </Group>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={4} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconShoppingCart size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Total commandes</Text>
                <Text c="white" fw={700} size="xl">{stats.total}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconTruck size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Commandes revendeurs</Text>
                <Text c="white" fw={700} size="xl">{stats.revendeurs}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconBuildingStore size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Commandes standard</Text>
                <Text c="white" fw={700} size="xl">{stats.standards}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCurrencyFrank size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Chiffre d'affaires</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(stats.totalMontant)} F</Text>
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
              value={searchNomClient}
              onChange={(e) => setSearchNomClient(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select
              label="Type de commande"
              placeholder="Tous les types"
              value={typeCommande}
              onChange={setTypeCommande}
              data={[
                { value: 'all', label: 'Tous les types' },
                { value: 'standard', label: 'Standard' },
                { value: 'revendeur', label: 'Revendeur' },
              ]}
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
              clearable
              searchable
              leftSection={<IconCalendar size={14} />}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              fullWidth
              mt="auto"
              variant="filled"
              color="adminBlue"
              onClick={handleSearch}
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
              <Title order={3} size="h4">Liste des commandes</Title>
              <Badge size="lg" variant="light" color="blue">{filteredCommandes.length} commandes</Badge>
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
                <Table.Th w={120}>Date</Table.Th>
                <Table.Th w={110}>Type</Table.Th>
                <Table.Th w={130}>Montant HT</Table.Th>
                <Table.Th w={130}>CodeFacture</Table.Th>
                <Table.Th w={100}>Date Facture</Table.Th>
                <Table.Th ta="center" w={100}>Facture</Table.Th>
                <Table.Th ta="center" w={80}>Détails</Table.Th>
                <Table.Th ta="center" w={130}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedCommandes.map((commande, index) => {
                const numCommande = (currentPage - 1) * itemsPerPage + index + 1;
                const typeLabel = getTypeCommandeLabel(commande);
                const codeFacture = commande.facture?.code_facture || commande.Facture?.code_facture || '-';
                const dateFacture = commande.facture?.date_facture || commande.Facture?.date_facture || null;
                const dateFactureFormatted = dateFacture ? new Date(dateFacture).toLocaleDateString('fr-FR') : '-';
                const commandeDate = getCommandeDate(commande);
                const hasFacture = codeFacture !== '-';

                return (
                  <Table.Tr key={commande.idCommande}>
                    <Table.Td fw={500}>{numCommande}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="blue">
                          {getClientDisplayName(commande).charAt(0).toUpperCase()}
                        </Avatar>
                        <Text fw={500} size="sm">{getClientDisplayName(commande)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {commandeDate ? commandeDate.toLocaleDateString('fr-FR') : '-'}
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
                      <Text fw={600} c="adminBlue">{formatMontant(commande.MontantHT || commande.montant_ht)} FCFA</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} size="sm">{codeFacture}</Text>
                    </Table.Td>
                    <Table.Td>{dateFactureFormatted}</Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label={hasFacture ? "Voir la facture" : "Générer la facture"}>
                        <ActionIcon
                          variant={hasFacture ? "light" : "filled"}
                          color={hasFacture ? "green" : "adminBlue"}
                          size="lg"
                          onClick={() => hasFacture ? handleViewFacture(commande) : handleGenerateFacture(commande)}
                          loading={loadingFacture}
                        >
                          <IconReceipt size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label="Voir détails">
                        <ActionIcon
                          variant="light"
                          color="adminBlue"
                          size="lg"
                          onClick={() => handleViewDetails(commande)}
                        >
                          <IconEye size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap={4} justify="center">
                        <Tooltip label="Modifier">
                          <ActionIcon variant="light" color="adminBlue" size="md">
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        {commande.statut !== 'ANNULEE' && (
                          <Tooltip label="Annuler">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              size="md"
                              onClick={() => {
                                setSelectedCommande(commande);
                                setCancelModalOpened(true);
                              }}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="md"
                            onClick={() => {
                              setSelectedCommande(commande);
                              setDeleteModalOpened(true);
                            }}
                          >
                            <IconTrash size={16} />
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

        {filteredCommandes.length === 0 && (
          <Flex justify="center" align="center" direction="column" py={60}>
            <IconPackage size={60} color="#ccc" />
            <Text ta="center" c="dimmed" mt="md">Aucune commande trouvée</Text>
          </Flex>
        )}

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
          </Group>
        )}
      </Card>

      {/* MODALS... (les mêmes que précédemment) */}
      <Modal opened={detailsModalOpened} onClose={() => setDetailsModalOpened(false)} title={`Détails commande ${selectedCommande?.code_commande || ''}`} size="lg" centered>
        {/* Contenu du modal - identique */}
        {selectedCommande && (
          <Stack>
            <SimpleGrid cols={2} spacing="md">
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed">Client</Text>
                <Text fw={500}>{getClientDisplayName(selectedCommande)}</Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed">Type</Text>
                <Badge color={getTypeCommandeLabel(selectedCommande) === 'Revendeur' ? 'green' : 'blue'}>
                  {getTypeCommandeLabel(selectedCommande)}
                </Badge>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed">Date commande</Text>
                <Text>{getCommandeDate(selectedCommande)?.toLocaleDateString('fr-FR') || '-'}</Text>
              </Card>
              <Card withBorder p="sm">
                <Text size="xs" c="dimmed">Montant HT</Text>
                <Text fw={600} c="adminBlue">{formatMontant(selectedCommande.MontantHT || selectedCommande.montant_ht)} FCFA</Text>
              </Card>
            </SimpleGrid>
            <Divider label="Produits" labelPosition="center" />
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produit</Table.Th>
                  <Table.Th ta="center">Qté</Table.Th>
                  <Table.Th ta="right">Prix unitaire</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(selectedCommande.details || []).map((detail: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{detail.produit_designation || detail.nom_produit || '-'}</Table.Td>
                    <Table.Td ta="center">{detail.quantite || detail.qte_commande}</Table.Td>
                    <Table.Td ta="right">{formatMontant(detail.prix_unitaire_vente)} FCFA</Table.Td>
                    <Table.Td ta="right" fw={500}>{formatMontant((detail.prix_unitaire_vente || 0) * (detail.quantite || 0))} FCFA</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setDetailsModalOpened(false)}>Fermer</Button>
              <Button color="adminBlue" onClick={() => { setDetailsModalOpened(false); handleGenerateFacture(selectedCommande); }}>Générer facture</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal opened={factureModalOpened} onClose={() => setFactureModalOpened(false)} title={`Facture - ${selectedCommande?.code_commande || ''}`} size="xl" centered fullScreen>
        {factureData && selectedCommande && (
          <>
            <Group justify="flex-end" mb="md">
              <Button variant="outline" onClick={() => setFactureModalOpened(false)}>Fermer</Button>
              <Button variant="filled" color="adminBlue" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Imprimer</Button>
            </Group>
            <Divider mb="md" />
            {isRevendeur(selectedCommande) ? <FactureRevendeur facture={factureData} /> : <FactureStandard facture={factureData} />}
          </>
        )}
      </Modal>

      <Modal opened={cancelModalOpened} onClose={() => setCancelModalOpened(false)} title="Annuler la commande" centered>
        <Stack>
          <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Confirmation">
            Êtes-vous sûr de vouloir annuler cette commande ?
            <Text size="sm" mt="md">- Annuler la commande<br />- Restaurer les quantités en stock</Text>
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setCancelModalOpened(false)}>Non, retour</Button>
            <Button color="orange" onClick={handleCancelCommande} loading={loadingAction}>Oui, annuler</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={deleteModalOpened} onClose={() => setDeleteModalOpened(false)} title="Supprimer la commande" centered>
        <Stack>
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Attention !">
            Êtes-vous sûr de vouloir supprimer définitivement cette commande ?
            <Text size="sm" mt="md" c="red">Action irréversible ! Les stocks seront restaurés.</Text>
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setDeleteModalOpened(false)}>Non, retour</Button>
            <Button color="red" onClick={handleDeleteCommande} loading={loadingAction}>Oui, supprimer</Button>
          </Group>
        </Stack>
      </Modal>

      <FormulaireCommande opened={modalOpened} onClose={() => { setModalOpened(false); refresh(); }} />
    </Stack>
  );
};

export default ListeCommandes;