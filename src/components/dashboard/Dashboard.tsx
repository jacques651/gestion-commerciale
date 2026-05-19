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
  Button,
  Modal,
  Box,
  Paper,
  Flex,
  Avatar} from '@mantine/core';
import {
  IconUsers,
  IconShoppingBag,
  IconChartBar,
  IconBuildingStore,
  IconPackage,
  IconInfoCircle,
  IconReceipt,
  IconCash,
  IconTruck,
  IconFileInvoice,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar} from '@tabler/icons-react';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

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
  | 'parametres'
  | 'commandes-revendeur';

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
    commandesRevendeur: 0,
    stockRevendeur: 0
  });
  const [recentVentes, setRecentVentes] = useState<any[]>([]);
  const [recentCommandes, setRecentCommandes] = useState<any[]>([]);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const db = await getDb();

        const clients = await db.select<any[]>("SELECT COUNT(*) as total FROM clients");
        const produits = await db.select<any[]>("SELECT COUNT(*) as total FROM products");
        const commandes = await db.select<any[]>(`
          SELECT COUNT(*) as total FROM commandes WHERE statut != 'ANNULEE'
        `);
        const ventes = await db.select<any[]>("SELECT COUNT(*) as total FROM ventes");
        const factures = await db.select<any[]>("SELECT COUNT(*) as total FROM factures");
        
        const ca = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant_ttc), 0) as total FROM ventes
        `);
        
        const encaissements = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant), 0) as total FROM reglements
        `);
        
        const facturesImpayees = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant_ttc), 0) as total 
          FROM factures 
          WHERE statut IN ('EN_ATTENTE', 'PARTIELLEMENT_REGLEE')
        `);

        // Statistiques revendeurs
        const commandesRevendeur = await db.select<any[]>(`
          SELECT COUNT(*) as total FROM commandes WHERE type_commande = 'REVENDEUR'
        `);
        
        const stockRevendeur = await db.select<any[]>(`
          SELECT COALESCE(SUM(qte_stock), 0) as total FROM produits_revendeur
        `);

        setStats({
          clients: clients[0]?.total || 0,
          produits: produits[0]?.total || 0,
          commandes: commandes[0]?.total || 0,
          ventes: ventes[0]?.total || 0,
          factures: factures[0]?.total || 0,
          chiffreAffaires: ca[0]?.total || 0,
          encaissements: encaissements[0]?.total || 0,
          resteARecouvrer: facturesImpayees[0]?.total || 0,
          commandesRevendeur: commandesRevendeur[0]?.total || 0,
          stockRevendeur: stockRevendeur[0]?.total || 0
        });

        const lastVentes = await db.select<any[]>(`
          SELECT 
            v.code_vente,
            v.date_vente,
            v.montant_ttc,
            v.type_vente,
            v.statut,
            cl.NomComplet as client_nom,
            cl.Societe as client_societe,
            cl.Tel as client_tel
          FROM ventes v
          LEFT JOIN clients cl ON v.idClient = cl.idClient
          ORDER BY v.date_vente DESC
          LIMIT 10
        `);
        setRecentVentes(lastVentes || []);

        const lastCommandes = await db.select<any[]>(`
          SELECT 
            c.idCommande,
            c.code_commande,
            datetime(c.date_commande, 'localtime') as date_commande,
            c.montant_ttc,
            c.statut,
            c.type_commande,
            cl.NomComplet as client_nom,
            cl.Societe as client_societe,
            cl.TypeClient as client_type
          FROM commandes c
          LEFT JOIN clients cl ON c.idClient = cl.idClient
          ORDER BY c.idCommande DESC
          LIMIT 5
        `);
        setRecentCommandes(lastCommandes || []);

      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        notifications.show({
          title: 'Erreur',
          message: 'Erreur lors du chargement des statistiques',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const benefice = stats.encaissements - stats.chiffreAffaires;
  const tauxRecouvrement = stats.chiffreAffaires > 0 
    ? (stats.encaissements / stats.chiffreAffaires) * 100 
    : 0;

  const quickLinks = [
    { label: 'Clients', action: () => setPage?.('clients'), icon: <IconUsers size={20} />, color: 'blue', description: 'Gestion des clients' },
    { label: 'Commandes', action: () => setPage?.('commandes'), icon: <IconShoppingBag size={20} />, color: 'orange', description: 'Gestion des commandes' },
    { label: 'Ventes', action: () => setPage?.('ventes'), icon: <IconBuildingStore size={20} />, color: 'teal', description: 'Historique des ventes' },
    { label: 'Produits', action: () => setPage?.('products'), icon: <IconPackage size={20} />, color: 'grape', description: 'Gestion des produits' },
    { label: 'Factures', action: () => setPage?.('factures'), icon: <IconReceipt size={20} />, color: 'cyan', description: 'Suivi des factures' },
    { label: 'Règlements', action: () => setPage?.('reglements'), icon: <IconCash size={20} />, color: 'green', description: 'Historique des paiements' },
    { label: 'Commandes Revendeurs', action: () => setPage?.('commandes-revendeur'), icon: <IconTruck size={20} />, color: 'violet', description: 'Gestion des revendeurs' },
  ];

  const getClientDisplayName = (vente: any) => {
    return vente.client_nom || vente.client_societe || 'Client anonyme';
  };

  const getStatusBadge = (statut: string) => {
    if (!statut) return <Badge color="gray" variant="light">Inconnu</Badge>;
    const colors: Record<string, string> = {
      CONFIRMEE: 'blue',
      EN_PREPARATION: 'orange',
      EXPEDIEE: 'violet',
      LIVREE: 'teal',
      FACTUREE: 'green',
      ANNULEE: 'red',
      COMPLETEE: 'green',
      BROUILLON: 'gray'
    };
    const labels: Record<string, string> = {
      CONFIRMEE: 'Confirmée',
      EN_PREPARATION: 'En prép.',
      EXPEDIEE: 'Expediée',
      LIVREE: 'Livrée',
      FACTUREE: 'Facturée',
      ANNULEE: 'Annulée',
      COMPLETEE: 'Complétée',
      BROUILLON: 'Brouillon'
    };
    return <Badge color={colors[statut] || 'gray'} variant="light" size="sm">{labels[statut] || statut}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'REVENDEUR') {
      return <Badge color="green" variant="light" size="sm" leftSection={<IconTruck size={10} />}>Revendeur</Badge>;
    }
    return <Badge color="blue" variant="light" size="sm">Standard</Badge>;
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={true} />
        <Text ta="center" pt={50}>Chargement du tableau de bord...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER ATTRACTIF */}
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
                  <IconChartBar size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Tableau de bord</Title>
                  <Text c="gray.3" size="sm">Vue d'ensemble de votre activité commerciale</Text>
                </div>
              </Group>
            </Stack>
            <Button
              variant="light"
              color="white"
              leftSection={<IconInfoCircle size={18} />}
              onClick={() => setInfoModalOpen(true)}
            >
              Instructions
            </Button>
          </Flex>

          {/* Cartes statistiques principales */}
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Clients</Text>
                  <Text c="white" fw={700} size="xl">{stats.clients}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Chiffre d'affaires</Text>
                  <Text c="white" fw={700} size="xl">{formatCurrency(stats.chiffreAffaires)}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconShoppingBag size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Commandes</Text>
                  <Text c="white" fw={700} size="xl">{stats.commandes}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="teal" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Ventes</Text>
                  <Text c="white" fw={700} size="xl">{stats.ventes}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* LIENS RAPIDES */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="blue" variant="light" size="sm">
              <IconBuildingStore size={16} />
            </ThemeIcon>
            <Title order={3} size="h4">Accès rapides</Title>
          </Group>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
            {quickLinks.map((link, index) => (
              <Card
                key={index}
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
            ))}
          </SimpleGrid>
        </Card>

        {/* KPI CARDS */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
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
                <Text size="xs" c="dimmed">Factures</Text>
                <Text fw={700} size="xl">{stats.factures}</Text>
              </Stack>
              <ThemeIcon color="cyan" variant="light" size={38} radius="md">
                <IconFileInvoice size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Commandes Revendeurs</Text>
                <Text fw={700} size="xl">{stats.commandesRevendeur}</Text>
              </Stack>
              <ThemeIcon color="violet" variant="light" size={38} radius="md">
                <IconTruck size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Stock Revendeurs</Text>
                <Text fw={700} size="xl">{stats.stockRevendeur}</Text>
              </Stack>
              <ThemeIcon color="grape" variant="light" size={38} radius="md">
                <IconPackage size={20} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder radius="md" p="sm" bg={tauxRecouvrement >= 80 ? "green.0" : "orange.0"}>
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Taux recouvrement</Text>
                <Text fw={700} size="xl">{tauxRecouvrement.toFixed(1)}%</Text>
              </Stack>
              <ThemeIcon color={tauxRecouvrement >= 80 ? "green" : "orange"} variant="light" size={38} radius="md">
                {tauxRecouvrement >= 80 ? <IconTrendingUp size={20} /> : <IconTrendingDown size={20} />}
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* STATISTIQUES FINANCIÈRES */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder radius="lg" shadow="sm" p="lg">
            <Group gap="xs" mb="md">
              <ThemeIcon color="blue" variant="light" size="sm">
                <IconCash size={16} />
              </ThemeIcon>
              <Text fw={600}>💰 Situation financière</Text>
              <Badge color={stats.resteARecouvrer > 0 ? "yellow" : "green"} variant="light">
                {stats.resteARecouvrer > 0 ? `${formatCurrency(stats.resteARecouvrer)} à recouvrer` : "À jour"}
              </Badge>
            </Group>
            <Divider mb="md" />
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Chiffre d'affaires (ventes)</Text>
                <Text fw={700} c="blue">{formatCurrency(stats.chiffreAffaires)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Encaissements reçus</Text>
                <Text fw={700} c="green">{formatCurrency(stats.encaissements)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Factures impayées</Text>
                <Text fw={700} c="orange">{formatCurrency(stats.resteARecouvrer)}</Text>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="sm" fw={600}>Marge brute</Text>
                <Text fw={700} c={benefice >= 0 ? "green" : "red"} size="lg">
                  {formatCurrency(benefice)}
                </Text>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="lg" shadow="sm" p="lg">
            <Group gap="xs" mb="md">
              <ThemeIcon color="orange" variant="light" size="sm">
                <IconShoppingBag size={16} />
              </ThemeIcon>
              <Text fw={600}>🛒 Dernières commandes</Text>
              <Badge color="blue" variant="light">5 dernières</Badge>
            </Group>
            <Divider mb="md" />
            <ScrollArea h={200}>
              <Stack gap="xs">
                {recentCommandes.length === 0 ? (
                  <Text ta="center" size="sm" c="dimmed">Aucune commande récente</Text>
                ) : (
                  recentCommandes.map((c, i) => (
                    <Group key={i} justify="space-between" wrap="wrap">
                      <div>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>{c.code_commande}</Text>
                          {getTypeBadge(c.type_commande)}
                        </Group>
                        <Text size="xs" c="dimmed">{c.client_nom || c.client_societe || 'Client inconnu'}</Text>
                      </div>
                      <Group gap="xs">
                        {getStatusBadge(c.statut)}
                        <Text size="sm" fw={600} c="green">{formatCurrency(c.montant_ttc)}</Text>
                      </Group>
                    </Group>
                  ))
                )}
              </Stack>
            </ScrollArea>
          </Card>
        </SimpleGrid>

        {/* DERNIÈRES VENTES */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="teal" variant="light" size="sm">
              <IconBuildingStore size={16} />
            </ThemeIcon>
            <Text fw={600}>📊 Dernières ventes enregistrées</Text>
            <Badge color="teal" variant="light">10 dernières</Badge>
          </Group>
          <Divider mb="md" />
          <ScrollArea h={250}>
            <Stack gap="xs">
              {recentVentes.length === 0 ? (
                <Text ta="center" size="sm" c="dimmed">Aucune vente récente</Text>
              ) : (
                recentVentes.map((v, i) => (
                  <Group key={i} justify="space-between" wrap="wrap" p="xs" style={{ borderBottom: '1px solid #e9ecef' }}>
                    <div>
                      <Group gap="xs">
                        <Avatar size="sm" radius="xl" color="teal">
                          {(getClientDisplayName(v).charAt(0) || 'C').toUpperCase()}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>{v.code_vente}</Text>
                          <Text size="xs" c="dimmed">{getClientDisplayName(v)}</Text>
                        </div>
                      </Group>
                    </div>
                    <div>
                      <Badge color={v.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light" size="sm">
                        {v.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Revendeur'}
                      </Badge>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c="green">{formatCurrency(v.montant_ttc)}</Text>
                      <Group gap={4}>
                        <IconCalendar size={10} color="#adb5bd" />
                        <Text size="xs" c="dimmed">{v.date_vente ? new Date(v.date_vente).toLocaleDateString() : '-'}</Text>
                      </Group>
                    </div>
                  </Group>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Card>

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions d'utilisation"
          size="md"
          centered
          styles={{
            header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: 'white', fontWeight: 600 },
            body: { padding: '20px' }
          }}
        >
          <Stack gap="md">
            <Text fw={600} size="sm">Bienvenue dans votre application de gestion commerciale !</Text>
            <Divider />

            <Text size="sm">1. <strong>Accès rapides</strong> - Utilisez les boutons colorés pour naviguer</Text>
            <Text size="sm">2. <strong>Clients</strong> - Gérez votre fichier clients (création, modification)</Text>
            <Text size="sm">3. <strong>Commandes</strong> - Créez et suivez vos commandes clients</Text>
            <Text size="sm">4. <strong>Ventes</strong> - Enregistrez vos ventes au comptoir</Text>
            <Text size="sm">5. <strong>Produits</strong> - Gérez votre catalogue et les stocks</Text>
            <Text size="sm">6. <strong>Factures</strong> - Générez des factures et suivez les paiements</Text>
            <Text size="sm">7. <strong>Règlements</strong> - Enregistrez les paiements clients</Text>

            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 2.0.0 - Gestion Commerciale Pro
            </Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default Dashboard;