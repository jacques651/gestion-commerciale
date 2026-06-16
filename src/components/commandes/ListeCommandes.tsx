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
  TextInput,
  Box
} from '@mantine/core';
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
  IconAlertCircle,
  IconPlus,
  IconSearch,
  IconCash,
  IconTrash,
  IconFileInvoice,
  IconEye,
  IconTruck,
  IconBuildingStore,
  IconX,
  IconList,
  IconMoneybag
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

  const [reglementModalOpened, setReglementModalOpened] = useState(false);
  const [reglementData, setReglementData] = useState({
    idFacture: 0,
    idClient: 0,
    montantMax: 0,
    codeFacture: '',
    clientNom: ''
  });

  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const {
    commandes,
    loading,
    refresh
  } = useCommandes();

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
    standards: commandes.filter(c => c.type_commande === 'STANDARD' || c.type_commande === null || c.type_commande === '').length,
    enCours: commandes.filter(c => c.statut === 'EN_COURS').length,
    annulees: commandes.filter(c => c.statut === 'ANNULEE').length,
    confirmees: commandes.filter(c => c.statut === 'CONFIRMEE').length
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
    idFacture?: number | string;
    idFactureRevendeur?: number | string;
  }

  const handleRegler = async (commande: CommandeReference) => {
    const db = await import('../../database/db').then(m => m.getDb());

    if (commande.type_commande === 'REVENDEUR') {
      notifications.show({
        title: 'Décompte revendeur',
        message: `Veuillez créer un décompte pour le revendeur ${commande.NomComplet}`,
        color: 'blue'
      });
      return;
    }

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
        return <Badge variant="light" size="sm">{statut || 'BROUILLON'}</Badge>;
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
            <Group><ThemeIcon color="white" variant="light" size="lg"><IconShoppingBag size={20} /></ThemeIcon>
              <div><Text c="white" size="xs">Total</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="green" variant="light" size="lg"><IconCheck size={20} /></ThemeIcon>
              <div><Text c="white" size="xs">Confirmées</Text><Text c="white" fw={700} size="xl">{stats.confirmees}</Text></div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconAlertCircle size={20} /></ThemeIcon>
              <div><Text c="white" size="xs">En cours</Text><Text c="white" fw={700} size="xl">{stats.enCours}</Text></div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="blue" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
              <div><Text c="white" size="xs">Livrées</Text><Text c="white" fw={700} size="xl">{stats.livrees}</Text></div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
              <div><Text c="white" size="xs">Montant total</Text><Text c="white" fw={700} size="xl">{stats.montantTotal.toLocaleString('fr-FR')} FCFA</Text></div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Filtres + Boutons sur une seule ligne */}
      <Card withBorder radius="lg" shadow="sm" p="xs">
        <Group align="flex-end" gap="xs" style={{ flexWrap: 'nowrap' }}>
          {/* Recherche */}
          <Box style={{ width: 130 }}>
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={12} />}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              size="xs"
              styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
            />
          </Box>
          
          {/* Statut */}
          <Box style={{ width: 100 }}>
            <Select
              placeholder="Statut"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              data={[
                { value: 'all', label: 'Tous' },
                { value: 'CONFIRMEE', label: 'Confirmée' },
                { value: 'EN_COURS', label: 'En cours' },
                { value: 'LIVREE', label: 'Livrée' },
                { value: 'ANNULEE', label: 'Annulée' }
              ]}
              size="xs"
              clearable
              styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
            />
          </Box>
          
          {/* Type */}
          <Box style={{ width: 100 }}>
            <Select
              placeholder="Type"
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
              data={[
                { value: 'all', label: 'Tous' },
                { value: 'STANDARD', label: 'Standard' },
                { value: 'REVENDEUR', label: 'Revendeur' }
              ]}
              size="xs"
              clearable
              styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
            />
          </Box>
          
          {/* Date début */}
          <Box style={{ width: 110 }}>
            <TextInput
              placeholder="Début"
              type="date"
              value={dateDebut instanceof Date ? dateDebut.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const val = e.target.value;
                setDateDebut(val ? new Date(val) : null);
              }}
              size="xs"
              styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
            />
          </Box>
          
          {/* Date fin */}
          <Box style={{ width: 110 }}>
            <TextInput
              placeholder="Fin"
              type="date"
              value={dateFin instanceof Date ? dateFin.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const val = e.target.value;
                setDateFin(val ? new Date(val) : null);
              }}
              size="xs"
              styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
            />
          </Box>
          
          {/* BOUTONS D'ACTION */}
          <Group gap="xs" align="flex-end" style={{ paddingBottom: 2, flex: 1, justifyContent: 'flex-end' }}>
            <Button 
              leftSection={<IconList size={12} />} 
              variant="filled" 
              color="blue" 
              onClick={() => navigate('/commandes')} 
              size="xs"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Toutes
            </Button>
            <Button 
              leftSection={<IconBuildingStore size={12} />} 
              variant="light" 
              color="cyan" 
              onClick={() => navigate('/commandes/standard')} 
              size="xs"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Standard
            </Button>
            <Button 
              leftSection={<IconTruck size={12} />} 
              variant="light" 
              color="green" 
              onClick={() => navigate('/commandes/revendeur')} 
              size="xs"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Revendeurs
            </Button>
            <Button 
              leftSection={<IconMoneybag size={12} />} 
              variant="light" 
              color="teal" 
              onClick={() => navigate('/reglements')} 
              size="xs"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Règlements
            </Button>
            <Button 
              variant="light" 
              color="red" 
              onClick={resetFilters} 
              size="xs" 
              leftSection={<IconX size={12} />}
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              Effacer
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Tableau des commandes */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h="calc(100vh - 480px)">
          <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
              <Table.Tr>
                <Table.Th c="white" style={{ width: 50, textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>N°</Table.Th>
                <Table.Th c="white" style={{ width: 220, fontSize: '13px', fontWeight: 600 }}>Client</Table.Th>
                <Table.Th c="white" style={{ width: 110, fontSize: '13px', fontWeight: 600 }}>Date</Table.Th>
                <Table.Th c="white" style={{ width: 90, fontSize: '13px', fontWeight: 600 }}>Type</Table.Th>
                <Table.Th c="white" style={{ width: 130, textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>Montant HT</Table.Th>
                <Table.Th c="white" style={{ width: 140, fontSize: '13px', fontWeight: 600 }}>Code Facture</Table.Th>
                <Table.Th c="white" style={{ width: 110, fontSize: '13px', fontWeight: 600 }}>Date Facture</Table.Th>
                <Table.Th c="white" style={{ width: 250, textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>Actions</Table.Th>
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
                    <Table.Td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Text fw={600} size="sm">{index + 1 + (currentPage - 1) * itemsPerPage}</Text>
                    </Table.Td>
                    <Table.Td style={{ verticalAlign: 'middle' }}>
                      <Group gap="sm" wrap="nowrap">
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
                    <Table.Td style={{ verticalAlign: 'middle' }}>
                      <Text size="sm">
                        {format(new Date(commande.date_commande), 'dd/MM/yyyy', { locale: fr })}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ verticalAlign: 'middle' }}>
                      <Badge
                        color={commande.type_commande === 'REVENDEUR' ? 'green' : 'blue'}
                        variant="light"
                        size="sm"
                        leftSection={commande.type_commande === 'REVENDEUR' ? <IconPackage size={12} /> : <IconReceipt size={12} />}
                      >
                        {commande.type_commande === 'REVENDEUR' ? 'Revendeur' : 'Standard'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                      <Text fw={600} size="sm" c="blue">
                        {commande.montant_ht.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ verticalAlign: 'middle' }}>
                      <Text fw={500} size="sm" c={commande.code_facture ? 'green' : 'dimmed'}>
                        {commande.code_facture || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ verticalAlign: 'middle' }}>
                      <Text size="sm" c={commande.date_facture ? 'green' : 'dimmed'}>
                        {commande.date_facture
                          ? format(new Date(commande.date_facture), 'dd/MM/yyyy', { locale: fr })
                          : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <Group gap="xs" justify="center" wrap="nowrap">
                        <Tooltip label="Voir détails">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            size="md"
                            onClick={() => handleViewDetails(commande.idCommande)}
                          >
                            <IconEye size={18} />
                          </ActionIcon>
                        </Tooltip>

                        {(commande.code_facture || commande.idFacture || commande.idFactureRevendeur) && (
                          <Tooltip label="Voir facture">
                            <ActionIcon
                              variant="subtle"
                              color="grape"
                              size="md"
                              onClick={() => handleVoirFacture(commande)}
                            >
                              <IconFileInvoice size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        <Tooltip label="Régler">
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            size="md"
                            onClick={() => handleRegler(commande)}
                          >
                            <IconCash size={18} />
                          </ActionIcon>
                        </Tooltip>

                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="md"
                            onClick={() => handleDelete(commande.idCommande)}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>

                        {!commande.code_facture && !commande.idFacture && !commande.idFactureRevendeur && (
                          <Tooltip label="Générer facture">
                            <ActionIcon
                              variant="subtle"
                              color="grape"
                              size="md"
                              onClick={() => handleGenererFacture(commande.idCommande, commande.type_commande)}
                            >
                              <IconReceipt size={18} />
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