// src/components/pages/revendeurs/ListeStockRevendeur.tsx
import { useEffect, useState, useRef } from "react";
import {
  Card,
  Table,
  Title,
  Select,
  Stack,
  Text,
  Group,
  Loader,
  Center,
  Badge,
  Paper,
  Flex,
  ThemeIcon,
  SimpleGrid,
  ScrollArea,
  Button,
  TextInput,
  Tooltip,
  ActionIcon,
  Divider,
  Modal
} from "@mantine/core";
import '@mantine/dates/styles.css';
import {
  IconUser,
  IconPackage,
  IconCurrencyFrank,
  IconPercentage,
  IconSearch,
  IconRefresh,
  IconTruck,
  IconBuildingStore,
  IconPrinter,
  IconFileExcel,
  IconFileTypePdf,
  IconEye,
  IconReceipt,
  IconFileInvoice
} from "@tabler/icons-react";
import { getDb } from "../../../database/db";
import { stockRevendeurRepository } from "../../../database/repositories/stockRevendeurRepository";
import { useReactToPrint } from "react-to-print";
import { notifications } from "@mantine/notifications";


interface Client {
  idClient: number;
  NomComplet: string;
  Societe: string | null;
  Tel: string | null;
  TypeClient: string;
}

interface StockItem {
  idStockRevendeur: number;
  idProduit: number;
  code_produit: string;
  designation: string;
  qte_stock: number;
  prix_achat_base: number;
  prix_vente_gros: number;
  categorie: string;
}

