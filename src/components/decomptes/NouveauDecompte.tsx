// src/components/decomptes/NouveauDecompte.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack, Card, Title, Text, Group, Button, Select, Table, NumberInput,
  Divider, Alert, Badge, ScrollArea, ActionIcon,
  TextInput, Flex, ThemeIcon, SimpleGrid, Center, Loader, Container,
  Paper
} from "@mantine/core";
import {
  IconArrowLeft, IconTrash, IconPhone,
  IconPackage, IconSearch, IconRefresh,
  IconFileText, IconShoppingCart, 
  IconTruck,
  IconAlertCircle,
  IconPercentage
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { notifications } from "@mantine/notifications";
import { stockRevendeurRepository } from "../../database/repositories/stockRevendeurRepository";
import { generateDecompteCode } from "../../services/codeGeneratorService";

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
}

interface PanierItem {
  idProduit: number;
  designation: string;
  quantite: number;
  prix_vente: number;
  prix_achat: number;
  total: number;
}

interface FacturePredefinie {
  idFactureRevendeur: number;
  code_facture: string;
  idRevendeur: number;
  date_facture: string;
  montant_ht: number;
  montant_ttc: number;
  commission: number;
  statut: string;
  client_nom?: string;
  client_societe?: string;
  details?: any[];
}

interface NouveauDecompteProps {
  onSuccess: () => void;
  onCancel: () => void;
  facturePredefinie?: FacturePredefinie;
}

