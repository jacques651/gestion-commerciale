// src/components/decomptes/NouveauDecompte.tsx
import React, { useState, useEffect } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Select, Table, NumberInput,
  LoadingOverlay, Box, Divider, Alert, Badge, ScrollArea, ActionIcon,
  TextInput, Paper, Flex, ThemeIcon, SimpleGrid
} from "@mantine/core";
import {
  IconArrowLeft, IconDeviceFloppy, IconTrash, IconUser, IconPhone,
  IconBuildingStore, IconPackage, IconSearch, IconRefresh,
  IconCash, IconFileText
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { notifications } from "@mantine/notifications";
import { stockRevendeurRepository } from "../../database/repositories/stockRevendeurRepository";
import {
  decompteRepository
} from "../../database/repositories/decompteRepository";

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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [produits, setProduits] = useState<ProduitRevendeur[]>([]);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [loading, setLoading] = useState(true);
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
          SELECT 
            idClient, 
            NomComplet, 
            Societe, 
            Tel, 
            TypeClient
          FROM clients 
          WHERE TypeClient = 'revendeur'
          ORDER BY NomComplet
        `);
        setClients(result);
      } catch (error) {
        console.error('Erreur chargement clients:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  // Charger les produits disponibles
  const loadStockRevendeur =
    async (
      idRevendeur: number
    ) => {

      try {

        const result =
          await stockRevendeurRepository
            .getByRevendeur(
              idRevendeur
            );

        setProduits(result);

        setPanier([]);

        setQuantiteInput({});

      } catch (error) {

        console.error(error);

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
    const total =
      quantite *
      produit.prix_vente_gros;

    const benefice =
      (
        produit.prix_vente_gros
        -
        produit.prix_achat_base
      )
      *
      quantite;

    const commission =
      benefice *
      (
        produit.commission_pourcentage
        / 100
      );

    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.qte_stock) {
        setError(`Quantité totale dépasse le stock disponible`);
        return;
      }
      const updated = [...panier];
      const benefice =
        (
          produit.prix_vente_gros -
          produit.prix_achat_base
        )
        *
        newQuantite;

      updated[existingIndex] = {

        ...updated[existingIndex],

        quantite: newQuantite,

        total:
          newQuantite *
          produit.prix_vente_gros,

        commission:
          benefice *
          (
            produit.commission_pourcentage
            / 100
          )
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

  const totalVente =
    panier.reduce(
      (s, i) =>
        s + i.total,
      0
    );

  const totalCommission =
    panier.reduce(
      (s, i) =>
        s + i.commission,
      0
    );

  const netAPayer =
    totalVente -
    totalCommission;

  const handleSubmit =
    async () => {

      if (!selectedClient) {

        notifications.show({

          title: "Erreur",

          message:
            "Sélectionnez un revendeur",

          color: "red"

        });

        return;
      }

      if (panier.length === 0) {

        notifications.show({

          title: "Erreur",

          message:
            "Ajoutez au moins un produit",

          color: "red"

        });

        return;
      }

      try {

        setSaving(true);

        const idDecompte =
          await decompteRepository
            .create(
              {
                idClient:
                  selectedClient.idClient,

                observation:
                  objet
              },
              panier.map(
                item => ({
                  idProduit:
                    item.idProduit,

                  qte_decompte:
                    item.quantite
                })
              )
            );

        notifications.show({

          title: "Succès",

          message:
            `Décompte créé (#${idDecompte})`,

          color: "green"

        });

        onSuccess();

      } catch (error: any) {

        notifications.show({

          title: "Erreur",

          message:
            error.message,

          color: "red"

        });

      } finally {

        setSaving(false);

      }

    };
  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" ta="center">
        <LoadingOverlay visible={true} />
        <Text>Chargement...</Text>
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
    <Box p="md">
      <Stack gap="lg">
        {/* En-tête */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b5e1f 0%, #2e7d32 100%)',
          }}
        >
          <Flex justify="space-between" align="center">
            <Group gap="md">
              <ThemeIcon size={50} radius="md" color="white" variant="light">
                <IconFileText size={30} />
              </ThemeIcon>
              <div>
                <Title order={1} c="white" style={{ fontSize: '1.5rem' }}>Nouveau décompte</Title>
                <Text c="gray.3" size="sm">Créez un décompte pour un revendeur</Text>
              </div>
            </Group>
            <Button variant="light" color="white" leftSection={<IconArrowLeft size={16} />} onClick={onCancel}>
              Retour
            </Button>
          </Flex>
        </Paper>

        {/* Partie client */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="green" variant="light" size="sm">
              <IconUser size={14} />
            </ThemeIcon>
            <Title order={4}>Informations client</Title>
          </Group>
          <Divider mb="md" />

          <Select
            label="Client revendeur"
            placeholder="Sélectionner un client"
            data={clientData}
            onChange={async (val) => {

              const client =
                clients.find(
                  c =>
                    c.idClient.toString() === val
                );

              setSelectedClient(
                client || null
              );

              if (!client) {

                setProduits([]);
                setPanier([]);
                return;
              }

              if (
                client.TypeClient !==
                "revendeur"
              ) {

                notifications.show({
                  title: "Erreur",
                  message:
                    "Le client doit être un revendeur",
                  color: "red"
                });

                setProduits([]);
                setPanier([]);

                return;
              }

              await loadStockRevendeur(
                client.idClient
              );

            }}
            leftSection={<IconUser size={16} />}
            required
            searchable
            size="md"
            mb="md"
          />

          {selectedClient && (
            <SimpleGrid cols={2} spacing="md">
              <Group gap="xs">
                <IconPhone size={14} color="#2e7d32" />
                <Text size="sm">{selectedClient.Tel || "Pas de téléphone"}</Text>
              </Group>
              <Group gap="xs">
                <IconBuildingStore size={14} color="#2e7d32" />
                <Text size="sm" tt="capitalize">{selectedClient.TypeClient === 'revendeur' ? 'Revendeur' : 'Client'}</Text>
              </Group>
            </SimpleGrid>
          )}
        </Card>

        {/* Produits disponibles */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <ThemeIcon color="blue" variant="light" size="sm">
                <IconPackage size={14} />
              </ThemeIcon>
              <Title order={4}>Produits disponibles</Title>
            </Group>
            <Group>
              <TextInput
                placeholder="Rechercher..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                size="sm"
                style={{ width: 250 }}
              />
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => {
                  if (selectedClient) {
                    loadStockRevendeur(
                      selectedClient.idClient
                    );
                  }
                }}
                size="sm"
              >
                Actualiser
              </Button>
            </Group>
          </Group>
          <Divider mb="md" />

          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th ta="right">Prix vente</Table.Th>
                  <Table.Th ta="center">Stock</Table.Th>
                  <Table.Th ta="center">Qté</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {produitsFiltres.map((p) => (
                  <Table.Tr key={p.idProduit}>
                    <Table.Td fw={500}>{p.designation}</Table.Td>
                    <Table.Td ta="right">{p.prix_vente_gros.toLocaleString()} FCFA</Table.Td>
                    <Table.Td ta="center">
                      <Badge color={p.qte_stock <= 5 ? "orange" : "green"} variant="light">
                        {p.qte_stock}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center" style={{ width: 100 }}>
                      <NumberInput
                        size="xs"
                        min={0}
                        max={p.qte_stock}
                        value={quantiteInput[p.idProduit] || 0}
                        onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) || 0 })}
                        style={{ width: 80 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        color="green"
                        onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)}
                      >
                        Ajouter
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {produitsFiltres.length === 0 && (
            <Text ta="center" c="dimmed" py={40}>Aucun produit disponible</Text>
          )}
        </Card>

        {/* Panier */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md">
            <ThemeIcon color="orange" variant="light" size="sm">
              <IconCash size={14} />
            </ThemeIcon>
            <Title order={4}>Panier</Title>
          </Group>
          <Divider mb="md" />

          {panier.length === 0 ? (
            <Text ta="center" c="dimmed" py={40}>Aucun produit sélectionné</Text>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Produit</Table.Th>
                    <Table.Th ta="center">Qté</Table.Th>
                    <Table.Th ta="right">Prix unitaire</Table.Th>
                    <Table.Th ta="right">Commission</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {panier.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={500}>{item.designation}</Table.Td>
                      <Table.Td ta="center">{item.quantite}</Table.Td>
                      <Table.Td ta="right">{item.prix_vente.toLocaleString()} FCFA</Table.Td>
                      <Table.Td ta="right">{item.commission.toLocaleString()} FCFA</Table.Td>
                      <Table.Td ta="right" fw={600}>{item.total.toLocaleString()} FCFA</Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" onClick={() => retirerDuPanier(idx)} variant="light">
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Divider my="md" />

              <Flex justify="flex-end">
                <Stack gap={4} align="flex-end">
                  <Group>
                    <Text size="sm">
                      Total ventes :
                    </Text>
                    <Text fw={600}>
                      {totalVente.toLocaleString()} FCFA
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" c="orange">Commission :</Text>
                    <Text fw={600} c="orange">- {totalCommission.toLocaleString()} FCFA</Text>
                  </Group>
                  <Divider />
                  <Group>
                    <Text fw={700} size="lg">Net à payer :</Text>
                    <Text fw={800} size="xl" c="green">{netAPayer.toLocaleString()} FCFA</Text>
                  </Group>
                </Stack>
              </Flex>
            </>
          )}

          <Divider my="md" />

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">

            <TextInput
              label="Objet"
              placeholder="Motif du décompte..."
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              size="md"
            />

          </SimpleGrid>

          <Divider my="md" />

          <Group justify="flex-end">
            <Button variant="outline" color="red" onClick={onCancel} size="md">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              loading={saving}
              leftSection={<IconDeviceFloppy size={16} />}
              variant="gradient"
              gradient={{ from: "green", to: "teal" }}
              size="md"
            >
              Enregistrer le décompte
            </Button>
          </Group>

          {error && <Alert color="red" mt="md">{error}</Alert>}
        </Card>
      </Stack>
    </Box>
  );
};

export default NouveauDecompte;