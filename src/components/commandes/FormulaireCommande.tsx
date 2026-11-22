// src/components/commandes/FormulaireCommande.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, TextInput, Select, Button, Group, Stack,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, Grid, Badge,
  Tooltip, Pagination, ScrollArea, ThemeIcon, Paper, Center,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash, IconPlus, IconSearch,
  IconRefresh, IconUserPlus, IconShoppingBag, IconPhone, IconUser,
  IconPackage, IconBuildingStore, IconShoppingCart, IconTruck,
  IconPercentage, IconEdit, IconCheck, IconX
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useCommandes } from '../../hooks/useCommandes';
import FormulaireProduit from '../products/FormulaireProduit';
import { FormulaireClient } from '../clients/FormulaireClient';
import { getDb } from '../../database/db';
import { tvaService } from '../../services/tvaService';
import StockRevendeurService from '../../services/StockRevendeurService';
import { useDebug } from '../../hooks/useDebug';
import { configCommerceService } from '../../services/configCommerceService';

interface FormulaireCommandeProps {
  opened: boolean;
  onClose: () => void;
  /**
   * Restreint le formulaire à un circuit précis.
   * 'REVENDEUR' : seuls les revendeurs sont proposés et le type de commande
   * est verrouillé, conformément au circuit décrit dans le guide
   * (Revendeurs → Commandes → Nouvelle commande).
   * Non renseigné : comportement d'origine (tous clients, type libre).
   */
  restrictionType?: 'REVENDEUR' | 'STANDARD';
  /** Appelé après un enregistrement réussi (pour rafraîchir la liste appelante) */
  onSaved?: () => void;
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
  prix_modifie?: boolean;
}

type PrixType = 'DETAIL' | 'GROS';

type Db = {
  select: (query: string, params?: any[]) => Promise<any[]>;
  execute: (query: string, params?: any[]) => Promise<{ lastInsertId?: number | string }>;
};

