// src/components/commandes/ListeCommandes.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Pagination, Tooltip, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, Grid, ScrollArea, Alert, Avatar,
  Menu
} from '@mantine/core';
import {
  IconShoppingCart, IconSearch, IconRefresh, IconPlus,
  IconEye, IconPrinter, IconEdit,
  IconCash, IconTruck, 
  IconAlertCircle, IconFileInvoice, 
  IconCheck, IconX, IconClock} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../database/db';

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
      
      // Vérifier si la table commandes existe
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
          cl.Tel
        FROM commandes c
        LEFT JOIN clients cl ON cl.idClient = c.idClient
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

      // Calculer les statistiques
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
        c.Societe?.toLowerCase().includes(term)
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

  const getStatutBadge = (statut: string) => {
    return (
      <Badge color={statutColors[statut] || 'gray'} variant="light" size="sm">
        {statutLabels[statut] || statut}
      </Badge>
    );
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
              placeholder="Code, client..."
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
                    <Table.Th c="white" ta="center" w={150}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedCommandes.map((commande, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;
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
                        <Table.Td ta="center">{getStatutBadge(commande.statut)}</Table.Td>
                        <Table.Td ta="center">
                          <Group gap={4} justify="center">
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
                            <Tooltip label="Imprimer">
                              <ActionIcon
                                variant="light"
                                color="teal"
                                size="sm"
                                onClick={() => navigate(`/commandes/${commande.idCommande}/print`)}
                              >
                                <IconPrinter size={14} />
                              </ActionIcon>
                            </Tooltip>
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
                            {commande.statut !== 'ANNULEE' && commande.statut !== 'LIVREE' && (
                              <Menu position="bottom-end" shadow="md" width={200}>
                                <Menu.Target>
                                  <ActionIcon variant="light" color="gray" size="sm">
                                    <IconFileInvoice size={14} />
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
  );
};

export default ListeCommandes;