// src/components/ventes/FormulaireVente.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TextInput, Select, Button, Group, Stack, Box,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, Title, LoadingOverlay, ScrollArea, Badge, Tooltip,
  Checkbox, Alert, Modal, Textarea, Pagination
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash, IconPlus, IconShoppingCart, IconSearch,
  IconRefresh, IconUserPlus, IconAlertCircle, IconBoxMultiple,
  IconEdit, IconCheck, IconX, IconCategory
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { FormulaireClient } from '../clients/FormulaireClient';
import { stockService } from '../../database/repositories/stockService';
import { journalCaisseService } from '../../services/journalCaisseService';
import { getDb } from '../../database/db';
import { categorieRepository } from '../../database/repositories/categorieRepository';
import { tvaService } from '../../services/tvaService';
import { MoyenPaiement } from '../../services/journalCaisseService';
import SelecteurModePaiement from '../common/SelecteurModePaiement';

interface FormulaireVenteProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Conditionnement {
  idConditionnement: number;
  libelle: string;
  quantite_par_unite_base: number;
  prix_vente_ttc: number;
  est_conditionnement_par_defaut: number;
}

interface SelectedUnit {
  idConditionnement: number | null;
  libelle: string;
  quantite_par_unite_base: number;
  prix: number;
}

interface CartItem {
  idProduit: number;
  idConditionnement: number | null;
  designation: string;
  code_produit: string;
  categorie?: string;
  unite_base: string;
  contenu_unite?: number;
  quantite_stock: number;
  prix_vente: number;
  prix_achat_base?: number;
  quantite: number;
  quantite_par_unite_base: number;
  libelle_conditionnement: string;
  total: number;
}

