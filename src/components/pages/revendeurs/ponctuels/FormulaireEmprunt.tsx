// src/components/pages/revendeurs/ponctuels/FormulaireEmprunt.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, TextInput, Button, Group, Table, ScrollArea,
  NumberInput, Select, Card, Text, Badge, ActionIcon,
  Alert, LoadingOverlay, Divider, SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconPlus, IconSearch, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import { productRepository } from '../../../../database/repositories/productRepository';
import { temporaryResellerRepository } from '../../../../database/repositories/temporaryResellerRepository';

interface FormulaireEmpruntProps {
  revendeur: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface EmpruntItem {
  idProduit: number;
  designation: string;
  code_produit: string;
  quantite: number;
  prix_vente_unitaire: number;
  prix_achat_base: number;
  stock_disponible: number;
}

export const FormulaireEmprunt: React.FC<FormulaireEmpruntProps> = ({
  revendeur,
  onSuccess,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [produits, setProduits] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<EmpruntItem[]>([]);
  const [dateRetour, setDateRetour] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  useEffect(() => {
    loadProduits();
  }, []);

  const loadProduits = async () => {
    try {
      const allProducts = await productRepository.getAll();
      // Filtrer les produits en stock
      const stockProducts = allProducts.filter((p: any) => (p.qte_stock || 0) > 0);
      setProduits(stockProducts);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les produits',
        color: 'red'
      });
    }
  };

