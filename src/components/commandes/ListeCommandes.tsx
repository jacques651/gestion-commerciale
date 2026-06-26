// src/components/commandes/ListeCommandes.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Pagination, Tooltip, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, Grid, ScrollArea, Alert, Avatar,
  Menu, Modal, Divider
} from '@mantine/core';
import {
  IconShoppingCart, IconSearch, IconRefresh, IconPlus,
  IconEye, IconPrinter, IconEdit, IconTrash,
  IconCash, IconTruck,
  IconAlertCircle, IconFileInvoice,
  IconCheck, IconX, IconClock
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../database/db';
import { factureRepository } from '../../database/repositories/factureRepository';

interface Commande {
  idCommande: number;
  code_commande: string;
  idClient: number;
  type_commande: 'STANDARD' | 'REVENDEUR';
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  montant_net: number;
  statut: 'BROUILLON' | 'CONFIRMEE' | 'LIVREE' | 'ANNULEE';
  source: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
  code_facture?: string;
  idFacture?: number;
  details?: any[];
}

interface Statistiques {
  total: number;
  totalStandard: number;
  totalRevendeur: number;
  totalConfirmée: number;
  totalLivree: number;
  totalAnnulee: number;
  montantTotal: number;
}

const statutColors: Record<string, string> = {
  'BROUILLON': 'gray',
  'CONFIRMEE': 'blue',
  'LIVREE': 'green',
  'ANNULEE': 'red'
};

const statutLabels: Record<string, string> = {
  'BROUILLON': '📝 Brouillon',
  'CONFIRMEE': '✅ Confirmée',
  'LIVREE': '📦 Livrée',
  'ANNULEE': '❌ Annulée'
};

const typeLabels: Record<string, string> = {
  'STANDARD': '🏷️ Standard',
  'REVENDEUR': '🔄 Revendeur'
};

export const ListeCommandes: React.FC = () => {
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [filteredCommandes, setFilteredCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [commandeToDelete, setCommandeToDelete] = useState<Commande | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statistiques, setStatistiques] = useState<Statistiques>({
    total: 0,
    totalStandard: 0,
    totalRevendeur: 0,
    totalConfirmée: 0,
    totalLivree: 0,
    totalAnnulee: 0,
    montantTotal: 0
  });

  const itemsPerPage = 10;

  // ✅ Fonction de formatage de date personnalisée (sans date-fns)
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return '-';
    }
  };

  const chargerCommandes = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();

      const tableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='commandes'
      `);

      if (tableExists.length === 0) {
        setCommandes([]);
        setFilteredCommandes([]);
        setLoading(false);
        return;
      }

      const result = await db.select<any[]>(`
        SELECT 
          c.*,
          cl.NomComplet,
          cl.Societe,
          cl.Tel,
          f.idFacture,
          f.code_facture
        FROM commandes c
        LEFT JOIN clients cl ON cl.idClient = c.idClient
        LEFT JOIN factures f ON f.idCommande = c.idCommande
        ORDER BY c.date_commande DESC
      `);

      const commandesData = result.map((row: any) => ({
        ...row,
        NomComplet: row.NomComplet || 'Client inconnu',
        Societe: row.Societe || '',
        Tel: row.Tel || ''
      }));

      setCommandes(commandesData);
      setFilteredCommandes(commandesData);

      const stats: Statistiques = {
        total: commandesData.length,
        totalStandard: commandesData.filter((c: Commande) => c.type_commande === 'STANDARD').length,
        totalRevendeur: commandesData.filter((c: Commande) => c.type_commande === 'REVENDEUR').length,
        totalConfirmée: commandesData.filter((c: Commande) => c.statut === 'CONFIRMEE').length,
        totalLivree: commandesData.filter((c: Commande) => c.statut === 'LIVREE').length,
        totalAnnulee: commandesData.filter((c: Commande) => c.statut === 'ANNULEE').length,
        montantTotal: commandesData.reduce((sum: number, c: Commande) => sum + (c.montant_ttc || 0), 0)
      };
      setStatistiques(stats);

    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      setError('Impossible de charger les commandes');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les commandes',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCommandes();
  }, []);

  useEffect(() => {
    let filtered = [...commandes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code_commande?.toLowerCase().includes(term) ||
        c.NomComplet?.toLowerCase().includes(term) ||
        c.Societe?.toLowerCase().includes(term) ||
        c.code_facture?.toLowerCase().includes(term)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(c => c.type_commande === typeFilter);
    }

    if (statutFilter) {
      filtered = filtered.filter(c => c.statut === statutFilter);
    }

    if (dateDebut) {
      filtered = filtered.filter(c => c.date_commande >= dateDebut);
    }

    if (dateFin) {
      filtered = filtered.filter(c => c.date_commande <= dateFin + ' 23:59:59');
    }

    setFilteredCommandes(filtered);
    setCurrentPage(1);
  }, [commandes, searchTerm, typeFilter, statutFilter, dateDebut, dateFin]);

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };


  const getTypeBadge = (type: string) => {
    return (
      <Badge color={type === 'STANDARD' ? 'blue' : 'green'} variant="filled" size="sm">
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter(null);
    setStatutFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  // ✅ Voir la facture
  const handleVoirFacture = (commande: Commande) => {
    if (commande.idFacture) {
      if (commande.type_commande === 'REVENDEUR') {
        navigate(`/factures-revendeur/${commande.idFacture}`);
      } else {
        navigate(`/factures/${commande.idFacture}`);
      }
    } else {
      notifications.show({
        title: 'Information',
        message: 'Aucune facture n\'a été générée pour cette commande',
        color: 'blue'
      });
    }
  };

  // ✅ Générer une facture
  const handleGenererFacture = async (commande: Commande) => {
    if (!commande.idCommande) {
      notifications.show({
        title: 'Erreur',
        message: 'Commande invalide',
        color: 'red'
      });
      return;
    }

    try {
      const db = await getDb();

      // Vérifier si une facture existe déjà
      const existingFacture = await db.select<any[]>(`
        SELECT idFacture, code_facture FROM factures WHERE idCommande = ?
      `, [commande.idCommande]);

      if (existingFacture.length > 0) {
        notifications.show({
          title: 'ℹ️ Information',
          message: `Une facture (${existingFacture[0].code_facture}) existe déjà pour cette commande.`,
          color: 'blue'
        });
        // Rediriger vers la facture existante
        if (commande.type_commande === 'REVENDEUR') {
          navigate(`/factures-revendeur/${existingFacture[0].idFacture}`);
        } else {
          navigate(`/factures/${existingFacture[0].idFacture}`);
        }
        return;
      }

      // Générer la facture
      const idFacture = await factureRepository.createFromCommande(commande.idCommande);

      // Récupérer la facture créée
      const facture = await db.select<any[]>(`
        SELECT code_facture FROM factures WHERE idFacture = ?
      `, [idFacture]);

      if (facture.length > 0) {
        notifications.show({
          title: '✅ Succès',
          message: `Facture ${facture[0].code_facture} générée avec succès !`,
          color: 'green',
          autoClose: 5000
        });

        // Recharger la liste
        await chargerCommandes();
      }

    } catch (error: any) {
      console.error('Erreur génération facture:', error);
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Impossible de générer la facture',
        color: 'red',
        autoClose: 5000
      });
    }
  };

  // ✅ Supprimer une commande
  const handleDelete = async () => {
    if (!commandeToDelete) return;

    setDeleting(true);

    const executeWithRetry = async <T,>(
      operation: () => Promise<T>,
      retries = 5,
      delay = 500
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error: any) {
        if (error?.message?.includes('database is locked') && retries > 0) {
          console.log(`⚠️ Base verrouillée, nouvelle tentative dans ${delay}ms... (${retries} restantes)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry(operation, retries - 1, delay * 1.5);
        }
        throw error;
      }
    };

    try {
      await executeWithRetry(async () => {
        const db = await getDb();

        // Vérifier si une facture est associée
        const factureCheck = await db.select<any[]>(`
          SELECT idFacture FROM factures WHERE idCommande = ?
        `, [commandeToDelete.idCommande]);

        if (factureCheck.length > 0) {
          notifications.show({
            title: '❌ Suppression impossible',
            message: 'Cette commande a une facture associée. Supprimez d\'abord la facture.',
            color: 'red'
          });
          setDeleteModalOpened(false);
          setCommandeToDelete(null);
          setDeleting(false);
          return;
        }

        // Désactiver les contraintes FOREIGN KEY
        await db.execute('PRAGMA foreign_keys = OFF');

        try {
          // 1. Récupérer les détails pour restaurer les stocks
          const details = await db.select<any[]>(`
            SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?
          `, [commandeToDelete.idCommande]);

          // 2. Restaurer les stocks pour chaque produit
          for (const detail of details) {
            await db.execute(`
              UPDATE products 
              SET qte_stock = qte_stock + ? 
              WHERE idProduit = ?
            `, [detail.qte_commande, detail.idProduit]);
          }

          // 3. Supprimer les détails de la commande
          await db.execute(`
            DELETE FROM commande_details WHERE idCommande = ?
          `, [commandeToDelete.idCommande]);

          // 4. Supprimer les mouvements de stock associés
          try {
            await db.execute(`
              DELETE FROM mouvements_stock WHERE reference = ?
            `, [commandeToDelete.code_commande]);
          } catch (e) {
            console.log('Table mouvements_stock non trouvée ou pas de mouvements');
          }

          // 5. Supprimer la commande
          await db.execute(`
            DELETE FROM commandes WHERE idCommande = ?
          `, [commandeToDelete.idCommande]);

          // Réactiver les contraintes
          await db.execute('PRAGMA foreign_keys = ON');

          notifications.show({
            title: '✅ Succès',
            message: `Commande ${commandeToDelete.code_commande} supprimée avec succès. ${details.length} produit(s) restauré(s).`,
            color: 'green',
            autoClose: 5000
          });

          setDeleteModalOpened(false);
          setCommandeToDelete(null);
          chargerCommandes();

        } catch (error) {
          await db.execute('PRAGMA foreign_keys = ON');
          throw error;
        }
      });

    } catch (error: unknown) {
      console.error('Erreur suppression:', error);

      let errorMessage = 'Impossible de supprimer la commande.';
      const errorText = typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string'
        ? (error as any).message
        : '';
      if (errorText.includes('database is locked')) {
        errorMessage = '⚠️ La base de données est verrouillée. Veuillez réessayer dans quelques instants.';
      } else if (errorText.includes('FOREIGN KEY')) {
        errorMessage = '❌ Cette commande a des dépendances qui empêchent sa suppression.';
      }

      notifications.show({
        title: '❌ Erreur',
        message: errorMessage,
        color: 'red',
        autoClose: 5000
      });

      try {
        const db = await getDb();
        await db.execute('PRAGMA foreign_keys = ON');
      } catch (e) { }
    } finally {
      setDeleting(false);
    }
  };

  // ✅ Ouvrir modal de confirmation de suppression
  const openDeleteModal = (commande: Commande) => {
    setCommandeToDelete(commande);
    setDeleteModalOpened(true);
  };

  const totalPages = Math.ceil(filteredCommandes.length / itemsPerPage);
  const paginatedCommandes = filteredCommandes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement des commandes...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert icon={<IconAlertCircle size={16} />} title="Erreur" color="red">
            {error}
          </Alert>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={chargerCommandes}
            variant="light"
          >
            Réessayer
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
          <Flex justify="space-between" align="center" wrap="wrap">
            <Group gap="md">
              <ThemeIcon size={50} radius="md" color="white" variant="light">
                <IconShoppingCart size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white">Commandes</Title>
                <Text c="gray.3" size="sm">Gestion des commandes clients et revendeurs</Text>
              </div>
            </Group>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconRefresh size={18} />}
                onClick={chargerCommandes}
              >
                Actualiser
              </Button>
              <Button
                variant="filled"
                color="red"
                leftSection={<IconPlus size={18} />}
                onClick={() => navigate('/commandes/nouveau')}
              >
                Nouvelle commande
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconShoppingCart size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total commandes</Text>
                  <Text c="white" fw={700} size="xl">{statistiques.total}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCheck size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Livrées</Text>
                  <Text c="white" fw={700} size="xl">{statistiques.totalLivree}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(33,150,243,0.3)' }}>
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconClock size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Confirmées</Text>
                  <Text c="white" fw={700} size="xl">{statistiques.totalConfirmée}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="yellow" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Montant total</Text>
                  <Text c="white" fw={700} size="xl">{formatMontant(statistiques.montantTotal)} F</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* FILTRES */}
        <Card withBorder radius="lg" shadow="sm" p="sm">
          <Grid align="flex-end">
            <Grid.Col span={3}>
              <TextInput
                label="Rechercher"
                placeholder="Code, client, facture..."
                leftSection={<IconSearch size={14} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Select
                label="Type"
                placeholder="Tous"
                data={[
                  { value: 'STANDARD', label: '🏷️ Standard' },
                  { value: 'REVENDEUR', label: '🔄 Revendeur' }
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Select
                label="Statut"
                placeholder="Tous"
                data={[
                  { value: 'BROUILLON', label: '📝 Brouillon' },
                  { value: 'CONFIRMEE', label: '✅ Confirmée' },
                  { value: 'LIVREE', label: '📦 Livrée' },
                  { value: 'ANNULEE', label: '❌ Annulée' }
                ]}
                value={statutFilter}
                onChange={setStatutFilter}
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Date début"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Group justify="flex-end" gap="xs">
                <TextInput
                  label="Date fin"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  size="xs"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<IconX size={14} />}
                  onClick={resetFilters}
                  size="xs"
                  style={{ marginTop: 20 }}
                >
                  Effacer
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>

        {/* TABLEAU */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          {filteredCommandes.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="sm">
                <IconShoppingCart size={48} color="#868e96" />
                <Text c="dimmed" size="lg" fw={500}>
                  Aucune commande trouvée
                </Text>
                <Text c="dimmed" size="sm">
                  {searchTerm || typeFilter || statutFilter || dateDebut || dateFin
                    ? 'Aucune commande ne correspond aux filtres appliqués'
                    : 'Commencez par créer une nouvelle commande'}
                </Text>
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/commandes/nouveau')}
                >
                  Nouvelle commande
                </Button>
              </Stack>
            </Center>
          ) : (
            <>
              <ScrollArea h={500}>
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                      <Table.Th c="white" w={40}>N°</Table.Th>
                      <Table.Th c="white">Code</Table.Th>
                      <Table.Th c="white">Client</Table.Th>
                      <Table.Th c="white">Type</Table.Th>
                      <Table.Th c="white">Date</Table.Th>
                      <Table.Th c="white" ta="right">Montant</Table.Th>
                      <Table.Th c="white" ta="center">Statut</Table.Th>
                      <Table.Th c="white" ta="center" w={200}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedCommandes.map((commande, idx) => {
                      const num = (currentPage - 1) * itemsPerPage + idx + 1;
                      const hasFacture = commande.idFacture && commande.code_facture;

                      return (
                        <Table.Tr key={commande.idCommande}>
                          <Table.Td fw={600}>{num}</Table.Td>
                          <Table.Td>
                            <Text fw={500} size="xs">{commande.code_commande}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Avatar size="sm" radius="xl" color="blue">
                                {(commande.NomComplet || 'C').charAt(0).toUpperCase()}
                              </Avatar>
                              <Stack gap={0}>
                                <Text size="xs" fw={500}>{commande.NomComplet || 'Inconnu'}</Text>
                                {commande.Societe && (
                                  <Text size="xs" c="dimmed">{commande.Societe}</Text>
                                )}
                              </Stack>
                            </Group>
                          </Table.Td>
                          <Table.Td>{getTypeBadge(commande.type_commande)}</Table.Td>
                          <Table.Td>
                            <Text size="xs">{formatDate(commande.date_commande)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c="blue" size="xs">{formatMontant(commande.montant_ttc)} F</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Group gap={4} justify="center" wrap="wrap">
                              {/* Voir détails - Ouvre la fiche commande */}
                              <Tooltip label="Voir détails">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="sm"
                                  onClick={() => navigate(`/commandes/${commande.idCommande}`)}
                                >
                                  <IconEye size={14} />
                                </ActionIcon>
                              </Tooltip>

                              {/* Voir facture ou Générer facture */}
                              <Tooltip label={hasFacture ? "Voir facture" : "Générer facture"}>
                                <ActionIcon
                                  variant="light"
                                  color={hasFacture ? "grape" : "orange"}
                                  size="sm"
                                  onClick={() => {
                                    if (hasFacture) {
                                      handleVoirFacture(commande);
                                    } else {
                                      handleGenererFacture(commande);
                                    }
                                  }}
                                >
                                  <IconFileInvoice size={14} />
                                </ActionIcon>
                              </Tooltip>

                              {/* Imprimer - Version simplifiée */}
                              <Tooltip label="Imprimer">
                                <ActionIcon
                                  variant="light"
                                  color="teal"
                                  size="sm"
                                  onClick={() => {
                                    // Utiliser window.print() ou ouvrir une version imprimable
                                    navigate(`/commandes/${commande.idCommande}?print=true`);
                                  }}
                                >
                                  <IconPrinter size={14} />
                                </ActionIcon>
                              </Tooltip>

                              {/* Modifier (seulement si brouillon) */}
                              {commande.statut === 'BROUILLON' && (
                                <Tooltip label="Modifier">
                                  <ActionIcon
                                    variant="light"
                                    color="orange"
                                    size="sm"
                                    onClick={() => navigate(`/commandes/${commande.idCommande}/edit`)}
                                  >
                                    <IconEdit size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              {/* Supprimer (seulement si pas de facture) */}
                              {!hasFacture && (
                                <Tooltip label="Supprimer">
                                  <ActionIcon
                                    variant="light"
                                    color="red"
                                    size="sm"
                                    onClick={() => openDeleteModal(commande)}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              {/* Menu actions supplémentaires */}
                              {commande.statut !== 'ANNULEE' && commande.statut !== 'LIVREE' && (
                                <Menu position="bottom-end" shadow="md" width={200}>
                                  <Menu.Target>
                                    <ActionIcon variant="light" color="gray" size="sm">
                                      <IconCheck size={14} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      leftSection={<IconCheck size={14} />}
                                      onClick={() => {
                                        notifications.show({
                                          title: 'Information',
                                          message: `Confirmation de la commande ${commande.code_commande}`,
                                          color: 'blue'
                                        });
                                      }}
                                    >
                                      Confirmer
                                    </Menu.Item>
                                    <Menu.Item
                                      leftSection={<IconTruck size={14} />}
                                      onClick={() => {
                                        notifications.show({
                                          title: 'Information',
                                          message: `Livraison de la commande ${commande.code_commande}`,
                                          color: 'blue'
                                        });
                                      }}
                                    >
                                      Livrer
                                    </Menu.Item>
                                    <Menu.Divider />
                                    <Menu.Item
                                      leftSection={<IconX size={14} />}
                                      color="red"
                                      onClick={() => {
                                        notifications.show({
                                          title: 'Information',
                                          message: `Annulation de la commande ${commande.code_commande}`,
                                          color: 'red'
                                        });
                                      }}
                                    >
                                      Annuler
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination
                    total={totalPages}
                    value={currentPage}
                    onChange={setCurrentPage}
                    size="sm"
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* RÉSUMÉ */}
        <Paper withBorder p="sm" radius="lg">
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="lg">
              <Text size="xs" c="dimmed">
                Total: <strong>{filteredCommandes.length}</strong> commandes
              </Text>
              <Text size="xs" c="dimmed">
                Montant total: <strong>{formatMontant(statistiques.montantTotal)} FCFA</strong>
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="blue" size="sm">
                Standard: {statistiques.totalStandard}
              </Badge>
              <Badge color="green" size="sm">
                Revendeur: {statistiques.totalRevendeur}
              </Badge>
              <Badge color="gray" size="sm">
                Brouillon: {commandes.filter(c => c.statut === 'BROUILLON').length}
              </Badge>
            </Group>
          </Flex>
        </Paper>
      </Stack>

      {/* MODAL DE CONFIRMATION DE SUPPRESSION */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setCommandeToDelete(null);
        }}
        title="⚠️ Confirmation de suppression"
        centered
        size="md"
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="⚠️ Attention !">
            <Text size="sm">
              Êtes-vous sûr de vouloir supprimer cette commande ?
            </Text>
            <Text size="sm" mt="md" c="red">
              <strong>Action irréversible !</strong>
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>La commande sera définitivement supprimée</li>
              <li>Les stocks seront automatiquement restaurés</li>
              <li>Les règlements associés seront supprimés</li>
            </ul>
          </Alert>

          {commandeToDelete && (
            <Paper p="md" withBorder>
              <Text size="sm">
                <strong>Commande:</strong> {commandeToDelete.code_commande}
              </Text>
              <Text size="sm">
                <strong>Client:</strong> {commandeToDelete.NomComplet || 'Inconnu'}
              </Text>
              <Text size="sm">
                <strong>Montant:</strong> {formatMontant(commandeToDelete.montant_ttc)} FCFA
              </Text>
              <Text size="sm">
                <strong>Date:</strong> {formatDate(commandeToDelete.date_commande)}
              </Text>
            </Paper>
          )}

          <Divider />

          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpened(false);
                setCommandeToDelete(null);
              }}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeCommandes;