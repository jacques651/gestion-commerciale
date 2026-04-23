import React, { useEffect, useState } from "react";
import { Stack, Card, Title, Text, Group, Table, Badge, LoadingOverlay, Box, ThemeIcon, SimpleGrid, Modal, Button, Divider, Alert } from "@mantine/core";
import { IconPackage, IconInfoCircle, IconAlertTriangle, IconCash } from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface StockProduit {
  idProduit: number;
  code_produit: string;
  designation: string;
  categorie: string;
  unite_base: string;
  qte_stock: number;
  prix_vente_detail: number;
  seuil_alerte: number;
  valeur_stock: number;
}

const StockGlobal: React.FC = () => {
  const [stock, setStock] = useState<StockProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const chargerStock = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<StockProduit[]>(`
      SELECT 
        p.idProduit, p.code_produit, p.designation, p.categorie, 
        p.unite_base, p.qte_stock, p.prix_vente_detail, p.seuil_alerte,
        (p.qte_stock * p.prix_vente_detail) as valeur_stock
      FROM products p
      WHERE p.est_supprime = 0
      ORDER BY p.designation
    `);
    setStock(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerStock(); }, []);

  const totalValeur = stock.reduce((sum, p) => sum + p.valeur_stock, 0);
  const produitsEnAlerte = stock.filter(p => p.qte_stock <= p.seuil_alerte).length;
  const produitsRupture = stock.filter(p => p.qte_stock <= 0).length;

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}><Group gap="xs"><IconPackage size={24} color="white" /><Title order={2} c="white">Stock global</Title></Group><Text size="sm" c="gray.3">État des stocks de produits</Text></Stack>
            <Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconPackage size={28} /></ThemeIcon></Group>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Produits en stock</Text><ThemeIcon size={30} color="blue" variant="light"><IconPackage size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{stock.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="green.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Valeur du stock</Text><ThemeIcon size={30} color="green" variant="light"><IconCash size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{totalValeur.toLocaleString()} FCFA</Text></Card>
          <Card withBorder radius="md" p="md" bg={produitsEnAlerte > 0 ? "red.0" : "green.0"}><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Alertes stock</Text><ThemeIcon size={30} color={produitsEnAlerte > 0 ? "red" : "green"} variant="light"><IconAlertTriangle size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c={produitsEnAlerte > 0 ? "red" : "green"}>{produitsEnAlerte}</Text></Card>
        </SimpleGrid>

        {produitsRupture > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Attention - Ruptures de stock">
            {produitsRupture} produit(s) en rupture de stock. Veuillez réapprovisionner.
          </Alert>
        )}

        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: "#1b365d" }}>
              <Table.Tr>
                <Table.Th style={{ color: "white" }}>Code</Table.Th>
                <Table.Th style={{ color: "white" }}>Produit</Table.Th>
                <Table.Th style={{ color: "white" }}>Catégorie</Table.Th>
                <Table.Th style={{ color: "white", textAlign: "right" }}>Stock</Table.Th>
                <Table.Th style={{ color: "white", textAlign: "right" }}>Valeur</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stock.map((p) => (
                <Table.Tr key={p.idProduit}>
                  <Table.Td><Badge color="gray" variant="light" size="sm">{p.code_produit}</Badge></Table.Td>
                  <Table.Td fw={500}>{p.designation}</Table.Td>
                  <Table.Td>{p.categorie || "-"}</Table.Td>
                  <Table.Td ta="right">
                    <Badge color={p.qte_stock <= p.seuil_alerte ? "red" : (p.qte_stock <= p.seuil_alerte * 2 ? "orange" : "green")} variant="light">
                      {p.qte_stock} {p.unite_base}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>{p.valeur_stock.toLocaleString()} FCFA</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack gap="md"><Text size="sm">1. Ce tableau montre l'état des stocks</Text><Text size="sm">2. Les produits en rouge sont en dessous du seuil d'alerte</Text><Text size="sm">3. La valeur du stock est calculée au prix de vente</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default StockGlobal;