export const FormulaireVente: React.FC<FormulaireVenteProps> = ({ onSuccess, onCancel }) => {
  const { clients, loading: clientsLoading, refresh: refreshClients } = useClients();
  const { products, loading: productsLoading, refresh: refreshProducts } = useProducts();
  const { createSale, loading } = useSales();

  // États principaux
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [, setSelectedClientDetails] = useState<any>(null);
  const [clientNom, setClientNom] = useState<string>('');
  const [clientContact, setClientContact] = useState<string>('');
  // Moyen de paiement de la vente : alimente la ventilation automatique
  // espèces / mobile money du point de caisse (via sa catégorie).
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement | null>(null);
  const [ajouterClient, setAjouterClient] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [venteCategorie, setVenteCategorie] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [codeVente, setCodeVente] = useState<string>('');
  const [clientModalOpened, setClientModalOpened] = useState(false);
  
  // États pour les catégories
  const [categories, setCategories] = useState<any[]>([]);
  const [showAddCategorie, setShowAddCategorie] = useState(false);
  const [newCategorie, setNewCategorie] = useState({ nom: '', description: '' });
  const [addingCategorie, setAddingCategorie] = useState(false);

  // États pour la TVA
  const [tvaActif, setTvaActif] = useState<boolean>(true);
  const [tauxTVA, setTauxTVA] = useState<number>(18);
  const [modifierPrix, setModifierPrix] = useState<{ index: number | null; prix: number }>({
    index: null,
    prix: 0
  });

  // États pour les conditionnements
  const [condMap, setCondMap] = useState<Record<number, Conditionnement[]>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<number, SelectedUnit>>({});

  const itemsPerPage = 5;

  // Charger la configuration TVA via la source de vérité unique (tvaService)
  useEffect(() => {
    const loadTVAConfig = async () => {
      try {
        const config = await tvaService.get(true);
        setTvaActif(config.active);
        setTauxTVA(config.taux);
      } catch (error) {
        console.error('Erreur chargement TVA:', error);
        // Valeurs par défaut en cas d'erreur
        setTvaActif(true);
        setTauxTVA(18);
      }
    };
    loadTVAConfig();
  }, []);

  // Charger les catégories
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await categorieRepository.getAll();
      setCategories(cats);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  // Générer le code de vente
  const generateUniqueVenteCode = async (): Promise<string> => {
    const db = await getDb();
    const prefix = 'VENTE-';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    let baseCode = `${prefix}${year}${month}${day}`;
    let code = `${baseCode}-001`;
    let counter = 1;
    let exists = true;
    while (exists && counter <= 100) {
      code = `${baseCode}-${String(counter).padStart(3, '0')}`;
      const result = await db.select(
        `SELECT COUNT(*) as count FROM ventes WHERE code_vente = ?`,
        [code]
      ) as Array<{ count: number }>;
      exists = (result[0]?.count ?? 0) > 0;
      if (exists) counter++;
    }
    if (counter > 100) code = `${prefix}${Date.now()}`;
    return code;
  };

  useEffect(() => {
    generateUniqueVenteCode().then(setCodeVente);
  }, []);

  // Charger les conditionnements
  const loadConditionnements = useCallback(async (productIds: number[]) => {
    if (productIds.length === 0) return;
    try {
      const db = await getDb();
      const placeholders = productIds.map(() => '?').join(',');
      const rows = await db.select<(Conditionnement & { idProduit: number })[]>(
        `SELECT idConditionnement, idProduit, libelle, quantite_par_unite_base,
                prix_vente_ttc, est_conditionnement_par_defaut
         FROM conditionnements
         WHERE idProduit IN (${placeholders}) AND est_actif = 1
         ORDER BY est_conditionnement_par_defaut DESC, quantite_par_unite_base ASC`,
        productIds
      );
      const map: Record<number, Conditionnement[]> = {};
      for (const row of rows) {
        if (!map[row.idProduit]) map[row.idProduit] = [];
        map[row.idProduit].push(row);
      }
      setCondMap(map);
    } catch (err) {
      console.error('Erreur chargement conditionnements:', err);
    }
  }, []);

  useEffect(() => {
    if (products.length > 0) {
      loadConditionnements(products.map(p => p.idProduit));
    }
  }, [products, loadConditionnements]);

  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.idClient.toString() === selectedClientId);
      setSelectedClientDetails(client);
      if (client) {
        setClientNom((client as any).NomComplet || (client as any).Societe || '');
        setClientContact((client as any).Tel || '');
        setAjouterClient(true);
      }
    } else if (!selectedClientId) {
      setSelectedClientDetails(null);
      if (!ajouterClient) {
        setClientNom('');
        setClientContact('');
      }
    }
  }, [selectedClientId, clients, ajouterClient]);

  // Fonctions pour les catégories
  const handleAddCategorie = async () => {
    if (!newCategorie.nom.trim()) {
      notifications.show({
        title: 'Erreur',
        message: 'Le nom de la catégorie est requis',
        color: 'red'
      });
      return;
    }

    setAddingCategorie(true);
    try {
      await categorieRepository.create({
        code_categorie: `CAT-${Date.now()}`,
        nom_categorie: newCategorie.nom,
        description: newCategorie.description
      });

      notifications.show({
        title: 'Succès',
        message: `Catégorie "${newCategorie.nom}" ajoutée avec succès`,
        color: 'green'
      });

      setShowAddCategorie(false);
      setNewCategorie({ nom: '', description: '' });
      await loadCategories();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'ajout de la catégorie',
        color: 'red'
      });
    } finally {
      setAddingCategorie(false);
    }
  };

  // Construire les options d'unité
  const getUnitOptions = (product: any): { value: string; label: string }[] => {
    const contenu = Math.max(1, Number(product.contenu_unite) || 1);
    const opts: { value: string; label: string }[] = [
      { value: 'piece', label: `${product.unite_base || 'Pièce'}${contenu > 1 ? ` (${contenu} pièces)` : ''} — ${formatMontant(product.prix_vente_detail)} F` }
    ];
    const conds = condMap[product.idProduit] || [];
    for (const c of conds) {
      opts.push({
        value: `cond_${c.idConditionnement}`,
        label: `${c.libelle} (${c.quantite_par_unite_base} pièces) — ${formatMontant(c.prix_vente_ttc)} F`,
      });
    }
    return opts;
  };

  const getResolvedUnit = (product: any): SelectedUnit => {
    const manual = selectedUnits[product.idProduit];
    if (manual) return manual;
    const conds = condMap[product.idProduit] || [];
    const def = conds.find(c => c.est_conditionnement_par_defaut === 1) || conds[0];
    if (def) {
      return {
        idConditionnement: def.idConditionnement,
        libelle: def.libelle,
        quantite_par_unite_base: def.quantite_par_unite_base,
        prix: def.prix_vente_ttc,
      };
    }
    return {
      idConditionnement: null,
      libelle: `${product.unite_base || 'pièce'}${Number(product.contenu_unite) > 1 ? ` (${product.contenu_unite} pièces)` : ''}`,
      quantite_par_unite_base: Math.max(1, Number(product.contenu_unite) || 1),
      prix: product.prix_vente_detail || 0,
    };
  };

  const handleUnitChange = (product: any, value: string | null) => {
    if (!value) return;
    if (value === 'piece') {
      setSelectedUnits(prev => ({
        ...prev,
        [product.idProduit]: {
          idConditionnement: null,
          libelle: `${product.unite_base || 'pièce'}${Number(product.contenu_unite) > 1 ? ` (${product.contenu_unite} pièces)` : ''}`,
          quantite_par_unite_base: Math.max(1, Number(product.contenu_unite) || 1),
          prix: product.prix_vente_detail || 0,
        }
      }));
    } else {
      const condId = parseInt(value.replace('cond_', ''));
      const cond = (condMap[product.idProduit] || []).find(c => c.idConditionnement === condId);
      if (cond) {
        setSelectedUnits(prev => ({
          ...prev,
          [product.idProduit]: {
            idConditionnement: cond.idConditionnement,
            libelle: cond.libelle,
            quantite_par_unite_base: cond.quantite_par_unite_base,
            prix: cond.prix_vente_ttc,
          }
        }));
      }
    }
  };

  const filteredProducts = products.filter(product => {
    const stockDisponible = (product.qte_stock || 0) > 0;
    const t = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      product.designation?.toLowerCase().includes(t) ||
      product.code_produit?.toLowerCase().includes(t) ||
      (product as any).reference?.toLowerCase().includes(t) ||
      product.categorie?.toLowerCase().includes(t);
    const matchesCategorie = !venteCategorie || product.categorie === venteCategorie;
    return matchesSearch && matchesCategorie && stockDisponible;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calcul des totaux
  const totalHT = cart.reduce((sum, item) => sum + item.total, 0);
  const tva = tvaActif ? totalHT * (tauxTVA / 100) : 0;
  const totalTTC = tvaActif ? totalHT + tva : totalHT;

  // Ajouter au panier
  const addToCart = (product: any) => {
    const unit = getResolvedUnit(product);
    const stock = product.qte_stock || 0;

    if (unit.prix <= 0) {
      notifications.show({
        title: 'Erreur',
        message: `Le prix du produit "${product.designation}" n'est pas défini`,
        color: 'red',
      });
      return;
    }
    if (stock <= 0) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `"${product.designation}" est en rupture de stock`,
        color: 'red',
      });
      return;
    }

    const piecesNecessaires = 1 * unit.quantite_par_unite_base;
    if (piecesNecessaires > stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${stock} pièce(s), il en faut ${piecesNecessaires} pour 1 ${unit.libelle}`,
        color: 'red',
      });
      return;
    }

    const existingIdx = cart.findIndex(
      item => item.idProduit === product.idProduit && item.idConditionnement === unit.idConditionnement
    );

    if (existingIdx >= 0) {
      const existing = cart[existingIdx];
      const newQty = existing.quantite + 1;
      const newPieces = newQty * unit.quantite_par_unite_base;
      if (newPieces > stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `Stock disponible: ${stock} pièce(s)`,
          color: 'red',
        });
        return;
      }
      setCart(cart.map((item, i) =>
        i === existingIdx
          ? { ...item, quantite: newQty, total: newQty * unit.prix }
          : item
      ));
    } else {
      setCart([...cart, {
        idProduit: product.idProduit,
        idConditionnement: unit.idConditionnement,
        designation: product.designation,
        code_produit: product.code_produit,
        categorie: product.categorie || 'Non catégorisé',
        unite_base: product.unite_base || 'pièce',
        quantite_stock: stock,
        prix_vente: unit.prix,
        prix_achat_base: product.prix_achat_base || 0,
        quantite: 1,
        quantite_par_unite_base: unit.quantite_par_unite_base,
        libelle_conditionnement: unit.libelle,
        total: unit.prix,
      }]);
    }
  };

  // Modifier la quantité
  const updateQuantity = (index: number, newQuantite: number) => {
    if (newQuantite < 1) return;
    const item = cart[index];
    const newPieces = newQuantite * item.quantite_par_unite_base;
    if (newPieces > item.quantite_stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${item.quantite_stock} pièce(s). Vous avez ${newQuantite} × ${item.libelle_conditionnement} = ${newPieces} pièce(s) requises.`,
        color: 'red',
      });
      return;
    }
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], quantite: newQuantite, total: newQuantite * newCart[index].prix_vente };
    setCart(newCart);
  };

  // Modifier le prix
  const updatePrix = (index: number, newPrix: number) => {
    if (newPrix < 0) return;
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], prix_vente: newPrix, total: newCart[index].quantite * newPrix };
    setCart(newCart);
    setModifierPrix({ index: null, prix: 0 });
  };

  // Ouvrir le modal de modification de prix
  const openPrixModal = (index: number) => {
    setModifierPrix({
      index: index,
      prix: cart[index].prix_vente
    });
  };

  // Supprimer du panier
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Soumettre la vente
  const handleSubmit = async () => {
    if (cart.length === 0) {
      notifications.show({ title: 'Erreur', message: 'Ajoutez au moins un produit', color: 'red' });
      return;
    }

    for (const item of cart) {
      const piecesRequises = item.quantite * item.quantite_par_unite_base;
      if (piecesRequises > item.quantite_stock) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `${item.designation}: ${piecesRequises} pièces requises, ${item.quantite_stock} disponibles`,
          color: 'red'
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const sale = {
        code_vente: codeVente,
        idClient: selectedClientId ? parseInt(selectedClientId) : null,
        nom_prenom: ajouterClient ? clientNom : 'Client anonyme',
        contact: ajouterClient ? (clientContact || null) : null,
        montant_ht: totalHT,
        montant_tva: tva,
        montant_ttc: totalTTC,
        type_vente: 'COMPTOIR',
        observation: ajouterClient ? `Client: ${clientNom} ${clientContact ? `(${clientContact})` : ''}` : null
      };

      const details = cart.map(item => ({
        idProduit: item.idProduit,
        quantite: item.quantite,
        quantite_pieces: item.quantite * item.quantite_par_unite_base,
        idConditionnement: item.idConditionnement || null,
        libelle_conditionnement: item.libelle_conditionnement,
        prix_unitaire_ht: item.prix_vente,
        prix_unitaire_ttc: tvaActif ? item.prix_vente * (1 + tauxTVA / 100) : item.prix_vente,
        tva_taux: tvaActif ? tauxTVA : 0,
        remise_percent: 0
      }));

      const createdSaleId = await createSale(sale, details);

      const results = [];
      for (const item of cart) {
        const quantiteEnPieces = item.quantite * item.quantite_par_unite_base;
        const result = await stockService.sortieStock({
          idProduit: item.idProduit,
          quantite: quantiteEnPieces,
          prix_vente: item.prix_vente / item.quantite_par_unite_base,
          reference: `VENTE-${codeVente}`,
          notes: `Vente au comptoir - ${codeVente} - ${item.quantite} ${item.libelle_conditionnement}(s) - Client: ${sale.nom_prenom}`
        });
        if (!result.success) throw new Error(`Erreur pour ${item.designation}: ${result.message}`);
        results.push(result);
      }

      const beneficeTotal = results.reduce((sum, r) => sum + (r.benefice || 0), 0);

      try {
        await journalCaisseService.ajouterVenteComptoir({
          montant: totalTTC,
          idVente: createdSaleId,
          codeVente: codeVente,
          clientNom: sale.nom_prenom,
          modePaiement: (moyenPaiement?.categorie || 'ESPECES'),
          modePaiementDetail: moyenPaiement?.libelle,
        });
      } catch (journalError) {
        console.error('Erreur journal de caisse:', journalError);
      }

      notifications.show({
        title: '✅ Vente enregistrée',
        message: `${cart.length} article(s) — Total: ${totalTTC.toLocaleString()} F — Bénéfice: ${beneficeTotal.toLocaleString()} F`,
        color: 'green',
        autoClose: 5000
      });

      await refreshProducts();
      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de la vente:', error);
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Erreur lors de l\'enregistrement de la vente',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const clientData = clients.map(c => ({
    value: c.idClient.toString(),
    label: (c as any).NomComplet || (c as any).Societe || 'Client sans nom'
  }));

  return (
    <>
      <Box p="md">
        <LoadingOverlay visible={submitting || productsLoading} />

        {/* En-tête */}
        <Box mb="md" p="md" className="tk-page-tools tk-page-tools--fiche">
          <Group justify="space-between" wrap="nowrap">
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconShoppingCart size={15} />}
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onClick={onCancel}
            >
              ← Retour aux ventes
            </Button>
            <Box ta="center" style={{ flex: 1 }}>
              <Text fw={700} c="white" size="md">Nouvelle vente au comptoir</Text>
              {codeVente && <Text size="xs" c="rgba(255,255,255,0.5)">{codeVente}</Text>}
            </Box>
            <Button
              size="sm"
              variant="outline"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}
              onClick={onCancel}
            >
              Annuler
            </Button>
          </Group>
        </Box>

        <Stack gap="md">
          {/* Code vente */}
          <Card className="tk-form-section" withBorder p="sm" radius="md">
            <TextInput
              label="Code vente"
              value={codeVente}
              readOnly
              disabled
              size="sm"
              styles={{ input: { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } }}
            />
          </Card>

          {/* Client */}
          <Card className="tk-form-section" withBorder p="sm" radius="md">
            <Group justify="space-between" mb="sm">
              <Title order={5}>Informations client (optionnel)</Title>
              <Checkbox
                label="Ajouter les infos client"
                checked={ajouterClient}
                onChange={(e) => {
                  setAjouterClient(e.currentTarget.checked);
                  if (!e.currentTarget.checked) {
                    setSelectedClientId(null);
                    setClientNom('');
                    setClientContact('');
                  }
                }}
              />
            </Group>

            {ajouterClient && (
              <>
                <Group grow>
                  <Select
                    label="Client existant"
                    placeholder="Choisir un client"
                    data={clientData}
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                    searchable
                    clearable
                    size="sm"
                  />
                  <Button
                    leftSection={<IconUserPlus size={14} />}
                    onClick={() => setClientModalOpened(true)}
                    size="sm"
                    variant="light"
                    mt="auto"
                  >
                    Nouveau client
                  </Button>
                </Group>
                <Group grow mt="sm">
                  <TextInput
                    label="Nom complet"
                    placeholder="Nom du client"
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    size="sm"
                  />
                  <TextInput
                    label="Contact"
                    placeholder="Téléphone"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    size="sm"
                  />
                </Group>
              </>
            )}
            {!ajouterClient && (
              <Text size="xs" c="dimmed" ta="center" mt="sm">
                La vente sera enregistrée comme "Client anonyme"
              </Text>
            )}
          </Card>

          {/* Informations TVA */}
          <Card className="tk-form-section" withBorder p="sm" radius="md" bg={tvaActif ? 'transparent' : '#fff8e1'}>
            <Group justify="space-between">
              <Group>
                <Text size="sm" fw={500}>
                  {tvaActif ? `TVA ${tauxTVA}% activée` : 'TVA désactivée'}
                </Text>
                <Badge color={tvaActif ? 'blue' : 'yellow'} size="sm">
                  {tvaActif ? 'Facturée' : 'Non facturée'}
                </Badge>
              </Group>
              <Tooltip label={tvaActif ? 'Désactiver la TVA' : 'Activer la TVA'}>
                <ActionIcon
                  color={tvaActif ? 'red' : 'green'}
                  onClick={() => setTvaActif(!tvaActif)}
                  variant="outline"
                >
                  {tvaActif ? <IconX size={16} /> : <IconCheck size={16} />}
                </ActionIcon>
              </Tooltip>
            </Group>
            {!tvaActif && (
              <Text size="xs" c="dimmed" mt={5}>
                ⚠️ La TVA est désactivée. Les prix sont affichés hors taxe.
              </Text>
            )}
          </Card>

          {/* Produits */}
          <Card className="tk-form-section" withBorder p="sm" radius="md">
            <Title order={5} mb="sm">Produits disponibles en stock</Title>
            <Group mb="sm" gap="xs">
              <TextInput
                placeholder="Rechercher (nom, code, référence)..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{ flex: 1 }}
                leftSection={<IconSearch size={14} />}
                size="sm"
              />
              <Select
                placeholder="Catégorie"
                data={[...new Set(products.map(p => p.categorie).filter(Boolean))].map((c) => ({ value: c as string, label: c as string }))}
                value={venteCategorie}
                onChange={(v) => { setVenteCategorie(v); setCurrentPage(1); }}
                searchable
                clearable
                size="sm"
                w={190}
              />
              <Tooltip label="Actualiser">
                <ActionIcon
                  onClick={() => { refreshProducts(); loadConditionnements(products.map(p => p.idProduit)); }}
                  size="sm"
                  variant="outline"
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {filteredProducts.length === 0 && (
              <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  {searchTerm
                    ? 'Aucun produit ne correspond à votre recherche'
                    : 'Aucun produit en stock disponible pour la vente'}
                </Text>
              </Alert>
            )}

            {filteredProducts.length > 0 && (
              <ScrollArea h={280}>
                <Table striped highlightOnHover style={{ minWidth: 700 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ whiteSpace: 'nowrap' }}>Désignation</Table.Th>
                      <Table.Th style={{ whiteSpace: 'nowrap' }}>Catégorie</Table.Th>
                      <Table.Th style={{ whiteSpace: 'nowrap' }}>Unité / Conditionnement</Table.Th>
                      <Table.Th style={{ whiteSpace: 'nowrap' }}>Prix sélectionné</Table.Th>
                      <Table.Th style={{ whiteSpace: 'nowrap' }}>Stock</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedProducts.map((product) => {
                      const hasConds = (condMap[product.idProduit] || []).length > 0;
                      const unitOpts = getUnitOptions(product);
                      const resolvedUnit = getResolvedUnit(product);
                      const currentSelectValue = resolvedUnit.idConditionnement
                        ? `cond_${resolvedUnit.idConditionnement}`
                        : 'piece';

                      return (
                        <Table.Tr key={product.idProduit}>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text size="sm" fw={500}>{product.designation}</Text>
                            <Text size="xs" c="dimmed">{product.code_produit}</Text>
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Group gap="xs">
                              <Badge variant="light" size="xs" color="grape">
                                {product.categorie || 'Non catégorisé'}
                              </Badge>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="blue"
                                onClick={() => setShowAddCategorie(true)}
                              >
                                <IconPlus size={12} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ minWidth: 200 }}>
                            {hasConds ? (
                              <Select
                                data={unitOpts}
                                value={currentSelectValue}
                                onChange={(val) => handleUnitChange(product, val)}
                                size="xs"
                                leftSection={<IconBoxMultiple size={12} />}
                                styles={{ input: { fontSize: 12 } }}
                              />
                            ) : (
                              <Text size="xs" c="dimmed">{product.unite_base || 'pièce'}</Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text fw={600} c="blue" size="sm">
                              {formatMontant(resolvedUnit.prix)} F
                            </Text>
                            {resolvedUnit.quantite_par_unite_base > 1 && (
                              <Text size="xs" c="dimmed">
                                ({Math.round(resolvedUnit.prix / resolvedUnit.quantite_par_unite_base).toLocaleString('fr-FR')} F/{product.unite_base || 'pièce'})
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Badge color={product.qte_stock > 10 ? 'green' : 'orange'} size="sm">
                              {product.qte_stock} {product.unite_base || 'pièces'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              color="blue"
                              onClick={() => addToCart(product)}
                              variant="filled"
                              size="sm"
                            >
                              <IconPlus size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}

            {totalPages > 1 && (
              <Group justify="center" mt="sm">
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={setCurrentPage}
                  size="sm"
                />
              </Group>
            )}
          </Card>

          {/* Panier */}
          {cart.length > 0 && (
            <Card className="tk-form-section" withBorder p="sm" radius="md">
              <Group justify="space-between" mb="sm">
                <Title order={5}>Panier ({cart.length} article{cart.length > 1 ? 's' : ''})</Title>
                <Button
                  size="xs"
                  variant="outline"
                  color="red"
                  onClick={() => setCart([])}
                >
                  Vider le panier
                </Button>
              </Group>

              <ScrollArea h={200}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th>Conditionnement</Table.Th>
                      <Table.Th>Qté</Table.Th>
                      <Table.Th>Prix unit.</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cart.map((item, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{item.designation}</Text>
                          <Text size="xs" c="dimmed">{item.code_produit}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light">
                            {item.libelle_conditionnement}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            value={item.quantite}
                            onChange={(val) => updateQuantity(index, Number(val) || 1)}
                            min={1}
                            max={Math.floor(item.quantite_stock / item.quantite_par_unite_base)}
                            size="xs"
                            style={{ width: 70 }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text size="sm">{formatMontant(item.prix_vente)} F</Text>
                            <ActionIcon
                              size="xs"
                              color="blue"
                              variant="subtle"
                              onClick={() => openPrixModal(index)}
                            >
                              <IconEdit size={12} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{formatMontant(item.total)} F</Text>
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            onClick={() => removeFromCart(index)}
                            size="sm"
                            variant="subtle"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Divider my="sm" />

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Total HT</Text>
                  <Text fw={600}>{formatMontant(totalHT)} F</Text>
                </Group>
                {tvaActif && (
                  <Group justify="space-between">
                    <Text size="sm">TVA ({tauxTVA}%)</Text>
                    <Text fw={600}>{formatMontant(tva)} F</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="lg" fw={700}>Total {tvaActif ? 'TTC' : 'HT'}</Text>
                  <Text size="lg" fw={700} c="blue">
                    {formatMontant(totalTTC)} F
                  </Text>
                </Group>

                {/* Mode de paiement : distingue automatiquement, au point de
                    caisse, les espèces présentes dans le tiroir des transferts. */}
                <SelecteurModePaiement
                  value={moyenPaiement?.code}
                  onChange={setMoyenPaiement}
                  size="sm"
                  withAsterisk
                />

                <Group justify="flex-end" mt="md">
                  <Button variant="light" onClick={onCancel}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={cart.length === 0}
                    leftSection={<IconShoppingCart size={16} />}
                  >
                    Valider la vente
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </Stack>
      </Box>

      {/* Modal d'ajout de catégorie */}
      <Modal
        opened={showAddCategorie}
        onClose={() => {
          setShowAddCategorie(false);
          setNewCategorie({ nom: '', description: '' });
        }}
        title="Ajouter une nouvelle catégorie"
        size="sm"
        centered
      >
        <Stack>
          <TextInput
            label="Nom de la catégorie *"
            placeholder="Ex: Accessoires, Électronique..."
            value={newCategorie.nom}
            onChange={(e) => setNewCategorie({ ...newCategorie, nom: e.target.value })}
            required
          />
          <TextInput
            label="Description"
            placeholder="Description de la catégorie (optionnel)"
            value={newCategorie.description}
            onChange={(e) => setNewCategorie({ ...newCategorie, description: e.target.value })}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setShowAddCategorie(false);
                setNewCategorie({ nom: '', description: '' });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddCategorie}
              loading={addingCategorie}
              leftSection={<IconCategory size={16} />}
            >
              Ajouter la catégorie
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de modification de prix */}
      <Modal
        opened={modifierPrix.index !== null}
        onClose={() => setModifierPrix({ index: null, prix: 0 })}
        title="Modifier le prix unitaire"
        size="sm"
        centered
      >
        {modifierPrix.index !== null && (
          <Stack>
            <Text size="sm" c="dimmed">
              Produit: <strong>{cart[modifierPrix.index]?.designation}</strong>
            </Text>
            <Text size="sm" c="dimmed">
              Conditionnement: <strong>{cart[modifierPrix.index]?.libelle_conditionnement}</strong>
            </Text>
            <NumberInput
              label="Nouveau prix unitaire"
              value={modifierPrix.prix}
              onChange={(val) => setModifierPrix({ ...modifierPrix, prix: Number(val) || 0 })}
              min={0}
              step={100}
              leftSection="FCFA"
              autoFocus
            />
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => setModifierPrix({ index: null, prix: 0 })}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (modifierPrix.index !== null) {
                    updatePrix(modifierPrix.index, modifierPrix.prix);
                  }
                }}
                color="blue"
              >
                Appliquer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal d'ajout client */}
      <FormulaireClient
        opened={clientModalOpened}
        onClose={() => setClientModalOpened(false)}
        onSuccess={() => {
          refreshClients();
          setClientModalOpened(false);
        }}
      />
    </>
  );
};

export default FormulaireVente;
