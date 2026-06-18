// src/components/commandes/FormulaireCommande.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, TextInput, Select, Button, Group, Stack,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, LoadingOverlay, Grid, Badge,
  Tooltip, Pagination, ScrollArea, ThemeIcon, Paper, Center,
  Alert, SegmentedControl
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash, IconPlus, IconSearch,
  IconRefresh, IconUserPlus, IconShoppingBag, IconPhone, IconUser,
  IconPackage, IconBuildingStore, IconShoppingCart, IconTruck,
  IconPercentage, IconEdit
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useCommandes } from '../../hooks/useCommandes';
import { FormulaireClient } from '../clients/FormulaireClient';

import { generateCommandeCode } from '../../utils/codeGenerator';
import { stockService } from '../../database/repositories/stockService';
import FormulaireProduit from '../products/FormulaireProduit';
import { getDb } from '../../database/db';

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
  prix_original?: number;
  type_prix?: 'DETAIL' | 'GROS';
}

type PrixType = 'DETAIL' | 'GROS';

export const FormulaireCommande: React.FC<FormulaireCommandeProps> = ({ opened, onClose }) => {
  const { clients, loading: clientsLoading, refresh: refreshClients } = useClients();
  const { products, loading: productsLoading, refresh: refreshProducts } = useProducts();
  const { loading } = useCommandes();

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
  const [, setDbError] = useState<string | null>(null);
  
  // ✅ Prix par défaut : DÉTAIL
  const [prixType, setPrixType] = useState<PrixType>('DETAIL');
  const [editingPrix, setEditingPrix] = useState<Record<number, boolean>>({});
  const [prixModifies, setPrixModifies] = useState<Record<number, boolean>>({});

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
          // ✅ On garde le prix en détail par défaut, même pour les revendeurs
          // L'utilisateur peut basculer manuellement vers "Gros" si besoin
        } else {
          setTypeCommande('STANDARD');
          // ✅ On garde 'DETAIL' par défaut
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
      setDbError(null);
      // ✅ Réinitialiser à 'DETAIL' quand on ferme
      setPrixType('DETAIL');
      setPrixModifies({});
      setEditingPrix({});
    }
  }, [opened]);

  // Recalculer les prix du panier quand le type de prix change
  useEffect(() => {
    if (cart.length > 0 && prixType) {
      const updatedCart = cart.map(item => {
        // Si le prix a été modifié manuellement, on le garde
        if (prixModifies[item.idProduit]) {
          return item;
        }
        
        const product = products.find(p => p.idProduit === item.idProduit);
        if (product) {
          const newPrix = prixType === 'DETAIL' 
            ? (product.prix_vente_detail || 0) 
            : (product.prix_vente_gros || 0);
          
          return {
            ...item,
            prix_vente: newPrix,
            total: newPrix * item.quantite_commande,
            prix_original: newPrix,
            type_prix: prixType
          };
        }
        return item;
      });
      setCart(updatedCart);
    }
  }, [prixType, products, prixModifies]);

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

  const getPrixProduit = (product: any): number => {
    if (prixType === 'DETAIL') {
      return product.prix_vente_detail || 0;
    } else {
      return product.prix_vente_gros || 0;
    }
  };

  const getPrixLabel = (): string => {
    return prixType === 'DETAIL' ? 'Détail' : 'Gros';
  };

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
    const prix = getPrixProduit(product);

    if (prix <= 0) {
      notifications.show({
        title: 'Erreur',
        message: `Le prix ${prixType === 'DETAIL' ? 'de détail' : 'de gros'} du produit "${product.designation}" n'est pas défini`,
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
          prix_original: prix,
          type_prix: prixType
        }
      ]);
    }
    
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
    newCart[index].total = newQuantite * newCart[index].prix_vente;
    setCart(newCart);
  };

  const updatePrix = (index: number, newPrix: number) => {
    if (newPrix < 0) return;
    const newCart = [...cart];
    newCart[index].prix_vente = newPrix;
    newCart[index].total = newPrix * newCart[index].quantite_commande;
    setPrixModifies(prev => ({ ...prev, [newCart[index].idProduit]: true }));
    setCart(newCart);
  };

  const toggleEditPrix = (idProduit: number) => {
    setEditingPrix(prev => ({ ...prev, [idProduit]: !prev[idProduit] }));
  };

  const removeFromCart = (index: number) => {
    const item = cart[index];
    setPrixModifies(prev => {
      const newPrixModifies = { ...prev };
      delete newPrixModifies[item.idProduit];
      return newPrixModifies;
    });
    setCart(cart.filter((_, i) => i !== index));
  };

  const resetPrixModifies = () => {
    setPrixModifies({});
    const updatedCart = cart.map(item => {
      const product = products.find(p => p.idProduit === item.idProduit);
      if (product) {
        const newPrix = prixType === 'DETAIL' 
          ? (product.prix_vente_detail || 0) 
          : (product.prix_vente_gros || 0);
        return {
          ...item,
          prix_vente: newPrix,
          total: newPrix * item.quantite_commande,
          prix_original: newPrix
        };
      }
      return item;
    });
    setCart(updatedCart);
  };

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

  // Calculer le prix moyen pour le panier
  const getPrixMoyen = () => {
    if (cart.length === 0) return 0;
    const total = cart.reduce((sum, item) => sum + (item.prix_vente * item.quantite_commande), 0);
    const totalQte = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
    return totalQte > 0 ? total / totalQte : 0;
  };

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
      const db = await getDb();
      
      await db.execute('BEGIN TRANSACTION');

      const montantHT = montantTotal / 1.18;

      const result = await db.execute(`
        INSERT INTO commandes (code_commande, idClient, type_commande, montant_ht, montant_ttc, statut)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        codeCommande,
        parseInt(selectedClientId),
        typeCommande,
        montantHT,
        typeCommande === 'REVENDEUR' ? montantApresCommission : montantTotal,
        'CONFIRMEE'
      ]);

      const idCommande = Number(result.lastInsertId);

      for (const item of cart) {
        await db.execute(`
          INSERT INTO commande_details (idCommande, idProduit, qte_commande, prix_unitaire_vente)
          VALUES (?, ?, ?, ?)
        `, [idCommande, item.idProduit, item.quantite_commande, item.prix_vente]);
      }

      await db.execute('COMMIT');

      if (typeCommande === 'STANDARD') {
        const results = [];
        for (const item of cart) {
          const resultStock = await stockService.sortieStock({
            idProduit: item.idProduit,
            quantite: item.quantite_commande,
            prix_vente: item.prix_vente,
            reference: `COMMANDE-${codeCommande}`,
            notes: `Commande standard - ${codeCommande} - Client: ${selectedClientDetails?.NomComplet || selectedClientDetails?.Societe || 'N/A'} - Prix: ${prixType}`
          });

          if (!resultStock.success) {
            throw new Error(`Erreur pour ${item.designation}: ${resultStock.message}`);
          }
          results.push(resultStock);
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
            `💵 Net à payer: ${montantApresCommission.toLocaleString()} FCFA`,
          color: 'green',
          autoClose: 8000
        });
      }

      await refreshProducts();
      onClose();

    } catch (error: any) {
      try {
        const db = await getDb();
        await db.execute('ROLLBACK');
      } catch (e) {}
      
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Erreur lors de la création de la commande',
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
          <Stack gap="md">
            {/* ============================================ */}
            {/* LIGNE 1: Client - Compactée */}
            {/* ============================================ */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Grid align="flex-end">
                <Grid.Col span={3}>
                  <Select
                    label="Client"
                    placeholder="Rechercher..."
                    data={clientData}
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                    searchable
                    required
                    size="xs"
                    leftSection={<IconUser size={14} />}
                  />
                </Grid.Col>

                <Grid.Col span={1.5}>
                  <TextInput
                    label="Contact"
                    value={selectedClientDetails?.Tel || ''}
                    readOnly
                    size="xs"
                    leftSection={<IconPhone size={14} />}
                    placeholder="Tél"
                  />
                </Grid.Col>

                <Grid.Col span={1.5}>
                  <Select
                    label="Type"
                    value={selectedClientDetails?.TypeClient || ''}
                    data={[
                      { value: 'client', label: 'Client' },
                      { value: 'revendeur', label: 'Revendeur' }
                    ]}
                    readOnly
                    size="xs"
                    leftSection={<IconBuildingStore size={14} />}
                  />
                </Grid.Col>

                <Grid.Col span={2}>
                  <Button
                    leftSection={<IconUserPlus size={14} />}
                    onClick={() => setClientModalOpened(true)}
                    size="xs"
                    variant="light"
                    color="blue"
                    fullWidth
                  >
                    Nouveau client
                  </Button>
                </Grid.Col>

                <Grid.Col span={2}>
                  <TextInput
                    label="Code"
                    value={codeCommande}
                    readOnly
                    disabled
                    size="xs"
                    leftSection={<IconPackage size={14} />}
                  />
                </Grid.Col>

                <Grid.Col span={2}>
                  <SegmentedControl
                    size="xs"
                    value={prixType}
                    onChange={(value) => setPrixType(value as PrixType)}
                    data={[
                      { label: 'Détail', value: 'DETAIL' },
                      { label: 'Gros', value: 'GROS' }
                    ]}
                    fullWidth
                    color={prixType === 'DETAIL' ? 'blue' : 'green'}
                  />
                </Grid.Col>
              </Grid>
            </Card>

            {/* ============================================ */}
            {/* LIGNE 2: Type de commande - Compactée */}
            {/* ============================================ */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Grid align="center">
                <Grid.Col span={3}>
                  <Group gap="xs" grow>
                    <Paper
                      p="xs"
                      withBorder
                      radius="md"
                      style={{
                        cursor: 'pointer',
                        backgroundColor: typeCommande === 'STANDARD' ? '#eef3f9' : 'white',
                        borderColor: typeCommande === 'STANDARD' ? '#1b365d' : '#e5e7eb',
                        textAlign: 'center'
                      }}
                      onClick={() => setTypeCommande('STANDARD')}
                    >
                      <Group gap="xs" justify="center">
                        <ThemeIcon color="blue" variant={typeCommande === 'STANDARD' ? 'filled' : 'light'} size="xs" radius="xl">
                          <IconShoppingBag size={12} />
                        </ThemeIcon>
                        <Text size="xs" fw={600} c={typeCommande === 'STANDARD' ? '#1b365d' : '#333'}>Standard</Text>
                      </Group>
                    </Paper>

                    <Paper
                      p="xs"
                      withBorder
                      radius="md"
                      style={{
                        cursor: 'pointer',
                        backgroundColor: typeCommande === 'REVENDEUR' ? '#e8f5e9' : 'white',
                        borderColor: typeCommande === 'REVENDEUR' ? '#2e7d32' : '#e5e7eb',
                        textAlign: 'center'
                      }}
                      onClick={() => setTypeCommande('REVENDEUR')}
                    >
                      <Group gap="xs" justify="center">
                        <ThemeIcon color="green" variant={typeCommande === 'REVENDEUR' ? 'filled' : 'light'} size="xs" radius="xl">
                          <IconTruck size={12} />
                        </ThemeIcon>
                        <Text size="xs" fw={600} c={typeCommande === 'REVENDEUR' ? '#2e7d32' : '#333'}>Revendeur</Text>
                      </Group>
                    </Paper>
                  </Group>
                </Grid.Col>

                <Grid.Col span={typeCommande === 'REVENDEUR' ? 2 : 0} style={{ display: typeCommande === 'REVENDEUR' ? 'block' : 'none' }}>
                  <NumberInput
                    label="Commission %"
                    placeholder="%"
                    value={commissionPourcentage}
                    onChange={(val) => setCommissionPourcentage(typeof val === 'number' ? val : 0)}
                    min={0}
                    max={100}
                    step={1}
                    size="xs"
                    leftSection={<IconPercentage size={14} />}
                  />
                </Grid.Col>

                <Grid.Col span={typeCommande === 'REVENDEUR' ? 3 : 6}>
                  {selectedClientDetails && (
                    <Paper p="xs" withBorder radius="md" bg="gray.0">
                      <Group gap="xs" justify="center">
                        <IconBuildingStore size={14} color="#1b365d" />
                        <Text size="xs" c="dimmed">
                          {selectedClientDetails.NomComplet || selectedClientDetails.Societe}
                        </Text>
                        <Badge 
                          size="xs" 
                          color={selectedClientDetails.TypeClient === 'revendeur' ? 'green' : 'blue'}
                          variant="light"
                        >
                          {selectedClientDetails.TypeClient === 'revendeur' ? 'Revendeur' : 'Client'}
                        </Badge>
                        <Badge size="xs" color={prixType === 'DETAIL' ? 'blue' : 'green'} variant="light">
                          {prixType === 'DETAIL' ? 'Prix détail' : 'Prix gros'}
                        </Badge>
                      </Group>
                    </Paper>
                  )}
                </Grid.Col>

                <Grid.Col span={typeCommande === 'REVENDEUR' ? 4 : 3}>
                  <Group gap="xs" grow>
                    <Paper p="xs" withBorder radius="md" bg="gray.0" ta="center">
                      <Text size="xs" c="dimmed">Articles</Text>
                      <Text size="sm" fw={700} c="#1b365d">{totalArticles}</Text>
                    </Paper>
                    <Paper p="xs" withBorder radius="md" bg="gray.0" ta="center">
                      <Text size="xs" c="dimmed">Pièces</Text>
                      <Text size="sm" fw={700} c="#1b365d">{totalPieces}</Text>
                    </Paper>
                    <Paper p="xs" withBorder radius="md" bg="gray.0" ta="center">
                      <Text size="xs" c="dimmed">Total</Text>
                      <Text size="sm" fw={700} c="#1b365d">{formatPrice(montantTotal)}</Text>
                    </Paper>
                  </Group>
                </Grid.Col>
              </Grid>

              {typeCommande === 'REVENDEUR' && commissionPourcentage > 0 && cart.length > 0 && (
                <Alert color="green" variant="light" mt="xs" p="xs">
                  <Group justify="space-between" gap="xs">
                    <Text size="xs">💰 Total: {montantTotal.toLocaleString()} F</Text>
                    <Text size="xs" c="orange">📊 Comm. {commissionPourcentage}%: -{commissionTotale.toLocaleString()} F</Text>
                    <Divider orientation="vertical" />
                    <Text size="xs" fw={700} c="green">💵 Net: {montantApresCommission.toLocaleString()} F</Text>
                  </Group>
                </Alert>
              )}
            </Card>

            {/* ============================================ */}
            {/* LIGNE 3: Produits - Compactée */}
            {/* ============================================ */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="xs" justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color="grape" variant="light" radius="md" size="sm">
                    <IconSearch size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" c="#1b365d">Produits</Text>
                  <Badge color="blue" variant="light" size="xs">{products.length}</Badge>
                  <Badge color={prixType === 'DETAIL' ? 'blue' : 'green'} variant="light" size="xs">
                    {prixType === 'DETAIL' ? 'Prix détail' : 'Prix gros'}
                  </Badge>
                </Group>
                <Group gap="xs">
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="grape" 
                    leftSection={<IconPlus size={12} />}
                    onClick={() => handleOpenProduitModal()}
                  >
                    Produit
                  </Button>
                  <Tooltip label="Actualiser">
                    <ActionIcon onClick={refreshProducts} size="sm" variant="subtle">
                      <IconRefresh size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    leftSection={<IconSearch size={14} />}
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Select
                    placeholder="Catégorie"
                    data={categories.map(c => ({ value: c, label: c }))}
                    value={selectedCategory}
                    onChange={(value) => {
                      setSelectedCategory(value);
                      setCurrentPage(1);
                    }}
                    clearable
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Text size="xs" c="dimmed" ta="right" mt={4}>
                    Page {currentPage}/{totalPages || 1}
                  </Text>
                </Grid.Col>
              </Grid>

              <ScrollArea h={250} mt="xs">
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                      <Table.Th c="white" style={{ width: '30%' }}>Désignation</Table.Th>
                      <Table.Th c="white" style={{ width: '12%' }}>Catégorie</Table.Th>
                      <Table.Th c="white" style={{ width: '8%' }} ta="center">Stock</Table.Th>
                      <Table.Th c="white" style={{ width: '14%' }} ta="right">Prix {prixType === 'DETAIL' ? 'Détail' : 'Gros'}</Table.Th>
                      <Table.Th c="white" style={{ width: '18%' }} ta="center">Quantité</Table.Th>
                      <Table.Th c="white" style={{ width: '18%' }} ta="center">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedProducts.map((product) => {
                      const isRupture = (product.qte_stock || 0) <= 0;
                      const prix = getPrixProduit(product);
                      const hasPrix = prix > 0;
                      return (
                        <Table.Tr key={product.idProduit} style={isRupture ? { backgroundColor: '#fff5f5' } : {}}>
                          <Table.Td>
                            <Text fw={500} size="xs">{product.designation}</Text>
                            <Text size="xs" c="dimmed">{product.code_produit}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="xs">{product.categorie || '-'}</Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge
                              color={isRupture ? 'red' : (product.qte_stock || 0) < (product.seuil_alerte || 10) ? 'orange' : 'green'}
                              variant={isRupture ? 'filled' : 'light'}
                              size="xs"
                            >
                              {product.qte_stock || 0}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            {hasPrix ? (
                              <Text fw={600} c="blue" size="xs">{formatPrice(prix)}</Text>
                            ) : (
                              <Text size="xs" c="red">Prix non défini</Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="center">
                            {isRupture ? (
                              <Button size="xs" variant="subtle" color="grape" onClick={() => handleOpenProduitModal(product)}>
                                Ajouter
                              </Button>
                            ) : !hasPrix ? (
                              <Button size="xs" variant="subtle" color="orange" onClick={() => handleOpenProduitModal(product)}>
                                Définir prix
                              </Button>
                            ) : (
                              <Group gap="xs" justify="center" wrap="nowrap">
                                <NumberInput
                                  size="xs"
                                  min={1}
                                  max={product.qte_stock || 0}
                                  value={quantiteInput[product.idProduit] || 0}
                                  onChange={(val) => setQuantiteInput({ ...quantiteInput, [product.idProduit]: Number(val) || 0 })}
                                  style={{ width: 60 }}
                                  placeholder="Qté"
                                />
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="green"
                                  onClick={() => addToCart(product, quantiteInput[product.idProduit] || 0)}
                                  disabled={!quantiteInput[product.idProduit] || quantiteInput[product.idProduit] <= 0}
                                >
                                  <IconPlus size={12} />
                                </ActionIcon>
                              </Group>
                            )}
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge size="xs" variant="outline" color="gray">
                              {product.unite_base || 'pc'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {filteredProducts.length === 0 && (
                <Center py="md">
                  <Stack align="center" gap="xs">
                    <IconSearch size={24} color="#ccc" />
                    <Text c="dimmed" size="xs">Aucun produit trouvé</Text>
                  </Stack>
                </Center>
              )}

              {totalPages > 1 && (
                <Group justify="center" mt="xs">
                  <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="xs" />
                </Group>
              )}
            </Card>

            {/* ============================================ */}
            {/* LIGNE 4: Panier - Compactée avec prix modifiables */}
            {/* ============================================ */}
            {cart.length > 0 && (
              <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
                <Group gap="xs" mb="xs" justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon color="orange" variant="light" radius="md" size="sm">
                      <IconShoppingCart size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" c="#1b365d">Panier</Text>
                    <Badge color="orange" variant="light" size="xs">{cart.length} produits</Badge>
                    <Badge color={prixType === 'DETAIL' ? 'blue' : 'green'} variant="light" size="xs">
                      {prixType === 'DETAIL' ? 'Prix détail' : 'Prix gros'}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">Prix moyen: {formatPrice(getPrixMoyen())} F</Text>
                    <Tooltip label="Réinitialiser les prix modifiés">
                      <ActionIcon 
                        size="sm" 
                        variant="subtle" 
                        color="blue"
                        onClick={resetPrixModifies}
                      >
                        <IconRefresh size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                <ScrollArea h={150}>
                  <Table striped highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '30%' }}>Produit</Table.Th>
                        <Table.Th ta="center" style={{ width: '12%' }}>Qté</Table.Th>
                        <Table.Th ta="right" style={{ width: '18%' }}>Prix unit.</Table.Th>
                        <Table.Th ta="right" style={{ width: '18%' }}>Total</Table.Th>
                        <Table.Th ta="center" style={{ width: '12%' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {cart.map((item, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>
                            <Text size="xs" fw={500}>{item.designation}</Text>
                            <Text size="xs" c="dimmed">{item.code_produit}</Text>
                            {prixModifies[item.idProduit] && (
                              <Badge size="xs" color="orange" variant="light">Modifié</Badge>
                            )}
                          </Table.Td>
                          <Table.Td ta="center">
                            <NumberInput
                              value={item.quantite_commande}
                              onChange={(val) => updateQuantity(index, Number(val) || 1)}
                              min={1}
                              max={item.quantite_stock}
                              size="xs"
                              w={60}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <Group gap="4px" justify="flex-end" wrap="nowrap">
                              {editingPrix[item.idProduit] ? (
                                <NumberInput
                                  value={item.prix_vente}
                                  onChange={(val) => updatePrix(index, Number(val) || 0)}
                                  size="xs"
                                  w={80}
                                  min={0}
                                  step={100}
                                />
                              ) : (
                                <Text size="xs" fw={600}>{formatPrice(item.prix_vente)}</Text>
                              )}
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color={editingPrix[item.idProduit] ? 'green' : 'blue'}
                                onClick={() => toggleEditPrix(item.idProduit)}
                              >
                                <IconEdit size={12} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c="blue" size="xs">{formatPrice(item.total)}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <ActionIcon color="red" onClick={() => removeFromCart(index)} size="sm" variant="subtle">
                              <IconTrash size={12} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="xs" />

                <Group justify="space-between" gap="xs">
                  <Group gap="xs">
                    <Badge size="sm" variant="light" color="blue">Articles: {totalArticles}</Badge>
                    <Badge size="sm" variant="light" color="gray">Pièces: {totalPieces}</Badge>
                  </Group>
                  <Text fw={700} size="md" c="#1b365d">
                    Total: {formatPrice(montantTotal)} FCFA
                  </Text>
                </Group>
              </Card>
            )}

            {/* ============================================ */}
            {/* Boutons d'action - Compactés */}
            {/* ============================================ */}
            <Group justify="flex-end" gap="xs" pb="xs">
              <Button
                variant="outline"
                onClick={onClose}
                size="xs"
                leftSection={<IconTrash size={14} />}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                loading={submitting || loading}
                disabled={cart.length === 0 || !selectedClientId}
                size="xs"
                color="green"
                leftSection={<IconShoppingBag size={14} />}
              >
                Enregistrer
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