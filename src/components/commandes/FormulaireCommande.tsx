// src/components/commandes/FormulaireCommande.tsx
import React, { useState, useEffect } from 'react';
import { 
  Modal, TextInput, Select, Button, Group, Stack, 
  NumberInput, Table, ActionIcon, Text, Card, 
  Divider, LoadingOverlay, Grid, Badge,
  Tooltip, Pagination, ScrollArea, ThemeIcon, Paper, Center
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconTrash, IconPlus, IconSearch, 
  IconRefresh, IconUserPlus, IconShoppingBag, IconPhone, IconUser,
  IconPackage, IconBuildingStore, IconShoppingCart, IconCheck, IconTruck} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useCommandes } from '../../hooks/useCommandes';
import { FormulaireClient } from '../clients/FormulaireClient';
import { generateCommandeCode } from '../../utils/codeGenerator';

interface FormulaireCommandeProps {
  opened: boolean;
  onClose: () => void;
}

interface CartItem {
  idProduit: number;
  designation: string;
  code_produit: string;
  categorie?: string;
  unite_mesure?: string;
  quantite_stock: number;
  prix_vente: number;
  prix_achat_base?: number;
  quantite_commande: number;
  total: number;
}

export const FormulaireCommande: React.FC<FormulaireCommandeProps> = ({ opened, onClose }) => {
  const { clients, loading: clientsLoading, refresh: refreshClients } = useClients();
  const { products, loading: productsLoading, refresh: refreshProducts } = useProducts();
  const { createCommande, loading } = useCommandes();
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [clientModalOpened, setClientModalOpened] = useState(false);
  const [codeCommande, setCodeCommande] = useState('');
  const [typeCommande, setTypeCommande] = useState<string>('STANDARD');
  
  const itemsPerPage = 5;

  // Générer le code commande
  useEffect(() => {
    const generateCode = async () => {
      if (opened) {
        try {
          const code = await generateCommandeCode();
          setCodeCommande(code);
        } catch (error) {
          console.error("Erreur génération code:", error);
          setCodeCommande(`CMD-${Date.now()}`);
        }
      }
    };
    generateCode();
  }, [opened]);

  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.idClient.toString() === selectedClientId);
      setSelectedClientDetails(client);
    } else {
      setSelectedClientDetails(null);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    if (!opened) {
      setCart([]);
      setSelectedClientId(null);
      setSelectedClientDetails(null);
      setSearchTerm('');
      setSelectedCategory(null);
      setCurrentPage(1);
      setCodeCommande('');
      setTypeCommande('STANDARD');
    }
  }, [opened]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? product.categorie === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = [...new Set(products.map(p => p.categorie).filter(Boolean))];

  const formatPrice = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.idProduit === product.idProduit);
    const qte = 1;
    const stock = product.qte_stock || 0;
    const prix = product.prix_vente_detail || 0;
    
    if (prix <= 0) {
      notifications.show({
        title: 'Erreur',
        message: `Le prix du produit "${product.designation}" n'est pas défini`,
        color: 'red',
      });
      return;
    }
    
    if (existingItem) {
      const newQuantite = existingItem.quantite_commande + qte;
      if (newQuantite > stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${stock}`,
          color: 'red',
        });
        return;
      }
      setCart(cart.map(item =>
        item.idProduit === product.idProduit
          ? { 
              ...item, 
              quantite_commande: newQuantite, 
              total: newQuantite * item.prix_vente 
            }
          : item
      ));
    } else {
      if (qte > stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${stock}`,
          color: 'red',
        });
        return;
      }
      setCart([
        ...cart,
        {
          idProduit: product.idProduit,
          designation: product.designation || 'Sans nom',
          code_produit: product.code_produit || '-',
          categorie: product.categorie,
          unite_mesure: product.unite_base || 'pièce',
          quantite_stock: stock,
          prix_vente: prix,
          prix_achat_base: product.prix_achat_base || 0,
          quantite_commande: qte,
          total: qte * prix,
        }
      ]);
    }
  };

  const updateQuantity = (index: number, newQuantite: number) => {
    const item = cart[index];
    if (newQuantite > item.quantite_stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${item.quantite_stock}`,
        color: 'red',
      });
      return;
    }
    const newCart = [...cart];
    newCart[index].quantite_commande = newQuantite;
    newCart[index].total = newQuantite * item.prix_vente;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const totalArticles = cart.length;
  const totalPieces = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
  const montantTotal = cart.reduce((sum, item) => sum + item.total, 0);


const handleSubmit = async () => {
  if (!selectedClientId) {
    notifications.show({ title: 'Erreur', message: 'Sélectionnez un client', color: 'red' });
    return;
  }
  
  if (cart.length === 0) {
    notifications.show({ title: 'Erreur', message: 'Ajoutez au moins un produit', color: 'red' });
    return;
  }
  
  setSubmitting(true);
  
  try {
    const montantHT = montantTotal / 1.18;
    
   const commande = {
  code_commande: codeCommande,
  idClient: parseInt(selectedClientId),
  type_commande: typeCommande,
  montant_ht: montantHT,
  montant_ttc: montantTotal,
  statut: 'CONFIRMEE'
};
    
    const details = cart.map(item => ({
  idProduit: item.idProduit,
  qte_commande: item.quantite_commande,
  prix_unitaire_vente: item.prix_vente
}));
    
    // Utiliser la méthode du hook (elle gère sa propre transaction)
    await createCommande(commande, details);
    
    notifications.show({
      title: 'Succès',
      message: `Commande ${codeCommande} créée avec succès`,
      color: 'green',
    });
    
    onClose();
    
  } catch (error: any) {
    const errorMessage = error?.message || 'Erreur lors de la création de la commande';
    console.error('Erreur création commande:', errorMessage);
    notifications.show({
      title: 'Erreur',
      message: errorMessage,
      color: 'red',
    });
  } finally {
    setSubmitting(false);
  }
};
  
  const clientData = clients.map(c => ({ 
    value: c.idClient.toString(), 
    label: c.NomComplet || c.Societe || 'Client sans nom'
  }));

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        size="70%"
        padding="xl"
        radius="lg"
        styles={{
          header: { backgroundColor: '#1b365d', padding: '20px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 700, fontSize: '1.5rem' },
          body: { padding: 0 }
        }}
        title={
          <Group gap="md">
            <ThemeIcon size="lg" radius="md" color="white" variant="light">
              <IconShoppingCart size={24} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="white">Nouvelle Commande</Text>
              <Text size="xs" opacity={0.7} c="white">Créez une nouvelle commande client</Text>
            </div>
          </Group>
        }
      >
        <ScrollArea h="calc(100vh - 180px)" type="auto" p="lg">
          <Stack gap="xl">
            {/* Partie Client */}
            <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#f8f9fa' }}>
              <Group gap="xs" mb="md">
                <ThemeIcon color="blue" variant="light" radius="md">
                  <IconUser size={18} />
                </ThemeIcon>
                <Text fw={600} size="md">Informations client</Text>
              </Group>
              
              <Grid>
                <Grid.Col span={8}>
                  <Select
                    label="Sélectionnez le client"
                    placeholder="Rechercher un client..."
                    data={clientData}
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                    searchable
                    required
                    size="md"
                    leftSection={<IconUser size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Button 
                    leftSection={<IconUserPlus size={16} />}
                    onClick={() => setClientModalOpened(true)}
                    fullWidth
                    mt="auto"
                    size="md"
                    variant="light"
                    color="blue"
                    style={{ marginTop: 28 }}
                  >
                    Nouveau client
                  </Button>
                </Grid.Col>
              </Grid>

              {selectedClientDetails && (
                <Paper p="sm" withBorder radius="md" mt="sm" style={{ backgroundColor: 'white' }}>
                  <Group grow>
                    <Group gap="xs">
                      <IconPhone size={14} color="#1b365d" />
                      <Text size="sm">{selectedClientDetails.Tel || 'Tél non renseigné'}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconBuildingStore size={14} color="#1b365d" />
                      <Text size="sm">{selectedClientDetails.TypeClient === 'revendeur' ? 'Revendeur' : 'Client'}</Text>
                    </Group>
                  </Group>
                </Paper>
              )}
            </Card>

            {/* Type de commande */}
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group gap="xs" mb="md">
                <ThemeIcon color="green" variant="light" radius="md">
                  <IconPackage size={18} />
                </ThemeIcon>
                <Text fw={600} size="md">Type de commande</Text>
              </Group>
              
              <Grid>
                <Grid.Col span={6}>
                  <Paper
                    p="md"
                    withBorder
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      backgroundColor: typeCommande === 'STANDARD' ? '#eef3f9' : 'white',
                      borderColor: typeCommande === 'STANDARD' ? '#1b365d' : '#e5e7eb'
                    }}
                    onClick={() => setTypeCommande('STANDARD')}
                  >
                    <Group>
                      <ThemeIcon color="blue" variant={typeCommande === 'STANDARD' ? 'filled' : 'light'} radius="xl">
                        <IconShoppingBag size={18} />
                      </ThemeIcon>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">Commande Standard</Text>
                        <Text size="xs" c="dimmed">Vente au détail - Prix normal</Text>
                      </div>
                      {typeCommande === 'STANDARD' && <IconCheck size={18} color="#1b365d" />}
                    </Group>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Paper
                    p="md"
                    withBorder
                    radius="md"
                    style={{
                      cursor: 'pointer',
                      backgroundColor: typeCommande === 'REVENDEUR' ? '#e8f5e9' : 'white',
                      borderColor: typeCommande === 'REVENDEUR' ? '#2e7d32' : '#e5e7eb'
                    }}
                    onClick={() => setTypeCommande('REVENDEUR')}
                  >
                    <Group>
                      <ThemeIcon color="green" variant={typeCommande === 'REVENDEUR' ? 'filled' : 'light'} radius="xl">
                        <IconTruck size={18} />
                      </ThemeIcon>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">Commande Revendeur</Text>
                        <Text size="xs" c="dimmed">Approvisionnement stock revendeur</Text>
                      </div>
                      {typeCommande === 'REVENDEUR' && <IconCheck size={18} color="#2e7d32" />}
                    </Group>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Divider my="md" />
              
              <TextInput
                label="Code commande"
                value={codeCommande}
                readOnly
                disabled
                size="md"
                leftSection={<IconPackage size={16} />}
              />
            </Card>

            {/* Liste des produits */}
            <Card withBorder radius="lg" shadow="sm" p="lg">
              <Group gap="xs" mb="md" justify="space-between">
                <Group>
                  <ThemeIcon color="grape" variant="light" radius="md">
                    <IconSearch size={18} />
                  </ThemeIcon>
                  <Text fw={600} size="md">Catalogue produits</Text>
                </Group>
                <Badge color="blue" variant="light" size="lg">{products.length} produits disponibles</Badge>
              </Group>
              
              <Grid>
                <Grid.Col span={8}>
                  <TextInput
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftSection={<IconSearch size={16} />}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    placeholder="Catégorie"
                    data={categories.map(c => ({ value: c, label: c }))}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    clearable
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <Tooltip label="Actualiser">
                    <ActionIcon onClick={refreshProducts} size="md" variant="outline" h={38}>
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Grid.Col>
              </Grid>

              <ScrollArea h={280}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#eef3f9' }}>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th ta="right">Prix vente</Table.Th>
                      <Table.Th ta="right">Prix achat</Table.Th>
                      <Table.Th ta="center">Stock</Table.Th>
                      <Table.Th ta="center" w={100}>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedProducts.map((product) => (
                      <Table.Tr key={product.idProduit}>
                        <Table.Td>
                          <Text fw={500} size="sm">{product.designation}</Text>
                          <Text size="xs" c="dimmed">{product.code_produit}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c="blue">{formatPrice(product.prix_vente_detail)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c="dimmed">{formatPrice(product.prix_achat_base)} F</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge 
                            color={(product.qte_stock || 0) < 10 ? 'red' : 'green'} 
                            variant="light" 
                            size="sm"
                          >
                            {product.qte_stock || 0} unités
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Button
                            size="xs"
                            leftSection={<IconPlus size={14} />}
                            onClick={() => addToCart(product)}
                            disabled={(product.qte_stock || 0) === 0}
                            variant="light"
                            color="blue"
                          >
                            Ajouter
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {filteredProducts.length === 0 && (
                <Center py="xl">
                  <Stack align="center">
                    <IconSearch size={40} color="#ccc" />
                    <Text c="dimmed">Aucun produit trouvé</Text>
                  </Stack>
                </Center>
              )}

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
                </Group>
              )}
            </Card>

            {/* Panier */}
            {cart.length > 0 && (
              <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#fafafa' }}>
                <Group gap="xs" mb="md">
                  <ThemeIcon color="orange" variant="light" radius="md">
                    <IconShoppingCart size={18} />
                  </ThemeIcon>
                  <Text fw={600} size="md">Panier ({totalArticles} articles)</Text>
                </Group>
                
                <ScrollArea h={200}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Produit</Table.Th>
                        <Table.Th ta="center" w={100}>Qté</Table.Th>
                        <Table.Th ta="right" w={120}>Total</Table.Th>
                        <Table.Th ta="center" w={50}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {cart.map((item, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>
                            <Text size="sm" fw={500}>{item.designation}</Text>
                            <Text size="xs" c="dimmed">{item.code_produit}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <NumberInput
                              value={item.quantite_commande}
                              onChange={(val) => updateQuantity(index, Number(val) || 1)}
                              min={1}
                              max={item.quantite_stock}
                              size="xs"
                              w={80}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c="blue">{formatPrice(item.total)} F</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <ActionIcon color="red" onClick={() => removeFromCart(index)} size="sm" variant="subtle">
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="md" />

                <Grid>
                  <Grid.Col span={4}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Articles</Text>
                      <Text size="xl" fw={700}>{totalArticles}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Pièces</Text>
                      <Text size="xl" fw={700}>{totalPieces}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder p="sm" style={{ backgroundColor: '#eef3f9' }}>
                      <Text size="xs" c="dimmed">Total TTC</Text>
                      <Text size="xl" fw={700} c="adminBlue">{formatPrice(montantTotal)} F</Text>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Card>
            )}

            {/* Boutons d'action */}
            <Group justify="flex-end" mt="md" pb="md">
              <Button 
                variant="outline" 
                onClick={onClose} 
                size="md"
                leftSection={<IconTrash size={16} />}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit} 
                loading={submitting || loading}
                disabled={cart.length === 0 || !selectedClientId}
                size="md"
                color="green"
                leftSection={<IconShoppingBag size={16} />}
              >
                Enregistrer la commande
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
        
        <LoadingOverlay visible={clientsLoading || productsLoading} />
      </Modal>

      <FormulaireClient
        opened={clientModalOpened}
        onClose={() => {
          setClientModalOpened(false);
          refreshClients();
        }}
      />
    </>
  );
};

export default FormulaireCommande;