// src/components/products/ListeProduits.tsx
import React, { useState } from 'react';
import {
  Table, TextInput, Button, Group, Badge, ActionIcon,
  Stack, Title, Card, Text, Tooltip, Pagination, Modal,
  ScrollArea, Paper, Flex, ThemeIcon, SimpleGrid, Avatar,
  Loader, Alert, Select} from '@mantine/core';
import {
  IconSearch, IconPlus, IconEdit, IconTrash, IconBox, IconPackage,
  IconRefresh, IconCube, IconAlertCircle
  } from '@tabler/icons-react';
import { useProducts } from '../../hooks/useProducts';
import { FormulaireProduit } from './FormulaireProduit';
import GestionConditionnements from './GestionConditionnements';
import { notifications } from '@mantine/notifications';

export const ListeProduits: React.FC = () => {
  const { products, loading, deleteProduct, refresh } = useProducts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [conditionnementModalOpen, setConditionnementModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  
  const itemsPerPage = 12;

  // Catégories uniques
  const categories = [...new Set(products.map((p: any) => p.categorie).filter(Boolean))];

  // Filtrage
  const filteredProducts = products.filter((p: any) => {
    const matchSearch = searchTerm === '' || 
      p.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategorie = !categorieFiltre || p.categorie === categorieFiltre;
    return matchSearch && matchCategorie;
  });

  // Statistiques
  const stats = {
    total: products.length,
    categories: categories.length,
    ruptureStock: products.filter((p: any) => (p.qte_stock || 0) <= 0).length,
    valeurStock: products.reduce((sum: number, p: any) => sum + ((p.qte_stock || 0) * (p.prix_achat_base || 0)), 0)
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getStockBadge = (stock: number, seuil: number) => {
    if (stock <= 0) return <Badge color="red" variant="filled" size="sm">Rupture</Badge>;
    if (stock <= seuil) return <Badge color="orange" variant="light" size="sm">Stock bas ({stock})</Badge>;
    return <Badge color="green" variant="light" size="sm">Stock OK ({stock})</Badge>;
  };

  const handleDeleteClick = (product: any) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.idProduit);
      notifications.show({ title: 'Succès', message: `Produit supprimé`, color: 'green' });
      setDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setEditingProduct(null);
    refresh();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategorieFiltre(null);
    setCurrentPage(1);
  };

  if (loading && products.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* En-tête */}
      <Paper p="xl" radius="lg" style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
        <Flex justify="space-between" align="center">
          <Group gap="md">
            <ThemeIcon size={50} radius="md" color="white" variant="light">
              <IconPackage size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Catalogue Produits</Title>
              <Text c="gray.3" size="sm">Gérez votre catalogue et stocks</Text>
            </div>
          </Group>
          <Button variant="light" color="white" leftSection={<IconPlus size={18} />} onClick={() => setModalOpened(true)}>
            Nouveau produit
          </Button>
        </Flex>

        <SimpleGrid cols={4} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Total produits</Text>
            <Text c="white" fw={700} size="xl">{stats.total}</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Catégories</Text>
            <Text c="white" fw={700} size="xl">{stats.categories}</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Rupture stock</Text>
            <Text c="white" fw={700} size="xl">{stats.ruptureStock}</Text>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Text c="white" size="xs">Valeur stock</Text>
            <Text c="white" fw={700} size="xl">{formatMontant(stats.valeurStock)} F</Text>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Barre d'outils */}
      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Flex gap="md">
          <TextInput
            placeholder="Rechercher..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ flex: 2 }}
          />
          <Select
            placeholder="Catégorie"
            data={[{ value: '', label: 'Toutes' }, ...categories.map(c => ({ value: c, label: c }))]}
            value={categorieFiltre}
            onChange={setCategorieFiltre}
            clearable
            style={{ width: 200 }}
          />
          <Button variant="light" onClick={resetFilters} leftSection={<IconRefresh size={16} />}>
            Réinitialiser
          </Button>
          <Tooltip label="Actualiser">
            <ActionIcon variant="light" onClick={refresh} size="lg">
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Flex>
      </Card>

      {/* Tableau */}
      <Card withBorder radius="lg" shadow="sm" p={0}>
        <ScrollArea h="calc(100vh - 450px)">
          <Table striped highlightOnHover>
            <Table.Thead style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Désignation</Table.Th>
                <Table.Th>Catégorie</Table.Th>
                <Table.Th ta="right">Prix achat</Table.Th>
                <Table.Th ta="right">Prix vente</Table.Th>
                <Table.Th ta="center">Stock</Table.Th>
                <Table.Th ta="center">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedProducts.map((product: any) => (
                <Table.Tr key={product.idProduit}>
                  <Table.Td><Text fw={600} size="sm">{product.code_produit}</Text></Table.Td>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" radius="xl" color="blue"><IconCube size={14} /></Avatar>
                      <Text fw={500} size="sm">{product.designation}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Badge variant="light">{product.categorie || '-'}</Badge></Table.Td>
                  <Table.Td ta="right">{formatMontant(product.prix_achat_base)} F</Table.Td>
                  <Table.Td ta="right"><Text fw={700} c="blue">{formatMontant(product.prix_vente_detail)} F</Text></Table.Td>
                  <Table.Td ta="center">{getStockBadge(product.qte_stock || 0, product.seuil_alerte || 10)}</Table.Td>
                  <Table.Td ta="center">
                    <Group gap={4} justify="center">
                      <Tooltip label="Conditionnements">
                        <ActionIcon color="teal" variant="light" size="md" onClick={() => { setSelectedProduct(product); setConditionnementModalOpen(true); }}>
                          <IconBox size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Modifier">
                        <ActionIcon color="blue" variant="light" size="md" onClick={() => handleEdit(product)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Supprimer">
                        <ActionIcon color="red" variant="light" size="md" onClick={() => handleDeleteClick(product)}>
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
          <Text ta="center" c="dimmed" py={60}>Aucun produit trouvé</Text>
        )}

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} />
          </Group>
        )}
      </Card>

      {/* Modals */}
      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Supprimer" centered>
        <Alert icon={<IconAlertCircle size={16} />} color="red">Confirmer la suppression ?</Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Annuler</Button>
          <Button color="red" onClick={confirmDelete}>Supprimer</Button>
        </Group>
      </Modal>

      <FormulaireProduit opened={modalOpened} onClose={handleCloseModal} editProduct={editingProduct} />

      <Modal opened={conditionnementModalOpen} onClose={() => setConditionnementModalOpen(false)} title={`Conditionnements`} size="lg" centered>
        {selectedProduct && <GestionConditionnements idProduit={selectedProduct.idProduit} />}
      </Modal>
    </Stack>
  );
};

export default ListeProduits;