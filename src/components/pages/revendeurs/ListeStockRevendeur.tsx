// src/components/pages/revendeurs/ListeStockRevendeur.tsx
import { useEffect, useState, useRef } from "react";
import { confirm } from '../../../utils/confirm';
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
  NumberInput,
  Tooltip,
  ActionIcon,
  Divider,
  Modal,
  Alert
} from "@mantine/core";
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
  IconFileInvoice,
  IconAlertCircle,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { getDb } from "../../../database/db";
import { stockRevendeurRepository } from "../../../database/repositories/stockRevendeurRepository";
import { revendeurAuditService } from "../../../services/revendeurAuditService";
import StockRevendeurService from "../../../services/StockRevendeurService";
import { useAuth } from "../../../contexts/AuthContext";
import { ModalImportStockRevendeur } from "./ModalImportStockRevendeur";
import { saveText } from "../../../utils/fileExport";
import { useReactToPrint } from "react-to-print";
import { notifications } from "@mantine/notifications";
import TkFilters from '../../TkFilters';

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
  unite_base?: string;
}

interface FactureRevendeur {
  idFactureRevendeur: number;
  idCommande: number;
  code_facture: string;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  commission: number;
  statut: string;
  code_commande: string;
}

interface FactureDetail {
  designation: string;
  code_produit: string;
  quantite: number;
  prix_unitaire_vente: number;
  total: number;
}

