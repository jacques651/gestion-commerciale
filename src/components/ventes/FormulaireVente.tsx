// src/components/ventes/FormulaireVente.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, TextInput, Select, Button, Group, Stack,
  NumberInput, Table, ActionIcon, Text, Card,
  Divider, Title, LoadingOverlay, ScrollArea, Badge, Tooltip,
  Checkbox
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconPlus, IconShoppingCart, IconSearch, IconRefresh, IconUserPlus } from '@tabler/icons-react';
import { useClients } from '../../hooks/useClients';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { getNextVenteCode } from '../../services/codeGeneratorService';
import { FormulaireClient } from '../clients/FormulaireClient';

interface FormulaireVenteProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface CartItem {
  idProduit: number;
  designation: string;
  code_produit: string;
  quantite_stock: number;
  prix_vente: number;
  quantite: number;
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
  const [currentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [codeVente, setCodeVente] = useState<string>('');
  const [clientModalOpened, setClientModalOpened] = useState(false);

  const itemsPerPage = 5;

  useEffect(() => {
    const generateCode = async () => {
      const code = await getNextVenteCode();
      setCodeVente(code);
    };
    generateCode();
  }, []);

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

  // Filtrer les produits
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code_produit?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calcul des totaux
  const totalHT = cart.reduce((sum, item) => sum + item.total, 0);
  const tva = totalHT * 0.18;
  const totalTTC = totalHT + tva;

  // Ajouter un produit au panier
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
      const newQuantite = existingItem.quantite + qte;
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
            quantite: newQuantite,
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
          designation: product.designation,
          code_produit: product.code_produit,
          quantite_stock: stock,
          prix_vente: prix,
          quantite: qte,
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
    newCart[index].quantite = newQuantite;
    newCart[index].total = newQuantite * item.prix_vente;
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
      prix_unitaire_ht: item.prix_vente,
      prix_unitaire_ttc: item.prix_vente * 1.18,
      tva_taux: 18,
      remise_percent: 0
    }));

    // Appel à createSale (sans la mise à jour manuelle du stock car le repository s'en occupe)
    await createSale(sale, details);

    notifications.show({
      title: 'Succès',
      message: `Vente ${codeVente} enregistrée`,
      color: 'green',
    });

    onSuccess();

  } catch (error) {
    console.error(error);
    notifications.show({
      title: 'Erreur',
      message: 'Erreur lors de l\'enregistrement',
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
    return num.toLocaleString();
  };

  const clientData = clients.map(c => ({
    value: c.idClient.toString(),
    label: (c as any).NomComplet || (c as any).Societe || 'Client sans nom'
  }));

  return (
    <>
      <Modal
        opened={true}
        onClose={onCancel}
        title="Nouvelle vente au comptoir"
        size="900px"
        padding="md"
      >
        <ScrollArea h="calc(100vh - 200px)" type="auto">
          <Stack gap="md" pr="sm">
            {/* Code vente */}
            <Card withBorder p="sm" radius="md">
              <Group grow>
                <TextInput
                  label="Code vente"
                  value={codeVente}
                  readOnly
                  disabled
                  size="sm"
                  styles={{ input: { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } }}
                />
              </Group>
            </Card>

            {/* Client - Optionnel */}
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
              <Title order={5} mb="sm">Produits</Title>

              <Group mb="sm" gap="xs">
                <TextInput
                  placeholder="Rechercher un produit"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ flex: 1 }}
                  leftSection={<IconSearch size={14} />}
                  size="sm"
                />
                <Tooltip label="Actualiser">
                  <ActionIcon onClick={refreshProducts} size="sm" variant="outline">
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <ScrollArea h={250}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th>Prix</Table.Th>
                      <Table.Th>Stock</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedProducts.map((product) => (
                      <Table.Tr key={product.idProduit}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{product.designation}</Text>
                          <Text size="xs" c="dimmed">{product.code_produit}</Text>
                        </Table.Td>
                        <Table.Td>{formatMontant(product.prix_vente_detail)} F</Table.Td>
                        <Table.Td>
                          <Badge color={(product.qte_stock || 0) < 10 ? 'red' : 'green'} variant="light" size="sm">
                            {product.qte_stock || 0}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            leftSection={<IconPlus size={12} />}
                            onClick={() => addToCart(product)}
                            disabled={(product.qte_stock || 0) === 0}
                            variant="light"
                          >
                            Ajouter
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>

            {/* Panier */}
            {cart.length > 0 && (
              <Card withBorder p="sm" radius="md">
                <Title order={5} mb="sm">Panier ({cart.length} article{cart.length > 1 ? 's' : ''})</Title>

                <ScrollArea h={200}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Produit</Table.Th>
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
                            <Text size="sm">{item.designation}</Text>
                          </Table.Td>
                          <Table.Td style={{ width: 100 }}>
                            <NumberInput
                              value={item.quantite}
                              onChange={(val) => updateQuantity(index, Number(val) || 1)}
                              min={1}
                              max={item.quantite_stock}
                              size="xs"
                            />
                          </Table.Td>
                          <Table.Td>{formatMontant(item.prix_vente)} F</Table.Td>
                          <Table.Td>{formatMontant(item.total)} F</Table.Td>
                          <Table.Td>
                            <ActionIcon color="red" onClick={() => removeFromCart(index)} size="sm" variant="subtle">
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="sm" />
                <Group justify="flex-end">
                  <div>
                    <Text size="sm">Total HT: <strong>{formatMontant(totalHT)} F</strong></Text>
                    <Text size="xs" c="dimmed">TVA (18%): {formatMontant(tva)} F</Text>
                    <Text size="lg" fw={700} c="blue">Total TTC: {formatMontant(totalTTC)} F</Text>
                  </div>
                </Group>
              </Card>
            )}

            <Group justify="flex-end">
              <Button variant="outline" onClick={onCancel} size="sm">
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                loading={submitting || loading}
                disabled={cart.length === 0}
                leftSection={<IconShoppingCart size={14} />}
                size="sm"
                color="green"
              >
                Enregistrer la vente
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

export default FormulaireVente;