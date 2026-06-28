// src/components/ventes/FormulaireVente.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TextInput, Select, Button, Group, Stack, Box,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, Title, LoadingOverlay, ScrollArea, Badge, Tooltip,
  Checkbox, Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTrash, IconPlus, IconShoppingCart, IconSearch,
  IconRefresh, IconUserPlus, IconAlertCircle, IconBoxMultiple
} from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { FormulaireClient } from '../clients/FormulaireClient';
import { stockService } from '../../database/repositories/stockService';
import { journalCaisseService } from '../../services/journalCaisseService';
import { getDb } from '../../database/db';

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
  quantite_stock: number;         // en unités de base (pièces)
  prix_vente: number;             // prix de l'unité sélectionnée
  prix_achat_base?: number;
  quantite: number;               // en unités sélectionnées (boîtes, pièces…)
  quantite_par_unite_base: number;// 1 = pièce, n = conditionnement
  libelle_conditionnement: string;// "pièce", "Boîte", etc.
  total: number;
}

export const FormulaireVente: React.FC<FormulaireVenteProps> = ({ onSuccess, onCancel }) => {
  const { clients, loading: clientsLoading, refresh: refreshClients } = useClients();
  const { products, loading: productsLoading, refresh: refreshProducts } = useProducts();
  const { createSale, loading } = useSales();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [, setSelectedClientDetails] = useState<any>(null);
  const [clientNom, setClientNom] = useState<string>('');
  const [clientContact, setClientContact] = useState<string>('');
  const [ajouterClient, setAjouterClient] = useState<boolean>(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [codeVente, setCodeVente] = useState<string>('');
  const [clientModalOpened, setClientModalOpened] = useState(false);

  // Conditionnements: map idProduit → liste de conditionnements
  const [condMap, setCondMap] = useState<Record<number, Conditionnement[]>>({});
  // Unité sélectionnée par produit dans la liste
  const [selectedUnits, setSelectedUnits] = useState<Record<number, SelectedUnit>>({});

  const itemsPerPage = 5;

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

  // Charger les conditionnements de tous les produits affichés
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

  // Construire les options d'unité pour un produit
  const getUnitOptions = (product: any): { value: string; label: string }[] => {
    const opts: { value: string; label: string }[] = [
      { value: 'piece', label: `Pièce — ${formatMontant(product.prix_vente_detail)} F` }
    ];
    const conds = condMap[product.idProduit] || [];
    for (const c of conds) {
      opts.push({
        value: `cond_${c.idConditionnement}`,
        label: `${c.libelle} (${c.quantite_par_unite_base} pièces) — ${c.prix_vente_ttc.toLocaleString('fr-FR')} F`,
      });
    }
    return opts;
  };

  // Résoudre l'unité sélectionnée (ou par défaut) pour un produit
  const getResolvedUnit = (product: any): SelectedUnit => {
    const manual = selectedUnits[product.idProduit];
    if (manual) return manual;
    // Par défaut: le conditionnement marqué par défaut, sinon pièce
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
      libelle: product.unite_base || 'pièce',
      quantite_par_unite_base: 1,
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
          libelle: product.unite_base || 'pièce',
          quantite_par_unite_base: 1,
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
    const matchesSearch = searchTerm === '' ||
      product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code_produit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.categorie?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && stockDisponible;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalHT = cart.reduce((sum, item) => sum + item.total, 0);
  const tva = totalHT * 0.18;
  const totalTTC = totalHT + tva;

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

    // Vérifier qu'on a au moins 1 unité en stock (en pièces)
    const piecesNecessaires = 1 * unit.quantite_par_unite_base;
    if (piecesNecessaires > stock) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${stock} pièce(s), il en faut ${piecesNecessaires} pour 1 ${unit.libelle}`,
        color: 'red',
      });
      return;
    }

    // Chercher si déjà dans le panier AVEC LA MÊME unité
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

  const updateQuantity = (index: number, newQuantite: number) => {
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
    newCart[index] = { ...newCart[index], quantite: newQuantite, total: newQuantite * item.prix_vente };
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

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
        prix_unitaire_ttc: item.prix_vente * 1.18,
        tva_taux: 18,
        remise_percent: 0
      }));

      const createdSaleId = await createSale(sale, details);

      const results = [];
      for (const item of cart) {
        const quantiteEnPieces = item.quantite * item.quantite_par_unite_base;
        const result = await stockService.sortieStock({
          idProduit: item.idProduit,
          quantite: quantiteEnPieces, // toujours en pièces
          prix_vente: item.prix_vente / item.quantite_par_unite_base, // prix unitaire pièce
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
          clientNom: sale.nom_prenom
        });
      } catch (journalError) {
        console.error('Erreur journal de caisse:', journalError);
      }

      notifications.show({
        title: 'Vente enregistrée',
        message: `${cart.length} article(s) — Total: ${totalTTC.toLocaleString()} F — Bénéfice: ${beneficeTotal.toLocaleString()} F`,
        color: 'green',
        autoClose: 5000
      });

      await refreshProducts();
      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de la vente:', error);
      notifications.show({
        title: 'Erreur',
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
        {/* En-tête */}
        <Box mb="md" p="md" style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #122040 60%, #1b365d 100%)',
          borderRadius: 12,
        }}>
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
          <Card withBorder p="sm" radius="md">
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
          <Card withBorder p="sm" radius="md">
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

          {/* Produits */}
          <Card withBorder p="sm" radius="md">
            <Title order={5} mb="sm">Produits disponibles en stock</Title>
            <Group mb="sm" gap="xs">
              <TextInput
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{ flex: 1 }}
                leftSection={<IconSearch size={14} />}
                size="sm"
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
                            <Badge variant="light" size="xs" color="grape">
                              {product.categorie || 'Non catégorisé'}
                            </Badge>
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
                            <Badge
                              color={product.qte_stock <= 0 ? 'red' : product.qte_stock <= (product.seuil_alerte || 0) ? 'orange' : 'green'}
                              variant="light"
                              size="xs"
                            >
                              {product.qte_stock} {product.unite_base || 'pièce'}(s)
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Button
                              size="xs"
                              leftSection={<IconPlus size={12} />}
                              onClick={() => addToCart(product)}
                              disabled={product.qte_stock <= 0}
                            >
                              Ajouter
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Group justify="center" mt="sm">
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  ← Précédent
                </Button>
                <Text size="xs" c="dimmed">
                  Page {currentPage} / {totalPages}
                </Text>
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Suivant →
                </Button>
              </Group>
            )}
          </Card>

          {/* Panier */}
          {cart.length > 0 && (
            <Card withBorder p="sm" radius="md">
              <Title order={5} mb="sm">Panier ({cart.length} article(s))</Title>
              <ScrollArea h={200}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th>Unité</Table.Th>
                      <Table.Th>Qté</Table.Th>
                      <Table.Th>Prix unit.</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cart.map((item, index) => (
                      <Table.Tr key={`${item.idProduit}-${String(item.idConditionnement)}`}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{item.designation}</Text>
                          <Text size="xs" c="dimmed">{item.code_produit}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="xs">
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
                            style={{ width: 80 }}
                          />
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm">{formatMontant(item.prix_vente)} F</Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" fw={600} c="blue">{formatMontant(item.total)} F</Text>
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" variant="subtle" size="sm" onClick={() => removeFromCart(index)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          )}

          {/* Totaux + Soumettre */}
          {cart.length > 0 && (
            <Card withBorder p="sm" radius="md">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total HT</Text>
                <Text size="sm">{formatMontant(totalHT)} F</Text>
              </Group>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">TVA (18%)</Text>
                <Text size="sm">{formatMontant(tva)} F</Text>
              </Group>
              <Divider mb="xs" />
              <Group justify="space-between" mb="md">
                <Text fw={700} size="lg">Total TTC</Text>
                <Text fw={700} size="lg" c="blue">{formatMontant(totalTTC)} F</Text>
              </Group>
              <Group justify="flex-end">
                <Button variant="outline" onClick={onCancel}>
                  Annuler
                </Button>
                <Button
                  leftSection={<IconShoppingCart size={16} />}
                  onClick={handleSubmit}
                  loading={submitting || loading}
                  disabled={cart.length === 0}
                >
                  Enregistrer la vente
                </Button>
              </Group>
            </Card>
          )}
        </Stack>
      </Box>

      {/* Modal nouveau client */}
      {clientModalOpened && (
        <FormulaireClient
          opened={clientModalOpened}
          onClose={() => setClientModalOpened(false)}
          onSuccess={() => {
            setClientModalOpened(false);
            refreshClients();
          }}
        />
      )}
    </>
  );
};

export default FormulaireVente;
