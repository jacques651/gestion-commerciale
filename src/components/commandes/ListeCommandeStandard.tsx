// src/components/commandes/ListeCommandeStandard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { confirm } from '../../utils/confirm';
import { useNavigate } from 'react-router-dom';
import {
  Button, Group, Stack, Title, Card, Text,
  Modal, TextInput, Paper,
  Loader, ThemeIcon, Flex, ActionIcon,
  ScrollArea, Pagination, Tooltip, Select, Badge, Table, SimpleGrid,
  Avatar, Box
} from '@mantine/core';
import {
  IconSearch, IconRefresh, IconShoppingBag,
  IconCurrencyFrank,
  IconFileInvoice, IconEye, IconReceipt, IconPlus,
  IconX, IconTruck, IconCash, IconTrash,
  IconList, IconMoneybag
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import { FormulaireCommande } from './FormulaireCommande';
import { FormulaireReglement } from '../reglements/FormulaireReglement';
import { useCommandes } from '../../hooks/useCommandes';

interface CommandeStandard {
  idCommande: number;
  code_commande: string;
  idClient: number;
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
  code_facture?: string;
  date_facture?: string;
  idFacture?: number;
}

interface FactureRow {
  idFacture: number;
  code_facture: string;
  montant_ttc: number;
  montant_regle: number;
  statut: string;
}

// ✅ Fonction de formatage de date personnalisée (sans date-fns)
const formatDateCustom = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

export const ListeCommandeStandard: React.FC = () => {
  const navigate = useNavigate();
  useCommandes();
  const [commandes, setCommandes] = useState<CommandeStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [clientsList, setClientsList] = useState<{ value: string; label: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCommande, setSelectedCommande] = useState<CommandeStandard | null>(null);
  const [detailsOpened, setDetailsOpened] = useState(false);
  const [formulaireOpened, setFormulaireOpened] = useState(false);
  
  const [reglementModalOpened, setReglementModalOpened] = useState(false);
  const [reglementData, setReglementData] = useState({
    idFacture: 0,
    idClient: 0,
    montantMax: 0,
    codeFacture: '',
    clientNom: ''
  });

  const itemsPerPage = 10;

  const chargerCommandes = async () => {
    setLoading(true);
    try {
      const db = await getDb();

      const result = await db.select<any[]>(`
        SELECT 
          c.idCommande,
          c.code_commande,
          c.idClient,
          c.date_commande,
          c.montant_ht,
          c.montant_ttc,
          c.statut,
          cl.NomComplet,
          cl.Societe,
          cl.Tel,
          f.code_facture,
          f.date_facture,
          f.idFacture
        FROM commandes c
        INNER JOIN clients cl ON cl.idClient = c.idClient
        LEFT JOIN factures f ON f.idCommande = c.idCommande
        WHERE c.type_commande = 'STANDARD' OR c.type_commande IS NULL OR c.type_commande = ''
        ORDER BY c.date_commande DESC
      `);

      setCommandes(result || []);

      const uniqueClients = [...new Map(result.map((item: any) => [item.idClient, {
        value: item.idClient.toString(),
        label: item.NomComplet || item.Societe || 'Client'
      }])).values()];
      setClientsList(uniqueClients);

    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCommandes();
  }, []);

  const handleViewDetails = async (idCommande: number) => {
    try {
      const db = await getDb();
      const details = await db.select<any[]>(`
        SELECT 
          cd.idDetail,
          cd.idProduit,
          cd.qte_commande,
          cd.prix_unitaire_vente,
          p.code_produit,
          p.designation
        FROM commande_details cd
        INNER JOIN products p ON p.idProduit = cd.idProduit
        WHERE cd.idCommande = ?
      `, [idCommande]);
      
      const commande = commandes.find(c => c.idCommande === idCommande);
      if (commande) {
        setSelectedCommande({ ...commande, details: details || [] } as any);
        setDetailsOpened(true);
      }
    } catch (error) {
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les détails', color: 'red' });
    }
  };

  const handleGenererFacture = async (idCommande: number) => {
    try {
      const { factureRepository } = await import('../../database/repositories/factureRepository');
      await factureRepository.createFromCommande(idCommande);
      notifications.show({ title: 'Succès', message: 'Facture générée avec succès', color: 'green' });
      await chargerCommandes();
    } catch (error) {
      console.error('Erreur génération facture:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de générer la facture', color: 'red' });
    }
  };

  const handleVoirFacture = (idFacture: number) => {
    if (idFacture) {
      navigate(`/factures/${idFacture}`);
    }
  };

  const handleRegler = async (commande: CommandeStandard) => {
    try {
      const db = await getDb();
      
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
          clientNom: commande.NomComplet || commande.Societe || 'Client'
        });
        setReglementModalOpened(true);
      } else {
        notifications.show({
          title: 'Information',
          message: 'Aucune facture trouvée. Veuillez générer la facture d\'abord.',
          color: 'orange'
        });
      }
    } catch (error) {
      console.error('Erreur:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les informations de règlement',
        color: 'red'
      });
    }
  };

  const handleDelete = async (idCommande: number) => {
    if (!await confirm('Supprimer cette commande ?', 'Suppression')) return;
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM commandes WHERE idCommande = ?`, [idCommande]);
      notifications.show({ title: 'Succès', message: 'Commande supprimée', color: 'green' });
      await chargerCommandes();
    } catch (error) {
      notifications.show({ title: 'Erreur', message: 'Suppression impossible', color: 'red' });
    }
  };

  const commandesFiltres = useMemo(() => {
    let filtered = [...commandes];

    if (selectedClient) {
      filtered = filtered.filter(c => c.idClient.toString() === selectedClient);
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(c => c.statut === statusFilter);
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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code_commande?.toLowerCase().includes(term) ||
        c.NomComplet?.toLowerCase().includes(term) ||
        c.Societe?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [commandes, selectedClient, statusFilter, dateDebut, dateFin, searchTerm]);

  const stats = {
    total: commandes.length,
    montantTotal: commandes.reduce((sum, c) => sum + (c.montant_ttc || 0), 0),
    avecFacture: commandes.filter(c => c.code_facture).length,
    sansFacture: commandes.filter(c => !c.code_facture).length,
    confirmees: commandes.filter(c => c.statut === 'CONFIRMEE').length,
    enCours: commandes.filter(c => c.statut === 'EN_COURS').length,
    livrees: commandes.filter(c => c.statut === 'LIVREE').length,
    annulees: commandes.filter(c => c.statut === 'ANNULEE').length
  };

  const totalPages = Math.ceil(commandesFiltres.length / itemsPerPage);
  const paginatedCommandes = commandesFiltres.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const resetFilters = () => {
    setSelectedClient(null);
    setStatusFilter('all');
    setDateDebut('');
    setDateFin('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
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

  if (loading && commandes.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des commandes...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderBottom: '3px solid #e94560' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={45} radius="md" color="orange" variant="filled">
                  <IconShoppingBag size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Commandes Standard</Title>
                  <Text c="gray.3" size="sm">Gestion des commandes clients standards</Text>
                </div>
              </Group>
            </Stack>
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
                onClick={chargerCommandes}
              >
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconShoppingBag size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Total</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Montant total</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.montantTotal)} F</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconReceipt size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Confirmées</Text><Text c="white" fw={700} size="xl">{stats.confirmees}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconFileInvoice size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">En cours</Text><Text c="white" fw={700} size="xl">{stats.enCours}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="blue" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Livrées</Text><Text c="white" fw={700} size="xl">{stats.livrees}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="red" variant="light" size="lg"><IconTrash size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Annulées</Text><Text c="white" fw={700} size="xl">{stats.annulees}</Text></div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* FILTRES */}
        <Card withBorder radius="lg" shadow="sm" p="xs">
          <Group align="flex-end" gap="xs" style={{ flexWrap: 'nowrap' }}>
            <Box style={{ width: 160 }}>
              <Select
                label="Client"
                placeholder="Client"
                data={clientsList}
                value={selectedClient}
                onChange={setSelectedClient}
                clearable
                searchable
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>
            
            <Box style={{ width: 160 }}>
              <Select
                label="Statut"
                placeholder="Statut"
                value={statusFilter}
                onChange={setStatusFilter}
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
            
            <Box style={{ width: 160 }}>
              <TextInput
                label="Début"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>
            
            <Box style={{ width: 160 }}>
              <TextInput
                label="Fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>
            
            <Box style={{ width: 300 }}>
              <TextInput
                label="Recherche"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftSection={<IconSearch size={12} />}
                size="xs"
                styles={{ input: { fontSize: '11px', padding: '4px 8px' }, label: { fontSize: '10px' } }}
              />
            </Box>
            
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
                leftSection={<IconFileInvoice size={12} />} 
                variant="light" 
                color="orange" 
                onClick={() => navigate('/factures')} 
                size="xs"
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                Factures
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

        {/* TABLEAU PRINCIPAL */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 500px)" style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="md" style={{ minWidth: 950, tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                  <Table.Th c="white" w={50} style={{ whiteSpace: 'nowrap' }}>N°</Table.Th>
                  <Table.Th c="white" w={180} style={{ whiteSpace: 'nowrap' }}>Client</Table.Th>
                  <Table.Th c="white" w={110} style={{ whiteSpace: 'nowrap' }}>Date</Table.Th>
                  <Table.Th c="white" w={160} style={{ whiteSpace: 'nowrap' }}>Code commande</Table.Th>
                  <Table.Th c="white" ta="right" w={120} style={{ whiteSpace: 'nowrap' }}>Montant TTC</Table.Th>
                  <Table.Th c="white" w={200} style={{ whiteSpace: 'nowrap' }}>Code facture</Table.Th>
                  <Table.Th c="white" w={110} style={{ whiteSpace: 'nowrap' }}>Statut</Table.Th>
                  <Table.Th c="white" ta="center" w={200} style={{ whiteSpace: 'nowrap' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedCommandes.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8} align="center">
                      <Stack align="center" py={50}>
                        <IconShoppingBag size={50} color="#ccc" />
                        <Text c="dimmed">Aucune commande standard trouvée</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginatedCommandes.map((commande, index) => {
                    const num = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <Table.Tr key={commande.idCommande}>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text fw={600} size="sm">{num}</Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                          <Group gap="sm" wrap="nowrap">
                            <Avatar size="sm" radius="xl" color="blue" style={{ flexShrink: 0 }}>
                              {(commande.NomComplet || 'C').charAt(0).toUpperCase()}
                            </Avatar>
                            <div style={{ overflow: 'hidden', minWidth: 0 }}>
                              <Text fw={500} size="sm" truncate>{commande.NomComplet || '-'}</Text>
                              <Text size="xs" c="dimmed" truncate>{commande.Societe || ''}</Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm">
                            {formatDateCustom(commande.date_commande)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text fw={600} size="sm">{commande.code_commande}</Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text fw={600} size="sm" c="blue">
                            {formatMontant(commande.montant_ttc)} F
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          <Text size="sm" c={commande.code_facture ? 'green' : 'dimmed'} truncate>
                            {commande.code_facture || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {getStatusBadge(commande.statut)}
                        </Table.Td>
                        <Table.Td ta="center" style={{ whiteSpace: 'nowrap' }}>
                          <Group gap={4} justify="center" wrap="nowrap">
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

                            {commande.code_facture && commande.idFacture && (
                              <Tooltip label="Voir facture">
                                <ActionIcon
                                  variant="light"
                                  color="grape"
                                  size="md"
                                  onClick={() => handleVoirFacture(commande.idFacture!)}
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

                            {!commande.code_facture && !commande.idFacture && (
                              <Tooltip label="Générer facture">
                                <ActionIcon
                                  variant="light"
                                  color="grape"
                                  size="md"
                                  onClick={() => handleGenererFacture(commande.idCommande)}
                                >
                                  <IconReceipt size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL DÉTAILS COMMANDE */}
      <Modal
        opened={detailsOpened}
        onClose={() => setDetailsOpened(false)}
        title={`Détails de la commande ${(selectedCommande as any)?.code_commande}`}
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
                <Text fw={500}>{formatDateCustom(selectedCommande.date_commande)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Code facture</Text>
                <Text fw={500}>{selectedCommande.code_facture || '-'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Statut</Text>
                {getStatusBadge(selectedCommande.statut)}
              </div>
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
                    {(selectedCommande as any).details?.map((detail: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td><Text size="sm">{detail.code_produit}</Text></Table.Td>
                        <Table.Td><Text size="sm">{detail.designation}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{detail.qte_commande}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{formatMontant(detail.prix_unitaire_vente)} F</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm" fw={500}>{formatMontant(detail.qte_commande * detail.prix_unitaire_vente)} F</Text></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </div>

            <div style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 16 }}>
              <Group justify="flex-end">
                <div>
                  <Text size="sm" c="dimmed">Total HT:</Text>
                  <Text fw={700} size="lg">{formatMontant((selectedCommande as any).montant_ht || 0)} F</Text>
                  <Text size="xs" c="dimmed">TVA (18%): {formatMontant((selectedCommande as any).montant_tva || 0)} F</Text>
                  <Text fw={700} size="xl" c="blue">Total TTC: {formatMontant((selectedCommande as any).montant_ttc || 0)} F</Text>
                </div>
              </Group>
            </div>
          </Stack>
        )}
      </Modal>
    </>
  );
};

export default ListeCommandeStandard;