export default function ListeStockRevendeur() {
  const printRef = useRef<HTMLDivElement>(null);
  const factureRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<Client | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [valeurStock, setValeurStock] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [adjustQte, setAdjustQte] = useState<number>(0);
  const [adjustMotif, setAdjustMotif] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [factures, setFactures] = useState<FactureRevendeur[]>([]);
  const [loadingFactures, setLoadingFactures] = useState(false);
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<FactureRevendeur | null>(null);
  const [factureDetails, setFactureDetails] = useState<FactureDetail[]>([]);
  const [loadingFactureDetails, setLoadingFactureDetails] = useState(false);

  useEffect(() => {
    loadRevendeurs();
  }, []);

  const loadRevendeurs = async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const data = await db.select<Client[]>(`
        SELECT idClient, NomComplet, Societe, Tel, TypeClient
        FROM clients
        WHERE TypeClient = 'revendeur'
        ORDER BY NomComplet
      `);
      setClients(data);
    } catch (err) {
      console.error('Erreur chargement revendeurs:', err);
      setError("Impossible de charger les revendeurs");
      notifications.show({ title: "Erreur", message: "Impossible de charger les revendeurs", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async (idRevendeur: number) => {
    try {
      setLoadingStock(true);
      setError(null);
      const data = await stockRevendeurRepository.getByRevendeur(idRevendeur);
      setStock(data);
      const valeur = await stockRevendeurRepository.getValeurStock(idRevendeur);
      setValeurStock(valeur);
    } catch (err) {
      console.error('Erreur chargement stock:', err);
      setError("Impossible de charger le stock");
      notifications.show({ title: "Erreur", message: "Impossible de charger le stock", color: "red" });
    } finally {
      setLoadingStock(false);
    }
  };

  const loadFactures = async (idRevendeur: number) => {
    try {
      setLoadingFactures(true);
      const db = await getDb();
      const data = await db.select<FactureRevendeur[]>(`
        SELECT
          fr.idFactureRevendeur,
          fr.idCommande,
          fr.code_facture,
          fr.date_facture,
          fr.montant_ht,
          fr.montant_ttc,
          fr.commission,
          fr.statut,
          c.code_commande
        FROM factures_revendeur fr
        LEFT JOIN commandes c ON c.idCommande = fr.idCommande
        WHERE fr.idRevendeur = ?
        ORDER BY fr.date_facture DESC
      `, [idRevendeur]);
      setFactures(data);
    } catch (err) {
      console.error('Erreur chargement factures:', err);
    } finally {
      setLoadingFactures(false);
    }
  };

  const openFacture = async (facture: FactureRevendeur) => {
    setSelectedFacture(facture);
    setShowFactureModal(true);
    setLoadingFactureDetails(true);
    try {
      const db = await getDb();
      const details = await db.select<FactureDetail[]>(`
        SELECT
          p.designation,
          p.code_produit,
          cd.qte_commande AS quantite,
          cd.prix_unitaire_vente,
          cd.qte_commande * cd.prix_unitaire_vente AS total
        FROM commande_details cd
        JOIN products p ON p.idProduit = cd.idProduit
        WHERE cd.idCommande = ?
      `, [facture.idCommande]);
      setFactureDetails(details);
    } catch (err) {
      console.error('Erreur details facture:', err);
    } finally {
      setLoadingFactureDetails(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Stock_${selectedClientDetails?.NomComplet || "Revendeur"}_${new Date().toLocaleDateString()}`,
  });

  const handlePrintFacture = useReactToPrint({
    contentRef: factureRef,
    documentTitle: `Facture_${selectedFacture?.code_facture || 'REV'}`,
  });

  const handleClientChange = (value: string | null) => {
    setSelectedClient(value);
    setSearchTerm("");
    setError(null);
    setFactures([]);

    if (value) {
      const client = clients.find(c => c.idClient.toString() === value);
      if (client && client.TypeClient === 'revendeur') {
        setSelectedClientDetails(client);
        loadStock(Number(value));
        loadFactures(Number(value));
      } else {
        setSelectedClient(null);
        setSelectedClientDetails(null);
        setStock([]);
        setValeurStock(0);
        notifications.show({ title: "Erreur", message: "Ce client n'est pas un revendeur", color: "red" });
      }
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

  const handleAjuster = async () => {
    if (!selectedClient || !selectedProduct) return;
    if (!adjustMotif.trim()) {
      notifications.show({ title: 'Motif requis', message: "Indiquez le motif de l'ajustement.", color: 'orange' });
      return;
    }
    setAdjustLoading(true);
    try {
      await StockRevendeurService.ajuster(
        Number(selectedClient),
        selectedProduct.idProduit,
        Number(adjustQte) || 0,
        adjustMotif.trim(),
        user?.nom,
      );
      notifications.show({ title: 'Stock ajusté', message: `Nouvelle quantité : ${adjustQte} (tracé).`, color: 'teal' });
      setShowDetailsModal(false);
      await loadStock(Number(selectedClient));
    } catch (e: any) {
      notifications.show({ title: 'Erreur', message: e?.message || "Ajustement impossible", color: 'red' });
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleViewDetails = (product: StockItem) => {
    setAdjustQte(product.qte_stock || 0);
    setAdjustMotif("");
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleResetStock = async () => {
    if (!selectedClient || !selectedClientDetails) return;
    const confirmed = await confirm(
      `Ramener le stock de ${selectedClientDetails.NomComplet} à 0 avec une trace d inventaire ?\n\nLes lignes et l historique seront conservés.`,
      'Ajustement inventaire'
    );
    if (!confirmed) return;
    try {
      const db = await getDb();
      const idRevendeur = Number(selectedClient);
      const lignes = await db.select<any[]>(
        'SELECT idProduit, qte_stock FROM stock_revendeur WHERE idRevendeur = ? AND qte_stock <> 0',
        [idRevendeur]
      );
      await db.execute('BEGIN TRANSACTION');
      try {
        for (const ligne of lignes) {
          await db.execute('UPDATE stock_revendeur SET qte_stock = 0 WHERE idRevendeur = ? AND idProduit = ?', [idRevendeur, ligne.idProduit]);
          await db.execute(
            `INSERT INTO mouvements_revendeur (idProduit, idRevendeur, type_mouvement, qte_mouvement)
             VALUES (?, ?, 'AJUSTEMENT_INVENTAIRE', ?)`,
            [ligne.idProduit, idRevendeur, -Number(ligne.qte_stock)]
          );
        }
        await db.execute('COMMIT');
      } catch (error) {
        await db.execute('ROLLBACK');
        throw error;
      }
      await revendeurAuditService.tracer({
        action: 'AJUSTEMENT_STOCK_A_ZERO', entite: 'STOCK', idRevendeur,
        details: { lignes: lignes.length, motif: 'Reinitialisation inventaire depuis ecran stock' },
      });
      await loadStock(idRevendeur);
      notifications.show({ title: 'Stock ajusté', message: `${lignes.length} ligne(s) ramenée(s) à 0 avec trace d inventaire.`, color: 'orange' });
    } catch (err) {
      console.error(err);
      notifications.show({ title: 'Erreur', message: 'Impossible d ajuster le stock', color: 'red' });
    }
  };

  const handleExportCSV = async () => {
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
    const res = await saveText(csvContent, `stock_${selectedClientDetails?.NomComplet || "revendeur"}_${new Date().toLocaleDateString()}.csv`);
    if (res !== 'cancelled') notifications.show({ title: "Succès", message: "Export CSV terminé — dossier choisi", color: "green" });
  };

  const filteredStock = stock.filter(item => {
    return (
      item.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code_produit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categorie?.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
        <Text ml="md" c="dimmed">Chargement des revendeurs...</Text>
      </Center>
    );
  }

  if (error && clients.length === 0) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert icon={<IconAlertCircle size={16} />} title="Erreur" color="red" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
          <Button leftSection={<IconRefresh size={16} />} onClick={loadRevendeurs} variant="light">
            Réessayer
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* EN-TÊTE */}
      <Paper className="tk-page-tools" p="xl" radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="cyan" variant="filled">
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

      <ModalImportStockRevendeur
        opened={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        idRevendeur={selectedClient ? Number(selectedClient) : null}
        revendeurNom={selectedClientDetails?.NomComplet}
        onSuccess={() => { if (selectedClient) loadStock(Number(selectedClient)); }}
      />

      {/* Barre d'actions - Visible dès qu'un revendeur est sélectionné */}
      {selectedClient && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" align="center">
            <Text fw={600}>Actions</Text>
            <Group>
              <Button 
                leftSection={<IconUpload size={16} />} 
                variant="light" 
                color="grape"
                onClick={() => setImportModalOpen(true)}
              >
                Importer le stock (Excel)
              </Button>
              <Tooltip label="Imprimer le stock">
                <ActionIcon 
                  variant="light" 
                  color="blue" 
                  size="lg" 
                  onClick={() => handlePrint()} 
                  disabled={stock.length === 0}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter en CSV">
                <ActionIcon 
                  variant="light" 
                  color="green" 
                  size="lg" 
                  onClick={handleExportCSV} 
                  disabled={stock.length === 0}
                >
                  <IconFileExcel size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter en PDF">
                <ActionIcon 
                  variant="light" 
                  color="red" 
                  size="lg" 
                  onClick={() => handlePrint()} 
                  disabled={stock.length === 0}
                >
                  <IconFileTypePdf size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Réinitialiser le stock à 0">
                <ActionIcon 
                  variant="light" 
                  color="orange" 
                  size="lg" 
                  onClick={handleResetStock} 
                  disabled={stock.length === 0}
                >
                  <IconTrash size={20} />
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
              <ThemeIcon color="blue" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total produits</Text>
                <Text fw={700} size="xl">{stats.totalProduits}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#e8f5e9' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total articles</Text>
                <Text fw={700} size="xl">{stats.totalArticles}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#fff3e0' }}>
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Valeur achat</Text>
                <Text fw={700} size="xl">{stats.valeurAchat.toLocaleString()} F</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" style={{ backgroundColor: '#f3e5f5' }}>
            <Group>
              <ThemeIcon color="grape" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
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
        <TkFilters>
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <TextInput
            placeholder="Rechercher par produit, code ou catégorie..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="md"
          />
        </Card>
        </TkFilters>
      )}

      {/* Tableau des stocks */}
      {selectedClient && (
        <Card withBorder radius="lg" shadow="sm" p="md">
          {loadingStock ? (
            <Center py={50}><Loader size="xl" /></Center>
          ) : stock.length === 0 ? (
            <Center py={50}>
              <Stack align="center" gap="sm">
                <IconPackage size={48} color="#868e96" />
                <Text c="dimmed" size="lg" fw={500}>Aucun stock pour ce revendeur</Text>
                <Text c="dimmed" size="sm">Le revendeur n'a pas encore de produits en stock</Text>
                <Button 
                  variant="light" 
                  color="grape" 
                  leftSection={<IconUpload size={16} />}
                  onClick={() => setImportModalOpen(true)}
                  mt="sm"
                >
                  Importer un stock
                </Button>
              </Stack>
            </Center>
          ) : (
            <>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <IconCurrencyFrank size={20} color="#1b365d" />
                  <Text fw={700}>Valeur totale du stock (prix achat)</Text>
                </Group>
                <Badge color="green" size="lg" variant="filled">{valeurStock.toLocaleString()} FCFA</Badge>
              </Group>

              <div ref={printRef}>
                <div style={{ textAlign: "center", marginBottom: 20, display: "none" }}>
                  <Title order={2}>Stock Revendeur</Title>
                  <Text>Revendeur: {selectedClientDetails?.NomComplet || selectedClientDetails?.Societe}</Text>
                  <Text>Date: {new Date().toLocaleDateString("fr-FR")}</Text>
                  <Text>Valeur totale: {valeurStock.toLocaleString()} FCFA</Text>
                </div>

                <ScrollArea h={400}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Code</Table.Th>
                        <Table.Th>Produit</Table.Th>
                        <Table.Th>Catégorie</Table.Th>
                        <Table.Th ta="center">Stock</Table.Th>
                        <Table.Th ta="right">Prix Achat</Table.Th>
                        <Table.Th ta="right">Prix Vente</Table.Th>
                        <Table.Th ta="right">Marge unitaire</Table.Th>
                        <Table.Th ta="right">Valeur stock</Table.Th>
                        <Table.Th ta="center">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredStock.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={9} ta="center">
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
                              <Table.Td><Text fw={500} size="sm">{item.code_produit}</Text></Table.Td>
                              <Table.Td><Text fw={500} size="sm">{item.designation}</Text></Table.Td>
                              <Table.Td><Badge variant="light" size="sm">{item.categorie || '-'}</Badge></Table.Td>
                              <Table.Td ta="center">
                                <Badge color={item.qte_stock <= 0 ? 'red' : item.qte_stock <= 5 ? 'orange' : 'green'} variant="light" size="sm">
                                  {item.qte_stock || 0}
                                </Badge>
                              </Table.Td>
                              <Table.Td ta="right"><Text size="sm">{item.prix_achat_base?.toLocaleString()} F</Text></Table.Td>
                              <Table.Td ta="right"><Text size="sm" fw={600} c="blue">{item.prix_vente_gros?.toLocaleString()} F</Text></Table.Td>
                              <Table.Td ta="right">
                                <Text size="sm" c={margeUnitaire >= 0 ? "green" : "red"}>{margeUnitaire.toLocaleString()} F</Text>
                              </Table.Td>
                              <Table.Td ta="right"><Text fw={600} c="green">{valeur.toLocaleString()} F</Text></Table.Td>
                              <Table.Td ta="center">
                                <Tooltip label="Voir détails">
                                  <ActionIcon variant="light" color="blue" size="sm" onClick={() => handleViewDetails(item)}>
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

              {stock.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
                  <Card withBorder p="sm" style={{ backgroundColor: '#e8f5e9' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconPercentage size={18} color="#2e7d32" />
                        <Text fw={600}>Bénéfice potentiel total</Text>
                      </Group>
                      <Text fw={700} size="lg" c="green">{stats.beneficePotentiel.toLocaleString()} F</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>(Prix vente - Prix achat) × Stock</Text>
                  </Card>
                  <Card withBorder p="sm" style={{ backgroundColor: '#fff3e0' }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconCurrencyFrank size={18} color="#ed6c02" />
                        <Text fw={600}>Chiffre d'affaires potentiel</Text>
                      </Group>
                      <Text fw={700} size="lg" c="blue">{stats.valeurVente.toLocaleString()} F</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>(Prix vente × Stock)</Text>
                  </Card>
                </SimpleGrid>
              )}
            </>
          )}
        </Card>
      )}

      {/* FACTURES REVENDEUR */}
      {selectedClient && (
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group gap="xs" mb="md">
            <ThemeIcon color="violet" variant="light" radius="md" size="sm">
              <IconFileInvoice size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm" c="#1b365d">Factures revendeur</Text>
            {loadingFactures ? (
              <Loader size="xs" />
            ) : (
              <Badge color="violet" variant="light" size="xs">{factures.length} facture(s)</Badge>
            )}
          </Group>

          {factures.length === 0 && !loadingFactures ? (
            <Center py={30}>
              <Stack align="center" gap="xs">
                <IconFileInvoice size={32} color="#adb5bd" stroke={1.5} />
                <Text c="dimmed" size="sm">Aucune facture pour ce revendeur</Text>
              </Stack>
            </Center>
          ) : (
            <ScrollArea h={200}>
              <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#5c2d91' }}>
                    <Table.Th>N° Facture</Table.Th>
                    <Table.Th>Commande</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th ta="right">Montant HT</Table.Th>
                    <Table.Th ta="right">Montant TTC</Table.Th>
                    <Table.Th ta="right">Commission</Table.Th>
                    <Table.Th ta="center">Statut</Table.Th>
                    <Table.Th ta="center">Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {factures.map((f) => (
                    <Table.Tr key={f.idFactureRevendeur}>
                      <Table.Td><Text fw={600} size="xs">{f.code_facture}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{f.code_commande || '-'}</Text></Table.Td>
                      <Table.Td><Text size="xs">{new Date(f.date_facture).toLocaleDateString('fr-FR')}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="xs">{f.montant_ht.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="right"><Text size="xs" fw={600} c="blue">{f.montant_ttc.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="right"><Text size="xs" c="orange">{f.commission.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="center">
                        <Badge
                          color={f.statut === 'PAYEE' ? 'green' : f.statut === 'EN_ATTENTE' ? 'orange' : 'gray'}
                          variant="light"
                          size="xs"
                        >
                          {f.statut}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Tooltip label="Voir / Imprimer">
                          <ActionIcon size="sm" variant="light" color="violet" onClick={() => openFacture(f)}>
                            <IconPrinter size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
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

      {/* MODAL FACTURE REVENDEUR */}
      <Modal
        opened={showFactureModal}
        onClose={() => setShowFactureModal(false)}
        title={`Facture ${selectedFacture?.code_facture || ''}`}
        size="lg"
        centered
        styles={{
          header: { backgroundColor: '#5c2d91', padding: '12px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 700 },
          body: { padding: '16px' }
        }}
      >
        {selectedFacture && (
          <>
            <div ref={factureRef} style={{ padding: 16, backgroundColor: 'white' }}>
              <Group justify="space-between" mb="md" style={{ borderBottom: '2px solid #5c2d91', paddingBottom: 8 }}>
                <div>
                  <Text fw={700} size="lg" c="#5c2d91">{selectedClientDetails?.NomComplet || 'Revendeur'}</Text>
                  <Text size="xs" c="dimmed">{selectedClientDetails?.Tel}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text fw={700} size="lg" c="#5c2d91">{selectedFacture.code_facture}</Text>
                  <Text size="xs" c="dimmed">Date: {new Date(selectedFacture.date_facture).toLocaleDateString('fr-FR')}</Text>
                </div>
              </Group>

              {loadingFactureDetails ? (
                <Center py={30}><Loader size="sm" /></Center>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th>Code</Table.Th>
                      <Table.Th ta="center">Qté</Table.Th>
                      <Table.Th ta="right">Prix unit.</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {factureDetails.map((detail, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{detail.designation}</Table.Td>
                        <Table.Td>{detail.code_produit}</Table.Td>
                        <Table.Td ta="center">{detail.quantite}</Table.Td>
                        <Table.Td ta="right">{detail.prix_unitaire_vente.toLocaleString()} F</Table.Td>
                        <Table.Td ta="right">{detail.total.toLocaleString()} F</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                  <Table.Tfoot>
                    <Table.Tr>
                      <Table.Td colSpan={3}></Table.Td>
                      <Table.Td ta="right" fw={700}>Total HT</Table.Td>
                      <Table.Td ta="right" fw={700}>{selectedFacture.montant_ht.toLocaleString()} F</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td colSpan={3}></Table.Td>
                      <Table.Td ta="right" fw={700}>TVA (18%)</Table.Td>
                      <Table.Td ta="right" fw={700}>{(selectedFacture.montant_ttc - selectedFacture.montant_ht).toLocaleString()} F</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td colSpan={3}></Table.Td>
                      <Table.Td ta="right" fw={700}  c="blue">Total TTC</Table.Td>
                      <Table.Td ta="right" fw={700}  c="blue">{selectedFacture.montant_ttc.toLocaleString()} F</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td colSpan={3}></Table.Td>
                      <Table.Td ta="right" fw={700} c="orange">Commission</Table.Td>
                      <Table.Td ta="right" fw={700} c="orange">{selectedFacture.commission.toLocaleString()} F</Table.Td>
                    </Table.Tr>
                  </Table.Tfoot>
                </Table>
              )}
            </div>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setShowFactureModal(false)}>Fermer</Button>
              <Button leftSection={<IconPrinter size={16} />} onClick={() => handlePrintFacture()} color="violet">
                Imprimer
              </Button>
            </Group>
          </>
        )}
      </Modal>

      {/* MODAL DETAILS PRODUIT */}
      <Modal
        opened={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={`Détails - ${selectedProduct?.designation || ''}`}
        size="md"
        centered
      >
        {selectedProduct && (
          <Stack>
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">Code</Text>
                <Text fw={600}>{selectedProduct.code_produit}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Catégorie</Text>
                <Text fw={600}>{selectedProduct.categorie || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Quantité en stock</Text>
                <Text fw={600} c={selectedProduct.qte_stock <= 0 ? 'red' : selectedProduct.qte_stock <= 5 ? 'orange' : 'green'}>
                  {selectedProduct.qte_stock}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Unité</Text>
                <Text fw={600}>{selectedProduct.unite_base || '-'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Prix d'achat</Text>
                <Text fw={600}>{selectedProduct.prix_achat_base?.toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Prix de vente</Text>
                <Text fw={600} c="blue">{selectedProduct.prix_vente_gros?.toLocaleString()} F</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Marge unitaire</Text>
                <Text fw={600} c={(selectedProduct.prix_vente_gros || 0) - (selectedProduct.prix_achat_base || 0) >= 0 ? 'green' : 'red'}>
                  {((selectedProduct.prix_vente_gros || 0) - (selectedProduct.prix_achat_base || 0)).toLocaleString()} F
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Valeur du stock</Text>
                <Text fw={700} c="green">{(selectedProduct.qte_stock * selectedProduct.prix_achat_base).toLocaleString()} F</Text>
              </div>
            </SimpleGrid>

            <Divider />

            <Group justify="space-between">
              <Text size="sm" c="dimmed">Bénéfice potentiel total</Text>
              <Text fw={700} c="green">
                {((selectedProduct.qte_stock || 0) * ((selectedProduct.prix_vente_gros || 0) - (selectedProduct.prix_achat_base || 0))).toLocaleString()} F
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Chiffre d'affaires potentiel</Text>
              <Text fw={700} c="blue">
                {((selectedProduct.qte_stock || 0) * (selectedProduct.prix_vente_gros || 0)).toLocaleString()} F
              </Text>
            </Group>

            <Divider label="Ajustement d'inventaire" labelPosition="center" />
            <Text size="xs" c="dimmed">
              Corrige la quantité en stock. L'opération est tracée (mouvement + audit) — jamais silencieuse.
            </Text>
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <NumberInput
                label="Nouvelle quantité"
                value={adjustQte}
                onChange={(v) => setAdjustQte(Number(v) || 0)}
                min={0}
                w={140}
                hideControls={false}
              />
              <TextInput
                style={{ flex: 1 }}
                label="Motif"
                placeholder="Ex: inventaire physique, casse, correction…"
                value={adjustMotif}
                onChange={(e) => setAdjustMotif(e.currentTarget.value)}
              />
              <Button color="teal" loading={adjustLoading} onClick={handleAjuster}>Ajuster</Button>
            </Group>

            <Button variant="light" onClick={() => setShowDetailsModal(false)}>Fermer</Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}