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

import { generateCommandeCode } from '../../services/codeGeneratorService';
import StockService from '../../services/StockService';
import StockRevendeurService from '../../services/StockRevendeurService';
import FormulaireProduit from '../products/FormulaireProduit';
import { getDb } from '../../database/db';
import { useDebug } from '../../hooks/useDebug';

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
  const debug = useDebug('FormulaireCommande');

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
          debug.logInfo('Code commande généré', { code });
        } catch (error) {
          debug.logError('Erreur génération code', error as Error);
          setCodeCommande(`CMD-${Date.now()}`);
        }
      }
    };
    generateCode();
  }, [opened]);

  useEffect(() => {
    debug.logMount();
    debug.logInfo('Formulaire initialisé', { opened });
    
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.idClient.toString() === selectedClientId);
      setSelectedClientDetails(client);

      if (client) {
        const newType = client.TypeClient === 'revendeur' ? 'REVENDEUR' : 'STANDARD';
        setTypeCommande(newType);
        debug.logInfo('Client sélectionné', { 
          clientId: selectedClientId, 
          clientName: client.NomComplet,
          type: newType 
        });
      }
    } else {
      setSelectedClientDetails(null);
    }
    
    return () => {
      debug.logUnmount();
      debug.logInfo('Formulaire fermé');
    };
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
      setPrixType('DETAIL');
      setPrixModifies({});
      setEditingPrix({});
      debug.logInfo('Formulaire réinitialisé');
    }
  }, [opened]);

  // Recalculer les prix du panier quand le type de prix change
  useEffect(() => {
    if (cart.length > 0 && prixType) {
      const updatedCart = cart.map(item => {
        if (prixModifies[item.idProduit]) {
          return item;
        }
        
        const product = products.find(p => p.idProduit === item.idProduit);
        if (product) {
          const newPrix = prixType === 'DETAIL' 
            ? (product.prix_vente_detail || 0) 
            : (product.prix_vente_gros || 0);
          
          debug.logDebug('Prix mis à jour', { 
            produit: item.designation, 
            ancienPrix: item.prix_vente, 
            nouveauPrix: newPrix,
            type: prixType 
          });
          
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

  // Filtrer les produits disponibles (qte_stock > 0)
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' ||
      product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? product.categorie === selectedCategory : true;
    const inStock = (product.qte_stock || 0) > 0;
    return matchesSearch && matchesCategory && inStock;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = [...new Set(products.map(p => p.categorie).filter(Boolean))];

  const formatPrice = (value: number | undefined | null): string => {
    return (value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getPrixProduit = (product: any): number => {
    if (prixType === 'DETAIL') {
      return product.prix_vente_detail || 0;
    } else {
      return product.prix_vente_gros || 0;
    }
  };

  const addToCart = (product: any, quantite: number) => {
    if (quantite <= 0) {
      debug.logWarning('Tentative d\'ajout avec quantité invalide', { quantite });
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
      debug.logWarning('Prix non défini', { 
        product: product.designation, 
        prixType,
        prix 
      });
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
        debug.logWarning('Stock insuffisant', { 
          product: product.designation, 
          demande: newQuantite, 
          disponible: stock 
        });
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${stock}`,
          color: 'red',
        });
        return;
      }
      debug.logInfo('Quantité mise à jour dans le panier', { 
        product: product.designation, 
        ancienneQuantite: existingItem.quantite_commande,
        nouvelleQuantite: newQuantite 
      });
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
        debug.logWarning('Stock insuffisant pour nouvel ajout', { 
          product: product.designation, 
          demande: quantite, 
          disponible: stock 
        });
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${stock}`,
          color: 'red',
        });
        return;
      }
      debug.logInfo('Produit ajouté au panier', { 
        product: product.designation, 
        quantite, 
        prix,
        prixType 
      });
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
      debug.logWarning('Tentative de mise à jour quantité dépassant le stock', {
        product: item.designation,
        demande: newQuantite,
        disponible: item.quantite_stock
      });
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${item.quantite_stock}`,
        color: 'red',
      });
      return;
    }
    debug.logInfo('Quantité mise à jour', {
      product: item.designation,
      ancienneQuantite: item.quantite_commande,
      nouvelleQuantite: newQuantite
    });
    const newCart = [...cart];
    newCart[index].quantite_commande = newQuantite;
    newCart[index].total = newQuantite * newCart[index].prix_vente;
    setCart(newCart);
  };

  const updatePrix = (index: number, newPrix: number) => {
    if (newPrix < 0) return;
    const item = cart[index];
    debug.logInfo('Prix modifié manuellement', {
      product: item.designation,
      ancienPrix: item.prix_vente,
      nouveauPrix: newPrix
    });
    const newCart = [...cart];
    newCart[index].prix_vente = newPrix;
    newCart[index].total = newPrix * newCart[index].quantite_commande;
    setPrixModifies(prev => ({ ...prev, [newCart[index].idProduit]: true }));
    setCart(newCart);
  };

  const toggleEditPrix = (idProduit: number) => {
    setEditingPrix(prev => ({ ...prev, [idProduit]: !prev[idProduit] }));
    debug.logDebug('Mode édition prix basculé', { 
      idProduit, 
      actif: !editingPrix[idProduit] 
    });
  };

  const removeFromCart = (index: number) => {
    const item = cart[index];
    debug.logInfo('Produit retiré du panier', { product: item.designation });
    setPrixModifies(prev => {
      const newPrixModifies = { ...prev };
      delete newPrixModifies[item.idProduit];
      return newPrixModifies;
    });
    setCart(cart.filter((_, i) => i !== index));
  };

  const resetPrixModifies = () => {
    debug.logInfo('Réinitialisation des prix modifiés');
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
      debug.logInfo('Ouverture modal produit pour édition', { product: product.designation });
    } else {
      setProduitToEdit(null);
      debug.logInfo('Ouverture modal produit pour création');
    }
    setProduitModalOpened(true);
  };

  const handleProduitModalClose = () => {
    debug.logInfo('Fermeture modal produit');
    setProduitModalOpened(false);
    setProduitToEdit(null);
    refreshProducts();
  };

  const totalArticles = cart.length;
  const totalPieces = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
  const montantTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const commissionTotale = typeCommande === 'REVENDEUR' ? montantTotal * (commissionPourcentage / 100) : 0;
  const montantApresCommission = montantTotal - commissionTotale;

  const getPrixMoyen = () => {
    if (cart.length === 0) return 0;
    const total = cart.reduce((sum, item) => sum + (item.prix_vente * item.quantite_commande), 0);
    const totalQte = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
    return totalQte > 0 ? total / totalQte : 0;
  };

  // ✅ Fonction pour générer un code unique avec vérification
  const generateUniqueCode = async (baseCode: string): Promise<string> => {
    const db = await getDb();
    let code = baseCode;
    let isUnique = false;
    let attempt = 0;
    const maxAttempts = 20;

    while (!isUnique && attempt < maxAttempts) {
      const check = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM commandes WHERE code_commande = ?`,
        [code]
      );

      if (check[0]?.count === 0) {
        isUnique = true;
      } else {
        // Générer un nouveau code
        const prefix = 'CMD';
        const timestamp = Date.now().toString().slice(-6);
        const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        code = `${prefix}-${timestamp}-${random}`;
        attempt++;
        debug.logWarning('Code dupliqué, nouvelle tentative', { 
          tentative: attempt, 
          code 
        });
      }
    }

    if (!isUnique) {
      code = `CMD-${Date.now()}`;
    }

    return code;
  };

  // ✅ Fonction handleSubmit complète
  const handleSubmit = async () => {
    if (!selectedClientId) {
      debug.logWarning('Tentative de soumission sans client sélectionné');
      notifications.show({ title: 'Erreur', message: 'Sélectionnez un client', color: 'red' });
      return;
    }

    if (cart.length === 0) {
      debug.logWarning('Tentative de soumission sans produits');
      notifications.show({ title: 'Erreur', message: 'Ajoutez au moins un produit', color: 'red' });
      return;
    }

    debug.logAction('Soumission de la commande', {
      clientId: selectedClientId,
      produits: cart.length,
      total: montantTotal,
      type: typeCommande
    });

    setSubmitting(true);
    let db = null;
    let finalCode = '';

    try {
      db = await getDb();
      await db.execute('BEGIN TRANSACTION');

      finalCode = await generateUniqueCode(codeCommande);
      
      if (finalCode !== codeCommande) {
        setCodeCommande(finalCode);
        debug.logInfo('Code commande mis à jour', { ancien: codeCommande, nouveau: finalCode });
      }

      const montantHT = montantTotal / 1.18;
      const dateCommande = new Date().toISOString();

      const clientCheck = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM clients WHERE idClient = ?`,
        [parseInt(selectedClientId)]
      );

      if (!clientCheck[0]?.count) {
        throw new Error('Client introuvable dans la base de données');
      }

      // Insérer la commande
      const result = await db.execute(`
        INSERT INTO commandes (
          code_commande, 
          idClient, 
          type_commande, 
          date_commande,
          montant_ht, 
          montant_ttc, 
          statut,
          montant_tva,
          montant_net,
          source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        finalCode,
        parseInt(selectedClientId),
        typeCommande,
        dateCommande,
        montantHT,
        typeCommande === 'REVENDEUR' ? montantApresCommission : montantTotal,
        'CONFIRMEE',
        montantTotal - montantHT,
        typeCommande === 'REVENDEUR' ? montantApresCommission : montantTotal,
        'DIRECT'
      ]);

      const idCommande = Number(result.lastInsertId);
      debug.logInfo('Commande créée', { idCommande, code: finalCode });

      // Insérer les détails
      for (const item of cart) {
        await db.execute(`
          INSERT INTO commande_details (
            idCommande, 
            idProduit, 
            qte_commande, 
            prix_unitaire_vente,
            remise
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          idCommande, 
          item.idProduit, 
          item.quantite_commande, 
          item.prix_vente,
          0
        ]);
      }

      await db.execute('COMMIT');
      debug.logInfo('Transaction validée');

      // ============================================
      // Gestion de la sortie de stock et mise à jour stock_revendeur
      // ============================================

      if (typeCommande === 'STANDARD') {
        // ✅ Commande standard - sortie de stock central
        let beneficeTotal = 0;
        let coutTotalAchat = 0;

        for (const item of cart) {
          try {
            const product = await db.select<{ prix_achat_base: number }[]>(
              `SELECT prix_achat_base FROM products WHERE idProduit = ?`,
              [item.idProduit]
            );
            
            const prixAchat = product[0]?.prix_achat_base || 0;
            coutTotalAchat += prixAchat * item.quantite_commande;
            beneficeTotal += (item.prix_vente - prixAchat) * item.quantite_commande;

            const resultStock = await StockService.decreaseStock(
              item.idProduit,
              item.quantite_commande,
              `Commande ${finalCode} - ${selectedClientDetails?.NomComplet || 'Client'}`
            );

            if (!resultStock.success) {
              throw new Error(resultStock.message || 'Erreur lors de la sortie de stock');
            }
            
            debug.logInfo('Stock mis à jour', { 
              produit: item.designation, 
              quantite: item.quantite_commande 
            });
            
          } catch (stockError: any) {
            const rollbackDb = await getDb();
            await rollbackDb.execute(`DELETE FROM commandes WHERE idCommande = ?`, [idCommande]);
            await rollbackDb.execute(`DELETE FROM commande_details WHERE idCommande = ?`, [idCommande]);
            throw new Error(`Erreur stock pour ${item.designation}: ${stockError.message}`);
          }
        }

        const chiffreAffaire = beneficeTotal + coutTotalAchat;

        notifications.show({
          title: '✅ Commande standard enregistrée',
          message: `${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 CA: ${chiffreAffaire.toLocaleString()} FCFA\n` +
            `📊 Coût d'achat: ${coutTotalAchat.toLocaleString()} FCFA\n` +
            `📈 Bénéfice: ${beneficeTotal.toLocaleString()} FCFA\n` +
            `📋 Code: ${finalCode}`,
          color: 'green',
          autoClose: 8000
        });

      } else {
        // ✅ Commande revendeur - mettre à jour stock_revendeur avec StockRevendeurService
        try {
          for (const item of cart) {
            // ✅ Utiliser StockRevendeurService pour ajouter au stock du revendeur
            await StockRevendeurService.increaseStock(
              parseInt(selectedClientId),
              item.idProduit,
              item.quantite_commande
            );
            
            debug.logInfo('Stock revendeur mis à jour', { 
              produit: item.designation, 
              quantite: item.quantite_commande,
              revendeur: selectedClientId
            });

            // Ajouter un mouvement revendeur (ENTREE)
            await db.execute(`
              INSERT INTO mouvements_revendeur (
                idProduit,
                idRevendeur,
                idCommande,
                type_mouvement,
                qte_mouvement
              )
              VALUES (?, ?, ?, ?, ?)
            `, [
              item.idProduit,
              parseInt(selectedClientId),
              idCommande,
              "ENTREE",
              item.quantite_commande
            ]);
          }

          debug.logInfo('Stock revendeur et mouvements créés avec succès');

        } catch (stockError: any) {
          debug.logError('Erreur mise à jour stock revendeur', stockError as Error);
          notifications.show({
            title: '⚠️ Attention',
            message: 'Commande créée mais le stock revendeur n\'a pas pu être mis à jour',
            color: 'orange'
          });
        }

        notifications.show({
          title: '✅ Commande revendeur enregistrée',
          message: `Commande revendeur ${finalCode} créée.\n` +
            `📦 ${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 Montant total: ${montantTotal.toLocaleString()} FCFA\n` +
            `📊 Commission (${commissionPourcentage}%): ${commissionTotale.toLocaleString()} FCFA\n` +
            `💵 Net à payer: ${montantApresCommission.toLocaleString()} FCFA\n` +
            `📦 Stock revendeur mis à jour`,
          color: 'green',
          autoClose: 8000
        });
      }

      await refreshProducts();
      debug.logInfo('Produits rafraîchis');
      onClose();

    } catch (error: any) {
      try {
        if (db) {
          await db.execute('ROLLBACK');
          debug.logInfo('Transaction annulée (ROLLBACK)');
        }
      } catch (rollbackError) {
        console.warn('Erreur lors du rollback:', rollbackError);
      }

      if (error?.message?.includes('UNIQUE constraint failed')) {
        notifications.show({
          title: '❌ Erreur de code',
          message: 'Un problème est survenu avec le code de la commande. Veuillez réessayer.',
          color: 'red',
        });
        const newCode = `CMD-${Date.now()}`;
        setCodeCommande(newCode);
      } else {
        notifications.show({
          title: '❌ Erreur',
          message: error?.message || 'Erreur lors de la création de la commande',
          color: 'red',
        });
      }

      debug.logError('Erreur lors de la création de la commande', error as Error);
    } finally {
      setSubmitting(false);
      debug.logDebug('Soumission terminée');
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
            {/* LIGNE 1: Client */}
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

            {/* LIGNE 2: Type de commande */}
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
                    <Text size="xs">💰 Total: {montantTotal.toLocaleString()} FCFA</Text>
                    <Text size="xs" c="orange">📊 Comm. {commissionPourcentage}%: -{commissionTotale.toLocaleString()} FCFA</Text>
                    <Divider orientation="vertical" />
                    <Text size="xs" fw={700} c="green">💵 Net: {montantApresCommission.toLocaleString()} FCFA</Text>
                  </Group>
                </Alert>
              )}
            </Card>

            {/* LIGNE 3: Produits disponibles */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="xs" justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color="grape" variant="light" radius="md" size="sm">
                    <IconPackage size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" c="#1b365d">Produits disponibles</Text>
                  <Badge color="green" variant="light" size="xs">{filteredProducts.length} en stock</Badge>
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
                {filteredProducts.length === 0 ? (
                  <Center py="xl">
                    <Stack align="center" gap="xs">
                      <IconPackage size={32} color="#adb5bd" />
                      <Text c="dimmed" size="sm">Aucun produit disponible en stock</Text>
                      <Text c="dimmed" size="xs">Ajoutez des produits ou approvisionnez le stock</Text>
                      <Button 
                        size="xs" 
                        variant="light" 
                        color="grape"
                        onClick={() => handleOpenProduitModal()}
                      >
                        Créer un produit
                      </Button>
                    </Stack>
                  </Center>
                ) : (
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
                                <Text fw={600} c="blue" size="xs">{formatPrice(prix)} FCFA</Text>
                              ) : (
                                <Text size="xs" c="red">Prix non défini</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {isRupture ? (
                                <Text size="xs" c="dimmed">Rupture</Text>
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
                )}
              </ScrollArea>

              {totalPages > 1 && (
                <Group justify="center" mt="xs">
                  <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="xs" />
                </Group>
              )}
            </Card>

            {/* LIGNE 4: Panier */}
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
                    <Text size="xs" c="dimmed">Prix moyen: {formatPrice(getPrixMoyen())} FCFA</Text>
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
                                <Text size="xs" fw={600}>{formatPrice(item.prix_vente)} FCFA</Text>
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
                            <Text fw={600} c="blue" size="xs">{formatPrice(item.total)} FCFA</Text>
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

            {/* Boutons d'action */}
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