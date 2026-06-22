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
  IconPlus,
  IconCash
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
  taux_commission?: number;
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
      
      const produitsAvecInfos = result.map(p => ({
        ...p,
        categorie: p.categorie || 'Non catégorisé',
        unite_base: p.unite_base || 'pièce'
      }));
      
      setProduits(produitsAvecInfos);
      console.log(`✅ ${produitsAvecInfos.length} produits chargés pour le revendeur`);
      return produitsAvecInfos;
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les produits', color: 'red' });
      return [];
    } finally {
      setLoadingProduits(false);
    }
  };

  // ✅ Pré-remplir UNIQUEMENT les informations du client - LE PANIER RESTE VIDE
  useEffect(() => {
    const prefillFromFacture = async () => {
      if (facturePredefinie && facturePredefinie.idRevendeur && clients.length > 0 && !initialized) {
        console.log('📄 Facture pré-définie reçue:', facturePredefinie.code_facture);
        
        // 1. Trouver le client
        const client = clients.find(c => c.idClient === facturePredefinie.idRevendeur);
        if (client) {
          setSelectedClient(client);
          console.log('✅ Client sélectionné:', client.NomComplet);
          
          // 2. Charger le stock du revendeur
          await loadStockRevendeur(client.idClient);
          
          // 3. ✅ LE PANIER RESTE VIDE - l'utilisateur choisira les produits manuellement
          setPanier([]);
          
          // 4. Pré-remplir l'objet
          setObjet(`Décompte pour facture ${facturePredefinie.code_facture}`);
          
          // 5. Récupérer le taux de commission de la facture
          if (facturePredefinie.taux_commission) {
            setTauxCommission(facturePredefinie.taux_commission);
          }
          
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
        INSERT INTO decomptes (
          idClient, 
          code_decompte, 
          date_decompte, 
          montant_achat,
          montant_vente, 
          montant_benefice,
          montant_commission, 
          montant_net, 
          statut, 
          observation,
          taux_commission
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        selectedClient.idClient,
        codeDecompte,
        dateDecompte,
        totalAchat,
        totalVente,
        totalBenefice,
        totalCommission,
        netAPayer,
        'VALIDE',
        objet || null,
        tauxCommission
      ]);

      const idDecompte = Number(insertResult.lastInsertId);

      for (const item of panier) {
        await db.execute(`
          INSERT INTO decompte_details (
            idDecompte, 
            idProduit, 
            qte_decompte, 
            prix_achat, 
            prix_vente,
            commission_pourcentage,
            designation
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          idDecompte,
          item.idProduit,
          item.quantite,
          item.prix_achat,
          item.prix_vente,
          tauxCommission,
          item.designation
        ]);

        await db.execute(`
          UPDATE stock_revendeur 
          SET qte_stock = qte_stock - ? 
          WHERE idProduit = ? AND idRevendeur = ?
        `, [item.quantite, item.idProduit, selectedClient.idClient]);

        await db.execute(`
          INSERT INTO mouvements_revendeur (
            idProduit,
            idRevendeur,
            idDecompte,
            type_mouvement,
            qte_mouvement
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          item.idProduit,
          selectedClient.idClient,
          idDecompte,
          "SORTIE",
          item.quantite
        ]);
      }

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
    p.designation.toLowerCase().includes(recherche.toLowerCase()) &&
    p.qte_stock > 0
  );

  return (
    <Modal
      opened={true}
      onClose={onCancel}
      size="80%"
      padding="xl"
      radius="lg"
      styles={{
        header: { 
          backgroundColor: '#1b365d', 
          padding: '16px 24px', 
          borderTopLeftRadius: '12px', 
          borderTopRightRadius: '12px' 
        },
        title: { color: 'white', fontWeight: 700, fontSize: '1.3rem' },
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
      <ScrollArea h="calc(100vh - 160px)" type="auto" p="lg">
        <Stack gap="md">
          {/* LIGNE 1: Client */}
          <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
            <Grid align="flex-end">
              <Grid.Col span={3}>
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

              <Grid.Col span={3}>
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

          {/* LIGNE 2: Produits disponibles */}
          <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#ffffff' }}>
            <Group gap="xs" mb="xs" justify="space-between">
              <Group gap="xs">
                <ThemeIcon color="grape" variant="light" radius="md" size="sm">
                  <IconPackage size={14} />
                </ThemeIcon>
                <Text fw={600} size="sm" c="#1b365d">Produits disponibles</Text>
                <Badge color="green" variant="light" size="xs">{produitsFiltres.length} en stock</Badge>
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
              <Center py={30}>
                <Stack align="center" gap="xs">
                  <IconPackage size={32} color="#adb5bd" />
                  <Text c="dimmed" size="sm">Aucun produit disponible en stock</Text>
                  <Text c="dimmed" size="xs">Le revendeur n'a pas encore de stock</Text>
                </Stack>
              </Center>
            ) : (
              <ScrollArea h={220}>
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: "#1b365d" }}>
                      <Table.Th c="white" style={{ width: '25%' }}>Produit</Table.Th>
                      <Table.Th c="white" style={{ width: '15%' }}>Catégorie</Table.Th>
                      <Table.Th c="white" style={{ width: '10%' }}>Unité</Table.Th>
                      <Table.Th c="white" style={{ width: '12%' }} ta="right">Prix</Table.Th>
                      <Table.Th c="white" style={{ width: '10%' }} ta="center">Stock</Table.Th>
                      <Table.Th c="white" style={{ width: '14%' }} ta="center">Qté</Table.Th>
                      <Table.Th c="white" style={{ width: '14%' }} ta="center">Action</Table.Th>
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
                          <Badge color={p.qte_stock <= 0 ? "red" : p.qte_stock <= 5 ? "orange" : "green"} variant="light">
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

          {/* LIGNE 3: Panier */}
          <Card withBorder radius="lg" shadow="sm" p="sm" style={{ backgroundColor: '#fafafa' }}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <ThemeIcon color="orange" variant="light" radius="md" size="sm">
                  <IconShoppingCart size={14} />
                </ThemeIcon>
                <Text fw={600} size="sm" c="#1b365d">Panier</Text>
                <Badge color="orange" variant="light" size="xs">{panier.length} produits</Badge>
              </Group>
              <Group gap="xs">
                {panier.length > 0 && (
                  <Text size="xs" c="dimmed">Total: {totalVente.toLocaleString()} F</Text>
                )}
                <Button variant="subtle" color="red" size="xs" onClick={viderPanier} leftSection={<IconTrash size={12} />}>
                  Vider
                </Button>
              </Group>
            </Group>

            {panier.length === 0 ? (
              <Center py={30}>
                <Stack align="center" gap="xs">
                  <IconShoppingCart size={32} color="#adb5bd" />
                  <Text c="dimmed" size="sm">Panier vide</Text>
                  <Text c="dimmed" size="xs">Ajoutez des produits depuis la liste ci-dessus</Text>
                </Stack>
              </Center>
            ) : (
              <>
                <ScrollArea h={150}>
                  <Table striped highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '25%' }}>Produit</Table.Th>
                        <Table.Th style={{ width: '12%' }}>Catégorie</Table.Th>
                        <Table.Th style={{ width: '10%' }}>Unité</Table.Th>
                        <Table.Th style={{ width: '13%' }} ta="center">Qté</Table.Th>
                        <Table.Th style={{ width: '13%' }} ta="right">Prix</Table.Th>
                        <Table.Th style={{ width: '15%' }} ta="right">Total</Table.Th>
                        <Table.Th style={{ width: '12%' }} ta="center">Action</Table.Th>
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
                    <Group gap="xs">
                      <IconCash size={18} color="#2e7d32" />
                      <Text fw={700} size="sm" c="green.8">NET À PAYER :</Text>
                    </Group>
                    <Text fw={800} size="lg" c="green.8">{netAPayer.toLocaleString()} FCFA</Text>
                  </Flex>
                </Paper>
              </>
            )}
          </Card>

          {/* Objet + Boutons */}
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
  );
};

export default NouveauDecompte;