  const handleAddProduct = () => {
    if (!selectedProduct) {
      notifications.show({
        title: 'Information',
        message: 'Veuillez sélectionner un produit',
        color: 'blue'
      });
      return;
    }

    const existing = items.find(i => i.idProduit === selectedProduct.idProduit);
    if (existing) {
      notifications.show({
        title: 'Information',
        message: 'Ce produit est déjà dans la liste',
        color: 'blue'
      });
      return;
    }

    const newItem: EmpruntItem = {
      idProduit: selectedProduct.idProduit,
      designation: selectedProduct.designation,
      code_produit: selectedProduct.code_produit,
      quantite: 1,
      prix_vente_unitaire: selectedProduct.prix_vente_detail || 0,
      prix_achat_base: selectedProduct.prix_achat_base || 0,
      stock_disponible: selectedProduct.qte_stock || 0
    };

    setItems([...items, newItem]);
    setSelectedProduct(null);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateQuantite = (index: number, value: number | string) => {
    const numValue = typeof value === 'string' ? parseInt(value) : value;
    if (isNaN(numValue) || numValue < 1) return;
    
    const newItems = [...items];
    if (numValue > newItems[index].stock_disponible) {
      notifications.show({
        title: 'Stock insuffisant',
        message: `Stock disponible: ${newItems[index].stock_disponible}`,
        color: 'red'
      });
      return;
    }
    newItems[index].quantite = numValue;
    setItems(newItems);
  };

  const updatePrix = (index: number, value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue < 0) return;
    
    const newItems = [...items];
    newItems[index].prix_vente_unitaire = numValue;
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Ajoutez au moins un produit',
        color: 'red'
      });
      return;
    }

    // Vérifier les stocks
    for (const item of items) {
      if (item.quantite > item.stock_disponible) {
        notifications.show({
          title: 'Stock insuffisant',
          message: `${item.designation}: ${item.quantite} demandé, ${item.stock_disponible} disponible`,
          color: 'red'
        });
        return;
      }
    }

    setLoading(true);
    try {
      const details = items.map(item => ({
        idProduit: item.idProduit,
        quantite_empruntee: item.quantite,
        quantite_retournee: 0,
        quantite_vendue: 0,
        prix_vente_unitaire: item.prix_vente_unitaire,
        prix_achat_base: item.prix_achat_base
      }));

      await temporaryResellerRepository.createBorrow({
        idRevendeurPonctuel: revendeur.idRevendeurPonctuel,
        date_retour_prevue: dateRetour || undefined,
        notes: notes,
        idUtilisateur: 1 // À remplacer par l'utilisateur connecté
      }, details);

      notifications.show({
        title: '✅ Succès',
        message: `Emprunt créé avec ${items.length} article(s)`,
        color: 'green'
      });

      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de la création de l\'emprunt',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = produits.filter((p: any) =>
    p.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code_produit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMontant = items.reduce((sum, item) => sum + (item.quantite * item.prix_vente_unitaire), 0);

  return (
    <Stack gap="md">
      <LoadingOverlay visible={loading} />

      <Card withBorder p="sm" bg="gray.0">
        <SimpleGrid cols={2}>
          <div>
            <Text size="xs" c="dimmed">Revendeur</Text>
            <Text fw={600} size="sm">{revendeur.nom_complet}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Téléphone</Text>
            <Text size="sm">{revendeur.telephone}</Text>
          </div>
        </SimpleGrid>
      </Card>

      <Divider label="Produits à emprunter" labelPosition="center" />

      {/* Sélection des produits */}
      <Card withBorder p="sm">
        <Group grow align="flex-end">
          <Select
            label="Produit"
            placeholder="Rechercher un produit..."
            data={filteredProducts.map((p: any) => ({
              value: p.idProduit.toString(),
              label: `${p.designation} (${p.code_produit}) - Stock: ${p.qte_stock}`
            }))}
            value={selectedProduct?.idProduit?.toString() || null}
            onChange={(val) => {
              const product = produits.find((p: any) => p.idProduit.toString() === val);
              setSelectedProduct(product || null);
            }}
            searchable
            clearable
            size="sm"
            nothingFoundMessage="Aucun produit trouvé"
          />
          <Button
            onClick={handleAddProduct}
            disabled={!selectedProduct}
            leftSection={<IconPlus size={14} />}
            size="sm"
          >
            Ajouter
          </Button>
        </Group>
      </Card>

      {/* Liste des produits */}
      {items.length > 0 ? (
        <Card withBorder p={0}>
          <ScrollArea h={250}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produit</Table.Th>
                  <Table.Th style={{ width: 80 }}>Qté</Table.Th>
                  <Table.Th style={{ width: 120 }}>Prix unit.</Table.Th>
                  <Table.Th style={{ width: 120 }}>Total</Table.Th>
                  <Table.Th style={{ width: 50 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{item.designation}</Text>
                      <Text size="xs" c="dimmed">{item.code_produit}</Text>
                      <Text size="xs" c="dimmed">Stock: {item.stock_disponible}</Text>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={item.quantite}
                        onChange={(val) => updateQuantite(index, val ?? 1)}
                        min={1}
                        max={item.stock_disponible}
                        size="xs"
                        style={{ width: 70 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={item.prix_vente_unitaire}
                        onChange={(val) => updatePrix(index, val ?? 0)}
                        min={0}
                        step={100}
                        size="xs"
                        style={{ width: 100 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600}>{(item.quantite * item.prix_vente_unitaire).toLocaleString()} F</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" onClick={() => removeItem(index)} size="sm" variant="subtle">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      ) : (
        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
          Aucun produit ajouté. Sélectionnez un produit ci-dessus.
        </Alert>
      )}

      {items.length > 0 && (
        <Card withBorder p="sm" bg="blue.0">
          <Group justify="space-between">
            <Text fw={600}>Total emprunt</Text>
            <Text fw={700} size="lg" c="blue">
              {totalMontant.toLocaleString()} FCFA
            </Text>
          </Group>
        </Card>
      )}

      <Divider />

      <SimpleGrid cols={2}>
        <TextInput
          label="Date de retour prévue"
          type="date"
          value={dateRetour}
          onChange={(e) => setDateRetour(e.target.value)}
          size="sm"
        />
        <TextInput
          label="Notes"
          placeholder="Observations sur l'emprunt"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="sm"
        />
      </SimpleGrid>

      <Divider />

      <Group justify="flex-end">
        <Button variant="light" onClick={onCancel} size="sm">
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          loading={loading}
          disabled={items.length === 0}
          size="sm"
          color="blue"
        >
          Confirmer l'emprunt
        </Button>
      </Group>
    </Stack>
  );
};

export default FormulaireEmprunt;