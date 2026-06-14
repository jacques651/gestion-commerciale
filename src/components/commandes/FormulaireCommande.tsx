// src/components/commandes/FormulaireCommande.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, TextInput, Select, Button, Group, Stack,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, LoadingOverlay, Grid, Badge,
  Tooltip, Pagination, ScrollArea, ThemeIcon, Paper, Center,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash, IconPlus, IconSearch,
  IconRefresh, IconUserPlus, IconShoppingBag, IconPhone, IconUser,
  IconPackage, IconBuildingStore, IconShoppingCart, IconCheck, IconTruck,
  IconPercentage
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useCommandes } from '../../hooks/useCommandes';
import { FormulaireClient } from '../clients/FormulaireClient';

import { generateCommandeCode } from '../../utils/codeGenerator';
import { stockService } from '../../database/repositories/stockService';
import FormulaireProduit from '../products/FormulaireProduit';

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
  const [produitModalOpened, setProduitModalOpened] = useState(false);
  const [produitToEdit, setProduitToEdit] = useState<any>(null);
  const [codeCommande, setCodeCommande] = useState('');
  const [typeCommande, setTypeCommande] = useState<string>('STANDARD');
  const [commissionPourcentage, setCommissionPourcentage] = useState<number>(0);
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});

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

      if (client) {
        if (client.TypeClient === 'revendeur') {
          setTypeCommande('REVENDEUR');
        } else {
          setTypeCommande('STANDARD');
        }
      }
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
      setCommissionPourcentage(0);
      setQuantiteInput({});
    }
  }, [opened]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' ||
      product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  // Fonction addToCart modifiée pour accepter la quantité
  const addToCart = (product: any, quantite: number) => {
    if (quantite <= 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez saisir une quantité valide',
        color: 'red',
      });
      return;
    }

    const existingItem = cart.find(item => item.idProduit === product.idProduit);
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
      const newQuantite = existingItem.quantite_commande + quantite;
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
      if (quantite > stock) {
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
          quantite_commande: quantite,
          total: quantite * prix,
        }
      ]);
    }
    
    // Réinitialiser le champ quantité après ajout
    setQuantiteInput({ ...quantiteInput, [product.idProduit]: 0 });
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

  // Gestion du modal produit
  const handleOpenProduitModal = (product?: any) => {
    if (product) {
      setProduitToEdit(product);
    } else {
      setProduitToEdit(null);
    }
    setProduitModalOpened(true);
  };

  const handleProduitModalClose = () => {
    setProduitModalOpened(false);
    setProduitToEdit(null);
    refreshProducts();
  };

  const totalArticles = cart.length;
  const totalPieces = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
  const montantTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const commissionTotale = typeCommande === 'REVENDEUR' ? montantTotal * (commissionPourcentage / 100) : 0;
  const montantApresCommission = montantTotal - commissionTotale;

  const handleSubmit = async () => {
    if (!selectedClientId) {
      notifications.show({ title: 'Erreur', message: 'Sélectionnez un client', color: 'red' });
      return;
    }

    if (cart.length === 0) {
      notifications.show({ title: 'Erreur', message: 'Ajoutez au moins un produit', color: 'red' });
      return;
    }

    for (const item of cart) {
      if (item.quantite_commande > item.quantite_stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock insuffisant pour ${item.designation}. Disponible: ${item.quantite_stock}`,
          color: 'red'
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const montantHT = montantTotal / 1.18;

      const commande = {
        code_commande: codeCommande,
        idClient: parseInt(selectedClientId),
        type_commande: typeCommande,
        montant_ht: montantHT,
        montant_ttc: typeCommande === 'REVENDEUR' ? montantApresCommission : montantTotal,
        statut: 'CONFIRMEE',
        commission_pourcentage: typeCommande === 'REVENDEUR' ? commissionPourcentage : null
      };

      const details = cart.map(item => ({
        idProduit: item.idProduit,
        qte_commande: item.quantite_commande,
        prix_unitaire_vente: item.prix_vente
      }));

      await createCommande(commande, details);

      if (typeCommande === 'STANDARD') {
        const results = [];
        for (const item of cart) {
          const result = await stockService.sortieStock({
            idProduit: item.idProduit,
            quantite: item.quantite_commande,
            prix_vente: item.prix_vente,
            reference: `COMMANDE-${codeCommande}`,
            notes: `Commande standard - ${codeCommande} - Client: ${selectedClientDetails?.NomComplet || selectedClientDetails?.Societe || 'N/A'}`
          });

          if (!result.success) {
            throw new Error(`Erreur pour ${item.designation}: ${result.message}`);
          }
          results.push(result);
        }

        const beneficeTotal = results.reduce((sum, r) => sum + (r.benefice || 0), 0);
        const coutTotalAchat = results.reduce((sum, r) => sum + (r.coutAchatTotal || 0), 0);
        const chiffreAffaire = beneficeTotal + coutTotalAchat;

        notifications.show({
          title: '✅ Commande standard enregistrée',
          message: `${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 CA: ${chiffreAffaire.toLocaleString()} FCFA\n` +
            `📊 Coût d'achat: ${coutTotalAchat.toLocaleString()} FCFA\n` +
            `📈 Bénéfice: ${beneficeTotal.toLocaleString()} FCFA\n` +
            `📋 Code: ${codeCommande}`,
          color: 'green',
          autoClose: 8000
        });
      } else {
        notifications.show({
          title: '✅ Commande revendeur enregistrée',
          message: `Commande revendeur ${codeCommande} créée.\n` +
            `📦 ${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 Montant total: ${montantTotal.toLocaleString()} FCFA\n` +
            `📊 Commission (${commissionPourcentage}%): ${commissionTotale.toLocaleString()} FCFA\n` +
            `💵 Net à payer: ${montantApresCommission.toLocaleString()} FCFA\n` +
            `Le stock revendeur sera mis à jour séparément.`,
          color: 'green',
          autoClose: 8000
        });
      }

      await refreshProducts();
      onClose();

    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur lors de la création de la commande';
      console.error('Erreur création commande:', errorMessage);
      notifications.show({
        title: '❌ Erreur',
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
            <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="md">
                <ThemeIcon color="blue" variant="light" radius="md">
                  <IconUser size={18} />
                </ThemeIcon>
                <Text fw={600} size="md" c="#1b365d">Informations client</Text>
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
                <Paper p="sm" withBorder radius="md" mt="sm" style={{ backgroundColor: '#f8f9fa' }}>
                  <Group grow>
                    <Group gap="xs">
                      <IconPhone size={14} color="#1b365d" />
                      <Text size="sm">{selectedClientDetails.Tel || 'Tél non renseigné'}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconBuildingStore size={14} color="#1b365d" />
                      <Text size="sm">
                        {selectedClientDetails.TypeClient === 'revendeur' ? 'Revendeur' : 'Client Standard'}
                      </Text>
                    </Group>
                  </Group>
                </Paper>
              )}
            </Card>

            {/* Type de commande */}
            <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="md">
                <ThemeIcon color="green" variant="light" radius="md">
                  <IconPackage size={18} />
                </ThemeIcon>
                <Text fw={600} size="md" c="#1b365d">Type de commande</Text>
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
                        <Text fw={600} size="sm" c={typeCommande === 'STANDARD' ? '#1b365d' : '#333'}>Commande Standard</Text>
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
                        <Text fw={600} size="sm" c={typeCommande === 'REVENDEUR' ? '#2e7d32' : '#333'}>Commande Revendeur</Text>
                        <Text size="xs" c="dimmed">Approvisionnement stock revendeur</Text>
                      </div>
                      {typeCommande === 'REVENDEUR' && <IconCheck size={18} color="#2e7d32" />}
                    </Group>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Divider my="md" />

              <Grid>
                <Grid.Col span={typeCommande === 'REVENDEUR' ? 6 : 12}>
                  <TextInput
                    label="Code commande"
                    value={codeCommande}
                    readOnly
                    disabled
                    size="md"
                    leftSection={<IconPackage size={16} />}
                  />
                </Grid.Col>
                {typeCommande === 'REVENDEUR' && (
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Taux de commission (%)"
                      description="Appliqué sur le montant total"
                      value={commissionPourcentage}
                      onChange={(val) => setCommissionPourcentage(typeof val === 'number' ? val : 0)}
                      min={0}
                      max={100}
                      step={1}
                      size="md"
                      leftSection={<IconPercentage size={16} />}
                    />
                  </Grid.Col>
                )}
              </Grid>

              {typeCommande === 'REVENDEUR' && commissionPourcentage > 0 && cart.length > 0 && (
                <Alert color="green" variant="light" mt="sm">
                  <Group justify="space-between">
                    <Text size="sm">💰 Montant total:</Text>
                    <Text size="sm" fw={600}>{montantTotal.toLocaleString()} FCFA</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="orange">📊 Commission ({commissionPourcentage}%):</Text>
                    <Text size="sm" fw={600} c="orange">- {commissionTotale.toLocaleString()} FCFA</Text>
                  </Group>
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>💵 Net à payer:</Text>
                    <Text size="md" fw={700} c="green">{montantApresCommission.toLocaleString()} FCFA</Text>
                  </Group>
                </Alert>
              )}
            </Card>

            {/* Liste des produits */}
            <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="md" justify="space-between">
                <Group>
                  <ThemeIcon color="grape" variant="light" radius="md">
                    <IconSearch size={18} />
                  </ThemeIcon>
                  <Text fw={600} size="md" c="#1b365d">Liste des produits disponibles en stock à selectionner</Text>
                </Group>
                <Group>
                  <Badge color="blue" variant="light" size="lg">{products.length} produits disponibles</Badge>
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="grape" 
                    leftSection={<IconPlus size={14} />}
                    onClick={() => handleOpenProduitModal()}
                  >
                    Nouveau produit
                  </Button>
                </Group>
              </Group>

              <Grid>
                <Grid.Col span={8}>
                  <TextInput
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    leftSection={<IconSearch size={16} />}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <Select
                    placeholder="Catégorie"
                    data={categories.map(c => ({ value: c, label: c }))}
                    value={selectedCategory}
                    onChange={(value) => {
                      setSelectedCategory(value);
                      setCurrentPage(1);
                    }}
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

              <ScrollArea h={350} mt="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                      <Table.Th style={{ width: '30%' }}>Désignation</Table.Th>
                      <Table.Th style={{ width: '15%' }}>Catégorie</Table.Th>
                      <Table.Th style={{ width: '10%' }}>Unité</Table.Th>
                      <Table.Th style={{ width: '10%' }} ta="center">Qte Stock</Table.Th>
                      <Table.Th style={{ width: '15%' }} ta="right">Prix vente</Table.Th>
                      <Table.Th style={{ width: '20%' }} ta="center">Quantité à commander</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedProducts.map((product) => {
                      const isRupture = (product.qte_stock || 0) <= 0;
                      return (
                        <Table.Tr key={product.idProduit} style={isRupture ? { backgroundColor: '#fff5f5' } : {}}>
                          <Table.Td>
                            <Text fw={500} size="sm">{product.designation}</Text>
                            <Text size="xs" c="dimmed">{product.code_produit}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="sm">{product.categorie || '-'}</Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{product.unite_base || 'pièce'}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge
                              color={isRupture ? 'red' : (product.qte_stock || 0) < (product.seuil_alerte || 10) ? 'orange' : 'green'}
                              variant={isRupture ? 'filled' : 'light'}
                              size="sm"
                            >
                              {product.qte_stock || 0}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c="blue">{formatPrice(product.prix_vente_detail)} F</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            {isRupture ? (
                              <Button
                                size="xs"
                                variant="light"
                                color="grape"
                                leftSection={<IconPlus size={14} />}
                                onClick={() => handleOpenProduitModal(product)}
                              >
                                Ajouter produit
                              </Button>
                            ) : (
                              <Group gap="xs" justify="center" wrap="nowrap">
                                <NumberInput
                                  size="xs"
                                  min={1}
                                  max={product.qte_stock || 0}
                                  value={quantiteInput[product.idProduit] || 0}
                                  onChange={(val) => setQuantiteInput({ ...quantiteInput, [product.idProduit]: Number(val) || 0 })}
                                  style={{ width: 80 }}
                                  placeholder="Qté"
                                />
                                <Tooltip label="Ajouter au panier">
                                  <ActionIcon
                                    size="md"
                                    variant="light"
                                    color="green"
                                    onClick={() => addToCart(product, quantiteInput[product.idProduit] || 0)}
                                    disabled={!quantiteInput[product.idProduit] || quantiteInput[product.idProduit] <= 0}
                                  >
                                    <IconPlus size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {filteredProducts.length === 0 && (
                <Center py="xl">
                  <Stack align="center">
                    <IconSearch size={40} color="#ccc" />
                    <Text c="dimmed">Aucun produit trouvé</Text>
                    <Button 
                      variant="light" 
                      leftSection={<IconPlus size={16} />}
                      onClick={() => handleOpenProduitModal()}
                    >
                      Ajouter un produit
                    </Button>
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
                  <Text fw={600} size="md" c="#1b365d">Liste des produits sélectionnés pour la commande</Text>
                </Group>

                <ScrollArea h={200}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Désignation</Table.Th>
                        <Table.Th ta="center" w={80}>Qté</Table.Th>
                        <Table.Th ta="right" w={120}>Prix unit.</Table.Th>
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
                              w={70}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{formatPrice(item.prix_vente)} F</Text>
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
                  <Grid.Col span={3}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Nb d'articles</Text>
                      <Text size="xl" fw={700} c="#1b365d">{totalArticles}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Nb de pièces</Text>
                      <Text size="xl" fw={700} c="#1b365d">{totalPieces}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Montant Total</Text>
                      <Text size="xl" fw={700} c="#1b365d">{formatPrice(montantTotal)} F</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Card withBorder p="sm" bg="gray.0">
                      <Text size="xs" c="dimmed">Date de commande</Text>
                      <Text size="md" fw={600} c="#1b365d">{new Date().toLocaleDateString('fr-FR')}</Text>
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

      <FormulaireProduit
        opened={produitModalOpened}
        onClose={handleProduitModalClose}
        editProduct={produitToEdit}
      />
    </>
  );
};

export default FormulaireCommande;