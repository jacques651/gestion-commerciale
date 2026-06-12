// src/components/commandes/ListeCommande.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Badge,
  Button,
  Group,
  Text,
  Modal,
  Stack,
  Paper,
  Title,
  Card,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Select,
  SimpleGrid,
  ThemeIcon,
  Flex,
  Avatar,
  Loader,
  Pagination,
  TextInput
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { FormulaireCommande } from './FormulaireCommande';
import { FormulaireReglement } from '../reglements/FormulaireReglement';
import {
  IconCheck,
  IconReceipt,
  IconPackage,
  IconRefresh,
  IconShoppingBag,
  IconCalendar,
  IconAlertCircle,
  IconPlus,
  IconSearch,
  IconFilter,
  IconCash,
  IconTrash,
  IconFileInvoice,
  IconEye,
  IconTruck,
  IconBuildingStore
} from '@tabler/icons-react';
import { useCommandes } from '../../hooks/useCommandes';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CommandeDetail {
  idDetail: number;
  idProduit: number;
  qte_commande: number;
  prix_unitaire_vente: number;
  code_produit: string;
  designation: string;
}

interface CommandeComplete {
  idCommande: number;
  code_commande: string;
  idClient: number;
  type_commande: string;
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  code_facture?: string;
  date_facture?: string;
  idFacture?: number;
  idFactureRevendeur?: number;
  statut: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
  details: CommandeDetail[];
}

// Interface pour le résultat de requête
interface FactureRow {
  idFacture: number;
  code_facture: string;
  montant_ttc: number;
  montant_regle: number;
  statut: string;
}

