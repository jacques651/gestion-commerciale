// src/components/decomptes/NouveauDecompte.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack, Card, Text, Group, Button, Select, Table, NumberInput,
  Divider, Alert, Badge, ScrollArea, ActionIcon,
  TextInput, Flex, ThemeIcon, Center, Loader,
  Paper, Grid, Tooltip, Modal
} from "@mantine/core";
import {
  IconArrowLeft, IconTrash, IconPhone,
  IconPackage, IconSearch, IconRefresh,
  IconFileText, IconShoppingCart, 
  IconTruck,
  IconAlertCircle,
  IconPercentage,
  IconUser,
  IconBuildingStore,
  IconCheck,
  IconPlus
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import { notifications } from "@mantine/notifications";
import { stockRevendeurRepository } from "../../database/repositories/stockRevendeurRepository";
import { generateDecompteCode } from "../../services/codeGeneratorService";
import { journalCaisseService } from "../../services/journalCaisseService";

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
  categorie?: string;
  unite_base?: string;
  qte_stock: number;
  prix_achat_base: number;
  prix_vente_gros: number;
}

interface PanierItem {
  idProduit: number;
  designation: string;
  categorie?: string;
  unite_mesure?: string;
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
  const [codeDecompte, setCodeDecompte] = useState("");

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
        
        const code = await generateDecompteCode();
        setCodeDecompte(code);
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
      
      // ✅ S'assurer que les champs categorie et unite_base sont présents
      const produitsAvecInfos = result.map(p => ({
        ...p,
        categorie: p.categorie || 'Non catégorisé',
        unite_base: p.unite_base || 'pièce'
      }));
      
      setProduits(produitsAvecInfos);
      return produitsAvecInfos;
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
          
          const produitsStock = await loadStockRevendeur(client.idClient);
          
