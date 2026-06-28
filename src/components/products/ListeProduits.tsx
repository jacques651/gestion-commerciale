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
  IconRefresh, IconCube, IconAlertCircle, IconCash,
  IconFileExcel, IconFilter, IconPrinter, IconClearAll, IconUpload,
  IconBuildingStore, IconChartBar, IconAlertTriangle
} from '@tabler/icons-react';
import { productRepository, Product } from '../../database/repositories/productRepository';
import { FormulaireProduit } from './FormulaireProduit';
import { ModalImportProduits } from './ModalImportProduits';
import { ModalAjoutStock } from './ModalAjoutStock';
import { PageHeader } from '../common/PageHeader';

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
    const headers = ['Code', 'Désignation', 'Catégorie', 'Unité', 'Stock', 'Prix achat (PMP)', 'Prix vente', 'Prix gros', 'Date entrée'];
    const rows = filteredProducts.map(p => [
      p.code_produit,
      p.designation,
      p.categorie || '',
      p.unite_base,
      p.qte_stock,
      (p.prix_moyen_pondere || p.prix_achat_base).toLocaleString(),
      p.prix_vente_detail.toLocaleString(),
      p.prix_vente_gros.toLocaleString(),
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
      <PageHeader
        title="Produits & Stocks"
        subtitle="Gestion de l'inventaire et suivi des stocks"
        icon={<IconPackage size={20} />}
        color="green"
        action={{ label: 'Nouveau produit', onClick: () => setModalOpened(true), color: 'green' }}
        extra={
          <Button size="sm" variant="subtle" style={{ color: 'rgba(255,255,255,0.6)' }}
            leftSection={<IconUpload size={14} />} onClick={() => setImportModalOpen(true)}>
            Importer
          </Button>
        }
        stats={[
          { label: 'Références', value: stats.total, icon: <IconPackage size={13} /> },
          { label: 'Valeur vente', value: `${formatMontant(stats.valeurVente)} F`, icon: <IconCash size={13} />, color: '#40c057' },
          { label: 'Stock bas', value: stats.stockBas, icon: <IconAlertCircle size={13} />, color: stats.stockBas > 0 ? '#f59f00' : 'rgba(255,255,255,0.5)' },
          { label: 'Rupture', value: stats.ruptureStock, icon: <IconAlertTriangle size={13} />, color: stats.ruptureStock > 0 ? '#ff6b6b' : 'rgba(255,255,255,0.5)' },
        ]}
      />

      {/* Alertes stock */}
      {(stats.ruptureStock > 0 || stats.stockBas > 0) && (
        <Stack gap="xs">
          {stats.ruptureStock > 0 && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" radius="md">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{stats.ruptureStock} produit(s) en rupture de stock</Text>
                <Button size="xs" variant="white" color="red" onClick={() => setShowRuptureOnly(true)}>Voir les ruptures</Button>
              </Group>
            </Alert>
          )}
          {stats.stockBas > 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" radius="md">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{stats.stockBas} produit(s) en dessous du seuil d'alerte</Text>
                <Button size="xs" variant="white" color="orange" onClick={() => { setStockMin(null); setStockMax(null); setShowRuptureOnly(false); setCurrentPage(1); }}>
                  Voir tous
                </Button>
              </Group>
            </Alert>
          )}
        </Stack>
      )}

      {/* Barre de recherche, filtres et boutons sur une seule ligne */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Grid align="flex-end">
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
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
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
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
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
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Annuler</Button>
          <Button color="red" onClick={handleDelete}>Supprimer</Button>
        </Group>
      </Modal>

      <FormulaireProduit 
        opened={modalOpened} 
        onClose={() => { 
          setModalOpened(false); 
          setEditingProduct(null); 
          loadProducts(); 
        }} 
        editProduct={editingProduct} 
      />
      
      <ModalAjoutStock 
        opened={ajoutStockModalOpen} 
        onClose={() => { 
          setAjoutStockModalOpen(false); 
          setSelectedProductForStock(null); 
        }} 
        produit={selectedProductForStock} 
        onSuccess={loadProducts} 
      />
      
      <ModalImportProduits 
        opened={importModalOpen} 
        onClose={() => setImportModalOpen(false)} 
        onSuccess={loadProducts} 
      />
    </Stack>
  );
};

export default ListeProduits;