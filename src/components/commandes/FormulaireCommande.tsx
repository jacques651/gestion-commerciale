// src/components/commandes/FormulaireCommande.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Select,
  TextInput,
  NumberInput,
  Table,
  Badge,
  LoadingOverlay,
  Box,
  Divider,
  Alert,
  ScrollArea,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconUser,
  IconPhone,
  IconBuildingStore,
  IconPackage,
  IconTrash,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface Client {
  idClient: number;
  nom_complet: string;
  telephone: string;
  type_client: string;
}

interface Produit {
  idProduit: number;
  designation: string;
  unite_base: string;
  prix_vente_detail: number;
  qte_stock: number;
  categorie: string;
}

interface PanierItem {
  idProduit: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
}

interface FormulaireCommandeProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const FormulaireCommande: React.FC<FormulaireCommandeProps> = ({ onSuccess, onCancel }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitsFiltres, setProduitsFiltres] = useState<Produit[]>([]);
  const [panier, setPanier] = useState<PanierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [typeCommande, setTypeCommande] = useState<string>('SIMPLE');
  const [dateCommande, setDateCommande] = useState(new Date().toISOString().split('T')[0]);

  // Charger les clients
  useEffect(() => {
    const loadClients = async () => {
      const db = await getDb();
      const result = await db.select<Client[]>(`
        SELECT idClient, nom_complet, telephone, type_client
        FROM clients WHERE est_supprime = 0 ORDER BY nom_complet
      `);
      setClients(result);
      setLoading(false);
    };
    loadClients();
  }, []);

  // Charger les produits
  useEffect(() => {
    const loadProduits = async () => {
      const db = await getDb();
      const result = await db.select<Produit[]>(`
        SELECT idProduit, designation, unite_base, prix_vente_detail, qte_stock, categorie
        FROM products WHERE est_supprime = 0 AND qte_stock > 0
        ORDER BY designation
      `);
      setProduits(result);
      setProduitsFiltres(result);
      const uniqueCategories = [...new Set(result.map(p => p.categorie).filter(Boolean))];
      setCategories(uniqueCategories);
    };
    loadProduits();
  }, []);

  // Filtrer les produits
  useEffect(() => {
    let filtered = [...produits];
    if (recherche) {
      filtered = filtered.filter(p => p.designation.toLowerCase().includes(recherche.toLowerCase()));
    }
    if (filtreCategorie) {
      filtered = filtered.filter(p => p.categorie === filtreCategorie);
    }
    setProduitsFiltres(filtered);
  }, [recherche, filtreCategorie, produits]);

  const handleClientChange = (value: string | null) => {
    if (!value) {
      setSelectedClient(null);
      return;
    }
    const client = clients.find(c => c.idClient.toString() === value);
    setSelectedClient(client || null);
    // Si le client est revendeur, forcer le type de commande
    if (client?.type_client === 'REVENDEUR') {
      setTypeCommande('REVENDEUR');
    }
  };

  const ajouterAuPanier = (produit: Produit, quantite: number) => {
    if (quantite <= 0) return;
    if (quantite > produit.qte_stock) {
      setError(`Stock insuffisant. Maximum: ${produit.qte_stock}`);
      return;
    }

    const existingIndex = panier.findIndex(p => p.idProduit === produit.idProduit);
    
    if (existingIndex >= 0) {
      const newQuantite = panier[existingIndex].quantite + quantite;
      if (newQuantite > produit.qte_stock) {
        setError(`Quantité totale (${newQuantite}) dépasse le stock (${produit.qte_stock})`);
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
        prix_unitaire: produit.prix_vente_detail,
        total: quantite * produit.prix_vente_detail,
      }]);
    }
    setError('');
  };

  const retirerDuPanier = (index: number) => {
    const updated = [...panier];
    updated.splice(index, 1);
    setPanier(updated);
  };

  const totalHT = panier.reduce((sum, item) => sum + item.total, 0);
  const [quantiteInput, setQuantiteInput] = useState<Record<number, number>>({});

  const handleSubmit = async () => {
    if (!selectedClient) {
      setError('Veuillez sélectionner un client');
      return;
    }
    if (panier.length === 0) {
      setError('Veuillez ajouter des produits à la commande');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const db = await getDb();
      const codeCommande = `CMD-${Date.now()}`;

      // Insérer la commande
      await db.execute(`
        INSERT INTO commandes (code_commande, idClient, type_commande, date_commande, montant_ht, montant_ttc, statut)
        VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMEE')
      `, [codeCommande, selectedClient.idClient, typeCommande, dateCommande, totalHT, totalHT]);

      const commandeResult = await db.select<{ idCommande: number }[]>(
        "SELECT idCommande FROM commandes WHERE code_commande = ?",
        [codeCommande]
      );
      const idCommande = commandeResult[0]?.idCommande;

      // Insérer les détails et mettre à jour le stock
      for (const item of panier) {
        await db.execute(`
          INSERT INTO commande_details (idCommande, idProduit, qte_commande, prix_unitaire_vente)
          VALUES (?, ?, ?, ?)
        `, [idCommande, item.idProduit, item.quantite, item.prix_unitaire]);

        // Mettre à jour le stock
        await db.execute(`
          UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?
        `, [item.quantite, item.idProduit]);
      }

      setSaving(false);
      onSuccess();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erreur lors de l\'enregistrement');
      setSaving(false);
    }
  };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* HEADER */}
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Group gap="xs"><IconPackage size={24} color="white" /><Title order={2} c="white">Nouvelle commande</Title></Group>
            <Button variant="light" color="white" leftSection={<IconArrowLeft size={16} />} onClick={onCancel}>Retour</Button>
          </Group>
        </Card>

        {/* CLIENT */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Informations client</Title>
          <Divider mb="md" />
          <Select
            label="Client"
            placeholder="Sélectionner un client"
            data={clients.map(c => ({ value: c.idClient.toString(), label: c.nom_complet }))}
            onChange={handleClientChange}
            leftSection={<IconUser size={16} />}
            required
            searchable
          />
          {selectedClient && (
            <Group mt="md">
              <Group gap="xs"><IconPhone size={14} /><Text size="sm">{selectedClient.telephone || 'Pas de téléphone'}</Text></Group>
              <Group gap="xs"><IconBuildingStore size={14} /><Text size="sm" tt="capitalize">{selectedClient.type_client}</Text></Group>
            </Group>
          )}
          <Select
            label="Type de commande"
            data={[
              { value: 'SIMPLE', label: 'Simple' },
              { value: 'REVENDEUR', label: 'Revendeur' },
            ]}
            value={typeCommande}
            onChange={(val) => setTypeCommande(val || 'SIMPLE')}
            mt="md"
            disabled={selectedClient?.type_client === 'REVENDEUR'}
          />
        </Card>

        {/* PRODUITS DISPONIBLES */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Produits disponibles</Title>
          <Divider mb="md" />
          <Group mb="md">
            <TextInput
              placeholder="Rechercher un produit..."
              leftSection={<IconSearch size={16} />}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Catégorie"
              data={[{ value: '', label: 'Toutes' }, ...categories.map(c => ({ value: c, label: c }))]}
              value={filtreCategorie}
              onChange={setFiltreCategorie}
              clearable
              style={{ width: 150 }}
            />
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => { setRecherche(''); setFiltreCategorie(null); }}>Actualiser</Button>
          </Group>
          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Désignation</Table.Th><Table.Th>Stock</Table.Th><Table.Th>Prix</Table.Th><Table.Th>Qté</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {produitsFiltres.map((p) => (
                  <Table.Tr key={p.idProduit}>
                    <Table.Td fw={500}>{p.designation}</Table.Td>
                    <Table.Td><Badge color={p.qte_stock <= 5 ? 'orange' : 'green'} variant="light">{p.qte_stock}</Badge></Table.Td>
                    <Table.Td>{p.prix_vente_detail.toLocaleString()} FCFA</Table.Td>
                    <Table.Td style={{ width: 100 }}>
                      <NumberInput size="xs" min={0} max={p.qte_stock} value={quantiteInput[p.idProduit] || 0} onChange={(val) => setQuantiteInput({ ...quantiteInput, [p.idProduit]: Number(val) })} />
                    </Table.Td>
                    <Table.Td><Button size="xs" variant="light" onClick={() => { ajouterAuPanier(p, quantiteInput[p.idProduit] || 0); setQuantiteInput({ ...quantiteInput, [p.idProduit]: 0 }); }}>Ajouter</Button></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {produitsFiltres.length === 0 && <Text ta="center" c="dimmed" py={40}>Aucun produit trouvé</Text>}
        </Card>

        {/* PANIER */}
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
                      <Table.Td>{item.prix_unitaire.toLocaleString()} FCFA</Table.Td>
                      <Table.Td fw={600}>{item.total.toLocaleString()} FCFA</Table.Td>
                      <Table.Td><ActionIcon color="red" onClick={() => retirerDuPanier(idx)}><IconTrash size={16} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Divider my="md" />
              <Group justify="flex-end">
                <Text fw={700} size="lg">Total : {totalHT.toLocaleString()} FCFA</Text>
              </Group>
            </>
          )}
          <Divider my="md" />
          <Group justify="space-between">
            <TextInput label="Date de commande" type="date" value={dateCommande} onChange={(e) => setDateCommande(e.target.value)} style={{ width: 200 }} />
            <Group>
              <Button variant="light" color="red" onClick={onCancel}>Annuler</Button>
              <Button onClick={handleSubmit} loading={saving} leftSection={<IconDeviceFloppy size={16} />} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>Enregistrer la commande</Button>
            </Group>
          </Group>
          {error && <Alert color="red" mt="md">{error}</Alert>}
        </Card>
      </Stack>
    </Box>
  );
};

export default FormulaireCommande;