// src/components/decomptes/NouveauDecompte.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack, Card, Title, Text, Group, Button, Select, Table, NumberInput,
  LoadingOverlay, Box, Divider, Alert, Badge, ScrollArea, ActionIcon,
  TextInput, Flex, ThemeIcon, SimpleGrid, Center, Loader
} from "@mantine/core";
import {
  IconArrowLeft, IconTrash, IconPhone,
  IconPackage, IconSearch, IconRefresh,
  IconFileText, IconShoppingCart, 
  IconTruck,
  IconAlertCircle
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { notifications } from "@mantine/notifications";
import { stockRevendeurRepository } from "../../database/repositories/stockRevendeurRepository";

interface Client {
  idClient: number;
  NomComplet: string;
  Societe: string | null;
  Tel: string | null;
  TypeClient: string;
}

interface ProduitRevendeur {
  idProduit: number;
  designation: string;
  qte_stock: number;
  prix_achat_base: number;
  prix_vente_gros: number;
  commission_pourcentage: number;
}

interface PanierItem {
  idProduit: number;
  designation: string;
  quantite: number;
  prix_vente: number;
  prix_achat: number;
  commission: number;
  total: number;
}

interface NouveauDecompteProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const NouveauDecompte: React.FC<NouveauDecompteProps> = ({ onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [produits, setProduits] = useState<ProduitRevendeur[]>([]);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProduits, setLoadingProduits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});
  const [objet, setObjet] = useState("");

  // Charger les clients revendeurs
  useEffect(() => {
    const loadClients = async () => {
      try {
        const db = await getDb();
        const result = await db.select<Client[]>(`
          SELECT idClient, NomComplet, Societe, Tel, TypeClient
          FROM clients 
          WHERE TypeClient = 'revendeur'
          ORDER BY NomComplet
        `);
        setClients(result);
      } catch (error) {
        console.error('Erreur chargement clients:', error);
        notifications.show({ title: 'Erreur', message: 'Impossible de charger les clients', color: 'red' });
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  // Charger les produits disponibles pour un revendeur
  const loadStockRevendeur = async (idRevendeur: number) => {
    setLoadingProduits(true);
    try {
      const result = await stockRevendeurRepository.getByRevendeur(idRevendeur);
      setProduits(result);
      setPanier([]);
      setQuantiteInput({});
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les produits', color: 'red' });
    } finally {
      setLoadingProduits(false);
    }
  };

  const ajouterAuPanier = (produit: ProduitRevendeur, quantite: number) => {
    if (quantite <= 0) {
      setError("Veuillez saisir une quantité valide");
      return;
    }
    if (quantite > produit.qte_stock) {
      setError(`Stock insuffisant. Maximum: ${produit.qte_stock}`);
      return;
    }

    const existingIndex = panier.findIndex(p => p.idProduit === produit.idProduit);
    const total = quantite * produit.prix_vente_gros;
    const benefice = (produit.prix_vente_gros - produit.prix_achat_base) * quantite;
    const commission = benefice * (produit.commission_pourcentage / 100);

    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.qte_stock) {
        setError(`Quantité totale dépasse le stock disponible`);
        return;
      }
      const updated = [...panier];
      const newBenefice = (produit.prix_vente_gros - produit.prix_achat_base) * newQuantite;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantite: newQuantite,
        total: newQuantite * produit.prix_vente_gros,
        commission: newBenefice * (produit.commission_pourcentage / 100)
      };
      setPanier(updated);
    } else {
      setPanier([...panier, {
        idProduit: produit.idProduit,
        designation: produit.designation,
        quantite: quantite,
        prix_vente: produit.prix_vente_gros,
        prix_achat: produit.prix_achat_base || 0,
        commission: commission,
        total: total,
      }]);
    }
    setError("");
    setQuantiteInput({ ...quantiteInput, [produit.idProduit]: 0 });
  };

  const retirerDuPanier = (index: number) => {
    const updated = [...panier];
    updated.splice(index, 1);
    setPanier(updated);
  };

  const totalVente = panier.reduce((s, i) => s + i.total, 0);
  const totalCommission = panier.reduce((s, i) => s + i.commission, 0);
  const netAPayer = totalVente - totalCommission;

  const handleSubmit = async () => {
    if (!selectedClient) {
      notifications.show({ title: "Erreur", message: "Sélectionnez un revendeur", color: "red" });
      return;
    }
    if (panier.length === 0) {
      notifications.show({ title: "Erreur", message: "Ajoutez au moins un produit", color: "red" });
      return;
    }

    setSaving(true);
    const db = await getDb();
    
    try {
      // Démarrer une transaction
      await db.execute("BEGIN TRANSACTION");

      // 1. Créer le décompte
      const codeDecompte = `DC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const dateDecompte = new Date().toISOString().split('T')[0];
      
      const insertResult = await db.execute(`
        INSERT INTO decomptes (idClient, code_decompte, date_decompte, montant_vente, montant_commission, montant_net, statut, observation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        selectedClient.idClient,
        codeDecompte,
        dateDecompte,
        totalVente,
        totalCommission,
        netAPayer,
        'EN_ATTENTE',
        objet || null
      ]);

      const idDecompte = Number(insertResult.lastInsertId);

      // 2. Insérer les détails du décompte
      for (const item of panier) {
        await db.execute(`
          INSERT INTO decompte_details (idDecompte, idProduit, qte_decompte, prix_achat, prix_vente, commission_pourcentage)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          idDecompte,
          item.idProduit,
          item.quantite,
          item.prix_achat,
          item.prix_vente,
          (item.commission / ((item.prix_vente - item.prix_achat) * item.quantite)) * 100 || 0
        ]);

        // 3. Mettre à jour le stock revendeur
        await db.execute(`
          UPDATE stock_revendeur 
          SET qte_stock = qte_stock - ? 
          WHERE idProduit = ? AND idRevendeur = ?
        `, [item.quantite, item.idProduit, selectedClient.idClient]);
      }

      // Valider la transaction
      await db.execute("COMMIT");

      notifications.show({
        title: "✅ Succès",
        message: `Décompte ${codeDecompte} créé avec succès`,
        color: "green"
      });

      onSuccess();
      navigate(`/decomptes/${idDecompte}/print`);

    } catch (error: any) {
      // Annuler la transaction en cas d'erreur
      await db.execute("ROLLBACK");
      console.error("Erreur création décompte:", error);
      notifications.show({
        title: "❌ Erreur",
        message: error.message || "Erreur lors de la création du décompte",
        color: "red"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text mt="md">Chargement des clients...</Text>
      </Card>
    );
  }

  const clientData = clients.map(c => ({
    value: c.idClient.toString(),
    label: c.NomComplet || c.Societe || 'Client sans nom'
  }));

  const produitsFiltres = produits.filter(p =>
    p.designation.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <Box p="sm">
      <Stack gap="sm">
        {/* En-tête compact */}
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={35} radius="md" color="blue" variant="light">
              <IconFileText size={20} />
            </ThemeIcon>
            <div>
              <Title order={3} c="#1b365d" style={{ fontSize: '1.1rem' }}>Nouveau décompte</Title>
              <Text size="xs" c="dimmed">Créez un décompte pour un revendeur</Text>
            </div>
          </Group>
          <Button variant="subtle" color="gray" size="sm" leftSection={<IconArrowLeft size={14} />} onClick={onCancel}>
            Retour
          </Button>
        </Group>

        {/* Client */}
        <Card withBorder radius="md" shadow="sm" p="sm">
          <Select
            label="Client revendeur"
            placeholder="Sélectionner un client"
            data={clientData}
            onChange={async (val) => {
              const client = clients.find(c => c.idClient.toString() === val);
              setSelectedClient(client || null);
              if (client) {
                await loadStockRevendeur(client.idClient);
              } else {
                setProduits([]);
                setPanier([]);
              }
            }}
            searchable
            size="sm"
          />

          {selectedClient && (
            <SimpleGrid cols={2} spacing="xs" mt="xs">
              <Group gap="xs">
                <IconPhone size={12} color="#1b365d" />
                <Text size="xs">{selectedClient.Tel || "Pas de téléphone"}</Text>
              </Group>
              <Group gap="xs">
                <IconTruck size={12} color="#1b365d" />
                <Text size="xs" tt="capitalize">Revendeur</Text>
              </Group>
            </SimpleGrid>
          )}
        </Card>

        {/* Produits disponibles */}
        <Card withBorder radius="md" shadow="sm" p="sm">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconPackage size={14} />
              <Text fw={600} size="sm">Produits disponibles</Text>
            </Group>
            <Group gap="xs">
              <TextInput
                placeholder="Rechercher..."
                size="xs"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                style={{ width: 180 }}
                leftSection={<IconSearch size={12} />}
              />
              <ActionIcon
                size="sm"
                variant="light"
                onClick={() => selectedClient && loadStockRevendeur(selectedClient.idClient)}
              >
                <IconRefresh size={14} />
              </ActionIcon>
            </Group>
          </Group>

          {loadingProduits ? (
            <Center py={30}>
              <Loader size="sm" />
              <Text size="xs" ml="sm">Chargement...</Text>
            </Center>
          ) : produitsFiltres.length === 0 ? (
            <Text ta="center" c="dimmed" py={30} size="sm">
              {selectedClient ? "Aucun produit disponible" : "Sélectionnez d'abord un client"}
            </Text>
          ) : (
            <ScrollArea h={200}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: "#1b365d" }}>
                    <Table.Th style={{ fontSize: '11px' }}>Produit</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }} ta="right">Prix</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }} ta="center">Stock</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }} ta="center">Qté</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }} ta="center"></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {produitsFiltres.slice(0, 8).map((p) => (
                    <Table.Tr key={p.idProduit}>
                      <Table.Td>
                        <Text size="xs" fw={500} lineClamp={1}>{p.designation}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" fw={600} c="blue">{p.prix_vente_gros.toLocaleString()} F</Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge size="xs" color={p.qte_stock <= 0 ? "red" : p.qte_stock <= 5 ? "orange" : "green"} variant="light">
                          {p.qte_stock}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center" style={{ width: 70 }}>
                        <NumberInput
                          size="xs"
                          min={0}
                          max={p.qte_stock}
                          value={quantiteInput[p.idProduit] || 0}
                          onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) || 0 })}
                          w={60}
                          hideControls={false}
                        />
                      </Table.Td>
                      <Table.Td ta="center">
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)}
                          disabled={!quantiteInput[p.idProduit] || quantiteInput[p.idProduit] <= 0}
                        >
                          Ajouter
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        {/* Panier */}
        {panier.length > 0 && (
          <Card withBorder radius="md" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
            <Group gap="xs" mb="xs">
              <IconShoppingCart size={14} />
              <Text fw={600} size="sm">Panier ({panier.length})</Text>
            </Group>
            <ScrollArea h={120}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontSize: '10px' }}>Produit</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="center">Qté</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="right">Total</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="center"></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {panier.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td><Text size="xs" lineClamp={1}>{item.designation}</Text></Table.Td>
                      <Table.Td ta="center"><Badge size="xs" color="blue">{item.quantite}</Badge></Table.Td>
                      <Table.Td ta="right"><Text size="xs" fw={600}>{item.total.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="center">
                        <ActionIcon color="red" size="xs" onClick={() => retirerDuPanier(idx)}>
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            <Divider my="xs" />
            <Flex justify="flex-end">
              <Stack gap={2} align="flex-end">
                <Group gap="md">
                  <Text size="xs">Total ventes :</Text>
                  <Text size="xs" fw={600}>{totalVente.toLocaleString()} F</Text>
                </Group>
                <Group gap="md">
                  <Text size="xs" c="orange">Commission :</Text>
                  <Text size="xs" c="orange">- {totalCommission.toLocaleString()} F</Text>
                </Group>
                <Group gap="md">
                  <Text fw={600} size="sm">Net à payer :</Text>
                  <Text fw={700} size="md" c="green">{netAPayer.toLocaleString()} F</Text>
                </Group>
              </Stack>
            </Flex>
          </Card>
        )}

        {/* Objet */}
        <TextInput
          label="Objet"
          placeholder="Motif du décompte (optionnel)"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          size="sm"
        />

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button variant="outline" color="gray" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            loading={saving}
            size="sm"
            color="green"
            disabled={!selectedClient || panier.length === 0}
          >
            Enregistrer
          </Button>
        </Group>

        {error && (
          <Alert color="red" variant="light" p="xs" icon={<IconAlertCircle size={12} />}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};

export default NouveauDecompte;