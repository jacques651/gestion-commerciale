// src/components/stock/StockGlobal.tsx
import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Table, Badge, LoadingOverlay,
  Box, ThemeIcon, SimpleGrid, Modal, Button, Divider, Alert,
  Paper, Flex, Avatar, ScrollArea, Tooltip, TextInput,
  ActionIcon,
  Pagination
} from "@mantine/core";
import {
  IconPackage, IconInfoCircle, IconAlertTriangle, IconCash,
  IconSearch, IconRefresh, IconBuildingStore, IconChartBar,
  IconAlertCircle, IconBox} from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface StockProduit {
  idProduit: number;
  code_produit: string;
  designation: string;
  categorie: string;
  unite_base: string;
  qte_stock: number;
  prix_vente_detail: number;
  prix_achat_base: number;
  seuil_alerte: number;
  valeur_stock_vente: number;
  valeur_stock_achat: number;
}

const StockGlobal: React.FC = () => {
  const [stock, setStock] = useState<StockProduit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 15;

  const chargerStock = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<StockProduit[]>(`
        SELECT 
          p.idProduit, p.code_produit, p.designation, p.categorie, 
          p.unite_base, p.qte_stock, p.prix_vente_detail, p.prix_achat_base, p.seuil_alerte,
          (p.qte_stock * p.prix_vente_detail) as valeur_stock_vente,
          (p.qte_stock * p.prix_achat_base) as valeur_stock_achat
        FROM products p
        WHERE p.est_supprime = 0
        ORDER BY p.designation
      `);
      setStock(result || []);
    } catch (error) {
      console.error("Erreur chargement stock:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerStock(); }, []);

  // Filtrage
  const stockFiltre = stock.filter(p =>
    p.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code_produit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.categorie && p.categorie.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(stockFiltre.length / itemsPerPage);
  const paginatedStock = stockFiltre.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalValeurVente = stock.reduce((sum, p) => sum + p.valeur_stock_vente, 0);
  const totalValeurAchat = stock.reduce((sum, p) => sum + p.valeur_stock_achat, 0);
  const margePotentielle = totalValeurVente - totalValeurAchat;
  const produitsEnAlerte = stock.filter(p => p.qte_stock > 0 && p.qte_stock <= p.seuil_alerte).length;
  const produitsRupture = stock.filter(p => p.qte_stock <= 0).length;

  const getStockBadge = (stock: number, seuil: number) => {
    if (stock <= 0) {
      return { color: "red", label: "Rupture", variant: "filled", icon: <IconAlertCircle size={12} /> };
    }
    if (stock <= seuil) {
      return { color: "orange", label: `Stock bas (${stock})`, variant: "light", icon: null };
    }
    return { color: "green", label: `${stock}`, variant: "light", icon: null };
  };

  if (loading) {
    return (
      <Card withBorder p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text mt="md">Chargement du stock...</Text>
      </Card>
    );
  }

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* EN-TÊTE ATTRACTIF */}
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
                  <IconPackage size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Stock Global</Title>
                  <Text c="gray.3" size="sm">État des stocks et valorisation</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" color="white" onClick={chargerStock} size="lg">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Flex>

          {/* Cartes statistiques */}
          <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconPackage size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Références</Text>
                  <Text c="white" fw={700} size="xl">{stock.length}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Valeur vente</Text>
                  <Text c="white" fw={700} size="xl">{totalValeurVente.toLocaleString()} F</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Valeur achat</Text>
                  <Text c="white" fw={700} size="xl">{totalValeurAchat.toLocaleString()} F</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="yellow" variant="light" size="lg">
                  <IconChartBar size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Marge potentielle</Text>
                  <Text c="white" fw={700} size="xl">{margePotentielle.toLocaleString()} F</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="red" variant="light" size="lg">
                  <IconAlertTriangle size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Rupture / Alerte</Text>
                  <Text c="white" fw={700} size="xl">{produitsRupture} / {produitsEnAlerte}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* Alertes */}
        {produitsRupture > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" radius="md">
            <Group justify="space-between">
              <Text size="sm" fw={500}>{produitsRupture} produit(s) en rupture de stock</Text>
              <Button size="xs" variant="white" color="red">Voir les ruptures</Button>
            </Group>
          </Alert>
        )}

        {produitsEnAlerte > 0 && produitsRupture === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" radius="md">
            <Text size="sm">{produitsEnAlerte} produit(s) en stock bas (seuil d'alerte)</Text>
          </Alert>
        )}

        {/* Barre d'outils */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Flex justify="space-between" align="center" wrap="wrap" gap="md">
            <TextInput
              placeholder="Rechercher un produit..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              size="sm"
              style={{ width: 300 }}
            />
            <Group>
              <Badge size="lg" variant="light" color="blue">{stockFiltre.length} produits</Badge>
              <Button variant="subtle" size="xs" onClick={() => { setSearchTerm(""); setCurrentPage(1); }} leftSection={<IconRefresh size={14} />}>
                Réinitialiser
              </Button>
            </Group>
          </Flex>
        </Card>

        {/* TABLEAU COMPACT */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <ScrollArea h="calc(100vh - 480px)">
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px' }}>Code</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px' }}>Produit</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', width: 100 }}>Catégorie</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', textAlign: 'center', width: 100 }}>Stock</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', textAlign: 'right', width: 120 }}>Prix vente</Table.Th>
                  <Table.Th style={{ color: 'white', fontSize: '12px', padding: '10px 12px', textAlign: 'right', width: 120 }}>Valeur</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedStock.map((p) => {
                  const stockInfo = getStockBadge(p.qte_stock, p.seuil_alerte);
                  return (
                    <Table.Tr key={p.idProduit} style={{ fontSize: '13px' }}>
                      <Table.Td style={{ padding: '8px 12px' }}>
                        <Text size="xs" fw={500} c="adminBlue">{p.code_produit}</Text>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px' }}>
                        <Group gap="xs" wrap="nowrap">
                          <Avatar size="sm" radius="xl" color="blue">
                            <IconBox size={14} />
                          </Avatar>
                          <div>
                            <Text fw={500} size="sm">{p.designation}</Text>
                            {p.categorie && <Text size="xs" c="dimmed">{p.categorie}</Text>}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px' }}>
                        <Badge variant="light" color="gray" size="sm">{p.categorie || "-"}</Badge>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <Badge color={stockInfo.color} variant={stockInfo.variant as any} size="sm" leftSection={stockInfo.icon}>
                          {stockInfo.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text fw={600} size="sm" c="blue">{p.prix_vente_detail.toLocaleString()} F</Text>
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text fw={600} size="sm">{p.valeur_stock_vente.toLocaleString()} F</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {stockFiltre.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={40}>
              <IconPackage size={40} color="#ccc" />
              <Text ta="center" c="dimmed" mt="sm" size="sm">Aucun produit trouvé</Text>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="sm">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
            </Group>
          )}
        </Card>

        {/* MODAL INSTRUCTIONS */}
        <Modal
          opened={infoModalOpen}
          onClose={() => setInfoModalOpen(false)}
          title="📋 Instructions"
          size="md"
          centered
          styles={{
            header: { backgroundColor: "#1b365d", padding: "16px 20px", borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
            title: { color: "white", fontWeight: 600 },
            body: { padding: "20px" }
          }}
        >
          <Stack gap="md">
            <Text size="sm">1. Ce tableau montre l'état des stocks de produits</Text>
            <Text size="sm">2. 🔴 Rupture : stock à zéro</Text>
            <Text size="sm">3. 🟠 Stock bas : quantité inférieure au seuil d'alerte</Text>
            <Text size="sm">4. 🟢 Stock OK : quantité supérieure au seuil d'alerte</Text>
            <Text size="sm">5. La valeur du stock est calculée au prix de vente</Text>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">Version 2.0.0 - Gestion Commerciale Pro</Text>
          </Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default StockGlobal;