          if (facturePredefinie.details && facturePredefinie.details.length > 0 && produitsStock.length > 0) {
            const panierItems: PanierItem[] = [];
            
            for (const detail of facturePredefinie.details) {
              const produitStock = produitsStock.find(p => p.idProduit === detail.idProduit);
              
              if (produitStock && produitStock.qte_stock > 0) {
                panierItems.push({
                  idProduit: detail.idProduit,
                  designation: detail.designation || produitStock.designation,
                  categorie: detail.categorie || produitStock.categorie || 'Non catégorisé',
                  unite_mesure: detail.unite_base || produitStock.unite_base || 'pièce',
                  quantite: Math.min(produitStock.qte_stock, 10),
                  prix_vente: detail.prix_unitaire_vente || produitStock.prix_vente_gros,
                  prix_achat: detail.prix_achat_base || produitStock.prix_achat_base,
                  total: (detail.prix_unitaire_vente || produitStock.prix_vente_gros) * Math.min(produitStock.qte_stock, 10)
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
        categorie: produit.categorie || 'Non catégorisé',
        unite_mesure: produit.unite_base || 'pièce',
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
      }

      // ✅ AJOUTER AU JOURNAL DE CAISSE
      try {
        await journalCaisseService.ajouterDecompteRevendeur({
          montant: netAPayer,
          idDecompte: idDecompte,
          codeDecompte: codeDecompte,
          revendeurNom: selectedClient.NomComplet
        });
        console.log('✅ Journal de caisse mis à jour pour le décompte', codeDecompte);
      } catch (journalError) {
        console.error('Erreur journal de caisse:', journalError);
        // Ne pas bloquer le décompte si le journal échoue
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

  return (
    <>
      <Modal
        opened={true}
        onClose={onCancel}
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
              <IconFileText size={24} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="white">
                {facturePredefinie ? `Décompte - Facture ${facturePredefinie.code_facture}` : 'Nouveau décompte'}
              </Text>
              <Text size="xs" opacity={0.7} c="white">Créez un décompte pour un revendeur</Text>
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
                {/* Sélection client */}
                <Grid.Col span={4}>
                  <Select
                    label="Revendeur"
                    placeholder="Sélectionner..."
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
                    size="xs"
                    leftSection={<IconUser size={14} />}
                    disabled={!!facturePredefinie}
                  />
                </Grid.Col>

                {/* Contact */}
                <Grid.Col span={2}>
                  <TextInput
                    label="Contact"
                    value={selectedClient?.Tel || ''}
                    readOnly
                    size="xs"
                    leftSection={<IconPhone size={14} />}
                    placeholder="Tél"
                  />
                </Grid.Col>

                {/* Type */}
                <Grid.Col span={2}>
                  <Select
                    label="Type"
                    value="revendeur"
                    data={[{ value: 'revendeur', label: 'Revendeur' }]}
                    readOnly
                    size="xs"
                    leftSection={<IconBuildingStore size={14} />}
                  />
                </Grid.Col>

                {/* Code décompte */}
                <Grid.Col span={2}>
                  <TextInput
                    label="Code"
                    value={codeDecompte}
                    readOnly
                    disabled
                    size="xs"
                    leftSection={<IconFileText size={14} />}
                  />
                </Grid.Col>

                {/* Taux commission */}
                <Grid.Col span={2}>
                  <NumberInput
                    label="Commission %"
                    value={tauxCommission}
                    onChange={(val) => setTauxCommission(typeof val === 'number' ? val : 0)}
                    min={0}
                    max={100}
                    step={5}
                    size="xs"
                    leftSection={<IconPercentage size={14} />}
                  />
                </Grid.Col>
              </Grid>

              {/* Info client */}
              {selectedClient && (
                <Paper p="xs" withBorder radius="md" mt="xs" style={{ backgroundColor: '#f8f9fa' }}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                        <IconTruck size={12} />
                      </ThemeIcon>
                      <Text size="xs" fw={500}>{selectedClient.NomComplet}</Text>
                      {selectedClient.Societe && <Text size="xs" c="dimmed">| {selectedClient.Societe}</Text>}
                    </Group>
                    <Badge color="green" variant="light" size="xs">Revendeur</Badge>
                  </Group>
                </Paper>
              )}
            </Card>

            {/* ============================================ */}
            {/* LIGNE 2: Produits - Compactée avec Catégorie et Unité */}
            {/* ============================================ */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Group gap="xs" mb="xs" justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color="grape" variant="light" radius="md" size="sm">
                    <IconPackage size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" c="#1b365d">Produits disponibles</Text>
                  <Badge color="blue" variant="light" size="xs">{produits.length}</Badge>
                </Group>
                <Group gap="xs">
                  <TextInput
                    placeholder="Rechercher..."
                    size="xs"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    style={{ width: 200 }}
                    leftSection={<IconSearch size={12} />}
                  />
                  <Tooltip label="Actualiser">
                    <ActionIcon size="sm" variant="light" onClick={() => selectedClient && loadStockRevendeur(selectedClient.idClient)}>
                      <IconRefresh size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              {loadingProduits ? (
                <Center py={30}><Loader size="sm" /><Text size="xs" ml="sm">Chargement...</Text></Center>
              ) : produitsFiltres.length === 0 ? (
                <Center py={30}><IconPackage size={24} color="#ccc" /><Text size="xs" c="dimmed" ml="sm">Aucun produit disponible</Text></Center>
              ) : (
                <ScrollArea h={200}>
                  <Table striped highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: "#1b365d" }}>
                        <Table.Th c="white" style={{ width: '25%' }}>Produit</Table.Th>
                        <Table.Th c="white" style={{ width: '15%' }}>Catégorie</Table.Th>
                        <Table.Th c="white" style={{ width: '10%' }}>Unité</Table.Th>
                        <Table.Th c="white" style={{ width: '12%' }} ta="right">Prix</Table.Th>
                        <Table.Th c="white" style={{ width: '10%' }} ta="center">Stock</Table.Th>
                        <Table.Th c="white" style={{ width: '16%' }} ta="center">Qté</Table.Th>
                        <Table.Th c="white" style={{ width: '12%' }} ta="center">Action</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {produitsFiltres.map((p) => (
                        <Table.Tr key={p.idProduit}>
                          <Table.Td>
                            <Text size="xs" fw={500} lineClamp={1}>{p.designation}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="xs" color="grape">
                              {p.categorie || '-'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{p.unite_base || 'pièce'}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" fw={600} c="blue">{p.prix_vente_gros.toLocaleString()} F</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge size="xs" color={p.qte_stock <= 0 ? "red" : p.qte_stock <= 5 ? "orange" : "green"} variant="light">
                              {p.qte_stock}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <NumberInput
                              size="xs"
                              min={0}
                              max={p.qte_stock}
                              value={quantiteInput[p.idProduit] || 0}
                              onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) || 0 })}
                              w={60}
                              placeholder="Qté"
                            />
                          </Table.Td>
                          <Table.Td ta="center">
                            <Button 
                              size="xs" 
                              variant="light" 
                              color="green" 
                              onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)} 
                              disabled={!quantiteInput[p.idProduit] || quantiteInput[p.idProduit] <= 0 || p.qte_stock <= 0}
                              leftSection={<IconPlus size={12} />}
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

            {/* ============================================ */}
            {/* LIGNE 3: Panier - Compactée avec Catégorie et Unité */}
            {/* ============================================ */}
            {panier.length > 0 && (
              <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <ThemeIcon color="orange" variant="light" radius="md" size="sm">
                      <IconShoppingCart size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" c="#1b365d">Panier</Text>
                    <Badge color="orange" variant="light" size="xs">{panier.length} produits</Badge>
                  </Group>
                  <Button variant="subtle" color="red" size="xs" onClick={viderPanier} leftSection={<IconTrash size={12} />}>
                    Vider
                  </Button>
                </Group>

                <ScrollArea h={150}>
                  <Table striped highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '25%' }}>Produit</Table.Th>
                        <Table.Th style={{ width: '15%' }}>Catégorie</Table.Th>
                        <Table.Th style={{ width: '10%' }}>Unité</Table.Th>
                        <Table.Th style={{ width: '13%' }} ta="center">Qté</Table.Th>
                        <Table.Th style={{ width: '13%' }} ta="right">Prix</Table.Th>
                        <Table.Th style={{ width: '15%' }} ta="right">Total</Table.Th>
                        <Table.Th style={{ width: '9%' }} ta="center"></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {panier.map((item, idx) => (
                        <Table.Tr key={idx}>
                          <Table.Td>
                            <Text size="xs" fw={500} lineClamp={1}>{item.designation}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" size="xs" color="grape">
                              {item.categorie || '-'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{item.unite_mesure || 'pièce'}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge size="xs" color="blue" variant="light" radius="xl">{item.quantite}</Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs">{item.prix_vente.toLocaleString()} F</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" fw={600} c="blue">{item.total.toLocaleString()} F</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <ActionIcon color="red" variant="subtle" size="sm" onClick={() => retirerDuPanier(idx)}>
                              <IconTrash size={12} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="xs" />

                {/* Totaux compactés */}
                <Grid>
                  <Grid.Col span={3}>
                    <Paper p="xs" withBorder radius="md" bg="gray.0" ta="center">
                      <Text size="xs" c="dimmed">Achats</Text>
                      <Text size="sm" fw={600}>{totalAchat.toLocaleString()} F</Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Paper p="xs" withBorder radius="md" bg="gray.0" ta="center">
                      <Text size="xs" c="dimmed">Ventes</Text>
                      <Text size="sm" fw={600} c="blue">{totalVente.toLocaleString()} F</Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Paper p="xs" withBorder radius="md" bg="green.0" ta="center">
                      <Text size="xs" c="dimmed">Bénéfice</Text>
                      <Text size="sm" fw={700} c="green">{totalBenefice.toLocaleString()} F</Text>
                    </Paper>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Paper p="xs" withBorder radius="md" bg="orange.0" ta="center">
                      <Text size="xs" c="dimmed">Comm. {tauxCommission}%</Text>
                      <Text size="sm" fw={700} c="orange">-{totalCommission.toLocaleString()} F</Text>
                    </Paper>
                  </Grid.Col>
                </Grid>

                <Paper p="sm" withBorder radius="md" bg="green.0" mt="xs">
                  <Flex justify="space-between" align="center">
                    <Text fw={700} size="sm">NET À PAYER :</Text>
                    <Text fw={800} size="lg" c="green">{netAPayer.toLocaleString()} FCFA</Text>
                  </Flex>
                </Paper>
              </Card>
            )}

            {/* ============================================ */}
            {/* Objet + Boutons - Compactés */}
            {/* ============================================ */}
            <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
              <Grid align="flex-end">
                <Grid.Col span={6}>
                  <TextInput
                    label="Objet"
                    placeholder="Motif du décompte (optionnel)"
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    size="xs"
                    leftSection={<IconFileText size={14} />}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group justify="flex-end" gap="xs">
                    <Button variant="outline" color="gray" size="xs" onClick={onCancel} leftSection={<IconArrowLeft size={12} />}>
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      loading={saving} 
                      size="xs" 
                      color="green" 
                      disabled={!selectedClient || panier.length === 0}
                      leftSection={<IconCheck size={14} />}
                    >
                      Enregistrer
                    </Button>
                  </Group>
                </Grid.Col>
              </Grid>
            </Card>

            {error && <Alert color="red" variant="light" p="xs" icon={<IconAlertCircle size={12} />}>{error}</Alert>}
          </Stack>
        </ScrollArea>
      </Modal>
    </>
  );
};

export default NouveauDecompte;