export function ListeCommande() {
  const navigate = useNavigate();
  const [selectedCommande, setSelectedCommande] = useState<CommandeComplete | null>(null);
  const [detailsOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);
  const [formulaireOpened, setFormulaireOpened] = useState(false);
  
  // États pour le règlement
  const [reglementModalOpened, setReglementModalOpened] = useState(false);
  const [reglementData, setReglementData] = useState({
    idFacture: 0,
    idClient: 0,
    montantMax: 0,
    codeFacture: '',
    clientNom: ''
  });

  // États des filtres
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState<string | null>(null);
  const [dateFin, setDateFin] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const {
    commandes,
    loading,
    refresh
  } = useCommandes();

  // Filtrer les commandes
  const filteredCommandes = useMemo(() => {
    let filtered = [...commandes];

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(c => c.statut === statusFilter);
    }

    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type_commande === typeFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code_commande?.toLowerCase().includes(term) ||
        c.NomComplet?.toLowerCase().includes(term) ||
        c.Societe?.toLowerCase().includes(term)
      );
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => new Date(c.date_commande) >= debut);
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => new Date(c.date_commande) <= fin);
    }

    return filtered;
  }, [commandes, statusFilter, typeFilter, searchTerm, dateDebut, dateFin]);

  const totalPages = Math.ceil(filteredCommandes.length / itemsPerPage);
  const paginatedCommandes = filteredCommandes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: commandes.length,
    montantTotal: commandes.reduce((sum, c) => sum + (c.montant_ttc || 0), 0),
    livrees: commandes.filter(c => c.statut === 'LIVREE').length,
    revendeurs: commandes.filter(c => c.type_commande === 'REVENDEUR').length,
    enCours: commandes.filter(c => c.statut === 'EN_COURS').length,
    annulees: commandes.filter(c => c.statut === 'ANNULEE').length
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchTerm('');
    setDateDebut(null);
    setDateFin(null);
    setCurrentPage(1);
  };

  const handleViewDetails = async (idCommande: number) => {
    const { commandeRepository } = await import('../../database/repositories/commandeRepository');
    const commande = await commandeRepository.getById(idCommande);
    if (commande) {
      setSelectedCommande(commande as CommandeComplete);
      openDetails();
    } else {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les détails de la commande',
        color: 'red'
      });
    }
  };

  const handleRefresh = async () => {
    await refresh();
    resetFilters();
    notifications.show({
      title: 'Actualisé',
      message: 'La liste des commandes a été actualisée',
      color: 'blue'
    });
  };

  const handleGenererFacture = async (idCommande: number, typeCommande: string) => {
    try {
      const { factureRepository } = await import('../../database/repositories/factureRepository');
      const { factureRevendeurRepository } = await import('../../database/repositories/factureRevendeurRepository');

      if (typeCommande === 'REVENDEUR') {
        await factureRevendeurRepository.createFromCommande(idCommande);
      } else {
        await factureRepository.createFromCommande(idCommande);
      }

      notifications.show({
        title: 'Succès',
        message: `Facture générée avec succès`,
        color: 'green'
      });
      await refresh();
    } catch (error) {
      console.error('Erreur génération facture:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de générer la facture',
        color: 'red'
      });
    }
  };

  interface CommandeReference {
    idCommande: number;
    idClient: number;
    type_commande: string;
    NomComplet: string;
    code_facture?: string;
    // idFacture in some places can be a string (from DB) or a number, accept both
    idFacture?: number | string;
    idFactureRevendeur?: number | string;
  }

  // ✅ Correction du type de la fonction handleRegler
  const handleRegler = async (commande: CommandeReference) => {
    const db = await import('../../database/db').then(m => m.getDb());
    
    // Pour les commandes revendeur
    if (commande.type_commande === 'REVENDEUR') {
      notifications.show({
        title: 'Décompte revendeur',
        message: `Veuillez créer un décompte pour le revendeur ${commande.NomComplet}`,
        color: 'blue'
      });
      return;
    }
    
    // ✅ Typage correct de la variable result
    const result = await db.select<FactureRow[]>(`
      SELECT idFacture, code_facture, montant_ttc, COALESCE(montant_regle, 0) as montant_regle, statut
      FROM factures 
      WHERE idCommande = ?
    `, [commande.idCommande]);
    
    if (result.length > 0) {
      const facture = result[0];
      const montantRestant = (facture.montant_ttc || 0) - (facture.montant_regle || 0);
      
      if (montantRestant <= 0) {
        notifications.show({
          title: 'Information',
          message: 'Cette facture est déjà entièrement réglée',
          color: 'blue'
        });
        return;
      }
      
      setReglementData({
        idFacture: facture.idFacture,
        idClient: commande.idClient,
        montantMax: montantRestant,
        codeFacture: facture.code_facture,
        clientNom: commande.NomComplet
      });
      setReglementModalOpened(true);
    } else {
      notifications.show({
        title: 'Information',
        message: 'Aucune facture trouvée pour cette commande. Veuillez générer la facture d\'abord.',
        color: 'orange'
      });
    }
  };

  const handleDelete = async (idCommande: number) => {
    if (!window.confirm('Supprimer cette commande ?')) return;
    try {
      const { getDb } = await import('../../database/db');
      const db = await getDb();
      await db.execute(`DELETE FROM commandes WHERE idCommande = ?`, [idCommande]);
      notifications.show({
        title: 'Succès',
        message: 'Commande supprimée',
        color: 'green'
      });
      await refresh();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Suppression impossible',
        color: 'red'
      });
    }
  };

  const handleVoirFacture = async (commande: CommandeReference) => {
    try {
      const { getDb } = await import('../../database/db');
      const db = await getDb();
      
      let facture = await db.select<any[]>(`
        SELECT idFacture, code_facture, 'standard' as type
        FROM factures 
        WHERE idCommande = ?
      `, [commande.idCommande]);
      
      if (facture.length === 0) {
        facture = await db.select<any[]>(`
          SELECT idFactureRevendeur as idFacture, code_facture, 'revendeur' as type
          FROM factures_revendeur 
          WHERE idCommande = ?
        `, [commande.idCommande]);
      }
      
      if (facture.length > 0) {
        const f = facture[0];
        if (f.type === 'revendeur') {
          navigate(`/factures-revendeur/${f.idFacture}`);
        } else {
          navigate(`/factures/${f.idFacture}`);
        }
      } else {
        notifications.show({
          title: 'Facture introuvable',
          message: 'Cette commande ne possède aucune facture',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de trouver la facture',
        color: 'red'
      });
    }
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'CONFIRMEE':
        return <Badge color="green" variant="light" size="sm">Confirmée</Badge>;
      case 'EN_COURS':
        return <Badge color="yellow" variant="light" size="sm">En cours</Badge>;
      case 'LIVREE':
        return <Badge color="blue" variant="light" size="sm">Livrée</Badge>;
      case 'ANNULEE':
        return <Badge color="red" variant="light" size="sm">Annulée</Badge>;
      default:
        return <Badge variant="light" size="sm">{statut}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'REVENDEUR' ? <IconPackage size={16} /> : <IconReceipt size={16} />;
  };

  const getTypeLabel = (type: string) => {
    return type === 'REVENDEUR' ? 'Revendeur' : 'Standard';
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
      {/* En-tête avec gradient */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconShoppingBag size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Gestion des Commandes</Title>
              <Text c="gray.3" size="sm">Suivez et gérez toutes vos commandes</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconPlus size={18} />}
              onClick={() => setFormulaireOpened(true)}
            >
              Nouvelle commande
            </Button>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={handleRefresh}
            >
              Actualiser
            </Button>
          </Group>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconShoppingBag size={20} />
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
                <IconCheck size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Livrées</Text>
                <Text c="white" fw={700} size="xl">{stats.livrees}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconAlertCircle size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">En cours</Text>
                <Text c="white" fw={700} size="xl">{stats.enCours}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="violet" variant="light" size="lg">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Revendeurs</Text>
                <Text c="white" fw={700} size="xl">{stats.revendeurs}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconReceipt size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Montant total</Text>
                <Text c="white" fw={700} size="xl">{stats.montantTotal.toLocaleString('fr-FR')} FCFA</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Barre de filtres */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFilter size={20} color="#1b365d" />
              <Title order={3} size="h4">Filtres</Title>
            </Group>
            <Button variant="light" onClick={resetFilters} size="xs" leftSection={<IconRefresh size={14} />}>
              Réinitialiser
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Select
              placeholder="Statut"
              label="Statut"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              data={[
                { value: 'all', label: 'Tous les statuts' },
                { value: 'CONFIRMEE', label: 'Confirmée' },
                { value: 'EN_COURS', label: 'En cours' },
                { value: 'LIVREE', label: 'Livrée' },
                { value: 'ANNULEE', label: 'Annulée' }
              ]}
              clearable
            />
            <Select
              placeholder="Type"
              label="Type"
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
              data={[
                { value: 'all', label: 'Tous les types' },
                { value: 'STANDARD', label: 'Standard' },
                { value: 'REVENDEUR', label: 'Revendeur' }
              ]}
              clearable
            />
            <DateInput
              placeholder="Date début"
              label="Date début"
              value={dateDebut}
              onChange={setDateDebut}
              clearable
            />
            <DateInput
              placeholder="Date fin"
              label="Date fin"
              value={dateFin}
              onChange={setDateFin}
              clearable
            />
          </SimpleGrid>

          <Text size="sm" c="dimmed" ta="right">
            {filteredCommandes.length} commande(s) trouvée(s)
          </Text>
        </Stack>
      </Card>

      {/* Boutons d'accès aux autres pages */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Group justify="center" gap="md">
          <Button
            variant="light"
            color="blue"
            leftSection={<IconBuildingStore size={18} />}
            onClick={() => navigate('/commandes')}
          >
            Commandes Standard
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconTruck size={18} />}
            onClick={() => navigate('/commandes-revendeur')}
          >
            Commandes Revendeurs
          </Button>
          <Button
            variant="light"
            color="orange"
            leftSection={<IconFileInvoice size={18} />}
            onClick={() => navigate('/factures')}
          >
            Factures Standard
          </Button>
          <Button
            variant="light"
            color="grape"
            leftSection={<IconReceipt size={18} />}
            onClick={() => navigate('/factures-revendeur')}
          >
            Factures Revendeurs
          </Button>
        </Group>
      </Card>

      {/* Tableau des commandes */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h="calc(100vh - 500px)">
          <Table striped highlightOnHover>
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
              <Table.Tr>
                <Table.Th c="white" w={60}>N°</Table.Th>
                <Table.Th c="white">Nom du client</Table.Th>
                <Table.Th c="white">Date de commande</Table.Th>
                <Table.Th c="white">Type</Table.Th>
                <Table.Th c="white" ta="right">Montant HT</Table.Th>
                <Table.Th c="white">Code Facture</Table.Th>
                <Table.Th c="white">Date Facture</Table.Th>
                <Table.Th c="white" ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedCommandes.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} align="center">
                    <Stack align="center" py={50}>
                      <IconShoppingBag size={50} color="gray" />
                      <Text c="dimmed">Aucune commande trouvée</Text>
                      <Button variant="light" onClick={resetFilters} size="xs">
                        Réinitialiser les filtres
                      </Button>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                paginatedCommandes.map((commande, index) => (
                  <Table.Tr key={commande.idCommande}>
                    <Table.Td>
                      <Text fw={600} size="sm">{index + 1 + (currentPage - 1) * itemsPerPage}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" radius="xl" color="blue">
                          {(commande.NomComplet || 'C').charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm">{commande.NomComplet || '-'}</Text>
                          {commande.Societe && (
                            <Text size="xs" c="dimmed">{commande.Societe}</Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconCalendar size={12} color="#adb5bd" />
                        <Text size="sm">
                          {format(new Date(commande.date_commande), 'dd/MM/yyyy', { locale: fr })}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={commande.type_commande === 'REVENDEUR' ? 'green' : 'blue'}
                        variant="light"
                        size="sm"
                        leftSection={getTypeIcon(commande.type_commande)}
                      >
                        {getTypeLabel(commande.type_commande)}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fw={600} size="sm" c="blue">
                        {commande.montant_ht.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {commande.code_facture || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {commande.date_facture
                          ? format(new Date(commande.date_facture), 'dd/MM/yyyy', { locale: fr })
                          : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap={4} justify="center">
                        <Tooltip label="Voir détails">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="md"
                            onClick={() => handleViewDetails(commande.idCommande)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>

                        {(commande.code_facture || commande.idFacture || commande.idFactureRevendeur) && (
                          <Tooltip label="Voir facture">
                            <ActionIcon
                              variant="light"
                              color="grape"
                              size="md"
                              onClick={() => handleVoirFacture(commande)}
                            >
                              <IconFileInvoice size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        <Tooltip label="Régler">
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="md"
                            onClick={() => handleRegler(commande)}
                          >
                            <IconCash size={16} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="md"
                            onClick={() => handleDelete(commande.idCommande)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>

                        {!commande.code_facture && !commande.idFacture && !commande.idFactureRevendeur && (
                          <Tooltip label="Générer facture">
                            <ActionIcon
                              variant="light"
                              color="grape"
                              size="md"
                              onClick={() => handleGenererFacture(commande.idCommande, commande.type_commande)}
                            >
                              <IconReceipt size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              size="md"
            />
          </Group>
        )}
      </Card>

      {/* Modal Détails Commande */}
      <Modal
        opened={detailsOpened}
        onClose={closeDetails}
        title={`Détails de la commande ${selectedCommande?.code_commande}`}
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedCommande && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <div>
                <Text size="sm" c="dimmed">Client</Text>
                <Text fw={500}>{selectedCommande.NomComplet}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Société</Text>
                <Text fw={500}>{selectedCommande.Societe || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Téléphone</Text>
                <Text fw={500}>{selectedCommande.Tel || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={500}>
                  {format(new Date(selectedCommande.date_commande), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Type</Text>
                <Group gap={4}>
                  {getTypeIcon(selectedCommande.type_commande)}
                  <Text>{getTypeLabel(selectedCommande.type_commande)}</Text>
                </Group>
              </div>
              <div>
                <Text size="sm" c="dimmed">Statut</Text>
                {getStatusBadge(selectedCommande.statut)}
              </div>
              {selectedCommande.code_facture && (
                <>
                  <div>
                    <Text size="sm" c="dimmed">Code Facture</Text>
                    <Text fw={500}>{selectedCommande.code_facture}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">Date Facture</Text>
                    <Text fw={500}>
                      {selectedCommande.date_facture
                        ? format(new Date(selectedCommande.date_facture), 'dd/MM/yyyy', { locale: fr })
                        : '-'}
                    </Text>
                  </div>
                </>
              )}
            </SimpleGrid>

            <div>
              <Text fw={700} mb="sm">Produits commandés</Text>
              <ScrollArea style={{ maxHeight: 300 }}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th ta="right">Quantité</Table.Th>
                      <Table.Th ta="right">Prix unitaire</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedCommande.details?.map((detail, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text size="sm">{detail.code_produit}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{detail.designation}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{detail.qte_commande}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{detail.prix_unitaire_vente.toLocaleString('fr-FR')} FCFA</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" fw={500}>
                            {(detail.qte_commande * detail.prix_unitaire_vente).toLocaleString('fr-FR')} FCFA
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </div>

            <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 16 }}>
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="dimmed">Montant HT</Text>
                  <Text fw={500} size="lg">
                    {selectedCommande.montant_ht.toLocaleString('fr-FR')} FCFA
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">Montant TTC</Text>
                  <Text fw={700} size="xl" c="blue">
                    {selectedCommande.montant_ttc.toLocaleString('fr-FR')} FCFA
                  </Text>
                </div>
              </Group>
            </div>
          </Stack>
        )}
      </Modal>

      {/* Modal de règlement pour facture standard */}
      <FormulaireReglement
        opened={reglementModalOpened}
        onClose={() => {
          setReglementModalOpened(false);
          refresh();
        }}
        idFacture={reglementData.idFacture}
        idClient={reglementData.idClient}
        montantMax={reglementData.montantMax}
      />

      {/* Formulaire de création de commande */}
      <FormulaireCommande
        opened={formulaireOpened}
        onClose={() => {
          setFormulaireOpened(false);
          refresh();
        }}
      />
    </Stack>
  );
}

export default ListeCommande;