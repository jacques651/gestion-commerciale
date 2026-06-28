// src/pages/revendeurs/DashboardRevendeurs.tsx
import { useEffect, useState } from "react";
import {
  Card,
  Grid,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Badge,
  Center,
  Tooltip,
  ThemeIcon
} from "@mantine/core";
import { IconInfoCircle, IconBuildingStore, IconTruck, IconCash } from "@tabler/icons-react";
import { getDb } from "../../../database/db";

interface DashboardRevendeur {
  idClient: number;
  NomComplet: string;
  Societe: string;
  nb_commandes: number;
  nb_decomptes: number;
  stock_total: number;
  valeur_stock: number;
  ventes_revendeur: number;      // CA du revendeur (montant_vente des décomptes)
  commission_totale: number;      // Commissions dues au revendeur
  ca_genere: number;              // CA généré pour l'entreprise (factures_revendeur)
  taux_commission_moyen: number;  // Commission moyenne en %
}

export default function DashboardRevendeurs() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardRevendeur[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const db = await getDb();

      const data = await db.select<DashboardRevendeur[]>(`
        SELECT
          c.idClient,
          c.NomComplet,
          c.Societe,
          
          -- Nombre de commandes
          (
            SELECT COUNT(*)
            FROM commandes cmd
            WHERE cmd.idClient = c.idClient
            AND cmd.type_commande = 'REVENDEUR'
          ) AS nb_commandes,
          
          -- Nombre de décomptes
          (
            SELECT COUNT(*)
            FROM decomptes d
            WHERE d.idClient = c.idClient
          ) AS nb_decomptes,
          
          -- Stock total (quantité)
          (
            SELECT COALESCE(SUM(sr.qte_stock), 0)
            FROM stock_revendeur sr
            WHERE sr.idRevendeur = c.idClient
          ) AS stock_total,
          
          -- Valeur du stock (prix d'achat)
          (
            SELECT COALESCE(SUM(sr.qte_stock * p.prix_achat_base), 0)
            FROM stock_revendeur sr
            INNER JOIN products p ON p.idProduit = sr.idProduit
            WHERE sr.idRevendeur = c.idClient
          ) AS valeur_stock,
          
          -- ✅ Ventes réalisées par le revendeur (CA du revendeur)
          (
            SELECT COALESCE(SUM(d.montant_vente), 0)
            FROM decomptes d
            WHERE d.idClient = c.idClient
          ) AS ventes_revendeur,
          
          -- ✅ Commissions dues au revendeur
          (
            SELECT COALESCE(SUM(d.montant_commission), 0)
            FROM decomptes d
            WHERE d.idClient = c.idClient
          ) AS commission_totale,
          
          -- ✅ CA généré pour l'entreprise (factures revendeur)
          (
            SELECT COALESCE(SUM(fr.montant_ttc), 0)
            FROM factures_revendeur fr
            WHERE fr.idRevendeur = c.idClient
          ) AS ca_genere,
          
          -- ✅ Taux de commission moyen
          (
            SELECT CASE 
              WHEN SUM(d.montant_vente) > 0 
              THEN (SUM(d.montant_commission) / SUM(d.montant_vente)) * 100
              ELSE 0
            END
            FROM decomptes d
            WHERE d.idClient = c.idClient
          ) AS taux_commission_moyen

        FROM clients c
        WHERE c.TypeClient = 'revendeur'
        ORDER BY ca_genere DESC
      `);

      setStats(data);
    } catch (error) {
      console.error("Erreur dashboard revendeurs", error);
    } finally {
      setLoading(false);
    }
  };

  // Totaux globaux
  const totalRevendeurs = stats.length;
  const totalStock = stats.reduce((sum, item) => sum + Number(item.stock_total || 0), 0);
  const totalValeurStock = stats.reduce((sum, item) => sum + Number(item.valeur_stock || 0), 0);
  const totalVentesRevendeur = stats.reduce((sum, item) => sum + Number(item.ventes_revendeur || 0), 0);
  const totalCommission = stats.reduce((sum, item) => sum + Number(item.commission_totale || 0), 0);
  const totalCAGenere = stats.reduce((sum, item) => sum + Number(item.ca_genere || 0), 0);

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Title order={2}>📊 Dashboard Revendeurs</Title>

      {/* Cartes de synthèse */}
      <Grid>
        <Grid.Col span={3}>
          <Card withBorder radius="md" shadow="sm">
            <Group>
              <ThemeIcon size="lg" color="blue" variant="light">
                <IconBuildingStore size={20} />
              </ThemeIcon>
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Revendeurs
                </Text>
                <Title order={3}>{totalRevendeurs}</Title>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card withBorder radius="md" shadow="sm">
            <Group>
              <ThemeIcon size="lg" color="teal" variant="light">
                <IconTruck size={20} />
              </ThemeIcon>
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Stock Total
                </Text>
                <Title order={3}>{totalStock.toLocaleString()}</Title>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card withBorder radius="md" shadow="sm">
            <Group>
              <ThemeIcon size="lg" color="orange" variant="light">
                <IconCash size={20} />
              </ThemeIcon>
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Valeur Stock
                </Text>
                <Title order={3}>{totalValeurStock.toLocaleString()} FCFA</Title>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={3}>
          <Card withBorder radius="md" shadow="sm" bg="green.0">
            <Group>
              <ThemeIcon size="lg" color="green" variant="filled">
                <IconCash size={20} />
              </ThemeIcon>
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  CA Généré (Entreprise)
                </Text>
                <Title order={3} c="green">
                  {totalCAGenere.toLocaleString()} FCFA
                </Title>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Deuxième ligne de cartes */}
      <Grid>
        <Grid.Col span={4}>
          <Card withBorder radius="md" shadow="sm">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Ventes Revendeurs
                </Text>
                <Title order={3} c="blue">
                  {totalVentesRevendeur.toLocaleString()} FCFA
                </Title>
              </div>
              <Tooltip label="Total des ventes réalisées par tous les revendeurs">
                <IconInfoCircle size={18} color="gray" />
              </Tooltip>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder radius="md" shadow="sm">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Commissions Totales
                </Text>
                <Title order={3} c="orange">
                  {totalCommission.toLocaleString()} FCFA
                </Title>
              </div>
              <Tooltip label="Total des commissions à reverser aux revendeurs">
                <IconInfoCircle size={18} color="gray" />
              </Tooltip>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={4}>
          <Card withBorder radius="md" shadow="sm" bg={totalCommission > 0 ? "yellow.0" : undefined}>
            <Group justify="space-between">
              <div>
                <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                  Taux de reversement moyen
                </Text>
                <Title order={3} c="violet">
                  {totalCAGenere > 0 ? ((totalCommission / totalCAGenere) * 100).toFixed(2) : 0}%
                </Title>
              </div>
              <Tooltip label="Pourcentage du CA reversé aux revendeurs sous forme de commissions">
                <IconInfoCircle size={18} color="gray" />
              </Tooltip>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Tableau détaillé */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Group mb="md" justify="space-between">
          <Group>
            <Badge color="blue" size="lg">Détail par revendeur</Badge>
            <Badge color="green" size="lg" variant="outline">
              Total CA: {totalCAGenere.toLocaleString()} FCFA
            </Badge>
          </Group>
        </Group>

        <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderBottom: '3px solid #e94560' }}>
              <Table.Th c="white">Revendeur</Table.Th>
              <Table.Th c="white" ta="center">Commandes</Table.Th>
              <Table.Th c="white" ta="center">Décomptes</Table.Th>
              <Table.Th c="white" ta="center">Stock</Table.Th>
              <Table.Th c="white" ta="right">Valeur Stock</Table.Th>
              <Table.Th c="white" ta="right">Ventes Revendeur</Table.Th>
              <Table.Th c="white" ta="right">Commission</Table.Th>
              <Table.Th c="white" ta="right">CA Généré</Table.Th>
              <Table.Th c="white" ta="center">Taux Comm.</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stats.map((row) => {
              const tauxCommission = row.ca_genere > 0 
                ? (row.commission_totale / row.ca_genere) * 100 
                : 0;
              
              return (
                <Table.Tr key={row.idClient}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text fw={600} size="sm">{row.NomComplet}</Text>
                      {row.Societe && (
                        <Text size="xs" c="dimmed">{row.Societe}</Text>
                      )}
                    </Stack>
                  </Table.Td>
                  
                  <Table.Td ta="center">
                    <Badge color="gray" variant="light" size="sm">
                      {row.nb_commandes}
                    </Badge>
                  </Table.Td>
                  
                  <Table.Td ta="center">
                    <Badge color="gray" variant="light" size="sm">
                      {row.nb_decomptes}
                    </Badge>
                  </Table.Td>
                  
                  <Table.Td ta="center">
                    {Number(row.stock_total).toLocaleString()}
                  </Table.Td>
                  
                  <Table.Td ta="right">
                    {Number(row.valeur_stock).toLocaleString()} FCFA
                  </Table.Td>
                  
                  <Table.Td ta="right">
                    <Text size="sm" c="blue">
                      {Number(row.ventes_revendeur).toLocaleString()} FCFA
                    </Text>
                  </Table.Td>
                  
                  <Table.Td ta="right">
                    <Text size="sm" c="orange">
                      {Number(row.commission_totale).toLocaleString()} FCFA
                    </Text>
                  </Table.Td>
                  
                  <Table.Td ta="right">
                    <Badge color="green" size="sm">
                      {Number(row.ca_genere).toLocaleString()} FCFA
                    </Badge>
                  </Table.Td>
                  
                  <Table.Td ta="center">
                    <Badge 
                      color={tauxCommission > 10 ? "red" : tauxCommission > 5 ? "yellow" : "green"} 
                      variant="light"
                      size="sm"
                    >
                      {tauxCommission.toFixed(1)}%
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {stats.length === 0 && (
          <Center py={50}>
            <Stack align="center">
              <IconBuildingStore size={50} color="gray" />
              <Text c="dimmed">Aucun revendeur trouvé</Text>
            </Stack>
          </Center>
        )}
      </Card>

      {/* Légende explicative */}
      <Card withBorder radius="md" bg="gray.0">
        <Group gap="xl" justify="center">
          <Tooltip label="Commandes passées par le revendeur chez le fournisseur">
            <Group gap="xs">
              <Badge color="gray" variant="light">Commandes</Badge>
              <Text size="xs">Commandes revendeur</Text>
            </Group>
          </Tooltip>
          
          <Tooltip label="Décomptes établis par le revendeur">
            <Group gap="xs">
              <Badge color="gray" variant="light">Décomptes</Badge>
              <Text size="xs">Périodes de déclaration</Text>
            </Group>
          </Tooltip>
          
          <Tooltip label="CA réalisé par le revendeur (ventes au client final)">
            <Group gap="xs">
              <Badge color="blue" variant="light">Ventes Revendeur</Badge>
              <Text size="xs">CA du revendeur</Text>
            </Group>
          </Tooltip>
          
          <Tooltip label="Commission due au revendeur sur ses ventes">
            <Group gap="xs">
              <Badge color="orange" variant="light">Commission</Badge>
              <Text size="xs">À reverser au revendeur</Text>
            </Group>
          </Tooltip>
          
          <Tooltip label="CA généré pour l'entreprise (ventes au revendeur)">
            <Group gap="xs">
              <Badge color="green" variant="light">CA Généré</Badge>
              <Text size="xs">CA de l'entreprise</Text>
            </Group>
          </Tooltip>
        </Group>
      </Card>
    </Stack>
  );
}