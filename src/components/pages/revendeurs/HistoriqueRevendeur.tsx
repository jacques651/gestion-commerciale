// src/components/pages/revendeurs/HistoriqueRevendeur.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table,
  Pagination, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, Grid, ScrollArea, Alert, Avatar,
  Tabs
} from '@mantine/core';
import {
  IconHistory, IconSearch, IconRefresh, IconTruck,
  IconShoppingCart, IconReceipt, 
  IconCash, IconAlertCircle
  } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getDb } from '../../../database/db';

interface HistoriqueItem {
  id: number;
  date: string;
  type: 'COMMANDE' | 'DECOMPTE' | 'STOCK';
  reference: string;
  designation: string;
  montant: number;
  quantite: number;
  solde: number;
  status: string;
  clientNom: string;
  clientId: number;
}

interface Statistiques {
  totalCommandes: number;
  totalDecomptes: number;
  totalMouvementsStock: number;
  montantTotalCommandes: number;
  montantTotalDecomptes: number;
}

const typeLabels: Record<string, string> = {
  'COMMANDE': '📦 Commande',
  'DECOMPTE': '📄 Décompte',
  'STOCK': '📊 Stock'
};

const typeColors: Record<string, string> = {
  'COMMANDE': 'blue',
  'DECOMPTE': 'orange',
  'STOCK': 'green'
};

