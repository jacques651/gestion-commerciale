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
  Avatar,
  Alert
} from '@mantine/core';
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
  IconCalendar,
  IconPercentage,
  IconAlertCircle,
  IconRefresh
} from '@tabler/icons-react';
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
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [stats, setStats] = useState({
    clients: 0,
    revendeurs: 0,
    produits: 0,
    commandes: 0,
    ventes: 0,
    decomptes: 0,
    factures: 0,
    chiffreAffaires: 0,
    commissions: 0,
    netAReverser: 0,
    encaissements: 0,
    resteARecouvrer: 0,
    commandesRevendeur: 0,
    stockCentral: 0,
    stockRevendeur: 0
  });

  const [recentDecomptes, setRecentDecomptes] = useState<any[]>([]);
  const [recentCommandes, setRecentCommandes] = useState<any[]>([]);
  const [recentVentes, setRecentVentes] = useState<any[]>([]);

  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Fonction pour vérifier si une colonne existe
  const columnExists = async (db: any, table: string, column: string): Promise<boolean> => {
    try {
      const result = (await db.select(`PRAGMA table_info(${table})`)) as any[];
      return result.some((col: any) => col.name === column);
    } catch (error) {
      console.warn(`Erreur vérification colonne ${table}.${column}:`, error);
      return false;
    }
  };

  // Fonction pour exécuter une requête avec gestion d'erreur
  const safeQuery = async (db: any, query: string, params?: any[]): Promise<any[]> => {
    try {
      return (await db.select(query, params || [])) as any[];
    } catch (error: any) {
      console.warn(`Erreur requête: ${query.substring(0, 100)}...`, error?.message || error);
      return [];
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      
      try {
        const db = await getDb();
        console.log('✅ Base de données connectée');

        // Vérifier la structure de la table decomptes
        const hasMontantVente = await columnExists(db, 'decomptes', 'montant_vente');
        const hasMontantCommission = await columnExists(db, 'decomptes', 'montant_commission');
        const hasTauxCommission = await columnExists(db, 'decomptes', 'taux_commission');
        
        console.log('Table decomptes - colonnes:', { hasMontantVente, hasMontantCommission, hasTauxCommission });

        // ============================================
        // 1. STATISTIQUES DE BASE
        // ============================================
        
        // Nombre de clients
        const clients = await safeQuery(db, `SELECT COUNT(*) as total FROM clients`);
        console.log('✅ Clients:', clients[0]?.total || 0);

        // Nombre de revendeurs
        const revendeurs = await safeQuery(db, `SELECT COUNT(*) as total FROM clients WHERE TypeClient = 'revendeur'`);
        console.log('✅ Revendeurs:', revendeurs[0]?.total || 0);

        // Produits actifs
        const produits = await safeQuery(db, `SELECT COUNT(*) as total FROM products WHERE est_supprime = 0`);
        console.log('✅ Produits:', produits[0]?.total || 0);

        // Nombre de commandes (non annulées)
        const commandes = await safeQuery(db, `SELECT COUNT(*) as total FROM commandes WHERE statut != 'ANNULEE'`);
        console.log('✅ Commandes:', commandes[0]?.total || 0);

        // Nombre de ventes
        const ventes = await safeQuery(db, `SELECT COUNT(*) as total FROM ventes`);
        console.log('✅ Ventes:', ventes[0]?.total || 0);

        // Nombre de décomptes
        const decomptes = await safeQuery(db, `SELECT COUNT(*) as total FROM decomptes`);
        console.log('✅ Décomptes:', decomptes[0]?.total || 0);

        // Nombre de factures
        const factures = await safeQuery(db, `SELECT COUNT(*) as total FROM factures`);
        console.log('✅ Factures:', factures[0]?.total || 0);

        // ============================================
        // 2. CHIFFRE D'AFFAIRES
        // ============================================
        
        const commandesCA = await safeQuery(db, `
          SELECT COALESCE(SUM(montant_ttc), 0) as total 
          FROM commandes 
          WHERE statut != 'ANNULEE'
        `);

        const ventesCA = await safeQuery(db, `
          SELECT COALESCE(SUM(montant_ttc), 0) as total 
          FROM ventes
        `);

        const totalCommandes = Number(commandesCA[0]?.total || 0);
        const totalVentes = Number(ventesCA[0]?.total || 0);
        const chiffreAffairesGlobal = totalCommandes + totalVentes;
        console.log('✅ Chiffre d\'affaires:', chiffreAffairesGlobal);

        // ============================================
        // 3. COMMISSIONS ET NET À REVERSER
        // ============================================
        
        let totalCommissions = 0;
        let netAReverser = 0;

        try {
          if (hasMontantVente && hasMontantCommission) {
            // Structure complète
            const commissions = await safeQuery(db, `
              SELECT COALESCE(SUM(montant_commission), 0) as total 
              FROM decomptes
            `);
            totalCommissions = Number(commissions[0]?.total || 0);
            console.log('✅ Commissions (direct):', totalCommissions);

            const net = await safeQuery(db, `
              SELECT COALESCE(SUM(montant_vente - montant_commission), 0) as total 
              FROM decomptes
            `);
            netAReverser = Number(net[0]?.total || 0);
            console.log('✅ Net à reverser (direct):', netAReverser);

          } else if (hasMontantVente && hasTauxCommission) {
            // Structure avec montant_vente et taux_commission
            const decomptesData = await safeQuery(db, `
              SELECT montant_vente, taux_commission 
              FROM decomptes
            `);
            
            for (const d of decomptesData) {
              if (d.montant_vente && d.taux_commission) {
                const commission = (d.montant_vente * d.taux_commission) / 100;
                totalCommissions += commission;
                netAReverser += d.montant_vente - commission;
              }
            }
            console.log('✅ Commissions (calculées):', totalCommissions);
            console.log('✅ Net à reverser (calculé):', netAReverser);

          } else if (hasTauxCommission) {
            // Structure avec taux_commission uniquement
            const details = await safeQuery(db, `
              SELECT 
                dd.idDecompte,
                dd.qte_decompte,
                dd.prix_vente,
                dd.prix_achat,
                d.taux_commission
              FROM decompte_details dd
              INNER JOIN decomptes d ON d.idDecompte = dd.idDecompte
            `);
            
            for (const det of details) {
              const beneficeLigne = ((det.prix_vente || 0) - (det.prix_achat || 0)) * (det.qte_decompte || 0);
              const taux = det.taux_commission || 60;
              const commission = (beneficeLigne * taux) / 100;
              totalCommissions += commission;
              netAReverser += beneficeLigne - commission;
            }
            console.log('✅ Commissions (détails):', totalCommissions);
            console.log('✅ Net à reverser (détails):', netAReverser);

          } else {
            // Structure sans commission
            const details = await safeQuery(db, `
              SELECT 
                dd.idDecompte,
                dd.qte_decompte,
                dd.prix_vente,
                dd.prix_achat
              FROM decompte_details dd
            `);
            
            for (const det of details) {
              const beneficeLigne = ((det.prix_vente || 0) - (det.prix_achat || 0)) * (det.qte_decompte || 0);
              const commission = (beneficeLigne * 60) / 100;
              totalCommissions += commission;
              netAReverser += beneficeLigne - commission;
            }
            console.log('✅ Commissions (défaut 60%):', totalCommissions);
            console.log('✅ Net à reverser (défaut):', netAReverser);
          }
        } catch (commissionError: any) {
          console.error('❌ Erreur calcul commissions:', commissionError);
          // On continue avec les valeurs par défaut (0)
        }

        // ============================================
        // 4. FINANCES
        // ============================================
        
        const encaissements = await safeQuery(db, `
          SELECT COALESCE(SUM(montant), 0) as total 
          FROM reglements
        `);
        console.log('✅ Encaissements:', encaissements[0]?.total || 0);

        const facturesImpayees = await safeQuery(db, `
          SELECT COALESCE(SUM(montant_ttc), 0) as total 
          FROM factures 
          WHERE statut IN ('EN_ATTENTE', 'PARTIELLEMENT_REGLEE')
        `);
        console.log('✅ Factures impayées:', facturesImpayees[0]?.total || 0);

        // ============================================
        // 5. COMMANDES REVENDEURS
        // ============================================
        
        const commandesRevendeur = await safeQuery(db, `
          SELECT COUNT(*) as total 
          FROM commandes 
          WHERE UPPER(type_commande) = 'REVENDEUR' 
          AND statut != 'ANNULEE'
        `);
        console.log('✅ Commandes revendeurs:', commandesRevendeur[0]?.total || 0);

        // ============================================
        // 6. STOCKS
        // ============================================
        
        const stockCentral = await safeQuery(db, `
          SELECT COALESCE(SUM(qte_stock), 0) as total 
          FROM products 
          WHERE est_supprime = 0
        `);
        console.log('✅ Stock central:', stockCentral[0]?.total || 0);

        const stockRevendeur = await safeQuery(db, `
          SELECT COALESCE(SUM(qte_stock), 0) as total 
          FROM stock_revendeur
        `);
        console.log('✅ Stock revendeur:', stockRevendeur[0]?.total || 0);

        // ============================================
        // 7. MISE À JOUR DES STATS
        // ============================================
        
        setStats({
          clients: Number(clients[0]?.total || 0),
          revendeurs: Number(revendeurs[0]?.total || 0),
          produits: Number(produits[0]?.total || 0),
          commandes: Number(commandes[0]?.total || 0),
          ventes: Number(ventes[0]?.total || 0),
          decomptes: Number(decomptes[0]?.total || 0),
          factures: Number(factures[0]?.total || 0),
          chiffreAffaires: chiffreAffairesGlobal,
          commissions: totalCommissions,
          netAReverser: netAReverser,
          encaissements: Number(encaissements[0]?.total || 0),
          resteARecouvrer: Number(facturesImpayees[0]?.total || 0),
          commandesRevendeur: Number(commandesRevendeur[0]?.total || 0),
          stockCentral: Number(stockCentral[0]?.total || 0),
          stockRevendeur: Number(stockRevendeur[0]?.total || 0)
        });

        // ============================================
        // 8. DERNIERS DÉCOMPTES
        // ============================================
        
        let lastDecomptesQuery = `
          SELECT
            d.idDecompte,
            d.code_decompte,
            d.date_decompte,
            c.NomComplet
        `;

        if (hasMontantVente) {
          lastDecomptesQuery += `, d.montant_vente`;
        } else {
          lastDecomptesQuery += `, 0 as montant_vente`;
        }

        if (hasMontantCommission) {
          lastDecomptesQuery += `, d.montant_commission`;
        } else {
          lastDecomptesQuery += `, 0 as montant_commission`;
        }

        lastDecomptesQuery += `
          FROM decomptes d
          INNER JOIN clients c ON c.idClient = d.idClient
          ORDER BY d.idDecompte DESC
          LIMIT 10
        `;

        const lastDecomptes = await safeQuery(db, lastDecomptesQuery);
        setRecentDecomptes(lastDecomptes || []);
        console.log('✅ Derniers décomptes:', lastDecomptes.length);

        // ============================================
        // 9. DERNIÈRES COMMANDES
        // ============================================
        
        const lastCommandes = await safeQuery(db, `
          SELECT
            c.idCommande,
            c.code_commande,
            c.date_commande,
            c.montant_ttc,
            c.statut,
            c.type_commande,
            cl.NomComplet as client_nom,
            cl.Societe as client_societe
          FROM commandes c
          LEFT JOIN clients cl ON cl.idClient = c.idClient
          ORDER BY c.idCommande DESC
          LIMIT 5
        `);
        setRecentCommandes(lastCommandes || []);
        console.log('✅ Dernières commandes:', lastCommandes.length);

        // ============================================
        // 10. DERNIÈRES VENTES
        // ============================================
        
        const lastVentes = await safeQuery(db, `
          SELECT
            v.code_vente,
            v.date_vente,
            v.montant_ttc,
            v.type_vente,
            c.NomComplet as client_nom,
            c.Societe as client_societe
          FROM ventes v
          LEFT JOIN clients c ON c.idClient = v.idClient
          ORDER BY v.idVente DESC
          LIMIT 10
        `);
        setRecentVentes(lastVentes || []);
        console.log('✅ Dernières ventes:', lastVentes.length);

        console.log('✅ Toutes les statistiques chargées avec succès');

      } catch (error: any) {
        console.error("❌ Erreur fatale dashboard:", error);
        const errorMsg = error?.message || 'Erreur inconnue';
        setError("Impossible de charger les statistiques");
        setErrorDetails(errorMsg);
        
        notifications.show({
          title: "Erreur",
          message: `Impossible de charger les statistiques: ${errorMsg}`,
          color: "red",
          autoClose: 10000
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

  if (error) {
    return (
      <Card withBorder radius="md" p="lg" style={{ minHeight: 300 }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={60} radius="xl" color="red" variant="light">
            <IconAlertCircle size={30} />
          </ThemeIcon>
          <Text size="lg" fw={600} c="red">{error}</Text>
          {errorDetails && (
            <Alert color="red" variant="light" style={{ maxWidth: 500 }}>
              <Text size="xs" c="dimmed">Détails: {errorDetails}</Text>
            </Alert>
          )}
          <Text c="dimmed" ta="center" size="sm">
            Vérifiez la console pour plus de détails
          </Text>
          <Group>
            <Button 
              variant="light" 
              color="blue"
              leftSection={<IconRefresh size={16} />}
              onClick={() => window.location.reload()}
            >
              Réessayer
            </Button>
            <Button 
              variant="subtle"
              onClick={() => {
                setError(null);
                setErrorDetails(null);
                window.location.reload();
              }}
            >
              Ignorer
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  // Le reste du JSX est identique...
  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER */}
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

        {/* SECTION DÉCOMPTES REVENDEURS */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="violet" variant="light" size="sm">
              <IconFileInvoice size={16} />
            </ThemeIcon>
            <Text fw={600}>📊 Suivi Revendeurs</Text>
            <Badge color="violet" variant="light">Décomptes</Badge>
          </Group>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">Nombre de décomptes</Text>
              <Text fw={700} size="xl">{stats.decomptes}</Text>
            </Card>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">Total commissions</Text>
              <Text fw={700} size="xl" c="orange">{formatCurrency(stats.commissions)}</Text>
            </Card>
            <Card withBorder radius="md" p="sm">
              <Text size="xs" c="dimmed">Net à reverser</Text>
              <Text fw={700} size="xl" c="green">{formatCurrency(stats.netAReverser)}</Text>
            </Card>
          </SimpleGrid>
        </Card>

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
                <Text size="sm" c="dimmed">Chiffre d'affaires (Commandes + Ventes)</Text>
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

        {/* DERNIERS DÉCOMPTES */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="grape" variant="light" size="sm">
              <IconPercentage size={16} />
            </ThemeIcon>
            <Text fw={600}>📋 Derniers décomptes revendeurs</Text>
            <Badge color="grape" variant="light">10 derniers</Badge>
          </Group>
          <Divider mb="md" />
          <ScrollArea h={250}>
            <Stack gap="xs">
              {recentDecomptes.length === 0 ? (
                <Text ta="center" size="sm" c="dimmed">Aucun décompte récent</Text>
              ) : (
                recentDecomptes.map((d, i) => (
                  <Group key={i} justify="space-between" wrap="wrap" p="xs" style={{ borderBottom: '1px solid #e9ecef' }}>
                    <div>
                      <Text size="sm" fw={500}>{d.code_decompte}</Text>
                      <Text size="xs" c="dimmed">{d.NomComplet || 'Revendeur inconnu'}</Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {d.montant_vente !== undefined && d.montant_vente > 0 && (
                        <Text size="xs" c="dimmed">Ventes: {formatCurrency(d.montant_vente || 0)}</Text>
                      )}
                      {d.montant_commission !== undefined && d.montant_commission > 0 && (
                        <Text size="xs" c="orange">Commission: {formatCurrency(d.montant_commission || 0)}</Text>
                      )}
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
            <Text size="sm">8. <strong>Décomptes</strong> - Suivez les commissions des revendeurs</Text>

            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              Version 3.0.0 - Gestion Commerciale Pro
            </Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default Dashboard;