export const FormulaireCommande: React.FC<FormulaireCommandeProps> = ({
  opened, onClose, restrictionType, onSaved
}) => {
  const debug = useDebug('FormulaireCommande');

  const { clients, refresh: refreshClients } = useClients();
  const { products, refresh: refreshProducts } = useProducts();
  const { loading } = useCommandes();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [clientModalOpened, setClientModalOpened] = useState(false);
  const [produitModalOpen, setProduitModalOpen] = useState(false);
  const [codeCommande, setCodeCommande] = useState('');
  // Le type est pré-positionné par le circuit d'appel quand il est imposé.
  const [typeCommande, setTypeCommande] = useState<string>(restrictionType || 'STANDARD');
  const [commissionPourcentage, setCommissionPourcentage] = useState<number>(60);
  const [commissionDefaut, setCommissionDefaut] = useState<number>(60);
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});
  const [, setDbError] = useState<string | null>(null);
  const [isCommissionInitialized, setIsCommissionInitialized] = useState<boolean>(false);

  const [prixType, setPrixType] = useState<PrixType>('GROS');
  const [editingPrix, setEditingPrix] = useState<Record<number, boolean>>({});
  const [prixModifies, setPrixModifies] = useState<Record<number, boolean>>({});
  const [tempPrix, setTempPrix] = useState<Record<number, number>>({});

  const itemsPerPage = 5;

  const generateUniqueCode = async (baseCode: string): Promise<string> => {
    const db = (await getDb()) as Db;
    let code = baseCode;
    let attempt = 0;
    const maxAttempts = 20;

    while (attempt < maxAttempts) {
      try {
        const check = await db.select(
          `SELECT COUNT(*) as count FROM commandes WHERE code_commande = ?`,
          [code]
        );

        if (check[0]?.count === 0) return code;

        code = `CMD-${Date.now().toString().slice(-6)}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
        attempt++;
        debug.logWarning('Code dupliqué, nouvelle tentative', { tentative: attempt, code });
      } catch (error) {
        debug.logWarning('Erreur lors de la vérification du code', { error });
        return `CMD-${Date.now()}`;
      }
    }

    return `CMD-${Date.now()}`;
  };

  // Charger le taux de commission par défaut configuré (dynamique)
  useEffect(() => {
    configCommerceService.getCommissionDefaut()
      .then((taux) => {
        setCommissionDefaut(taux);
        if (!isCommissionInitialized) setCommissionPourcentage(taux);
      })
      .catch(() => setCommissionDefaut(60));
  }, [opened]);

  useEffect(() => {
    const generateCode = async () => {
      if (opened) {
        try {
          const code = await generateUniqueCode(`CMD-${Date.now().toString().slice(-6)}`);
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

  // ✅ useEffect pour la sélection du client - Commission dynamique
  useEffect(() => {
    debug.logMount();
    debug.logInfo('Formulaire initialisé', { opened });

    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.idClient.toString() === selectedClientId);
      setSelectedClientDetails(client);

      if (client) {
        const newType = client.TypeClient === 'revendeur' ? 'REVENDEUR' : 'STANDARD';
        setTypeCommande(newType);
        
        // ✅ CORRECTION : Commission dynamique - 0% possible
        if (!isCommissionInitialized) {
          if (newType === 'REVENDEUR') {
            setCommissionPourcentage(commissionDefaut);
          } else {
            setCommissionPourcentage(0);
          }
          setIsCommissionInitialized(true);
        }
        
        debug.logInfo('Client sélectionné', {
          clientId: selectedClientId,
          clientName: client.NomComplet,
          type: newType,
          commission: commissionPourcentage
        });
      }
    } else {
      setSelectedClientDetails(null);
      setIsCommissionInitialized(false);
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
      // On revient au type du circuit d'appel, pas systématiquement à STANDARD :
      // sinon la réouverture depuis « Commandes revendeur » repartait en standard.
      setTypeCommande(restrictionType || 'STANDARD');
      setCommissionPourcentage(commissionDefaut);
      setIsCommissionInitialized(false);
      setQuantiteInput({});
      setDbError(null);
      setPrixType('GROS');
      setPrixModifies({});
      setEditingPrix({});
      setTempPrix({});
      debug.logInfo('Formulaire réinitialisé');
    }
  }, [opened]);

  // ✅ Effet pour mettre à jour les prix lors du changement de type de prix
  useEffect(() => {
    if (cart.length > 0 && prixType) {
      const updatedCart = cart.map(item => {
        if (prixModifies[item.idProduit]) return item;

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
            type_prix: prixType,
            prix_modifie: false
          };
        }
        return item;
      });

      setCart(updatedCart);
    }
  }, [prixType, products, prixModifies]);

  const filteredProducts = products.filter(product => {
    const t = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === '' ||
      product.designation?.toLowerCase().includes(t) ||
      product.code_produit?.toLowerCase().includes(t) ||
      (product as any).reference?.toLowerCase().includes(t);
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
    return prixType === 'DETAIL'
      ? (product.prix_vente_detail || 0)
      : (product.prix_vente_gros || 0);
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
          ? { ...item, quantite_commande: newQuantite, total: newQuantite * item.prix_vente }
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
          type_prix: prixType,
          prix_modifie: false
        }
      ]);
    }

    setQuantiteInput({ ...quantiteInput, [product.idProduit]: 0 });
  };

  const updateQuantity = (index: number, newQuantite: number) => {
    if (newQuantite < 1) return;
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

  const startEditPrix = (index: number) => {
    const item = cart[index];
    setTempPrix({ ...tempPrix, [item.idProduit]: item.prix_vente });
    setEditingPrix({ ...editingPrix, [item.idProduit]: true });
  };

  const confirmEditPrix = (index: number) => {
    const item = cart[index];
    const newPrix = tempPrix[item.idProduit] !== undefined ? tempPrix[item.idProduit] : item.prix_vente;
    
    if (newPrix < 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Le prix ne peut pas être négatif',
        color: 'red',
      });
      return;
    }

    const newCart = [...cart];
    newCart[index].prix_vente = newPrix;
    newCart[index].total = newPrix * newCart[index].quantite_commande;
    newCart[index].prix_modifie = true;
    
    setPrixModifies({ ...prixModifies, [item.idProduit]: true });
    setCart(newCart);
    setEditingPrix({ ...editingPrix, [item.idProduit]: false });
    
    notifications.show({
      title: '✅ Prix modifié',
      message: `Nouveau prix: ${formatPrice(newPrix)} FCFA`,
      color: 'green',
      autoClose: 2000
    });
  };

  const cancelEditPrix = (index: number) => {
    const item = cart[index];
    setEditingPrix({ ...editingPrix, [item.idProduit]: false });
    setTempPrix({ ...tempPrix, [item.idProduit]: undefined as any });
  };

  const resetPrix = (index: number) => {
    const item = cart[index];
    const product = products.find(p => p.idProduit === item.idProduit);
    if (product) {
      const defaultPrix = prixType === 'DETAIL'
        ? (product.prix_vente_detail || 0)
        : (product.prix_vente_gros || 0);
      
      const newCart = [...cart];
      newCart[index].prix_vente = defaultPrix;
      newCart[index].total = defaultPrix * newCart[index].quantite_commande;
      newCart[index].prix_modifie = false;
      
      setPrixModifies({ ...prixModifies, [item.idProduit]: false });
      setCart(newCart);
      
      notifications.show({
        title: '✅ Prix réinitialisé',
        message: `Prix par défaut: ${formatPrice(defaultPrix)} FCFA`,
        color: 'blue',
        autoClose: 2000
      });
    }
  };

  const handlePrixChange = (idProduit: number, value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(numValue) && numValue >= 0) {
      setTempPrix({ ...tempPrix, [idProduit]: numValue });
    }
  };

  const removeFromCart = (index: number) => {
    const item = cart[index];
    setPrixModifies(prev => {
      const newPrixModifies = { ...prev };
      delete newPrixModifies[item.idProduit];
      return newPrixModifies;
    });
    setEditingPrix(prev => {
      const newEditing = { ...prev };
      delete newEditing[item.idProduit];
      return newEditing;
    });
    setTempPrix(prev => {
      const newTemp = { ...prev };
      delete newTemp[item.idProduit];
      return newTemp;
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
          prix_original: newPrix,
          prix_modifie: false
        };
      }
      return item;
    });
    setCart(updatedCart);
  };

  const handleOpenProduitModal = (_product?: any) => {
    setProduitModalOpen(true);
  };

  const handleProduitModalClose = () => {
    setProduitModalOpen(false);
    refreshProducts();
  };

  const totalArticles = cart.length;
  const totalPieces = cart.reduce((sum, item) => sum + item.quantite_commande, 0);
  const montantTotal = cart.reduce((sum, item) => sum + item.total, 0);

  const beneficeTotal = cart.reduce((sum, item) => {
    const prixAchat = item.prix_achat_base || 0;
    const beneficeUnitaire = item.prix_vente - prixAchat;
    return sum + (beneficeUnitaire * item.quantite_commande);
  }, 0);

  // ✅ Commission calculée avec le pourcentage (peut être 0)
  const commissionTotale = typeCommande === 'REVENDEUR'
    ? beneficeTotal * (commissionPourcentage / 100)
    : 0;

  const montantApresCommission = montantTotal - commissionTotale;

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
    let db: Db | null = null;
    let finalCode = '';
    let idCommande = 0;
    let maxRetries = 10;
    let retryDelay = 200;

    const executeWithRetry = async <T,>(
      operation: () => Promise<T>,
      retries = maxRetries
    ): Promise<T> => {
      try {
        if (!db) {
          db = (await getDb()) as Db;
          try {
            await db.execute('PRAGMA busy_timeout = 30000');
            await db.execute('PRAGMA journal_mode = WAL');
            await db.execute('PRAGMA synchronous = NORMAL');
          } catch (e) {
            console.warn('Impossible de configurer la base:', e);
          }
        }
        return await operation();
      } catch (error: any) {
        if (error?.message?.includes('database is locked') && retries > 0) {
          console.log(`⚠️ Base verrouillée, tentative ${maxRetries - retries + 1}/${maxRetries}...`);
          
          try {
            db = (await getDb()) as Db;
          } catch (e) {
            console.warn('Impossible de réinitialiser la connexion:', e);
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 1.5;
          return executeWithRetry(operation, retries - 1);
        }
        throw error;
      }
    };

    try {
      db = (await getDb()) as Db;
      
      await db.execute('PRAGMA busy_timeout = 30000');
      await db.execute('PRAGMA journal_mode = WAL');
      await db.execute('PRAGMA synchronous = NORMAL');

      finalCode = await executeWithRetry(async () => {
        return await generateUniqueCode(codeCommande);
      });

      if (finalCode !== codeCommande) {
        setCodeCommande(finalCode);
      }

      // TVA selon le réglage (source de vérité unique) : 0 si désactivée.
      const _tvaCfg = await tvaService.get(true);
      const _coefTVA = _tvaCfg.active ? _tvaCfg.taux / 100 : 0;
      const montantHT = montantTotal / (1 + _coefTVA);
      const dateCommande = new Date().toISOString();

      const clientCheck = await executeWithRetry(async () => {
        return await db!.select(
          `SELECT COUNT(*) as count FROM clients WHERE idClient = ?`,
          [parseInt(selectedClientId)]
        );
      });

      if (!clientCheck[0]?.count) {
        throw new Error('Client introuvable dans la base de données');
      }

      // 1. Insertion de la commande
    // Dans handleSubmit, section insertion de la commande

const result = await executeWithRetry(async () => {
  return await db!.execute(`
    INSERT INTO commandes (
      code_commande,
      idClient,
      type_commande,
      date_commande,
      montant_ht,
      montant_ttc,
      statut,
      taux_commission  -- ✅ AJOUTER CETTE COLONNE
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    finalCode,
    parseInt(selectedClientId),
    typeCommande,
    dateCommande,
    montantHT,
    typeCommande === 'REVENDEUR' ? montantApresCommission : montantTotal,
    'CONFIRMEE',
    typeCommande === 'REVENDEUR' ? commissionPourcentage : 0  // ✅ AJOUTER
  ]);
});

      idCommande = Number(result.lastInsertId);

      // 2. Insertion des détails de la commande
      for (const item of cart) {
        await executeWithRetry(async () => {
          return await db!.execute(
            `
            INSERT INTO commande_details (
              idCommande,
              idProduit,
              qte_commande,
              prix_unitaire_vente,
              remise
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
              idCommande,
              item.idProduit,
              item.quantite_commande,
              item.prix_vente,
              0
            ]
          );
        });
      }

      // 3. Traitement selon le type de commande
      if (typeCommande === 'STANDARD') {
        let beneficeTotalCalcul = 0;
        let coutTotalAchat = 0;

        for (const item of cart) {
          await executeWithRetry(async () => {
            const stockCheck = await db!.select(
              `SELECT qte_stock FROM products WHERE idProduit = ?`,
              [item.idProduit]
            );

            const stockDisponible = stockCheck[0]?.qte_stock || 0;
            if (stockDisponible < item.quantite_commande) {
              throw new Error(`Stock insuffisant pour ${item.designation}. Disponible: ${stockDisponible}`);
            }

            const product = await db!.select(
              `SELECT prix_achat_base FROM products WHERE idProduit = ?`,
              [item.idProduit]
            );

            const prixAchat = product[0]?.prix_achat_base || 0;
            coutTotalAchat += prixAchat * item.quantite_commande;
            beneficeTotalCalcul += (item.prix_vente - prixAchat) * item.quantite_commande;

            const stockAvant = stockDisponible;
            const stockApres = stockDisponible - item.quantite_commande;

            await db!.execute(
              `
              UPDATE products
              SET qte_stock = qte_stock - ?
              WHERE idProduit = ? AND qte_stock >= ?
              `,
              [item.quantite_commande, item.idProduit, item.quantite_commande]
            );

            await db!.execute(
              `
              INSERT INTO mouvements_stock (
                idProduit,
                type_mouvement,
                quantite,
                stock_avant,
                stock_apres,
                prix_unitaire,
                reference,
                notes,
                date_mouvement
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                item.idProduit,
                'SORTIE',
                item.quantite_commande,
                stockAvant,
                stockApres,
                item.prix_vente,
                finalCode,
                `Commande ${finalCode} - ${selectedClientDetails?.NomComplet || 'Client'}`,
                new Date().toISOString()
              ]
            );
          });
        }

        notifications.show({
          title: '✅ Commande standard enregistrée',
          message:
            `${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 CA: ${(beneficeTotalCalcul + coutTotalAchat).toLocaleString()} FCFA\n` +
            `📊 Coût d'achat: ${coutTotalAchat.toLocaleString()} FCFA\n` +
            `📈 Bénéfice: ${beneficeTotalCalcul.toLocaleString()} FCFA\n` +
            `📋 Code: ${finalCode}`,
          color: 'green',
          autoClose: 8000
        });

      } else {
        // Type REVENDEUR - Utilise le pourcentage saisi (peut être 0)
        const commissionParDefaut = commissionPourcentage;
        
        for (const item of cart) {
          await executeWithRetry(async () => {
            const stockCheck = await db!.select(
              `SELECT qte_stock FROM products WHERE idProduit = ?`,
              [item.idProduit]
            );

            const stockDisponible = stockCheck[0]?.qte_stock || 0;
            if (stockDisponible < item.quantite_commande) {
              throw new Error(`Stock insuffisant pour ${item.designation}. Disponible: ${stockDisponible}`);
            }

            const stockAvant = stockDisponible;
            const stockApres = stockDisponible - item.quantite_commande;

            await db!.execute(
              `
              UPDATE products
              SET qte_stock = qte_stock - ?
              WHERE idProduit = ? AND qte_stock >= ?
              `,
              [item.quantite_commande, item.idProduit, item.quantite_commande]
            );

            // Stock revendeur via le SERVICE unique (stock + mouvement 'ENTREE' + audit).
            await StockRevendeurService.increaseStock(
              parseInt(selectedClientId), item.idProduit, item.quantite_commande,
              { typeMouvement: 'ENTREE', idCommande, prixUnitaire: item.prix_achat_base || 0, prixVente: item.prix_vente }
            );

            // Rafraîchir les prix / commission du revendeur pour ce produit.
            await db!.execute(
              `UPDATE stock_revendeur
               SET prix_achat = ?, prix_vente = ?, commission_pourcentage = ?
               WHERE idRevendeur = ? AND idProduit = ?`,
              [item.prix_achat_base || 0, item.prix_vente, commissionParDefaut, parseInt(selectedClientId), item.idProduit]
            );

            await db!.execute(
              `
              INSERT INTO mouvements_stock (
                idProduit,
                type_mouvement,
                quantite,
                stock_avant,
                stock_apres,
                prix_unitaire,
                reference,
                notes,
                date_mouvement
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                item.idProduit,
                'SORTIE_REVENDEUR',
                item.quantite_commande,
                stockAvant,
                stockApres,
                item.prix_vente,
                finalCode,
                `Commande revendeur ${finalCode} - ${selectedClientDetails?.NomComplet || 'Client'}`,
                new Date().toISOString()
              ]
            );
          });
        }

        notifications.show({
          title: '✅ Commande revendeur enregistrée',
          message:
            `Commande revendeur ${finalCode} créée.\n` +
            `📦 ${cart.length} produit(s) commandé(s) (${totalPieces} pièces)\n` +
            `💰 Montant total: ${montantTotal.toLocaleString()} FCFA\n` +
            `📊 Bénéfice total: ${beneficeTotal.toLocaleString()} FCFA\n` +
            `📊 Commission (${commissionParDefaut}%): ${commissionTotale.toLocaleString()} FCFA\n` +
            `💵 Net à payer: ${montantApresCommission.toLocaleString()} FCFA`,
          color: 'green',
          autoClose: 8000
        });
      }

     // Auto-génération de la facture
try {
  if (typeCommande === 'STANDARD') {
    const { factureRepository } = await import('../../database/repositories/factureRepository');
    await factureRepository.createFromCommande(idCommande);
  } else {
    const { factureRevendeurRepository } = await import('../../database/repositories/factureRevendeurRepository');
    // ✅ Passer explicitement le taux
    await factureRevendeurRepository.createFromCommande(idCommande, {
      taux_commission: commissionPourcentage
    });
  }
} catch (factureError) {
  console.error('Erreur génération facture auto:', factureError);
}

      await refreshProducts();
      // Permet à la liste appelante (ex. Commandes revendeur) de se rafraîchir
      onSaved?.();
      onClose();

    } catch (error: any) {
      const errorMessage = error?.message || 'Erreur lors de la création de la commande';

      if (errorMessage.includes('database is locked')) {
        notifications.show({
          title: '⏳ Base de données verrouillée',
          message: 'Veuillez réessayer dans quelques instants. Si le problème persiste, fermez les autres fenêtres.',
          color: 'orange',
          autoClose: 8000
        });
      } else if (errorMessage.includes('UNIQUE constraint failed')) {
        notifications.show({
          title: '❌ Erreur de code',
          message: 'Un problème est survenu avec le code de la commande. Veuillez réessayer.',
          color: 'red',
        });
        setCodeCommande(`CMD-${Date.now()}`);
      } else {
        notifications.show({
          title: '❌ Erreur',
          message: errorMessage,
          color: 'red',
          autoClose: 5000
        });
      }

      console.error('Erreur lors de la création de la commande:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Lorsqu'un circuit est imposé (ex. commandes revendeur), on ne propose
  // que les clients du bon type : impossible de sortir du circuit par erreur.
  const clientsDuCircuit = restrictionType === 'REVENDEUR'
    ? clients.filter(c => c.TypeClient === 'revendeur')
    : restrictionType === 'STANDARD'
      ? clients.filter(c => c.TypeClient !== 'revendeur')
      : clients;

  const clientData = clientsDuCircuit.map(c => ({
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
          header: { backgroundColor: '#1a1a2e', padding: '20px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
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
            <Card className="tk-form-section" withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Grid align="flex-end">
                <Grid.Col span={3}>
                  <Group gap={4} align="flex-end" wrap="nowrap">
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
                      style={{ flex: 1 }}
                    />
                    <Tooltip label="Nouveau client" position="top">
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="blue"
                        onClick={() => setClientModalOpened(true)}
                        mb={1}
                      >
                        <IconUserPlus size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
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

              </Grid>
            </Card>

            <Card className="tk-form-section" withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Grid align="center">
                <Grid.Col span={3}>
                  <Group gap="xs" grow>
                    <Paper
                      p="xs"
                      withBorder
                      radius="md"
                      style={{
                        cursor: restrictionType ? 'not-allowed' : 'pointer',
                        opacity: restrictionType && restrictionType !== 'STANDARD' ? 0.45 : 1,
                        backgroundColor: typeCommande === 'STANDARD' ? '#eef3f9' : 'white',
                        borderColor: typeCommande === 'STANDARD' ? '#4a6cf7' : '#e5e7eb',
                        textAlign: 'center'
                      }}
                      onClick={() => { if (!restrictionType) setTypeCommande('STANDARD'); }}
                    >
                      <Group gap="xs" justify="center">
                        <ThemeIcon color="blue" variant={typeCommande === 'STANDARD' ? 'filled' : 'light'} size="xs" radius="xl">
                          <IconShoppingBag size={12} />
                        </ThemeIcon>
                        <Text size="xs" fw={600} c={typeCommande === 'STANDARD' ? 'blue.5' : '#333'}>Standard</Text>
                      </Group>
                    </Paper>

                    <Paper
                      p="xs"
                      withBorder
                      radius="md"
                      style={{
                        cursor: restrictionType ? 'not-allowed' : 'pointer',
                        opacity: restrictionType && restrictionType !== 'REVENDEUR' ? 0.45 : 1,
                        backgroundColor: typeCommande === 'REVENDEUR' ? '#e8f5e9' : 'white',
                        borderColor: typeCommande === 'REVENDEUR' ? '#2e7d32' : '#e5e7eb',
                        textAlign: 'center'
                      }}
                      onClick={() => { if (!restrictionType) setTypeCommande('REVENDEUR'); }}
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
                        <IconBuildingStore size={14} color="#4a6cf7" />
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

              {/* ✅ Alert avec commission - même à 0% */}
              {typeCommande === 'REVENDEUR' && cart.length > 0 && (
                <Alert color={commissionPourcentage > 0 ? 'green' : 'blue'} variant="light" mt="xs" p="xs">
                  <Group justify="space-between" gap="xs">
                    <Text size="xs">💰 Total: {montantTotal.toLocaleString()} FCFA</Text>
                    <Text size="xs" c="dimmed">📊 Bénéfice: {beneficeTotal.toLocaleString()} FCFA</Text>
                    <Divider orientation="vertical" />
                    <Text size="xs" c="orange">📊 Comm. {commissionPourcentage}%: {commissionTotale.toLocaleString()} FCFA</Text>
                    <Divider orientation="vertical" />
                    <Text size="xs" fw={700} c={commissionPourcentage > 0 ? 'green' : 'blue'}>
                      💵 Net: {montantApresCommission.toLocaleString()} FCFA
                    </Text>
                  </Group>
                </Alert>
              )}
            </Card>

            <Card className="tk-form-section" withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
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
                <Grid.Col span={5}>
                  <TextInput
                    placeholder="Rechercher (nom, code, référence)..."
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
                    searchable
                    clearable
                    onChange={(value) => {
                      setSelectedCategory(value);
                      setCurrentPage(1);
                    }}
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={3}>
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
                  <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                        <Table.Th style={{ width: '12%', minWidth: '100px' }}>Code</Table.Th>
                        <Table.Th style={{ width: '25%', minWidth: '150px' }}>Désignation</Table.Th>
                        <Table.Th style={{ width: '12%', minWidth: '80px' }}>Catégorie</Table.Th>
                        <Table.Th style={{ width: '8%', minWidth: '60px' }} ta="center">Unité</Table.Th>
                        <Table.Th style={{ width: '8%', minWidth: '60px' }} ta="center">Stock</Table.Th>
                        <Table.Th style={{ width: '12%', minWidth: '90px' }} ta="right">Prix</Table.Th>
                        <Table.Th style={{ width: '13%', minWidth: '100px' }} ta="center">Qté</Table.Th>
                        <Table.Th style={{ width: '10%', minWidth: '60px' }} ta="center">Action</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {paginatedProducts.map((product) => {
                        const isRupture = (product.qte_stock || 0) <= 0;
                        const prix = getPrixProduit(product);
                        const hasPrix = prix > 0;
                        return (
                          <Table.Tr key={product.idProduit} className={isRupture ? 'tk-row-danger' : undefined}>
                            <Table.Td><Text fw={500} size="xs">{product.code_produit}</Text></Table.Td>
                            <Table.Td><Text fw={500} size="xs" lineClamp={1}>{product.designation}</Text></Table.Td>
                            <Table.Td><Badge variant="light" size="xs" fullWidth>{product.categorie || '-'}</Badge></Table.Td>
                            <Table.Td ta="center"><Text size="xs">{product.unite_base || 'pc'}</Text></Table.Td>
                            <Table.Td ta="center">
                              <Badge
                                color={isRupture ? 'red' : (product.qte_stock || 0) < (product.seuil_alerte ?? 5) ? 'orange' : 'green'}
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
                                <Text size="xs" c="red">Non défini</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {isRupture ? (
                                <Text size="xs" c="dimmed">Rupture</Text>
                              ) : !hasPrix ? (
                                <Button size="xs" variant="subtle" color="orange" onClick={() => handleOpenProduitModal(product)}>
                                  Définir
                                </Button>
                              ) : (
                                <Group gap="4px" justify="center" wrap="nowrap">
                                  <NumberInput
                                    size="xs"
                                    min={1}
                                    max={product.qte_stock || 0}
                                    value={quantiteInput[product.idProduit] || 0}
                                    onChange={(val) => setQuantiteInput({ ...quantiteInput, [product.idProduit]: Number(val) || 0 })}
                                    style={{ width: 55 }}
                                    placeholder="0"
                                    hideControls
                                  />
                                </Group>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {!isRupture && hasPrix && (
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="green"
                                  onClick={() => addToCart(product, quantiteInput[product.idProduit] || 0)}
                                  disabled={!quantiteInput[product.idProduit] || quantiteInput[product.idProduit] <= 0}
                                >
                                  <IconPlus size={14} />
                                </ActionIcon>
                              )}
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

            {cart.length > 0 && (
              <Card className="tk-form-section" withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
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
                  <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                        <Table.Th style={{ width: '12%', minWidth: '100px' }}>Code</Table.Th>
                        <Table.Th style={{ width: '22%', minWidth: '130px' }}>Désignation</Table.Th>
                        <Table.Th style={{ width: '10%', minWidth: '70px' }}>Catégorie</Table.Th>
                        <Table.Th style={{ width: '6%', minWidth: '50px' }} ta="center">Unité</Table.Th>
                        <Table.Th style={{ width: '8%', minWidth: '60px' }} ta="center">Qté</Table.Th>
                        <Table.Th style={{ width: '18%', minWidth: '130px' }} ta="right">Prix unit.</Table.Th>
                        <Table.Th style={{ width: '12%', minWidth: '90px' }} ta="right">Total</Table.Th>
                        <Table.Th style={{ width: '12%', minWidth: '80px' }} ta="center">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {cart.map((item, index) => (
                        <Table.Tr key={index}>
                          <Table.Td><Text fw={500} size="xs">{item.code_produit}</Text></Table.Td>
                          <Table.Td>
                            <Text fw={500} size="xs" lineClamp={1}>{item.designation}</Text>
                            {item.prix_modifie && (
                              <Badge size="xs" color="orange" variant="light" mt={2}>Modifié</Badge>
                            )}
                          </Table.Td>
                          <Table.Td><Badge variant="light" size="xs" fullWidth>{item.categorie || '-'}</Badge></Table.Td>
                          <Table.Td ta="center"><Text size="xs">{item.unite_mesure || 'pc'}</Text></Table.Td>
                          <Table.Td ta="center">
                            <NumberInput
                              value={item.quantite_commande}
                              onChange={(val) => updateQuantity(index, Number(val) || 1)}
                              min={1}
                              max={item.quantite_stock}
                              size="xs"
                              w={55}
                              hideControls
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            {editingPrix[item.idProduit] ? (
                              <Group gap="4px" justify="flex-end" wrap="nowrap">
                                <NumberInput
                                  value={tempPrix[item.idProduit] ?? item.prix_vente}
                                  onChange={(val) => handlePrixChange(item.idProduit, val ?? 0)}
                                  size="xs"
                                  w={100}
                                  min={0}
                                  step={100}
                                  autoFocus
                                />
                                <ActionIcon
                                  size="sm"
                                  variant="filled"
                                  color="green"
                                  onClick={() => confirmEditPrix(index)}
                                >
                                  <IconCheck size={12} />
                                </ActionIcon>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="red"
                                  onClick={() => cancelEditPrix(index)}
                                >
                                  <IconX size={12} />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Group gap="4px" justify="flex-end" wrap="nowrap">
                                <Text fw={600} c={item.prix_modifie ? 'orange' : 'blue'} size="xs">
                                  {formatPrice(item.prix_vente)}
                                </Text>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="blue"
                                  onClick={() => startEditPrix(index)}
                                >
                                  <IconEdit size={12} />
                                </ActionIcon>
                                {item.prix_modifie && (
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => resetPrix(index)}
                                  >
                                    <IconRefresh size={12} />
                                  </ActionIcon>
                                )}
                              </Group>
                            )}
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={700} c="blue" size="xs">{formatPrice(item.total)} FCFA</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <ActionIcon color="red" onClick={() => removeFromCart(index)} size="sm" variant="subtle">
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="xs" />

                {/* ✅ Badges avec commission affichée même à 0% */}
                <Group justify="space-between" gap="xs">
                  <Group gap="xs">
                    <Badge size="sm" variant="light" color="blue">Articles: {totalArticles}</Badge>
                    <Badge size="sm" variant="light" color="gray">Pièces: {totalPieces}</Badge>
                    {typeCommande === 'REVENDEUR' && (
                      <Badge size="sm" variant="light" color="orange">
                        Comm.: {commissionPourcentage}%
                      </Badge>
                    )}
                    {typeCommande === 'REVENDEUR' && commissionPourcentage > 0 && (
                      <Badge size="sm" variant="light" color="green">
                        Net: {formatPrice(montantApresCommission)}
                      </Badge>
                    )}
                  </Group>
                  <Text fw={700} size="md" c="#1b365d">
                    Total: {formatPrice(montantTotal)} FCFA
                  </Text>
                </Group>
              </Card>
            )}

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
                color="blue"
                leftSection={<IconCheck size={14} />}
              >
                Enregistrer la commande
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Modal Nouveau Client */}
      <FormulaireClient
        opened={clientModalOpened}
        onClose={() => { setClientModalOpened(false); refreshClients(); }}
      />

      {/* Modal Nouveau Produit */}
      <FormulaireProduit
        opened={produitModalOpen}
        onClose={handleProduitModalClose}
      />
    </>
  );
};

export default FormulaireCommande;