export const HistoriqueRevendeur: React.FC = () => {
  const [historique, setHistorique] = useState<HistoriqueItem[]>([]);
  const [filteredHistorique, setFilteredHistorique] = useState<HistoriqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [statistiques, setStatistiques] = useState<Statistiques>({
    totalCommandes: 0,
    totalDecomptes: 0,
    totalMouvementsStock: 0,
    montantTotalCommandes: 0,
    montantTotalDecomptes: 0
  });

  const itemsPerPage = 10;

  // ✅ Fonction de formatage de date personnalisée
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

  const chargerHistorique = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      
      // Récupérer les commandes revendeur
      const commandes = await db.select<any[]>(`
        SELECT 
          c.idCommande as id,
          c.date_commande as date,
          'COMMANDE' as type,
          c.code_commande as reference,
          'Commande revendeur' as designation,
          c.montant_ttc as montant,
          0 as quantite,
          0 as solde,
          c.statut as status,
          cl.NomComplet as clientNom,
          cl.idClient as clientId
        FROM commandes c
        LEFT JOIN clients cl ON cl.idClient = c.idClient
        WHERE c.type_commande = 'REVENDEUR'
        ORDER BY c.date_commande DESC
      `);

      // Récupérer les décomptes
      const decomptes = await db.select<any[]>(`
        SELECT 
          d.idDecompte as id,
          d.date_decompte as date,
          'DECOMPTE' as type,
          d.code_decompte as reference,
          'Décompte revendeur' as designation,
          d.montant_net as montant,
          0 as quantite,
          0 as solde,
          d.statut as status,
          cl.NomComplet as clientNom,
          cl.idClient as clientId
        FROM decomptes d
        LEFT JOIN clients cl ON cl.idClient = d.idClient
        ORDER BY d.date_decompte DESC
      `);

      // Récupérer les mouvements de stock revendeur
      const mouvements = await db.select<any[]>(`
        SELECT 
          mr.idMouvement as id,
          mr.date_mouvement as date,
          'STOCK' as type,
          mr.type_mouvement as reference,
          p.designation as designation,
          0 as montant,
          mr.qte_mouvement as quantite,
          0 as solde,
          mr.type_mouvement as status,
          cl.NomComplet as clientNom,
          cl.idClient as clientId
        FROM mouvements_revendeur mr
        LEFT JOIN products p ON p.idProduit = mr.idProduit
        LEFT JOIN clients cl ON cl.idClient = mr.idRevendeur
        ORDER BY mr.date_mouvement DESC
      `);

      // Combiner tous les éléments
      const allItems: HistoriqueItem[] = [
        ...commandes.map((c: any) => ({ ...c, clientNom: c.clientNom || 'Inconnu' })),
        ...decomptes.map((d: any) => ({ ...d, clientNom: d.clientNom || 'Inconnu' })),
        ...mouvements.map((m: any) => ({ 
          ...m, 
          clientNom: m.clientNom || 'Inconnu',
          reference: m.reference === 'ENTREE' ? '📥 Entrée stock' : '📤 Sortie stock'
        }))
      ];

      // Trier par date décroissante
      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistorique(allItems);
      setFilteredHistorique(allItems);

      // Calculer les statistiques
      const stats: Statistiques = {
        totalCommandes: commandes.length,
        totalDecomptes: decomptes.length,
        totalMouvementsStock: mouvements.length,
        montantTotalCommandes: commandes.reduce((sum: number, c: any) => sum + (c.montant || 0), 0),
        montantTotalDecomptes: decomptes.reduce((sum: number, d: any) => sum + (d.montant || 0), 0)
      };
      setStatistiques(stats);

    } catch (error) {
      console.error('Erreur chargement historique:', error);
      setError('Impossible de charger l\'historique');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger l\'historique',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerHistorique();
  }, []);

  useEffect(() => {
    let filtered = [...historique];

    // Filtrer par onglet
    if (activeTab && activeTab !== 'all') {
      filtered = filtered.filter(item => item.type === activeTab);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.reference?.toLowerCase().includes(term) ||
        item.designation?.toLowerCase().includes(term) ||
        item.clientNom?.toLowerCase().includes(term)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    if (dateDebut) {
      filtered = filtered.filter(item => item.date >= dateDebut);
    }

    if (dateFin) {
      filtered = filtered.filter(item => item.date <= dateFin + ' 23:59:59');
    }

    setFilteredHistorique(filtered);
    setCurrentPage(1);
  }, [historique, activeTab, searchTerm, typeFilter, dateDebut, dateFin]);

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge color={typeColors[type] || 'gray'} variant="light" size="sm">
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string, type: string) => {
    if (type === 'COMMANDE') {
      const colors: Record<string, string> = {
        'BROUILLON': 'gray',
        'CONFIRMEE': 'blue',
        'LIVREE': 'green',
        'ANNULEE': 'red'
      };
      return <Badge color={colors[status] || 'gray'} variant="light" size="xs">{status || '-'}</Badge>;
    }
    if (type === 'DECOMPTE') {
      const colors: Record<string, string> = {
        'brouillon': 'gray',
        'valide': 'green',
        'paye': 'blue',
        'annule': 'red'
      };
      return <Badge color={colors[status?.toLowerCase()] || 'gray'} variant="light" size="xs">{status || '-'}</Badge>;
    }
    if (type === 'STOCK') {
      const isEntree = status === 'ENTREE';
      return (
        <Badge color={isEntree ? 'green' : 'red'} variant="light" size="xs">
          {isEntree ? '📥 Entrée' : '📤 Sortie'}
        </Badge>
      );
    }
    return <Badge variant="light" size="xs">{status || '-'}</Badge>;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredHistorique.length / itemsPerPage);
  const paginatedHistorique = filteredHistorique.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement de l'historique...</Text>
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
            onClick={chargerHistorique}
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
              <IconHistory size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Historique Revendeurs</Title>
              <Text c="gray.3" size="sm">Suivi complet des activités des revendeurs</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerHistorique}
            >
              Actualiser
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
                <Text c="white" size="xs">Commandes</Text>
                <Text c="white" fw={700} size="xl">{statistiques.totalCommandes}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(255,152,0,0.3)' }}>
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconReceipt size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Décomptes</Text>
                <Text c="white" fw={700} size="xl">{statistiques.totalDecomptes}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(76,175,80,0.3)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconTruck size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Mouvements stock</Text>
                <Text c="white" fw={700} size="xl">{statistiques.totalMouvementsStock}</Text>
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
                <Text c="white" fw={700} size="xl">
                  {formatMontant(statistiques.montantTotalCommandes + statistiques.montantTotalDecomptes)} F
                </Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* FILTRES */}
      <Card withBorder radius="lg" shadow="sm" p="sm">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="all" leftSection={<IconHistory size={14} />}>
              Tout
              <Badge size="xs" color="blue" ml="xs" variant="light">{historique.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="COMMANDE" leftSection={<IconShoppingCart size={14} />}>
              Commandes
              <Badge size="xs" color="blue" ml="xs" variant="light">{statistiques.totalCommandes}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="DECOMPTE" leftSection={<IconReceipt size={14} />}>
              Décomptes
              <Badge size="xs" color="orange" ml="xs" variant="light">{statistiques.totalDecomptes}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="STOCK" leftSection={<IconTruck size={14} />}>
              Stocks
              <Badge size="xs" color="green" ml="xs" variant="light">{statistiques.totalMouvementsStock}</Badge>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Grid align="flex-end" mt="sm">
          <Grid.Col span={3}>
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={14} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Type"
              data={[
                { value: 'COMMANDE', label: '📦 Commande' },
                { value: 'DECOMPTE', label: '📄 Décompte' },
                { value: 'STOCK', label: '📊 Stock' }
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <TextInput
              type="date"
              placeholder="Date début"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <TextInput
              type="date"
              placeholder="Date fin"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              size="xs"
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="light"
                color="gray"
                leftSection={<IconRefresh size={14} />}
                onClick={resetFilters}
                size="xs"
              >
                Effacer
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Card>

      {/* TABLEAU */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        {filteredHistorique.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <IconHistory size={48} color="#868e96" />
              <Text c="dimmed" size="lg" fw={500}>
                Aucun historique trouvé
              </Text>
              <Text c="dimmed" size="sm">
                Aucune activité enregistrée pour les revendeurs
              </Text>
            </Stack>
          </Center>
        ) : (
          <>
            <ScrollArea h={500}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                    <Table.Th c="white" w={40}>N°</Table.Th>
                    <Table.Th c="white">Date</Table.Th>
                    <Table.Th c="white">Type</Table.Th>
                    <Table.Th c="white">Référence</Table.Th>
                    <Table.Th c="white">Désignation</Table.Th>
                    <Table.Th c="white">Revendeur</Table.Th>
                    <Table.Th c="white" ta="right">Montant</Table.Th>
                    <Table.Th c="white" ta="center">Statut</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedHistorique.map((item, idx) => {
                    const num = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <Table.Tr key={`${item.type}-${item.id}`}>
                        <Table.Td fw={600}>{num}</Table.Td>
                        <Table.Td>
                          <Text size="xs">{formatDate(item.date)}</Text>
                        </Table.Td>
                        <Table.Td>{getTypeBadge(item.type)}</Table.Td>
                        <Table.Td>
                          <Text fw={500} size="xs">{item.reference || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{item.designation || '-'}</Text>
                          {item.quantite > 0 && (
                            <Text size="xs" c="dimmed">Qté: {item.quantite}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Avatar size="sm" radius="xl" color="blue">
                              {(item.clientNom || 'C').charAt(0).toUpperCase()}
                            </Avatar>
                            <Text size="xs">{item.clientNom || 'Inconnu'}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td ta="right">
                          {item.montant > 0 ? (
                            <Text fw={600} c="blue" size="xs">{formatMontant(item.montant)} F</Text>
                          ) : item.type === 'STOCK' ? (
                            <Text size="xs" c="dimmed">-</Text>
                          ) : (
                            <Text size="xs" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="center">
                          {getStatusBadge(item.status, item.type)}
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
    </Stack>
  );
};

export default HistoriqueRevendeur;