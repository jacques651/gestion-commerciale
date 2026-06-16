// src/components/decomptes/GestionDecomptes.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack, Card, Title, Text, Group, Button, Paper,
  ThemeIcon, SimpleGrid, Flex, Tabs, Badge, Tooltip
} from '@mantine/core';
import {
  IconReceipt, IconTruck, IconPackage, 
  IconFileInvoice, IconPlus, IconRefresh, IconArrowBackUp,
  IconBuildingStore} from '@tabler/icons-react';
import { ListeDecomptes } from './ListeDecomptes';
import { ListeCommandesRevendeur } from '../commandes/ListeCommandesRevendeur';
import ListeStockRevendeur from '../pages/revendeurs/ListeStockRevendeur';


export const GestionDecomptes: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('decomptes');

  // Statistiques (à remplacer par des données réelles)
  const stats = {
    decomptes: 0,
    commandes: 0,
    stocks: 0
  };

  return (
    <Stack gap="lg" p="md">
      {/* EN-TÊTE */}
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
        }}
      >
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
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
              onClick={() => window.location.reload()}
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
        <Group justify="center" gap="md">
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
        </Group>
      </Paper>
    </Stack>
  );
};

export default GestionDecomptes;