export default function ListeStockRevendeur() {
  const printRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [valeurStock, setValeurStock] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [] = useState<Date | null>(null);
  const [] = useState<Date | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  useEffect(() => {
    loadRevendeurs();
  }, []);

  const loadRevendeurs = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      
      const data = await db.select<Client[]>(`
        SELECT 
          idClient, 
          NomComplet, 
          Societe, 
          Tel, 
          TypeClient
        FROM clients 
        WHERE TypeClient = 'revendeur'
        ORDER BY NomComplet
      `);
      
      console.log("Revendeurs chargés:", data);
      setClients(data);
    } catch (error) {
      console.error(error);
      notifications.show({ title: "Erreur", message: "Impossible de charger les revendeurs", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async (idRevendeur: number) => {
    try {
      setLoadingStock(true);
      const data = await stockRevendeurRepository.getByRevendeur(idRevendeur);
      setStock(data);
      const valeur = await stockRevendeurRepository.getValeurStock(idRevendeur);
      setValeurStock(valeur);
    } catch (error) {
      console.error(error);
      notifications.show({ title: "Erreur", message: "Impossible de charger le stock", color: "red" });
    } finally {
      setLoadingStock(false);
    }
  };

  const handleClientChange = (value: string | null) => {
    setSelectedClient(value);
    if (value) {
      const client = clients.find(c => c.idClient.toString() === value);
      if (client && client.TypeClient === 'revendeur') {
        setSelectedClientDetails(client);
        loadStock(Number(value));
      } else {
        setSelectedClient(null);
        setSelectedClientDetails(null);
        setStock([]);
        setValeurStock(0);
        notifications.show({
          title: "Erreur",
          message: "Ce client n'est pas un revendeur",
          color: "red"
        });
      }
      setSearchTerm("");
    } else {
      setSelectedClientDetails(null);
      setStock([]);
      setValeurStock(0);
    }
  };

  const clientData = clients
    .filter(client => client.TypeClient === 'revendeur')
    .map(client => ({
      value: client.idClient.toString(),
      label: client.NomComplet || client.Societe || "Revendeur sans nom"
    }));

  // Voir les détails d'un produit
  const handleViewDetails = (product: StockItem) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  // Générer la facture pour un produit (à implémenter si nécessaire)
  const handleGenererFacture = async () => {
    notifications.show({
      title: "Information",
      message: "Cette fonctionnalité sera disponible prochainement",
      color: "blue"
    });
  };

  // Créer un décompte pour un produit
  const handleCreerDecompte = (product: StockItem) => {
    notifications.show({
      title: "Décompte",
      message: `Créer un décompte pour ${product.designation}`,
      color: "blue"
    });
  };

  // Impression
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Stock_${selectedClientDetails?.NomComplet || selectedClientDetails?.Societe || "Revendeur"}_${new Date().toLocaleDateString()}`,
  });

  // Export CSV
  const handleExportCSV = () => {
    if (filteredStock.length === 0) {
      notifications.show({ title: "Info", message: "Aucune donnée à exporter", color: "blue" });
      return;
    }
    
    const headers = ["Code", "Produit", "Catégorie", "Stock", "Prix Achat", "Prix Vente", "Valeur Stock"];
    const rows = filteredStock.map(item => [
      item.code_produit,
      item.designation,
      item.categorie || "-",
      item.qte_stock,
      item.prix_achat_base.toLocaleString(),
      item.prix_vente_gros.toLocaleString(),
      (item.qte_stock * item.prix_achat_base).toLocaleString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", `stock_${selectedClientDetails?.NomComplet || "revendeur"}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    notifications.show({ title: "Succès", message: "Export CSV terminé", color: "green" });
  };

  // Export PDF (via impression)
  const handleExportPDF = () => {
    handlePrint();
  };

  // Filtrer le stock par recherche et dates
  const filteredStock = stock.filter(item => {
    const matchSearch = item.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Note: Les dates ne sont pas disponibles dans stock_revendeur
    // Cette fonctionnalité peut être ajoutée si nécessaire
    const matchDate = true;
    
    return matchSearch && matchDate;
  });

  const stats = {
    totalProduits: stock.length,
    totalArticles: stock.reduce((sum, item) => sum + (item.qte_stock || 0), 0),
    valeurAchat: stock.reduce((sum, item) => sum + ((item.qte_stock || 0) * (item.prix_achat_base || 0)), 0),
    valeurVente: stock.reduce((sum, item) => sum + ((item.qte_stock || 0) * (item.prix_vente_gros || 0)), 0),
    beneficePotentiel: stock.reduce((sum, item) => sum + ((item.qte_stock || 0) * ((item.prix_vente_gros || 0) - (item.prix_achat_base || 0))), 0)
  };

  if (loading && clients.length === 0) {
    return (
      <Center py={100}>
        <Loader size="xl" />
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
              <IconBuildingStore size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white" style={{ fontSize: '2rem' }}>Stock Revendeurs</Title>
              <Text c="gray.3" size="sm">Gestion des stocks par revendeur</Text>
            </div>
          </Group>
          <Group>
            <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={loadRevendeurs}>
              Actualiser
            </Button>
          </Group>
        </Flex>
      </Paper>

      {/* Sélection du revendeur */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Select
          label="Sélectionner un revendeur"
          placeholder="Choisir un revendeur"
          searchable
          clearable
          data={clientData}
          value={selectedClient}
          onChange={handleClientChange}
          leftSection={<IconUser size={16} />}
          size="md"
          mb="md"
        />
        
        {selectedClientDetails && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="md">
            <Group gap="xs">
              <IconBuildingStore size={16} color="#1b365d" />
              <Text size="sm" c="dimmed">Société:</Text>
              <Text fw={500}>{selectedClientDetails.Societe || '-'}</Text>
            </Group>
            <Group gap="xs">
              <IconTruck size={16} color="#1b365d" />
              <Text size="sm" c="dimmed">Contact:</Text>
              <Text>{selectedClientDetails.Tel || '-'}</Text>
            </Group>
            <Group gap="xs">
              <IconUser size={16} color="#1b365d" />
              <Text size="sm" c="dimmed">Type:</Text>
              <Badge color="green" size="sm">Revendeur</Badge>
            </Group>
          </SimpleGrid>
        )}
      </Card>

      {/* Boutons d'export */}
      {selectedClient && stock.length > 0 && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" align="center">
            <Text fw={600}>Actions</Text>
            <Group>
              <Tooltip label="Imprimer le stock">
                <ActionIcon variant="light" color="blue" size="lg" onClick={handlePrint}>
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter en CSV">
                <ActionIcon variant="light" color="green" size="lg" onClick={handleExportCSV}>
                  <IconFileExcel size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter en PDF">
                <ActionIcon variant="light" color="red" size="lg" onClick={handleExportPDF}>
                  <IconFileTypePdf size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Card>
      )}

      {/* Cartes statistiques */}
      {selectedClient && stock.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md">
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#e3f2fd' }}>
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total produits</Text>
                <Text fw={700} size="xl">{stats.totalProduits}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#e8f5e9' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total articles</Text>
                <Text fw={700} size="xl">{stats.totalArticles}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#fff3e0' }}>
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconCurrencyFrank size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Valeur achat</Text>
                <Text fw={700} size="xl">{stats.valeurAchat.toLocaleString()} F</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#f3e5f5' }}>
            <Group>
              <ThemeIcon color="grape" variant="light" size="lg">
                <IconCurrencyFrank size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Valeur vente</Text>
                <Text fw={700} size="xl">{stats.valeurVente.toLocaleString()} F</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      )}

      {/* Barre de recherche */}
      {selectedClient && stock.length > 0 && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <TextInput
            placeholder="Rechercher par produit ou code..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="md"
          />
        </Card>
      )}

      {/* Tableau des stocks - Zone imprimable */}
      {selectedClient && (
        <Card withBorder radius="lg" shadow="sm" p="md">
          {loadingStock ? (
            <Center py={50}>
              <Loader size="xl" />
            </Center>
          ) : (
            <>
              {/* En-tête avec valeur du stock */}
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <IconCurrencyFrank size={20} color="#1b365d" />
                  <Text fw={700}>Valeur totale du stock (prix achat)</Text>
                </Group>
                <Badge color="green" size="lg" variant="filled">
                  {valeurStock.toLocaleString()} FCFA
                </Badge>
              </Group>

              {/* Zone à imprimer */}
              <div ref={printRef}>
                {/* En-tête pour impression (visible seulement à l'impression) */}
                <div style={{ textAlign: "center", marginBottom: 20, display: "none" }}>
                  <Title order={2}>Stock Revendeur</Title>
                  <Text>Revendeur: {selectedClientDetails?.NomComplet || selectedClientDetails?.Societe}</Text>
                  <Text>Date: {new Date().toLocaleDateString("fr-FR")}</Text>
                  <Text>Valeur totale: {valeurStock.toLocaleString()} FCFA</Text>
                </div>

                <ScrollArea h={400}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                        <Table.Th c="white">Code</Table.Th>
                        <Table.Th c="white">Produit</Table.Th>
                        <Table.Th c="white">Catégorie</Table.Th>
                        <Table.Th c="white" ta="center">Stock</Table.Th>
                        <Table.Th c="white" ta="right">Prix Achat</Table.Th>
                        <Table.Th c="white" ta="right">Prix Vente</Table.Th>
                        <Table.Th c="white" ta="right">Marge unitaire</Table.Th>
                        <Table.Th c="white" ta="right">Valeur stock</Table.Th>
                        <Table.Th c="white" ta="center">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredStock.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={9} align="center">
                            <Text c="dimmed" py={50}>
                              {searchTerm ? "Aucun produit trouvé" : "Aucun stock disponible pour ce revendeur"}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        filteredStock.map((item) => {
                          const valeur = (item.qte_stock || 0) * (item.prix_achat_base || 0);
                          const margeUnitaire = (item.prix_vente_gros || 0) - (item.prix_achat_base || 0);
                          
                          return (
                            <Table.Tr key={item.idStockRevendeur}>
                              <Table.Td>
                                <Text fw={500} size="sm">{item.code_produit}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text fw={500} size="sm">{item.designation}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" size="sm">{item.categorie || '-'}</Badge>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Badge 
                                  color={item.qte_stock <= 0 ? 'red' : item.qte_stock <= 5 ? 'orange' : 'green'} 
                                  variant="light" 
                                  size="sm"
                                >
                                  {item.qte_stock || 0}
                                </Badge>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm">{item.prix_achat_base?.toLocaleString()} F</Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" fw={600} c="blue">{item.prix_vente_gros?.toLocaleString()} F</Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" c={margeUnitaire >= 0 ? "green" : "red"}>
                                  {margeUnitaire.toLocaleString()} F
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text fw={600} c="green">{valeur.toLocaleString()} F</Text>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Tooltip label="Voir détails">
                                  <ActionIcon
                                    variant="light"
                                    color="blue"
                                    size="sm"
                                    onClick={() => handleViewDetails(item)}
                                  >
                                    <IconEye size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Résumé des bénéfices potentiels */}
              {stock.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
                  <Card withBorder p="sm" style={{ backgroundColor: '#e8f5e9' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconPercentage size={18} color="#2e7d32" />
                        <Text fw={600}>Bénéfice potentiel total</Text>
                      </Group>
                      <Text fw={700} size="lg" c="green">
                        {stats.beneficePotentiel.toLocaleString()} F
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      (Prix vente - Prix achat) × Stock
                    </Text>
                  </Card>
                  <Card withBorder p="sm" style={{ backgroundColor: '#fff3e0' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconCurrencyFrank size={18} color="#ed6c02" />
                        <Text fw={600}>Chiffre d'affaires potentiel</Text>
                      </Group>
                      <Text fw={700} size="lg" c="blue">
                        {stats.valeurVente.toLocaleString()} F
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      (Prix vente × Stock)
                    </Text>
                  </Card>
                </SimpleGrid>
              )}
            </>
          )}
        </Card>
      )}

      {!selectedClient && (
        <Card withBorder radius="lg" shadow="sm" p="xl" ta="center">
          <ThemeIcon size={60} radius="xl" color="gray" variant="light" mx="auto" mb="md">
            <IconUser size={30} />
          </ThemeIcon>
          <Text c="dimmed" size="lg">Sélectionnez un revendeur pour voir son stock</Text>
        </Card>
      )}

      {/* MODAL DÉTAILS PRODUIT */}
      <Modal
        opened={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={`Détails du produit - ${selectedProduct?.designation || ''}`}
        size="md"
        centered
      >
        {selectedProduct && (
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">Code produit</Text>
                <Text fw={600}>{selectedProduct.code_produit}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Catégorie</Text>
                <Text fw={600}>{selectedProduct.categorie || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Stock actuel</Text>
                <Badge color={selectedProduct.qte_stock <= 0 ? 'red' : 'green'} size="lg">
                  {selectedProduct.qte_stock} unités
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Prix d'achat</Text>
                <Text fw={600} c="orange">{selectedProduct.prix_achat_base.toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Prix de vente</Text>
                <Text fw={600} c="blue">{selectedProduct.prix_vente_gros.toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Marge unitaire</Text>
                <Text fw={600} c="green">{(selectedProduct.prix_vente_gros - selectedProduct.prix_achat_base).toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Valeur stock</Text>
                <Text fw={700} c="green">{(selectedProduct.qte_stock * selectedProduct.prix_achat_base).toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Bénéfice potentiel</Text>
                <Text fw={700} c="blue">{(selectedProduct.qte_stock * (selectedProduct.prix_vente_gros - selectedProduct.prix_achat_base)).toLocaleString()} F</Text>
              </div>
            </SimpleGrid>

            <Divider />

            <Group justify="flex-end" gap="sm">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconReceipt size={16} />}
                onClick={() => handleCreerDecompte(selectedProduct)}
              >
                Créer décompte
              </Button>
              <Button
                variant="light"
                color="green"
                leftSection={<IconFileInvoice size={16} />}
                onClick={() => handleGenererFacture()}
              >
                Générer facture
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}