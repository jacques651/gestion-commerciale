import React, { useState, useEffect } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Select, Table, NumberInput,
  LoadingOverlay, Box, Divider, Alert, Badge, ScrollArea, ActionIcon,
  TextInput
} from "@mantine/core";
import {
  IconArrowLeft, IconDeviceFloppy, IconTrash, IconUser, IconPhone,
  IconBuildingStore, IconPackage, IconSearch, IconRefresh
} from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface Client {
  idClient: number;
  nom_complet: string;
  telephone: string;
  type_client: string;
}

interface ProduitStock {
  idProduit: number;
  designation: string;
  unite_base: string;
  quantite_restante: number;
  prix_vente_detail: number;
  prix_achat_base: number;
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
  const [produits, setProduits] = useState<ProduitStock[]>([]);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});
  const [dateDecompte, setDateDecompte] = useState(new Date().toISOString().split("T")[0]);

  // Charger les clients revendeurs
  useEffect(() => {
    const loadClients = async () => {
      const db = await getDb();
      const result = await db.select<Client[]>(`
        SELECT idClient, nom_complet, telephone, type_client
        FROM clients WHERE type_client = 'REVENDEUR' AND est_supprime = 0
        ORDER BY nom_complet
      `);
      setClients(result);
      setLoading(false);
    };
    loadClients();
  }, []);

  // Charger le stock du revendeur
  const loadStockRevendeur = async (idClient: number) => {
    const db = await getDb();
    const result = await db.select<ProduitStock[]>(`
      SELECT 
        p.idProduit, p.designation, p.unite_base, p.prix_vente_detail, p.prix_achat_base,
        p.commission_pourcentage,
        COALESCE((
          SELECT sr.quantite_commande - sr.quantite_vendue
          FROM stock_revendeur sr
          WHERE sr.idRevendeur = ? AND sr.idProduit = p.idProduit
        ), 0) as quantite_restante
      FROM products p
      WHERE EXISTS (
        SELECT 1 FROM stock_revendeur sr 
        WHERE sr.idRevendeur = ? AND sr.idProduit = p.idProduit
        AND sr.quantite_commande > sr.quantite_vendue
      )
      ORDER BY p.designation
    `, [idClient, idClient]);
    setProduits(result);
    setQuantiteInput({});
  };

  const handleClientChange = async (value: string | null) => {
    if (!value) {
      setSelectedClient(null);
      setProduits([]);
      return;
    }
    const client = clients.find(c => c.idClient.toString() === value);
    setSelectedClient(client || null);
    if (client) {
      await loadStockRevendeur(client.idClient);
    }
  };

  const ajouterAuPanier = (produit: ProduitStock, quantite: number) => {
    if (quantite <= 0) return;
    if (quantite > produit.quantite_restante) {
      setError(`Stock insuffisant. Maximum: ${produit.quantite_restante}`);
      return;
    }

    const existingIndex = panier.findIndex(p => p.idProduit === produit.idProduit);
    const total = quantite * produit.prix_vente_detail;
    const commission = total * (produit.commission_pourcentage / 100);
    
    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.quantite_restante) {
        setError(`Quantité totale dépasse le stock disponible`);
        return;
      }
      const updated = [...panier];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantite: newQuantite,
        total: newQuantite * produit.prix_vente_detail,
      };
      setPanier(updated);
    } else {
      setPanier([...panier, {
        idProduit: produit.idProduit,
        designation: produit.designation,
        quantite: quantite,
        prix_vente: produit.prix_vente_detail,
        prix_achat: produit.prix_achat_base,
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

  const totalHT = panier.reduce((sum, item) => sum + item.total, 0);
  const totalCommission = panier.reduce((sum, item) => sum + item.commission, 0);
  const netAPayer = totalHT - totalCommission;

  const handleSubmit = async () => {
    if (!selectedClient) { setError("Veuillez sélectionner un client"); return; }
    if (panier.length === 0) { setError("Veuillez ajouter des produits au panier"); return; }

    setSaving(true);
    setError("");

    try {
      const db = await getDb();
      const codeDecompte = `DCP-${Date.now()}`;

      await db.execute(`
        INSERT INTO decomptes (code_decompte, idClient, date_decompte, montant_ht, montant_ttc, statut)
        VALUES (?, ?, ?, ?, ?, 'EN_ATTENTE')
      `, [codeDecompte, selectedClient.idClient, dateDecompte, totalHT, netAPayer]);

      const decompteResult = await db.select<{ idDecompte: number }[]>(
        "SELECT idDecompte FROM decomptes WHERE code_decompte = ?", [codeDecompte]
      );
      const idDecompte = decompteResult[0]?.idDecompte;

      for (const item of panier) {
        await db.execute(`
          INSERT INTO decompte_details (idDecompte, idProduit, quantite_vendue, prix_vente, prix_achat, commission)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [idDecompte, item.idProduit, item.quantite, item.prix_vente, item.prix_achat, item.commission]);

        await db.execute(`
          UPDATE stock_revendeur 
          SET quantite_vendue = quantite_vendue + ?
          WHERE idRevendeur = ? AND idProduit = ?
        `, [item.quantite, selectedClient.idClient, item.idProduit]);
      }

      setSaving(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  // Filtrer les produits par recherche
  const produitsFiltres = produits.filter(p => p.designation.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Group gap="xs"><IconPackage size={24} color="white" /><Title order={2} c="white">Nouveau décompte</Title></Group>
            <Button variant="light" color="white" leftSection={<IconArrowLeft size={16} />} onClick={onCancel}>Retour</Button>
          </Group>
        </Card>

        {/* Partie client */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Informations client</Title>
          <Divider mb="md" />
          <Select
            label="Client revendeur"
            placeholder="Sélectionner un client"
            data={clients.map(c => ({ value: c.idClient.toString(), label: c.nom_complet }))}
            onChange={handleClientChange}
            leftSection={<IconUser size={16} />}
            required searchable
          />
          {selectedClient && (
            <Group mt="md">
              <Group gap="xs"><IconPhone size={14} /><Text size="sm">{selectedClient.telephone || "Pas de téléphone"}</Text></Group>
              <Group gap="xs"><IconBuildingStore size={14} /><Text size="sm" tt="capitalize">{selectedClient.type_client}</Text></Group>
            </Group>
          )}
        </Card>

        {/* Produits disponibles */}
        {selectedClient && (
          <Card withBorder radius="md" p="lg">
            <Title order={4} mb="md">Produits disponibles</Title>
            <Divider mb="md" />
            <Group mb="md">
              <TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ flex: 1 }} />
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => { setRecherche(""); loadStockRevendeur(selectedClient.idClient); }}>Actualiser</Button>
            </Group>
            <ScrollArea h={300}>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Désignation</Table.Th><Table.Th>Stock</Table.Th><Table.Th>Prix vente</Table.Th><Table.Th>Qté</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {produitsFiltres.map((p) => (
                    <Table.Tr key={p.idProduit}>
                      <Table.Td fw={500}>{p.designation}</Table.Td>
                      <Table.Td><Badge color={p.quantite_restante <= 5 ? "orange" : "green"} variant="light">{p.quantite_restante}</Badge></Table.Td>
                      <Table.Td>{p.prix_vente_detail.toLocaleString()} FCFA</Table.Td>
                      <Table.Td style={{ width: 100 }}>
                        <NumberInput size="xs" min={0} max={p.quantite_restante} value={quantiteInput[p.idProduit] || 0} onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) })} />
                      </Table.Td>
                      <Table.Td><Button size="xs" variant="light" onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)}>Ajouter</Button></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {produitsFiltres.length === 0 && <Text ta="center" c="dimmed" py={40}>Aucun produit disponible</Text>}
          </Card>
        )}

        {/* Panier */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Panier</Title>
          <Divider mb="md" />
          {panier.length === 0 ? (
            <Text ta="center" c="dimmed" py={40}>Aucun produit sélectionné</Text>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Produit</Table.Th><Table.Th>Qté</Table.Th><Table.Th>Prix unitaire</Table.Th><Table.Th>Total</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {panier.map((item, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={500}>{item.designation}</Table.Td>
                      <Table.Td>{item.quantite}</Table.Td>
                      <Table.Td>{item.prix_vente.toLocaleString()} FCFA</Table.Td>
                      <Table.Td fw={600}>{item.total.toLocaleString()} FCFA</Table.Td>
                      <Table.Td><ActionIcon color="red" onClick={() => retirerDuPanier(idx)}><IconTrash size={16} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Divider my="md" />
              <Group justify="flex-end">
                <Stack gap={4} align="flex-end">
                  <Text size="sm">Total HT : <strong>{totalHT.toLocaleString()} FCFA</strong></Text>
                  <Text size="sm">Commission : <strong>- {totalCommission.toLocaleString()} FCFA</strong></Text>
                  <Text size="lg" fw={700}>Net à payer : <span style={{ color: "#1b365d" }}>{netAPayer.toLocaleString()} FCFA</span></Text>
                </Stack>
              </Group>
            </>
          )}
          <Divider my="md" />
          <Group justify="space-between">
            <TextInput label="Date du décompte" type="date" value={dateDecompte} onChange={(e) => setDateDecompte(e.target.value)} style={{ width: 200 }} />
            <Group>
              <Button variant="light" color="red" onClick={onCancel}>Annuler</Button>
              <Button onClick={handleSubmit} loading={saving} leftSection={<IconDeviceFloppy size={16} />} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Enregistrer le décompte</Button>
            </Group>
          </Group>
          {error && <Alert color="red" mt="md">{error}</Alert>}
        </Card>
      </Stack>
    </Box>
  );
};

export default NouveauDecompte;