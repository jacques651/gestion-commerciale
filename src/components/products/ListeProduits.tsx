// src/components/products/ListeProduits.tsx
import React, { useState, useEffect } from 'react';
import {
  Table, TextInput, Button, Group, Badge, ActionIcon,
  Stack, Title, Card, Text, Tooltip, Pagination, Modal,
  ScrollArea, Paper, Flex, ThemeIcon, SimpleGrid, Avatar,
  Loader, Alert, NumberInput, Divider, Select, Grid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconPackage,
  IconRefresh, IconCube, IconAlertCircle, IconCoin, IconCash,
  IconFileExcel, IconFilter, IconPrinter, IconClearAll, IconUpload,
  IconBuildingStore, IconChartBar, IconAlertTriangle
} from '@tabler/icons-react';
import { productRepository, Product } from '../../database/repositories/productRepository';
import { stockService } from '../../database/repositories/stockService';
import { FormulaireProduit } from './FormulaireProduit';
import { ModalImportProduits } from './ModalImportProduits';

// Modal d'ajout de stock (inchangé)
const ModalAjoutStock: React.FC<{
  opened: boolean;
  onClose: () => void;
  produit: Product | null;
  onSuccess: () => void;
}> = ({ opened, onClose, produit, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [quantite, setQuantite] = useState<number>(1);
  const [prixAchat, setPrixAchat] = useState<number>(0);
  const [margeFixe, setMargeFixe] = useState<number>(produit?.commission_pourcentage || 5000);
  const [dateEntree, setDateEntree] = useState<Date>(new Date());
  const [referenceFacture, setReferenceFacture] = useState('');
  const [notes, setNotes] = useState('');

  const prixVenteCalcule = prixAchat + margeFixe;

  useEffect(() => {
    if (opened && produit) {
      setQuantite(1);
      setPrixAchat(0);
      setMargeFixe(produit.commission_pourcentage || 5000);
      setDateEntree(new Date());
      setReferenceFacture('');
      setNotes('');
    }
  }, [opened, produit]);

  const handleSubmit = async () => {
    if (!produit) return;
    if (quantite <= 0) {
      notifications.show({ title: 'Erreur', message: 'Quantité invalide', color: 'red' });
      return;
    }
    if (prixAchat <= 0) {
      notifications.show({ title: 'Erreur', message: 'Prix d\'achat invalide', color: 'red' });
      return;
    }

    setLoading(true);
    try {
      const result = await stockService.entreeStock({
        idProduit: produit.idProduit,
        quantite: quantite,
        prix_achat: prixAchat,
        prix_vente: prixVenteCalcule,
        date_entree: dateEntree.toISOString().split('T')[0],
        reference_facture: referenceFacture || undefined,
        notes: notes || undefined
      });

      if (result.success) {
        notifications.show({
          title: '✅ Stock ajouté',
          message: `${quantite} ${produit.unite_base} ajouté(s) | Prix vente: ${prixVenteCalcule.toLocaleString()} F`,
          color: 'green'
        });
        onSuccess();
        onClose();
      } else {
        notifications.show({ title: 'Erreur', message: result.message, color: 'red' });
      }
    } catch (error) {
      notifications.show({ title: 'Erreur', message: error instanceof Error ? error.message : 'Erreur', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Ajouter du stock - ${produit?.designation}`} size="md" centered>
      <Stack gap="sm">
        <Alert icon={<IconPackage size={16} />} color="blue" variant="light" p="xs">
          <SimpleGrid cols={2} spacing="xs">
            <Text size="xs">📦 Code: {produit?.code_produit}</Text>
            <Text size="xs">📊 Stock: {produit?.qte_stock || 0} {produit?.unite_base}</Text>
            <Text size="xs">💰 PMP: {(produit?.prix_achat_base || 0).toLocaleString()} F</Text>
            <Text size="xs">💎 Marge: +{(produit?.commission_pourcentage || 5000).toLocaleString()} F</Text>
          </SimpleGrid>
        </Alert>
        <NumberInput label="Quantité" value={quantite} onChange={(val) => setQuantite(typeof val === 'number' ? val : 0)} min={1} size="sm" />
        <NumberInput label="Prix d'achat (F CFA)" value={prixAchat} onChange={(val) => setPrixAchat(typeof val === 'number' ? val : 0)} min={0} step={100} size="sm" leftSection={<IconCash size={14} />} />
        <NumberInput label="Marge fixe (F CFA)" value={margeFixe} onChange={(val) => setMargeFixe(typeof val === 'number' ? val : 0)} min={0} step={100} size="sm" leftSection={<IconCoin size={14} />} />
        {prixAchat > 0 && (
          <Alert color="green" variant="light" p="xs">
            <Group justify="space-between">
              <Text size="sm">💵 Prix vente:</Text>
              <Text fw={700} c="blue">{prixVenteCalcule.toLocaleString()} F</Text>
            </Group>
          </Alert>
        )}
        <TextInput type="date" label="Date d'entrée" value={dateEntree.toISOString().split('T')[0]} onChange={(e) => setDateEntree(new Date(e.target.value))} size="sm" />
        <TextInput label="Référence facture" placeholder="N° de facture" value={referenceFacture} onChange={(e) => setReferenceFacture(e.target.value)} size="sm" />
        <Group justify="flex-end" mt="sm">
          <Button variant="outline" onClick={onClose} size="sm">Annuler</Button>
          <Button onClick={handleSubmit} loading={loading} color="green" size="sm">Ajouter</Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export const ListeProduits: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [uniteFiltre, setUniteFiltre] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<Date | null>(null);
  const [dateFin, setDateFin] = useState<Date | null>(null);
  const [stockMin, setStockMin] = useState<number | null>(null);
  const [stockMax, setStockMax] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showRuptureOnly, setShowRuptureOnly] = useState(false);

  // Modals states
  const [modalOpened, setModalOpened] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [ajoutStockModalOpen, setAjoutStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const itemsPerPage = 12;

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await productRepository.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Erreur chargement:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les produits', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = [...new Set(products.map(p => p.categorie).filter(Boolean))];
  const unites = [...new Set(products.map(p => p.unite_base).filter(Boolean))];

  // Statistiques globales
  const stats = {
    total: products.length,
    categories: categories.length,
    ruptureStock: products.filter(p => p.qte_stock <= 0).length,
    stockBas: products.filter(p => p.qte_stock > 0 && p.qte_stock <= (p.seuil_alerte || 10)).length,
    stockOK: products.filter(p => p.qte_stock > (p.seuil_alerte || 10)).length,
    valeurVente: products.reduce((sum, p) => sum + (p.qte_stock * p.prix_vente_detail), 0),
    valeurAchat: products.reduce((sum, p) => sum + (p.qte_stock * (p.prix_moyen_pondere || p.prix_achat_base)), 0),
    margePotentielle: products.reduce((sum, p) => sum + (p.qte_stock * p.prix_vente_detail), 0) - 
                      products.reduce((sum, p) => sum + (p.qte_stock * (p.prix_moyen_pondere || p.prix_achat_base)), 0)
  };

  // Filtrage avancé
  const filteredProducts = products.filter(p => {
    const matchSearch = searchTerm === '' ||
      p.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategorie = !categorieFiltre || p.categorie === categorieFiltre;
    const matchUnite = !uniteFiltre || p.unite_base === uniteFiltre;
    const matchStock = (!stockMin || p.qte_stock >= stockMin) && (!stockMax || p.qte_stock <= stockMax);
    const matchRupture = !showRuptureOnly || p.qte_stock <= 0;

    let matchDate = true;
    if (dateDebut || dateFin) {
      const dateEntree = new Date(p.date_entree);
      if (dateDebut && dateEntree < dateDebut) matchDate = false;
      if (dateFin && dateEntree > dateFin) matchDate = false;
    }

    return matchSearch && matchCategorie && matchUnite && matchStock && matchDate && matchRupture;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatMontant = (value: number): string => (value || 0).toLocaleString('fr-FR');


  const handleDelete = async () => {
    if (productToDelete) {
      await productRepository.delete(productToDelete.idProduit);
      notifications.show({ title: 'Succès', message: 'Produit supprimé', color: 'green' });
      setDeleteModalOpen(false);
      setProductToDelete(null);
      loadProducts();
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategorieFiltre(null);
    setUniteFiltre(null);
    setDateDebut(null);
    setDateFin(null);
    setStockMin(null);
    setStockMax(null);
    setShowRuptureOnly(false);
    setCurrentPage(1);
  };

  // Export Excel
  const exportToExcel = () => {
    const headers = ['Code', 'Désignation', 'Catégorie', 'Unité', 'Stock', 'Prix achat (PMP)', 'Prix vente', 'Date entrée'];
    const rows = filteredProducts.map(p => [
      p.code_produit,
      p.designation,
      p.categorie || '',
      p.unite_base,
      p.qte_stock,
      (p.prix_moyen_pondere || p.prix_achat_base).toLocaleString(),
      p.prix_vente_detail.toLocaleString(),
      new Date(p.date_entree).toLocaleDateString('fr-FR')
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `export_produits_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifications.show({ title: '✅ Export terminé', message: `${filteredProducts.length} produit(s) exportés`, color: 'green' });
  };

  // Impression
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const today = new Date().toLocaleDateString('fr-FR');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Liste des produits - ${today}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #1b365d; text-align: center; }
          .header { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #1b365d; color: white; padding: 10px; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; }
          .total { margin-top: 20px; text-align: right; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header"><h1>GESTION DES STOCKS DE PRODUITS</h1><div>Établi le : ${today}</div></div>
        <table><thead><tr><th>Code</th><th>Désignation</th><th>Catégorie</th><th>Unité</th><th>Stock</th><th>Prix vente</th></tr></thead>
          <tbody>${filteredProducts.map(p => `<tr><td>${p.code_produit}</td><td>${p.designation}</td><td>${p.categorie || '-'}</td><td>${p.unite_base}</td><td>${p.qte_stock}</td><td>${p.prix_vente_detail.toLocaleString()} F</td></tr>`).join('')}</tbody>
        </table>
        <div class="total">Total produits : ${filteredProducts.length}</div>
        <div class="footer">Document généré par l'application de gestion commerciale</div>
        <script>window.print();setTimeout(()=>window.close(),1000);</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading && products.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des produits...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête avec toutes les statistiques */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconPackage size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">GESTION DES STOCKS DE PRODUITS</Title>
              <Text c="gray.3" size="sm">Gérez votre inventaire et suivez vos stocks</Text>
            </div>
          </Group>
          <Group>
            <Button variant="light" color="yellow" leftSection={<IconUpload size={18} />} onClick={() => setImportModalOpen(true)}>Importer</Button>
            <Button variant="light" color="white" leftSection={<IconRefresh size={18} />} onClick={loadProducts}>Actualiser</Button>
            <Button variant="filled" color="white" c="dark" leftSection={<IconPlus size={18} />} onClick={() => setModalOpened(true)}>Nouveau produit</Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="white" variant="light" size="lg"><IconPackage size={20} /></ThemeIcon><div><Text c="white" size="xs">Références</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div></Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="green" variant="light" size="lg"><IconCash size={20} /></ThemeIcon><div><Text c="white" size="xs">Valeur vente</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.valeurVente)} F</Text></div></Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="blue" variant="light" size="lg"><IconBuildingStore size={20} /></ThemeIcon><div><Text c="white" size="xs">Valeur achat</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.valeurAchat)} F</Text></div></Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconChartBar size={20} /></ThemeIcon><div><Text c="white" size="xs">Marge pot.</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.margePotentielle)} F</Text></div></Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="orange" variant="light" size="lg"><IconAlertCircle size={20} /></ThemeIcon><div><Text c="white" size="xs">Stock bas</Text><Text c="white" fw={700} size="xl">{stats.stockBas}</Text></div></Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group><ThemeIcon color="red" variant="light" size="lg"><IconAlertTriangle size={20} /></ThemeIcon><div><Text c="white" size="xs">Rupture</Text><Text c="white" fw={700} size="xl">{stats.ruptureStock}</Text></div></Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Alertes */}
      {stats.ruptureStock > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" radius="md">
          <Group justify="space-between">
            <Text size="sm" fw={500}>{stats.ruptureStock} produit(s) en rupture de stock</Text>
            <Button size="xs" variant="white" color="red" onClick={() => setShowRuptureOnly(true)}>Voir les ruptures</Button>
          </Group>
        </Alert>
      )}

      {/* Barre de recherche, filtres et boutons sur une seule ligne */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Grid  align="flex-end">
          {/* Recherche */}
          <Grid.Col span={2.5}>
            <TextInput
              placeholder="Rechercher..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              size="sm"
            />
          </Grid.Col>
          
          {/* Filtre Catégorie */}
          <Grid.Col span={1.5}>
            <Select
              placeholder="Catégorie"
              data={categories.map(c => ({ value: c, label: c }))}
              value={categorieFiltre}
              onChange={setCategorieFiltre}
              clearable
              size="sm"
            />
          </Grid.Col>
          
          {/* Filtre Unité */}
          <Grid.Col span={1.2}>
            <Select
              placeholder="Unité"
              data={unites.map(u => ({ value: u, label: u }))}
              value={uniteFiltre}
              onChange={setUniteFiltre}
              clearable
              size="sm"
            />
          </Grid.Col>
          
          {/* Filtre Stock */}
          <Grid.Col span={1.2}>
            <Select
              placeholder="Stock"
              data={[
                { value: 'all', label: 'Tous' },
                { value: 'rupture', label: 'Rupture' },
                { value: 'bas', label: 'Stock bas' },
                { value: 'ok', label: 'Stock OK' }
              ]}
              value={showRuptureOnly ? 'rupture' : null}
              onChange={(val) => {
                setShowRuptureOnly(val === 'rupture');
                setCurrentPage(1);
              }}
              clearable
              size="sm"
            />
          </Grid.Col>
          
          {/* Boutons d'action */}
          <Grid.Col span={3.6}>
            <Group gap="xs" justify="flex-end">
              <Button 
                variant={showFilters ? "filled" : "light"} 
                color={showFilters ? "blue" : "gray"} 
                leftSection={<IconFilter size={14} />} 
                onClick={() => setShowFilters(!showFilters)} 
                size="sm"
              >
                Filtres
              </Button>
              <Tooltip label="Réinitialiser">
                <ActionIcon variant="light" color="red" size="md" onClick={resetFilters}>
                  <IconClearAll size={16} />
                </ActionIcon>
              </Tooltip>
              <Divider orientation="vertical" />
              <Tooltip label="Importer">
                <ActionIcon variant="light" color="teal" size="md" onClick={() => setImportModalOpen(true)}>
                  <IconUpload size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter">
                <ActionIcon variant="light" color="green" size="md" onClick={exportToExcel}>
                  <IconFileExcel size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon variant="light" color="indigo" size="md" onClick={handlePrint}>
                  <IconPrinter size={16} />
                </ActionIcon>
              </Tooltip>
              <Divider orientation="vertical" />
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" color="gray" size="md" onClick={loadProducts}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button 
                variant="gradient" 
                gradient={{ from: 'blue', to: 'cyan', deg: 90 }} 
                leftSection={<IconPlus size={14} />} 
                onClick={() => setModalOpened(true)} 
                size="sm"
              >
                Nouveau
              </Button>
            </Group>
          </Grid.Col>
        </Grid>

        {/* Panneau des filtres avancés (affiché en dessous) */}
        {showFilters && (
          <Paper withBorder p="md" radius="md" mt="md" bg="gray.0">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <TextInput 
                type="date" 
                label="Date début" 
                value={dateDebut ? dateDebut.toISOString().split('T')[0] : ''} 
                onChange={(e) => setDateDebut(e.target.value ? new Date(e.target.value) : null)} 
                size="xs" 
              />
              <TextInput 
                type="date" 
                label="Date fin" 
                value={dateFin ? dateFin.toISOString().split('T')[0] : ''} 
                onChange={(e) => setDateFin(e.target.value ? new Date(e.target.value) : null)} 
                size="xs" 
              />
              <NumberInput 
                label="Stock min" 
                placeholder="Min" 
                value={stockMin || ''} 
                onChange={(val) => setStockMin(val === '' ? null : Number(val))} 
                min={0} 
                size="xs" 
              />
              <NumberInput 
                label="Stock max" 
                placeholder="Max" 
                value={stockMax || ''} 
                onChange={(val) => setStockMax(val === '' ? null : Number(val))} 
                min={0} 
                size="xs" 
              />
            </SimpleGrid>
            <Group justify="flex-end" mt="md">
              <Button size="xs" variant="outline" onClick={resetFilters}>Tout effacer</Button>
            </Group>
          </Paper>
        )}
        
        <Text size="xs" c="dimmed" mt="xs">
          📊 {filteredProducts.length} produit(s) trouvé(s) sur {products.length}
        </Text>
      </Card>

      {/* Tableau des produits */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h="calc(100vh - 480px)">
          <Table striped highlightOnHover>
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
              <Table.Tr>
                <Table.Th style={{ color: 'white' }}>Code</Table.Th>
                <Table.Th style={{ color: 'white' }}>Désignation</Table.Th>
                <Table.Th style={{ color: 'white' }}>Catégorie</Table.Th>
                <Table.Th style={{ color: 'white' }}>Unité</Table.Th>
                <Table.Th style={{ color: 'white' }} ta="center">Stock</Table.Th>
                <Table.Th style={{ color: 'white' }} ta="right">Prix achat (PMP)</Table.Th>
                <Table.Th style={{ color: 'white' }} ta="right">Prix vente</Table.Th>
                <Table.Th style={{ color: 'white' }} ta="right">Valeur stock</Table.Th>
                <Table.Th style={{ color: 'white' }} ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedProducts.map((product) => (
                <Table.Tr key={product.idProduit} style={product.qte_stock <= 0 ? { backgroundColor: '#fff5f5' } : {}}>
                  <Table.Td>
                    <Text fw={600} size="sm">{product.code_produit}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" radius="xl" color="blue">
                        <IconCube size={14} />
                      </Avatar>
                      <Text fw={500} size="sm">{product.designation}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">{product.categorie || '-'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{product.unite_base}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    {product.qte_stock <= 0 ? (
                      <Badge color="red" variant="filled" size="sm">Rupture</Badge>
                    ) : (
                      <Badge 
                        color={product.qte_stock <= (product.seuil_alerte || 10) ? 'orange' : 'green'} 
                        variant="light" 
                        size="sm"
                      >
                        {product.qte_stock}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed">
                      {formatMontant(product.prix_moyen_pondere || product.prix_achat_base)} F
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={700} c="blue">
                      {formatMontant(product.prix_vente_detail)} F
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600}>
                      {(product.qte_stock * product.prix_vente_detail).toLocaleString()} F
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center">
                      <Tooltip label="Ajouter du stock">
                        <ActionIcon 
                          color="blue" 
                          variant="light" 
                          size="md" 
                          onClick={() => { 
                            setSelectedProductForStock(product); 
                            setAjoutStockModalOpen(true); 
                          }}
                        >
                          <IconPlus size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <ActionIcon 
                          color="yellow" 
                          variant="light" 
                          size="md" 
                          onClick={() => { 
                            setEditingProduct(product); 
                            setModalOpened(true); 
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon 
                          color="red" 
                          variant="light" 
                          size="md" 
                          onClick={() => { 
                            setProductToDelete(product); 
                            setDeleteModalOpen(true); 
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {filteredProducts.length === 0 && (
          <Text ta="center" c="dimmed" py={60}>
            {showRuptureOnly ? '🎉 Aucun produit en rupture de stock !' : 'Aucun produit trouvé'}
          </Text>
        )}
        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} />
          </Group>
        )}
      </Card>

      {/* Modals */}
      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirmation" centered>
        <Alert icon={<IconAlertCircle size={16} />} color="red">Supprimer "{productToDelete?.designation}" ?</Alert>
        <Group justify="flex-end" mt="md"><Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Annuler</Button><Button color="red" onClick={handleDelete}>Supprimer</Button></Group>
      </Modal>

      <FormulaireProduit opened={modalOpened} onClose={() => { setModalOpened(false); setEditingProduct(null); loadProducts(); }} editProduct={editingProduct} />
      <ModalAjoutStock opened={ajoutStockModalOpen} onClose={() => { setAjoutStockModalOpen(false); setSelectedProductForStock(null); }} produit={selectedProductForStock} onSuccess={loadProducts} />
      <ModalImportProduits opened={importModalOpen} onClose={() => setImportModalOpen(false)} onSuccess={loadProducts} />
    </Stack>
  );
};

export default ListeProduits;