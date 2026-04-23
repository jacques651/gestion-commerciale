import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Button, TextInput, Table, Badge,
  ActionIcon, LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider,
  ThemeIcon, SimpleGrid, Select
} from "@mantine/core";
import {
  IconPackage, IconPlus, IconEdit, IconTrash, IconSearch, 
  IconInfoCircle, IconCategory
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import FormulaireProduit from "./FormulaireProduit";

interface Produit {
  idProduit: number;
  code_produit: string;
  categorie: string;
  designation: string;
  unite_base: string;
  prix_achat_base: number;
  prix_vente_detail: number;
  prix_vente_gros: number;
  seuil_alerte: number;
  qte_stock: number;
}

const ListeProduits: React.FC = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [produitEdition, setProduitEdition] = useState<Produit | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerProduits = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Produit[]>("SELECT * FROM products WHERE est_supprime = 0 ORDER BY designation");
    setProduits(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerProduits(); }, []);

  const supprimerProduit = async (id: number) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const db = await getDb();
    await db.execute("UPDATE products SET est_supprime = 1 WHERE idProduit = ?", [id]);
    chargerProduits();
  };

  const categories = [...new Set(produits.map(p => p.categorie).filter(Boolean))];
  const produitsFiltres = produits.filter(p => p.designation.toLowerCase().includes(recherche.toLowerCase()) && (!categorieFiltre || p.categorie === categorieFiltre));
  const totalPages = Math.ceil(produitsFiltres.length / itemsPerPage);
  const paginatedData = produitsFiltres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (vueForm) return <FormulaireProduit produit={produitEdition || undefined} onSuccess={() => { setVueForm(false); setProduitEdition(null); chargerProduits(); }} onCancel={() => { setVueForm(false); setProduitEdition(null); }} />;

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}><Group gap="xs"><IconPackage size={24} color="white" /><Title order={2} c="white">Produits</Title></Group><Text size="sm" c="gray.3">Gestion des produits</Text></Stack>
            <Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconPackage size={28} /></ThemeIcon></Group>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Total produits</Text><ThemeIcon size={30} color="blue" variant="light"><IconPackage size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{produits.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="orange.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Catégories</Text><ThemeIcon size={30} color="orange" variant="light"><IconCategory size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="orange">{categories.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="green.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Valeur stock</Text><ThemeIcon size={30} color="green" variant="light"><IconPackage size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{produits.reduce((s, p) => s + p.qte_stock * p.prix_vente_detail, 0).toLocaleString()} FCFA</Text></Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between"><Group><TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 250 }} /><Select placeholder="Catégorie" data={[{ value: "", label: "Toutes" }, ...categories.map(c => ({ value: c, label: c }))]} value={categorieFiltre} onChange={setCategorieFiltre} size="sm" style={{ width: 150 }} clearable /></Group><Group><Button leftSection={<IconPlus size={16} />} onClick={() => { setProduitEdition(null); setVueForm(true); }} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Nouveau produit</Button></Group></Group>
        </Card>

        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: "#1b365d" }}><Table.Tr><Table.Th style={{ color: "white" }}>Code</Table.Th><Table.Th style={{ color: "white" }}>Désignation</Table.Th><Table.Th style={{ color: "white" }}>Catégorie</Table.Th><Table.Th style={{ color: "white", textAlign: "right" }}>Prix détail</Table.Th><Table.Th style={{ color: "white", textAlign: "center" }}>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{paginatedData.map((p) => (<Table.Tr key={p.idProduit}><Table.Td><Badge color="gray" variant="light" size="sm">{p.code_produit}</Badge></Table.Td><Table.Td fw={500}>{p.designation}</Table.Td><Table.Td>{p.categorie ? <Badge color="blue" variant="light" size="sm">{p.categorie}</Badge> : "-"}</Table.Td><Table.Td ta="right" fw={600}>{p.prix_vente_detail.toLocaleString()} FCFA</Table.Td><Table.Td><Group gap={6} justify="center"><Tooltip label="Modifier"><ActionIcon size="sm" color="orange" onClick={() => { setProduitEdition(p); setVueForm(true); }}><IconEdit size={16} /></ActionIcon></Tooltip><Tooltip label="Supprimer"><ActionIcon size="sm" color="red" onClick={() => supprimerProduit(p.idProduit)}><IconTrash size={16} /></ActionIcon></Tooltip></Group></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          {totalPages > 1 && <Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>}
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}><Stack gap="md"><Text size="sm">1. Ajoutez des produits avec leurs prix</Text><Text size="sm">2. Le stock est mis à jour automatiquement</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack></Modal>
      </Stack>
    </Box>
  );
};

export default ListeProduits;