const NouveauDecompte: React.FC<NouveauDecompteProps> = ({ onSuccess, onCancel, facturePredefinie }) => {
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
  const [tauxCommission, setTauxCommission] = useState<number>(60);
  const [initialized, setInitialized] = useState(false);

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

  const loadStockRevendeur = async (idRevendeur: number) => {
    setLoadingProduits(true);
    try {
      const result = await stockRevendeurRepository.getByRevendeur(idRevendeur);
      setProduits(result);
      return result;
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les produits', color: 'red' });
      return [];
    } finally {
      setLoadingProduits(false);
    }
  };

  // Pré-remplir avec la facture sélectionnée
  useEffect(() => {
    const prefillFromFacture = async () => {
      if (facturePredefinie && facturePredefinie.idRevendeur && clients.length > 0 && !initialized) {
        const client = clients.find(c => c.idClient === facturePredefinie.idRevendeur);
        if (client) {
          setSelectedClient(client);
          
          // Charger les produits du revendeur
          const produitsStock = await loadStockRevendeur(client.idClient);
          
          // Maintenant que les produits sont chargés, on peut remplir le panier
          if (facturePredefinie.details && facturePredefinie.details.length > 0 && produitsStock.length > 0) {
            const panierItems: PanierItem[] = [];
            
            for (const detail of facturePredefinie.details) {
              const produitStock = produitsStock.find(p => p.idProduit === detail.idProduit);
              
              if (produitStock && produitStock.qte_stock > 0) {
                panierItems.push({
                  idProduit: detail.idProduit,
                  designation: detail.designation || produitStock.designation,
                  quantite: produitStock.qte_stock,
                  prix_vente: detail.prix_unitaire_vente || produitStock.prix_vente_gros,
                  prix_achat: detail.prix_achat_base || produitStock.prix_achat_base,
                  total: (detail.prix_unitaire_vente || produitStock.prix_vente_gros) * produitStock.qte_stock
                });
              }
            }
            
            if (panierItems.length > 0) {
              setPanier(panierItems);
            }
          }
          
          setObjet(`Décompte pour facture ${facturePredefinie.code_facture}`);
          setInitialized(true);
        }
      }
    };
    
    if (clients.length > 0 && facturePredefinie && !initialized) {
      prefillFromFacture();
    }
  }, [facturePredefinie, clients, initialized]);

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

    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.qte_stock) {
        setError(`Quantité totale dépasse le stock disponible`);
        return;
      }
      const updated = [...panier];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantite: newQuantite,
        total: newQuantite * produit.prix_vente_gros,
      };
      setPanier(updated);
    } else {
      setPanier([...panier, {
        idProduit: produit.idProduit,
        designation: produit.designation,
        quantite: quantite,
        prix_vente: produit.prix_vente_gros,
        prix_achat: produit.prix_achat_base || 0,
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

  const viderPanier = () => {
    setPanier([]);
    setQuantiteInput({});
    notifications.show({ title: "Panier vidé", message: "Tous les produits ont été retirés du panier", color: "blue" });
  };

  const totalAchat = panier.reduce((s, i) => s + (i.prix_achat * i.quantite), 0);
  const totalVente = panier.reduce((s, i) => s + i.total, 0);
  const totalBenefice = totalVente - totalAchat;
  const totalCommission = (totalBenefice * tauxCommission) / 100;
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
    if (tauxCommission < 0 || tauxCommission > 100) {
      notifications.show({ title: "Erreur", message: "Le taux de commission doit être entre 0 et 100%", color: "red" });
      return;
    }

    setSaving(true);
    
    try {
      const db = await getDb();
      
      // 🔥 Générer le code décompte au format DCP-0001
      const codeDecompte = await generateDecompteCode();
      const dateDecompte = new Date().toISOString().split('T')[0];
      
      const insertResult = await db.execute(`
        INSERT INTO decomptes (idClient, code_decompte, date_decompte, montant_vente, montant_commission, montant_net, statut, observation, taux_commission, idFactureRevendeur)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        selectedClient.idClient,
        codeDecompte,
        dateDecompte,
        totalVente,
        totalCommission,
        netAPayer,
        'VALIDE',
        objet || null,
        tauxCommission,
        facturePredefinie?.idFactureRevendeur || null
      ]);

      const idDecompte = Number(insertResult.lastInsertId);
      console.log(`📝 Décompte créé: ${codeDecompte} (ID: ${idDecompte})`);

      for (const item of panier) {
        const beneficeUnitaire = item.prix_vente - item.prix_achat;
        const beneficeLigne = beneficeUnitaire * item.quantite;
        
        await db.execute(`
          INSERT INTO decompte_details (idDecompte, idProduit, qte_decompte, prix_achat, prix_vente, benefice, commission)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          idDecompte,
          item.idProduit,
          item.quantite,
          item.prix_achat,
          item.prix_vente,
          beneficeLigne,
          (beneficeLigne * tauxCommission) / 100
        ]);

        await db.execute(`
          UPDATE stock_revendeur 
          SET qte_stock = qte_stock - ? 
          WHERE idProduit = ? AND idRevendeur = ?
        `, [item.quantite, item.idProduit, selectedClient.idClient]);
        
        console.log(`📦 Stock mis à jour pour ${item.designation}: -${item.quantite}`);
      }

      notifications.show({
        title: "✅ Succès",
        message: `Décompte ${codeDecompte} créé avec succès (Commission: ${tauxCommission}%)`,
        color: "green"
      });

      onSuccess();
      navigate(`/decomptes/${idDecompte}/print`);

    } catch (error: any) {
      console.error("❌ Erreur création décompte:", error);
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
      <Center h={400}>
        <Loader size="xl" />
        <Text ml="md">Chargement des clients...</Text>
      </Center>
    );
  }

  const clientData = clients.map(c => ({
    value: c.idClient.toString(),
    label: c.NomComplet || c.Societe || 'Client sans nom'
  }));

  const produitsFiltres = produits.filter(p =>
    p.designation.toLowerCase().includes(recherche.toLowerCase())
  );

  // Afficher le nom du client sélectionné
  const clientSelectionne = selectedClient ? (
    <Paper p="md" withBorder mt="sm" style={{ backgroundColor: '#eef3f9' }}>
      <Group justify="space-between">
        <Group gap="md">
          <ThemeIcon size="md" radius="xl" color="blue" variant="light">
            <IconTruck size={14} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">{selectedClient.NomComplet}</Text>
            <Text size="xs" c="dimmed">{selectedClient.Societe || 'Revendeur'}</Text>
          </div>
        </Group>
        <Group gap="md">
          <Group gap={4}>
            <IconPhone size={12} color="#1b365d" />
            <Text size="xs">{selectedClient.Tel || 'Pas de téléphone'}</Text>
          </Group>
          <Badge color="green" variant="light" size="sm">Revendeur</Badge>
        </Group>
      </Group>
    </Paper>
  ) : null;

  return (
    <Container size="xl" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={35} radius="md" color="blue" variant="light">
              <IconFileText size={20} />
            </ThemeIcon>
            <div>
              <Title order={3} c="#1b365d" style={{ fontSize: '1.1rem' }}>
                {facturePredefinie ? `Décompte - Facture ${facturePredefinie.code_facture}` : 'Nouveau décompte'}
              </Title>
              <Text size="xs" c="dimmed">Créez un décompte pour un revendeur</Text>
            </div>
          </Group>
          <Button variant="subtle" color="gray" size="sm" leftSection={<IconArrowLeft size={14} />} onClick={onCancel}>
            Retour
          </Button>
        </Group>

        <Card withBorder radius="md" shadow="sm" p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Client revendeur"
              placeholder="Sélectionner un client"
              data={clientData}
              value={selectedClient?.idClient?.toString() || null}
              onChange={async (val) => {
                const client = clients.find(c => c.idClient.toString() === val);
                setSelectedClient(client || null);
                if (client) {
                  await loadStockRevendeur(client.idClient);
                  setPanier([]);
                  setQuantiteInput({});
                }
              }}
              searchable
              size="sm"
              disabled={!!facturePredefinie}
            />
            
            <NumberInput
              label="Taux de commission (%)"
              description="Appliqué sur le bénéfice total"
              value={tauxCommission}
              onChange={(val) => setTauxCommission(typeof val === 'number' ? val : 0)}
              min={0}
              max={100}
              step={5}
              size="sm"
              leftSection={<IconPercentage size={16} />}
            />
          </SimpleGrid>

          {clientSelectionne}
        </Card>

        {/* Produits disponibles */}
        {selectedClient && (
          <Card withBorder radius="md" shadow="sm" p="sm">
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconPackage size={14} />
                <Text fw={600} size="sm">Produits disponibles</Text>
                <Badge size="sm" color="blue" variant="light">{produits.length} produits</Badge>
              </Group>
              <Group gap="xs">
                <TextInput
                  placeholder="Rechercher..."
                  size="xs"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  style={{ width: 220 }}
                  leftSection={<IconSearch size={12} />}
                />
                <ActionIcon size="sm" variant="light" onClick={() => selectedClient && loadStockRevendeur(selectedClient.idClient)}>
                  <IconRefresh size={14} />
                </ActionIcon>
              </Group>
            </Group>

            {loadingProduits ? (
              <Center py={30}><Loader size="sm" /><Text size="xs" ml="sm">Chargement...</Text></Center>
            ) : produitsFiltres.length === 0 ? (
              <Center py={30}><IconPackage size={30} color="#ccc" /><Text size="sm" c="dimmed" ml="sm">Aucun produit disponible</Text></Center>
            ) : (
              <ScrollArea h={250}>
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: "#1b365d" }}>
                      <Table.Th style={{ fontSize: '11px', color: 'white' }}>Produit</Table.Th>
                      <Table.Th style={{ fontSize: '11px', color: 'white' }} ta="right">Prix vente</Table.Th>
                      <Table.Th style={{ fontSize: '11px', color: 'white' }} ta="center">Stock</Table.Th>
                      <Table.Th style={{ fontSize: '11px', color: 'white' }} ta="center">Qté</Table.Th>
                      <Table.Th style={{ fontSize: '11px', color: 'white' }} ta="center"></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {produitsFiltres.map((p) => (
                      <Table.Tr key={p.idProduit}>
                        <Table.Td><Text size="xs" fw={500} lineClamp={1}>{p.designation}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="xs" fw={600} c="blue">{p.prix_vente_gros.toLocaleString()} F</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge size="xs" color={p.qte_stock <= 0 ? "red" : p.qte_stock <= 5 ? "orange" : "green"} variant="light">
                            {p.qte_stock}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="center" style={{ width: 80 }}>
                          <NumberInput
                            size="xs"
                            min={0}
                            max={p.qte_stock}
                            value={quantiteInput[p.idProduit] || 0}
                            onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) || 0 })}
                            w={70}
                            placeholder="Qté"
                          />
                        </Table.Td>
                        <Table.Td ta="center">
                          <Button size="xs" variant="light" color="green" onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)} disabled={!quantiteInput[p.idProduit] || quantiteInput[p.idProduit] <= 0 || p.qte_stock <= 0}>
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
        )}

        {/* Panier */}
        {panier.length > 0 && (
          <Card withBorder radius="md" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconShoppingCart size={14} />
                <Text fw={600} size="sm">Panier ({panier.length} produits)</Text>
              </Group>
              <Button variant="subtle" color="red" size="xs" onClick={viderPanier}>Vider le panier</Button>
            </Group>
            
            <ScrollArea h={180}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ fontSize: '10px' }}>Produit</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="center">Qté</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="right">Prix unit.</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="right">Total</Table.Th>
                    <Table.Th style={{ fontSize: '10px' }} ta="center"></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {panier.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td><Text size="xs" fw={500} lineClamp={1}>{item.designation}</Text></Table.Td>
                      <Table.Td ta="center"><Badge size="xs" color="blue" variant="light" radius="xl">{item.quantite}</Badge></Table.Td>
                      <Table.Td ta="right"><Text size="xs">{item.prix_vente.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="right"><Text size="xs" fw={600} c="blue">{item.total.toLocaleString()} F</Text></Table.Td>
                      <Table.Td ta="center">
                        <ActionIcon color="red" variant="subtle" size="sm" onClick={() => retirerDuPanier(idx)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            
            <Divider my="xs" />
            
            <Stack gap={4}>
              <Flex justify="space-between"><Text size="xs" c="dimmed">Total Achats :</Text><Text size="xs" fw={500}>{totalAchat.toLocaleString()} FCFA</Text></Flex>
              <Flex justify="space-between"><Text size="xs" c="dimmed">Total Ventes :</Text><Text size="xs" fw={600} c="blue">{totalVente.toLocaleString()} FCFA</Text></Flex>
              <Paper p="xs" withBorder bg="green.0" radius="sm">
                <Flex justify="space-between"><Group gap={4}><IconPercentage size={12} color="#2e7d32" /><Text size="xs" fw={600} c="green">Bénéfice Total :</Text></Group><Text size="xs" fw={700} c="green">{totalBenefice.toLocaleString()} FCFA</Text></Flex>
              </Paper>
              <Paper p="xs" withBorder bg="orange.0" radius="sm">
                <Flex justify="space-between"><Group gap={4}><IconPercentage size={12} color="#ed6c02" /><Text size="xs" fw={600} c="orange">Commission ({tauxCommission}%) :</Text></Group><Text size="xs" fw={700} c="orange">- {totalCommission.toLocaleString()} FCFA</Text></Flex>
              </Paper>
              <Divider />
              <Paper p="sm" withBorder bg="green.0" radius="md">
                <Flex justify="space-between"><Text fw={700} size="md">NET À PAYER :</Text><Text fw={800} size="xl" c="green">{netAPayer.toLocaleString()} FCFA</Text></Flex>
              </Paper>
            </Stack>
          </Card>
        )}

        <TextInput label="Objet" placeholder="Motif du décompte (optionnel)" value={objet} onChange={(e) => setObjet(e.target.value)} size="sm" />

        <Group justify="flex-end" gap="sm">
          <Button variant="outline" color="gray" size="sm" onClick={onCancel}>Annuler</Button>
          <Button onClick={handleSubmit} loading={saving} size="sm" color="green" disabled={!selectedClient || panier.length === 0} leftSection={<IconFileText size={16} />}>
            Enregistrer le décompte
          </Button>
        </Group>

        {error && <Alert color="red" variant="light" p="xs" icon={<IconAlertCircle size={12} />}>{error}</Alert>}
      </Stack>
    </Container>
  );
};

export default NouveauDecompte;