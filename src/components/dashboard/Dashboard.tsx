// src/components/dashboard/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack, Card, Title, Text, Group, SimpleGrid, ThemeIcon, Badge,
  LoadingOverlay, Button, Box, Paper, Avatar, Alert, ActionIcon,
  Divider, Progress, Tooltip
} from '@mantine/core';
import {
  IconUsers, IconShoppingBag, IconBuildingStore, IconPackage,
  IconReceipt, IconCash, IconTruck, IconFileInvoice,
  IconTrendingUp, IconTrendingDown, IconAlertCircle, IconRefresh,
  IconPlus, IconChartBar, IconShoppingCart, IconUserPlus,
  IconReceipt2, IconArrowRight
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../database/db';
import { notifications } from '@mantine/notifications';

type PageKey =
  | 'dashboard' | 'clients' | 'commandes' | 'factures' | 'ventes'
  | 'products' | 'stock' | 'decomptes' | 'reglements' | 'utilisateurs'
  | 'parametres' | 'commandes-revendeur';

interface DashboardProps {
  setPage?: (page: PageKey) => void;
}

const formatCurrency = (v?: number) =>
  `${(v || 0).toLocaleString('fr-FR')} FCFA`;

const formatDate = () => {
  const now = new Date();
  return now.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
};

const Dashboard: React.FC<DashboardProps> = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    clients: 0, revendeurs: 0, produits: 0, commandes: 0,
    ventes: 0, decomptes: 0, factures: 0, chiffreAffaires: 0,
    commissions: 0, netAReverser: 0, encaissements: 0,
    resteARecouvrer: 0, commandesRevendeur: 0,
    stockCentral: 0, stockRevendeur: 0,
    facturesEnAttente: 0, commandesEnAttente: 0,
  });

  const [recentCommandes, setRecentCommandes] = useState<any[]>([]);
  const [recentVentes, setRecentVentes] = useState<any[]>([]);
  const [recentDecomptes, setRecentDecomptes] = useState<any[]>([]);
  const [produitsAlerte, setProduitsAlerte] = useState<any[]>([]);

  const safeQuery = async (db: any, query: string, params?: any[]): Promise<any[]> => {
    try { return (await db.select(query, params || [])) as any[]; }
    catch { return []; }
  };

  const columnExists = async (db: any, table: string, column: string): Promise<boolean> => {
    try {
      const result = (await db.select(`PRAGMA table_info(${table})`)) as any[];
      return result.some((col: any) => col.name === column);
    } catch { return false; }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      const hasMontantVente = await columnExists(db, 'decomptes', 'montant_vente');
      const hasMontantCommission = await columnExists(db, 'decomptes', 'montant_commission');
      const hasTauxCommission = await columnExists(db, 'decomptes', 'taux_commission');

      const [clients, revendeurs, produits, commandes, ventes, decomptes, factures] = await Promise.all([
        safeQuery(db, `SELECT COUNT(*) as total FROM clients`),
        safeQuery(db, `SELECT COUNT(*) as total FROM clients WHERE TypeClient = 'revendeur'`),
        safeQuery(db, `SELECT COUNT(*) as total FROM products WHERE est_supprime = 0`),
        safeQuery(db, `SELECT COUNT(*) as total FROM commandes WHERE statut != 'ANNULEE'`),
        safeQuery(db, `SELECT COUNT(*) as total FROM ventes`),
        safeQuery(db, `SELECT COUNT(*) as total FROM decomptes`),
        safeQuery(db, `SELECT COUNT(*) as total FROM factures`),
      ]);

      const [commandesCA, ventesCA, encaissements, facturesImpayees,
             commandesRevendeur, commandesEnAttente, facturesEnAttente,
             stockCentral, stockRevendeur] = await Promise.all([
        safeQuery(db, `SELECT COALESCE(SUM(montant_ttc), 0) as total FROM commandes WHERE statut != 'ANNULEE'`),
        safeQuery(db, `SELECT COALESCE(SUM(montant_ttc), 0) as total FROM ventes`),
        safeQuery(db, `SELECT COALESCE(SUM(montant), 0) as total FROM reglements`),
        safeQuery(db, `SELECT COALESCE(SUM(montant_ttc), 0) as total FROM factures WHERE statut IN ('EN_ATTENTE', 'PARTIELLEMENT_REGLEE')`),
        safeQuery(db, `SELECT COUNT(*) as total FROM commandes WHERE UPPER(type_commande) = 'REVENDEUR' AND statut != 'ANNULEE'`),
        safeQuery(db, `SELECT COUNT(*) as total FROM commandes WHERE statut NOT IN ('LIVREE','ANNULEE')`),
        safeQuery(db, `SELECT COUNT(*) as total FROM factures WHERE statut = 'EN_ATTENTE'`),
        safeQuery(db, `SELECT COALESCE(SUM(qte_stock), 0) as total FROM products WHERE est_supprime = 0`),
        safeQuery(db, `SELECT COALESCE(SUM(qte_stock), 0) as total FROM stock_revendeur`),
      ]);

      let totalCommissions = 0, netAReverser = 0;
      try {
        if (hasMontantVente && hasMontantCommission) {
          const [c, n] = await Promise.all([
            safeQuery(db, `SELECT COALESCE(SUM(montant_commission), 0) as total FROM decomptes`),
            safeQuery(db, `SELECT COALESCE(SUM(montant_vente - montant_commission), 0) as total FROM decomptes`),
          ]);
          totalCommissions = Number(c[0]?.total || 0);
          netAReverser = Number(n[0]?.total || 0);
        } else if (hasMontantVente && hasTauxCommission) {
          const data = await safeQuery(db, `SELECT montant_vente, taux_commission FROM decomptes`);
          for (const d of data) {
            if (d.montant_vente && d.taux_commission) {
              const comm = (d.montant_vente * d.taux_commission) / 100;
              totalCommissions += comm;
              netAReverser += d.montant_vente - comm;
            }
          }
        }
      } catch { /* silencieux */ }

      const chiffreAffaires = Number(commandesCA[0]?.total || 0) + Number(ventesCA[0]?.total || 0);

      setStats({
        clients: Number(clients[0]?.total || 0),
        revendeurs: Number(revendeurs[0]?.total || 0),
        produits: Number(produits[0]?.total || 0),
        commandes: Number(commandes[0]?.total || 0),
        ventes: Number(ventes[0]?.total || 0),
        decomptes: Number(decomptes[0]?.total || 0),
        factures: Number(factures[0]?.total || 0),
        chiffreAffaires,
        commissions: totalCommissions,
        netAReverser,
        encaissements: Number(encaissements[0]?.total || 0),
        resteARecouvrer: Number(facturesImpayees[0]?.total || 0),
        commandesRevendeur: Number(commandesRevendeur[0]?.total || 0),
        stockCentral: Number(stockCentral[0]?.total || 0),
        stockRevendeur: Number(stockRevendeur[0]?.total || 0),
        facturesEnAttente: Number(facturesEnAttente[0]?.total || 0),
        commandesEnAttente: Number(commandesEnAttente[0]?.total || 0),
      });

      // Produits en alerte stock
      const alertProduits = await safeQuery(db, `
        SELECT designation, code_produit, qte_stock, seuil_alerte, unite_base
        FROM products
        WHERE est_supprime = 0
          AND seuil_alerte > 0
          AND qte_stock <= seuil_alerte
        ORDER BY qte_stock ASC
        LIMIT 8
      `);
      setProduitsAlerte(alertProduits);

      const [lastCommandes, lastVentes, lastDecomptes] = await Promise.all([
        safeQuery(db, `
          SELECT c.code_commande, c.date_commande, c.montant_ttc, c.statut, c.type_commande,
                 cl.NomComplet as client_nom, cl.Societe as client_societe
          FROM commandes c LEFT JOIN clients cl ON cl.idClient = c.idClient
          ORDER BY c.idCommande DESC LIMIT 6`),
        safeQuery(db, `
          SELECT v.code_vente, v.date_vente, v.montant_ttc, v.type_vente,
                 c.NomComplet as client_nom, c.Societe as client_societe
          FROM ventes v LEFT JOIN clients c ON c.idClient = v.idClient
          ORDER BY v.idVente DESC LIMIT 6`),
        hasMontantVente
          ? safeQuery(db, `
              SELECT d.code_decompte, d.date_decompte, d.montant_vente, d.montant_commission,
                     c.NomComplet FROM decomptes d
              INNER JOIN clients c ON c.idClient = d.idClient
              ORDER BY d.idDecompte DESC LIMIT 5`)
          : [],
      ]);

      setRecentCommandes(lastCommandes);
      setRecentVentes(lastVentes);
      setRecentDecomptes(lastDecomptes);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
      notifications.show({ title: 'Erreur', message: 'Impossible de charger le tableau de bord', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const tauxRecouvrement = stats.chiffreAffaires > 0
    ? Math.min((stats.encaissements / stats.chiffreAffaires) * 100, 100)
    : 0;

  const getStatusBadge = (statut: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CONFIRMEE: { color: 'blue', label: 'Confirmée' },
      LIVREE: { color: 'green', label: 'Livrée' },
      ANNULEE: { color: 'red', label: 'Annulée' },
      BROUILLON: { color: 'gray', label: 'Brouillon' },
      FACTUREE: { color: 'teal', label: 'Facturée' },
    };
    const s = map[statut] || { color: 'gray', label: statut };
    return <Badge size="xs" color={s.color} variant="light">{s.label}</Badge>;
  };

  if (loading) {
    return (
      <Box p="md" pos="relative" style={{ minHeight: 400 }}>
        <LoadingOverlay visible />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Alert icon={<IconAlertCircle size={18} />} color="red" title="Erreur de chargement">
          {error}
          <Button size="xs" mt="sm" leftSection={<IconRefresh size={14} />} onClick={loadData}>
            Réessayer
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Stack gap="md">

        {/* ── BANDEAU HAUT ───────────────────────────────── */}
        <Paper
          p="md"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #122040 60%, #1b365d 100%)',
            border: 'none',
          }}
        >
          <Group justify="space-between" mb="md" wrap="wrap">
            <Box>
              <Text size="xs" c="rgba(255,255,255,0.5)" tt="uppercase" style={{ letterSpacing: 1 }}>
                {formatDate()}
              </Text>
              <Title order={2} c="white" style={{ fontSize: 22, fontWeight: 700 }}>
                Tableau de bord
              </Title>
            </Box>
            <Tooltip label="Actualiser">
              <ActionIcon
                variant="subtle"
                onClick={loadData}
                size="lg"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* 4 métriques clés inline */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {[
              { label: "Chiffre d'affaires", value: formatCurrency(stats.chiffreAffaires), icon: <IconChartBar size={16} />, color: '#f4b400' },
              { label: 'Encaissements', value: formatCurrency(stats.encaissements), icon: <IconCash size={16} />, color: '#40c057' },
              { label: 'Impayés', value: formatCurrency(stats.resteARecouvrer), icon: <IconAlertCircle size={16} />, color: stats.resteARecouvrer > 0 ? '#f97316' : '#40c057' },
              { label: 'Recouvrement', value: `${tauxRecouvrement.toFixed(0)}%`, icon: tauxRecouvrement >= 80 ? <IconTrendingUp size={16} /> : <IconTrendingDown size={16} />, color: tauxRecouvrement >= 80 ? '#40c057' : '#f97316' },
            ].map((m, i) => (
              <Box key={i} p="xs" style={{ borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
                <Group gap={6} mb={4}>
                  <Box style={{ color: m.color }}>{m.icon}</Box>
                  <Text size="xs" c="rgba(255,255,255,0.5)">{m.label}</Text>
                </Group>
                <Text fw={700} c="white" size="sm" style={{ fontSize: 15 }}>{m.value}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>

        {/* ── ACTIONS RAPIDES ─────────────────────────────── */}
        <Card withBorder radius="lg" p="md">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="sm" style={{ letterSpacing: 0.8 }}>
            Actions rapides
          </Text>
          <Group gap="sm" wrap="wrap">
            <Button
              leftSection={<IconPlus size={15} />}
              variant="gradient"
              gradient={{ from: 'teal', to: 'cyan' }}
              size="sm"
              onClick={() => navigate('/ventes')}
            >
              Nouvelle vente
            </Button>
            <Button
              leftSection={<IconShoppingCart size={15} />}
              variant="gradient"
              gradient={{ from: 'blue', to: 'indigo' }}
              size="sm"
              onClick={() => navigate('/commandes/nouveau')}
            >
              Nouvelle commande
            </Button>
            <Button
              leftSection={<IconUserPlus size={15} />}
              variant="light"
              color="violet"
              size="sm"
              onClick={() => navigate('/clients')}
            >
              Nouveau client
            </Button>
            <Button
              leftSection={<IconReceipt2 size={15} />}
              variant="light"
              color="orange"
              size="sm"
              onClick={() => navigate('/decomptes/nouveau')}
            >
              Nouveau décompte
            </Button>
            <Button
              leftSection={<IconCash size={15} />}
              variant="light"
              color="green"
              size="sm"
              onClick={() => navigate('/caisse')}
            >
              Journal de caisse
            </Button>
          </Group>
        </Card>

        {/* ── INDICATEURS MÉTIER (compacts) ───────────────── */}
        <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="sm">
          {[
            { label: 'Clients', value: stats.clients, icon: <IconUsers size={16} />, color: 'blue', to: '/clients' },
            { label: 'Produits', value: stats.produits, icon: <IconPackage size={16} />, color: 'grape', to: '/products' },
            { label: 'Commandes', value: stats.commandes, icon: <IconShoppingBag size={16} />, color: 'orange', to: '/commandes', alert: stats.commandesEnAttente > 0 ? stats.commandesEnAttente : undefined },
            { label: 'Ventes', value: stats.ventes, icon: <IconBuildingStore size={16} />, color: 'teal', to: '/ventes' },
            { label: 'Factures', value: stats.factures, icon: <IconFileInvoice size={16} />, color: 'cyan', to: '/factures', alert: stats.facturesEnAttente > 0 ? stats.facturesEnAttente : undefined },
            { label: 'Décomptes', value: stats.decomptes, icon: <IconReceipt size={16} />, color: 'violet', to: '/decomptes' },
          ].map((item, i) => (
            <Card
              key={i}
              withBorder
              p="sm"
              radius="md"
              style={{ cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => navigate(item.to)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <Group justify="space-between" mb={4}>
                <ThemeIcon size={28} color={item.color} variant="light" radius="md">
                  {item.icon}
                </ThemeIcon>
                {item.alert !== undefined && (
                  <Badge size="xs" color="red" variant="filled" circle>{item.alert}</Badge>
                )}
              </Group>
              <Text fw={700} size="xl" lh={1}>{item.value}</Text>
              <Text size="xs" c="dimmed" mt={2}>{item.label}</Text>
            </Card>
          ))}
        </SimpleGrid>

        {/* ── ACTIVITÉ RÉCENTE ─────────────────────────────── */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">

          {/* Dernières commandes */}
          <Card withBorder radius="lg" p={0}>
            <Group p="md" pb="xs" justify="space-between">
              <Group gap="xs">
                <ThemeIcon size={22} color="blue" variant="light" radius="md">
                  <IconShoppingBag size={13} />
                </ThemeIcon>
                <Text size="sm" fw={600}>Commandes récentes</Text>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                color="blue"
                rightSection={<IconArrowRight size={12} />}
                onClick={() => navigate('/commandes')}
              >
                Tout voir
              </Button>
            </Group>
            <Divider />
            <Stack gap={0}>
              {recentCommandes.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text size="sm" c="dimmed">Aucune commande</Text>
                  <Button size="xs" mt="sm" variant="light" leftSection={<IconPlus size={12} />}
                    onClick={() => navigate('/commandes/nouveau')}>
                    Créer une commande
                  </Button>
                </Box>
              ) : recentCommandes.map((c, i) => (
                <Group
                  key={i}
                  p="sm"
                  justify="space-between"
                  wrap="nowrap"
                  style={{
                    borderBottom: i < recentCommandes.length - 1 ? '1px solid #f1f3f5' : 'none',
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar size={28} radius="xl" color="blue" style={{ fontSize: 11, flexShrink: 0 }}>
                      {(c.client_nom || c.client_societe || 'C').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} truncate>{c.code_commande}</Text>
                      <Text size="xs" c="dimmed" truncate>{c.client_nom || c.client_societe || 'Client inconnu'}</Text>
                    </Box>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    {getStatusBadge(c.statut)}
                    <Text size="xs" fw={600} c="green" style={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(c.montant_ttc)}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>

          {/* Dernières ventes */}
          <Card withBorder radius="lg" p={0}>
            <Group p="md" pb="xs" justify="space-between">
              <Group gap="xs">
                <ThemeIcon size={22} color="teal" variant="light" radius="md">
                  <IconBuildingStore size={13} />
                </ThemeIcon>
                <Text size="sm" fw={600}>Ventes récentes</Text>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                color="teal"
                rightSection={<IconArrowRight size={12} />}
                onClick={() => navigate('/ventes')}
              >
                Tout voir
              </Button>
            </Group>
            <Divider />
            <Stack gap={0}>
              {recentVentes.length === 0 ? (
                <Box p="xl" ta="center">
                  <Text size="sm" c="dimmed">Aucune vente enregistrée</Text>
                  <Button size="xs" mt="sm" variant="light" color="teal" leftSection={<IconPlus size={12} />}
                    onClick={() => navigate('/ventes')}>
                    Nouvelle vente
                  </Button>
                </Box>
              ) : recentVentes.map((v, i) => (
                <Group
                  key={i}
                  p="sm"
                  justify="space-between"
                  wrap="nowrap"
                  style={{
                    borderBottom: i < recentVentes.length - 1 ? '1px solid #f1f3f5' : 'none',
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Avatar size={28} radius="xl" color="teal" style={{ fontSize: 11, flexShrink: 0 }}>
                      {(v.client_nom || v.client_societe || 'C').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} truncate>{v.code_vente}</Text>
                      <Text size="xs" c="dimmed" truncate>{v.client_nom || v.client_societe || 'Vente comptoir'}</Text>
                    </Box>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Badge size="xs" color={v.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light">
                      {v.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Revendeur'}
                    </Badge>
                    <Text size="xs" fw={600} c="green" style={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(v.montant_ttc)}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        </SimpleGrid>

        {/* ── ALERTES STOCK ───────────────────────────────── */}
        {produitsAlerte.length > 0 && (
          <Card withBorder radius="lg" p={0} style={{ borderColor: '#f59f00' }}>
            <Group p="md" pb="xs" justify="space-between" style={{ borderBottom: '1px solid #fff3bf' }}>
              <Group gap="xs">
                <ThemeIcon size={22} color="orange" variant="light" radius="md">
                  <IconAlertCircle size={13} />
                </ThemeIcon>
                <Text size="sm" fw={600} c="orange.7">Alertes stock</Text>
                <Badge size="xs" color="orange" variant="filled">{produitsAlerte.length}</Badge>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                color="orange"
                rightSection={<IconArrowRight size={12} />}
                onClick={() => navigate('/products')}
              >
                Gérer les stocks
              </Button>
            </Group>
            <Stack gap={0}>
              {produitsAlerte.map((p, i) => (
                <Group
                  key={i}
                  p="sm"
                  justify="space-between"
                  wrap="nowrap"
                  style={{
                    borderBottom: i < produitsAlerte.length - 1 ? '1px solid #f8f9fa' : 'none',
                    backgroundColor: p.qte_stock <= 0 ? '#fff5f5' : 'transparent',
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon size={22} color={p.qte_stock <= 0 ? 'red' : 'orange'} variant="light" radius="md">
                      <IconPackage size={12} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} truncate>{p.designation}</Text>
                      <Text size="xs" c="dimmed">{p.code_produit}</Text>
                    </Box>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed">Seuil: {p.seuil_alerte} {p.unite_base}</Text>
                    <Badge
                      size="sm"
                      color={p.qte_stock <= 0 ? 'red' : 'orange'}
                      variant={p.qte_stock <= 0 ? 'filled' : 'light'}
                    >
                      {p.qte_stock <= 0 ? 'Rupture' : `${p.qte_stock} ${p.unite_base}`}
                    </Badge>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* ── SITUATION FINANCIÈRE ─────────────────────────── */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder radius="lg" p="md">
            <Group gap="xs" mb="md">
              <ThemeIcon size={22} color="green" variant="light" radius="md">
                <IconCash size={13} />
              </ThemeIcon>
              <Text size="sm" fw={600}>Situation financière</Text>
            </Group>
            <Stack gap="xs">
              {[
                { label: "CA total (commandes + ventes)", value: stats.chiffreAffaires, color: 'blue' },
                { label: "Encaissements reçus", value: stats.encaissements, color: 'green' },
                { label: "Factures impayées", value: stats.resteARecouvrer, color: 'orange' },
              ].map((row, i) => (
                <Group key={i} justify="space-between">
                  <Text size="xs" c="dimmed">{row.label}</Text>
                  <Text size="xs" fw={700} c={row.color}>{formatCurrency(row.value)}</Text>
                </Group>
              ))}
              <Divider my={4} />
              <Box>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">Taux de recouvrement</Text>
                  <Text size="xs" fw={700} c={tauxRecouvrement >= 80 ? 'green' : 'orange'}>
                    {tauxRecouvrement.toFixed(1)}%
                  </Text>
                </Group>
                <Progress
                  value={tauxRecouvrement}
                  color={tauxRecouvrement >= 80 ? 'green' : tauxRecouvrement >= 50 ? 'yellow' : 'red'}
                  size="sm"
                  radius="xl"
                />
              </Box>
            </Stack>
          </Card>

          {/* Revendeurs */}
          <Card withBorder radius="lg" p="md">
            <Group gap="xs" mb="md" justify="space-between">
              <Group gap="xs">
                <ThemeIcon size={22} color="violet" variant="light" radius="md">
                  <IconTruck size={13} />
                </ThemeIcon>
                <Text size="sm" fw={600}>Revendeurs</Text>
              </Group>
              <Button size="xs" variant="subtle" color="violet" rightSection={<IconArrowRight size={12} />}
                onClick={() => navigate('/decomptes')}>
                Décomptes
              </Button>
            </Group>
            <SimpleGrid cols={3} spacing="xs" mb="md">
              {[
                { label: 'Revendeurs', value: stats.revendeurs, color: 'violet' },
                { label: 'Commissions', value: formatCurrency(stats.commissions), color: 'orange' },
                { label: 'Net reversé', value: formatCurrency(stats.netAReverser), color: 'green' },
              ].map((item, i) => (
                <Box key={i} p="xs" style={{ background: '#f8f9fa', borderRadius: 8, textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" lh={1.2}>{item.label}</Text>
                  <Text size="xs" fw={700} c={item.color} mt={4}>{item.value}</Text>
                </Box>
              ))}
            </SimpleGrid>
            {recentDecomptes.length > 0 && (
              <>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: 0.5 }}>
                  Derniers décomptes
                </Text>
                <Stack gap={4}>
                  {recentDecomptes.slice(0, 4).map((d, i) => (
                    <Group key={i} justify="space-between" p="xs" style={{ background: '#f8f9fa', borderRadius: 6 }}>
                      <Box>
                        <Text size="xs" fw={600}>{d.code_decompte}</Text>
                        <Text size="xs" c="dimmed">{d.NomComplet || '—'}</Text>
                      </Box>
                      {d.montant_vente > 0 && (
                        <Text size="xs" fw={600} c="green">{formatCurrency(d.montant_vente)}</Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              </>
            )}
            {recentDecomptes.length === 0 && (
              <Box ta="center" py="sm">
                <Text size="xs" c="dimmed">Aucun décompte enregistré</Text>
                <Button size="xs" mt="xs" variant="light" color="violet" leftSection={<IconPlus size={12} />}
                  onClick={() => navigate('/decomptes/nouveau')}>
                  Créer un décompte
                </Button>
              </Box>
            )}
          </Card>
        </SimpleGrid>

      </Stack>
    </Box>
  );
};

export default Dashboard;
