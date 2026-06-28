// src/components/decomptes/GestionDecomptes.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack, Card, Title, Text, Group, Button, Paper,
  ThemeIcon, SimpleGrid, Flex, Tabs, Badge, Tooltip, Loader, Center,
  Alert
} from '@mantine/core';
import {
  IconReceipt, IconTruck, IconPackage, 
  IconFileInvoice, IconPlus, IconRefresh, IconArrowBackUp,
  IconBuildingStore, IconList, IconAlertCircle
} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';
import ListeDecomptes from './ListeDecomptes';
import { ListeCommandesRevendeur } from '../commandes/ListeCommandesRevendeur';
import ListeStockRevendeur from '../pages/revendeurs/ListeStockRevendeur';

export const GestionDecomptes: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('decomptes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    decomptes: 0,
    commandes: 0,
    stocks: 0
  });

  // Charger les statistiques
  const chargerStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      
      // Vérifier si les tables existent
      const tables = await db.select<{ name: string }[]>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('decomptes', 'commandes', 'stock_revendeur')
      `);
      
      const tableNames = tables.map(t => t.name);
      
      // Nombre de décomptes
      let decomptesCount = 0;
      if (tableNames.includes('decomptes')) {
        const decomptes = await db.select<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM decomptes`
        );
        decomptesCount = decomptes[0]?.count || 0;
      }
      
      // Nombre de commandes revendeurs
      let commandesCount = 0;
      if (tableNames.includes('commandes')) {
        const commandes = await db.select<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM commandes WHERE type_commande = 'REVENDEUR'`
        );
        commandesCount = commandes[0]?.count || 0;
      }
      
      // Nombre de produits en stock revendeur
      let stocksCount = 0;
      if (tableNames.includes('stock_revendeur')) {
        const stocks = await db.select<{ count: number }[]>(
          `SELECT COUNT(*) as count FROM stock_revendeur WHERE qte_stock > 0`
        );
        stocksCount = stocks[0]?.count || 0;
      }
      
      setStats({
        decomptes: decomptesCount,
        commandes: commandesCount,
        stocks: stocksCount
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      setError('Impossible de charger les statistiques');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les statistiques',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerStats();
  }, []);

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement des statistiques...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Erreur" 
            color="red"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
          <Button 
            leftSection={<IconRefresh size={16} />}
            onClick={chargerStats}
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
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderBottom: '3px solid #e94560',
        }}
      >
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="red" variant="filled">
              <IconReceipt size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Gestion des Décomptes</Title>
              <Text c="gray.3" size="sm">Gestion complète des revendeurs, stocks et décomptes</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerStats}
            >
              Actualiser
            </Button>
            <Button
              variant="light"
              color="white"
              leftSection={<IconArrowBackUp size={18} />}
              onClick={() => navigate('/')}
            >
              Retour
            </Button>
          </Group>
        </Flex>

        {/* Cartes statistiques */}
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconReceipt size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Décomptes</Text>
                <Text c="white" fw={700} size="xl">{stats.decomptes}</Text>
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
                <Text c="white" fw={700} size="xl">{stats.commandes}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Produits en stock</Text>
                <Text c="white" fw={700} size="xl">{stats.stocks}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Onglets de navigation */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab 
              value="decomptes" 
              leftSection={<IconReceipt size={18} />}
            >
              Décomptes
              <Badge size="xs" color="blue" ml="xs" variant="light">{stats.decomptes}</Badge>
            </Tabs.Tab>
            <Tabs.Tab 
              value="commandes" 
              leftSection={<IconTruck size={18} />}
            >
              Commandes Revendeurs
              <Badge size="xs" color="green" ml="xs" variant="light">{stats.commandes}</Badge>
            </Tabs.Tab>
            <Tabs.Tab 
              value="stocks" 
              leftSection={<IconPackage size={18} />}
            >
              Stocks Revendeurs
              <Badge size="xs" color="orange" ml="xs" variant="light">{stats.stocks}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="decomptes" pt="md">
            <ListeDecomptes />
          </Tabs.Panel>

          <Tabs.Panel value="commandes" pt="md">
            <ListeCommandesRevendeur />
          </Tabs.Panel>

          <Tabs.Panel value="stocks" pt="md">
            <ListeStockRevendeur />
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Boutons d'action rapide */}
      <Paper p="md" withBorder radius="lg" shadow="sm">
        <Group justify="center" gap="md" wrap="wrap">
          <Tooltip label="Nouveau décompte">
            <Button
              variant="filled"
              color="green"
              leftSection={<IconPlus size={18} />}
              onClick={() => navigate('/decomptes/nouveau')}
              size="sm"
            >
              Nouveau décompte
            </Button>
          </Tooltip>
          <Tooltip label="Factures revendeurs">
            <Button
              variant="light"
              color="grape"
              leftSection={<IconFileInvoice size={18} />}
              onClick={() => navigate('/factures-revendeur')}
              size="sm"
            >
              Factures Revendeurs
            </Button>
          </Tooltip>
          <Tooltip label="Commandes standard">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconBuildingStore size={18} />}
              onClick={() => navigate('/commandes')}
              size="sm"
            >
              Commandes Standard
            </Button>
          </Tooltip>
          <Tooltip label="Stocks revendeurs">
            <Button
              variant="light"
              color="orange"
              leftSection={<IconList size={18} />}
              onClick={() => navigate('/stock-revendeurs')}
              size="sm"
            >
              Stocks Revendeurs
            </Button>
          </Tooltip>
          <Tooltip label="Historique revendeurs">
            <Button
              variant="light"
              color="violet"
              leftSection={<IconList size={18} />}
              onClick={() => navigate('/revendeurs/historique')}
              size="sm"
            >
              Historique
            </Button>
          </Tooltip>
        </Group>
      </Paper>
    </Stack>
  );
};

export default GestionDecomptes;