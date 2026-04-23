// src/components/dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  SimpleGrid,
  ThemeIcon,
  Badge,
  ScrollArea,
  LoadingOverlay,
  Divider,
  Grid,
  Button,
  Modal,
  Box,
} from '@mantine/core';
import {
  IconUsers,
  IconShoppingBag,
  IconChartBar,
  IconBuildingStore,
  IconPackage,
  IconInfoCircle,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

type PageKey =
  | 'dashboard'
  | 'clients'
  | 'commandes'
  | 'factures'
  | 'ventes'
  | 'products'
  | 'stock'
  | 'decomptes'
  | 'reglements'
  | 'utilisateurs'
  | 'parametres';

interface DashboardProps {
  setPage?: (page: PageKey) => void;
}

const formatCurrency = (v?: number) => `${(v || 0).toLocaleString('fr-FR')} FCFA`;

const Dashboard: React.FC<DashboardProps> = ({ setPage }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    clients: 0,
    produits: 0,
    commandes: 0,
    ventes: 0,
    factures: 0,
    chiffreAffaires: 0,
    encaissements: 0,
    resteARecouvrer: 0,
  });
  const [recentVentes, setRecentVentes] = useState<any[]>([]);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const db = await getDb();

      // Nombre de clients
      const clients = await db.select<any[]>("SELECT COUNT(*) as total FROM clients WHERE est_supprime = 0");
      
      // Nombre de produits
      const produits = await db.select<any[]>("SELECT COUNT(*) as total FROM products WHERE est_supprime = 0");
      
      // Nombre de commandes
      const commandes = await db.select<any[]>("SELECT COUNT(*) as total FROM commandes WHERE statut != 'ANNULEE'");
      
      // Nombre de ventes
      const ventes = await db.select<any[]>("SELECT COUNT(*) as total FROM ventes");
      
      // Nombre de factures
      const factures = await db.select<any[]>("SELECT COUNT(*) as total FROM factures");
      
      // Chiffre d'affaires
      const ca = await db.select<any[]>("SELECT SUM(montant_total) as total FROM ventes");
      
      // Encaissements
      const encaissements = await db.select<any[]>("SELECT SUM(montant_regle) as total FROM reglements");
      
      // Reste à recouvrer
      const facturesTotal = await db.select<any[]>("SELECT SUM(montant_ttc) as total FROM factures WHERE statut != 'PAYEE'");
      const resteARecouvrer = (facturesTotal[0]?.total || 0) - (encaissements[0]?.total || 0);

      setStats({
        clients: clients[0]?.total || 0,
        produits: produits[0]?.total || 0,
        commandes: commandes[0]?.total || 0,
        ventes: ventes[0]?.total || 0,
        factures: factures[0]?.total || 0,
        chiffreAffaires: ca[0]?.total || 0,
        encaissements: encaissements[0]?.total || 0,
        resteARecouvrer: resteARecouvrer > 0 ? resteARecouvrer : 0,
      });

      // Dernières ventes
      const lastVentes = await db.select<any[]>(`
        SELECT v.code_vente, v.nom_prenom, v.montant_total, v.date_vente, v.type_vente
        FROM ventes v
        ORDER BY v.date_vente DESC
        LIMIT 10
      `);
      setRecentVentes(lastVentes || []);
      
      setLoading(false);
    };

    loadStats();
  }, []);

  const benefice = stats.encaissements - stats.chiffreAffaires;

  const quickLinks = [
    { label: 'Clients', action: () => setPage?.('clients'), icon: <IconUsers size={20} />, color: 'blue', description: 'Gestion des clients' },
    { label: 'Commandes', action: () => setPage?.('commandes'), icon: <IconShoppingBag size={20} />, color: 'orange', description: 'Gestion des commandes' },
    { label: 'Ventes', action: () => setPage?.('ventes'), icon: <IconBuildingStore size={20} />, color: 'teal', description: 'Historique des ventes' },
    { label: 'Stock', action: () => setPage?.('stock'), icon: <IconPackage size={20} />, color: 'grape', description: 'Gestion du stock' },
  ];

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement du tableau de bord...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER AVEC BOUTON INSTRUCTIONS */}
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}>
              <Group gap="xs">
                <IconChartBar size={24} color="white" />
                <Title order={2} c="white">Tableau de bord</Title>
              </Group>
              <Text size="sm" c="gray.3">
                Vue d'ensemble de votre activité commerciale
              </Text>
            </Stack>
            <Group gap="md">
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
              <ThemeIcon size={48} radius="md" color="white" variant="light">
                <IconChartBar size={28} />
              </ThemeIcon>
            </Group>
          </Group>
        </Card>

        {/* LIENS RAPIDES */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">🔗 Accès rapides</Title>
          <Divider mb="md" />
          <Grid>
            {quickLinks.map((link, index) => (
              <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                <Card
                  withBorder
                  radius="md"
                  p="sm"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={link.action}
                >
                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon color={link.color} variant="light" size={40} radius="md">
                      {link.icon}
                    </ThemeIcon>
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">{link.label}</Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>{link.description}</Text>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Card>

        {/* KPI CARDS */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Clients</Text>
                <Text fw={700} size="xl">{stats.clients}</Text>
              </Stack>
              <ThemeIcon color="blue" variant="light" size={38} radius="md">
                <IconUsers size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Produits</Text>
                <Text fw={700} size="xl">{stats.produits}</Text>
              </Stack>
              <ThemeIcon color="green" variant="light" size={38} radius="md">
                <IconPackage size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Commandes</Text>
                <Text fw={700} size="xl">{stats.commandes}</Text>
              </Stack>
              <ThemeIcon color="orange" variant="light" size={38} radius="md">
                <IconShoppingBag size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Ventes</Text>
                <Text fw={700} size="xl">{stats.ventes}</Text>
              </Stack>
              <ThemeIcon color="teal" variant="light" size={38} radius="md">
                <IconBuildingStore size={20} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* STATISTIQUES FINANCIÈRES */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>💰 Situation financière</Text>
              <Badge color={stats.resteARecouvrer > 0 ? "yellow" : "green"} variant="light">
                {stats.resteARecouvrer > 0 ? "Attention" : "Saine"}
              </Badge>
            </Group>
            <Divider mb="md" />
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Chiffre d'affaires</Text>
                <Text fw={700} c="blue">{formatCurrency(stats.chiffreAffaires)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Encaissements</Text>
                <Text fw={700} c="green">{formatCurrency(stats.encaissements)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Reste à recouvrer</Text>
                <Text fw={700} c="orange">{formatCurrency(stats.resteARecouvrer)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Bénéfice</Text>
                <Text fw={700} c={benefice >= 0 ? "green" : "red"}>{formatCurrency(benefice)}</Text>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>📊 Activité récente</Text>
              <Badge color="blue" variant="light">10 dernières ventes</Badge>
            </Group>
            <Divider mb="md" />
            <ScrollArea h={200}>
              <Stack gap="xs">
                {recentVentes.length === 0 ? (
                  <Text ta="center" size="sm" c="dimmed">Aucune vente récente</Text>
                ) : (
                  recentVentes.map((v, i) => (
                    <Group key={i} justify="space-between">
                      <Group gap="xs">
                        <Text size="sm" fw={500}>{v.code_vente}</Text>
                        <Text size="xs" c="dimmed">{v.nom_prenom}</Text>
                      </Group>
                      <Badge color={v.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light" size="sm">
                        {v.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Revendeur'}
                      </Badge>
                      <Text size="sm" fw={600} c="green">{v.montant_total.toLocaleString()} FCFA</Text>
                    </Group>
                  ))
                )}
              </Stack>
            </ScrollArea>
          </Card>
        </SimpleGrid>

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
          size="md"
          centered
          styles={{
            header: {
              backgroundColor: '#1b365d',
              padding: '16px 20px',
            },
            title: {
              color: 'white',
              fontWeight: 600,
            },
            body: {
              padding: '20px',
            },
          }}
        >
          <Stack gap="md">
            <Text size="sm">1. Utilisez les accès rapides pour naviguer dans l'application</Text>
            <Text size="sm">2. Les KPI en haut donnent une vue d'ensemble rapide</Text>
            <Text size="sm">3. Gérez vos clients, produits, commandes et ventes</Text>
            <Text size="sm">4. Suivez vos factures et règlements</Text>
            <Text size="sm">5. Consultez régulièrement la situation financière</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 1.0.0 - Gestion Commerciale
            </Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default Dashboard;