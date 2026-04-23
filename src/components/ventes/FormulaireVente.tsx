import React, { useState, useEffect } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Select, NumberInput,
  Divider, Alert, Box, Modal, Table, ActionIcon, TextInput,
  ScrollArea, SimpleGrid,
  Badge,
  LoadingOverlay
} from "@mantine/core";
import {
  IconDeviceFloppy, IconArrowLeft, IconBuildingStore, IconUser,
  IconTrash,
  IconSearch} from "@tabler/icons-react";
import { getDb } from "../../database/db";

interface Client { idClient: number; nom_complet: string; }
interface Produit { idProduit: number; designation: string; unite_base: string; prix_vente_detail: number; qte_stock: number; categorie: string; }
interface PanierItem { idProduit: number; designation: string; quantite: number; prix_unitaire: number; total: number; }

const FormulaireVente: React.FC<{ onSuccess: () => void; onCancel: () => void }> = ({ onSuccess, onCancel }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitsFiltres, setProduitsFiltres] = useState<Produit[]>([]);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});
  const [formData, setFormData] = useState({ idClient: "", nomClient: "", contact: "", dateVente: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    const loadData = async () => {
      const db = await getDb();
      const clientsData = await db.select<Client[]>("SELECT idClient, nom_complet FROM clients WHERE est_actif=1 AND est_supprime=0 ORDER BY nom_complet");
      const produitsData = await db.select<Produit[]>("SELECT idProduit, designation, unite_base, prix_vente_detail, qte_stock, categorie FROM products WHERE est_supprime=0 AND qte_stock > 0 ORDER BY designation");
      setClients(clientsData);
      setProduits(produitsData);
      setProduitsFiltres(produitsData);
      const uniqueCategories = [...new Set(produitsData.map(p => p.categorie).filter(Boolean))];
      setCategories(uniqueCategories);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...produits];
    if (recherche) filtered = filtered.filter(p => p.designation.toLowerCase().includes(recherche.toLowerCase()));
    if (categorieFiltre) filtered = filtered.filter(p => p.categorie === categorieFiltre);
    setProduitsFiltres(filtered);
  }, [recherche, categorieFiltre, produits]);

  const ajouterAuPanier = (produit: Produit, quantite: number) => {
    if (quantite <= 0) return;
    if (quantite > produit.qte_stock) { setError(`Stock insuffisant. Maximum: ${produit.qte_stock}`); return; }

    const existingIndex = panier.findIndex(p => p.idProduit === produit.idProduit);
    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.qte_stock) { setError(`Quantité totale dépasse le stock`); return; }
      const updated = [...panier];
      updated[existingIndex] = { ...updated[existingIndex], quantite: newQuantite, total: newQuantite * produit.prix_vente_detail };
      setPanier(updated);
    } else {
      setPanier([...panier, { idProduit: produit.idProduit, designation: produit.designation, quantite: quantite, prix_unitaire: produit.prix_vente_detail, total: quantite * produit.prix_vente_detail }]);
    }
    setError("");
    setQuantiteInput({ ...quantiteInput, [produit.idProduit]: 0 });
  };

  const retirerDuPanier = (index: number) => { const updated = [...panier]; updated.splice(index, 1); setPanier(updated); };
  const totalHT = panier.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async () => {
    if (panier.length === 0) { setError("Veuillez ajouter des produits"); return; }
    setSaving(true); setError("");
    try {
      const db = await getDb();
      const codeVente = `VNT-${Date.now()}`;
      await db.execute(`INSERT INTO ventes (code_vente, idClient, nom_prenom, contact, date_vente, montant_total, type_vente) VALUES (?, ?, ?, ?, ?, ?, 'COMPTOIR')`,
        [codeVente, formData.idClient || null, formData.nomClient, formData.contact || null, formData.dateVente, totalHT]);

      const venteResult = await db.select<{ idVente: number }[]>("SELECT idVente FROM ventes WHERE code_vente = ?", [codeVente]);
      const idVente = venteResult[0]?.idVente;

      for (const item of panier) {
        await db.execute("INSERT INTO vente_details (idVente, idProduit, quantite, prix_unitaire) VALUES (?, ?, ?, ?)", [idVente, item.idProduit, item.quantite, item.prix_unitaire]);
        await db.execute("UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?", [item.quantite, item.idProduit]);
      }
      setSuccess(true);
      setTimeout(() => onSuccess(), 1500);
    } catch (err: any) { setError(err.message || "Erreur"); }
    finally { setSaving(false); }
  };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d"><Group justify="space-between"><Group gap="xs"><IconBuildingStore size={24} color="white" /><Title order={2} c="white">Nouvelle vente</Title></Group><Button variant="light" color="white" leftSection={<IconArrowLeft size={16} />} onClick={onCancel}>Retour</Button></Group></Card>

        {/* Infos client */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Informations client</Title>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Client (optionnel)" placeholder="Sélectionner" data={clients.map(c => ({ value: c.idClient.toString(), label: c.nom_complet }))} value={formData.idClient} onChange={(val) => setFormData({ ...formData, idClient: val || "" })} leftSection={<IconUser size={14} />} clearable searchable />
            <TextInput label="Nom complet" placeholder="Nom du client" value={formData.nomClient} onChange={(e) => setFormData({ ...formData, nomClient: e.target.value })} leftSection={<IconUser size={14} />} required />
            <TextInput label="Contact" placeholder="Téléphone" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} leftSection={<IconUser size={14} />} />
            <TextInput label="Date" type="date" value={formData.dateVente} onChange={(e) => setFormData({ ...formData, dateVente: e.target.value })} />
          </SimpleGrid>
        </Card>

        {/* Produits */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Produits</Title>
          <Divider mb="md" />
          <Group mb="md"><TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ flex: 1 }} /><Select placeholder="Catégorie" data={[{ value: "", label: "Toutes" }, ...categories.map(c => ({ value: c, label: c }))]} value={categorieFiltre} onChange={setCategorieFiltre} style={{ width: 150 }} clearable /></Group>
          <ScrollArea h={250}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Produit</Table.Th><Table.Th>Stock</Table.Th><Table.Th>Prix</Table.Th><Table.Th>Qté</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{produitsFiltres.map((p) => (<Table.Tr key={p.idProduit}><Table.Td fw={500}>{p.designation}</Table.Td><Table.Td><Badge color={p.qte_stock <= 5 ? "orange" : "green"} variant="light">{p.qte_stock}</Badge></Table.Td><Table.Td>{p.prix_vente_detail.toLocaleString()} FCFA</Table.Td><Table.Td><NumberInput size="xs" min={0} max={p.qte_stock} value={quantiteInput[p.idProduit] || 0} onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) })} style={{ width: 80 }} /></Table.Td><Table.Td><Button size="xs" variant="light" onClick={() => ajouterAuPanier(p, quantiteInput[p.idProduit] || 0)}>Ajouter</Button></Table.Td></Table.Tr>))}</Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Panier */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Panier</Title>
          <Divider mb="md" />
          {panier.length === 0 ? <Text ta="center" c="dimmed" py={40}>Aucun produit</Text> : (<><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Produit</Table.Th><Table.Th>Qté</Table.Th><Table.Th>Prix</Table.Th><Table.Th>Total</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead><Table.Tbody>{panier.map((item, idx) => (<Table.Tr key={idx}><Table.Td fw={500}>{item.designation}</Table.Td><Table.Td>{item.quantite}</Table.Td><Table.Td>{item.prix_unitaire.toLocaleString()} FCFA</Table.Td><Table.Td fw={600}>{item.total.toLocaleString()} FCFA</Table.Td><Table.Td><ActionIcon color="red" onClick={() => retirerDuPanier(idx)}><IconTrash size={16} /></ActionIcon></Table.Td></Table.Tr>))}</Table.Tbody></Table><Divider my="md" /><Group justify="flex-end"><Text fw={700} size="lg">Total : {totalHT.toLocaleString()} FCFA</Text></Group></>)}
          <Divider my="md" />
          {error && <Alert color="red" mb="md">{error}</Alert>}
          <Group justify="flex-end"><Button variant="light" color="red" onClick={onCancel}>Annuler</Button><Button onClick={handleSubmit} loading={saving} leftSection={<IconDeviceFloppy size={16} />} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Enregistrer</Button></Group>
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}><Stack gap="md"><Text size="sm">1. Saisissez les informations du client</Text><Text size="sm">2. Ajoutez les produits au panier</Text><Text size="sm">3. Validez la vente</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack></Modal>
      </Stack>
    </Box>
  );
};

export default FormulaireVente;