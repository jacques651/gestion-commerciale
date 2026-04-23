import React, { useEffect, useState } from "react";
import { Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon, LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon, SimpleGrid, Select, TextInput } from "@mantine/core";
import { IconFileText, IconEye, IconSearch, IconInfoCircle, IconCalendar, IconCash, IconPlus, IconClock } from "@tabler/icons-react";
import { getDb } from "../../database/db";
import NouveauDecompte from "./NouveauDecompte";

interface Decompte { idDecompte: number; code_decompte: string; idClient: number; client_nom: string; date_decompte: string; montant_ht: number; montant_ttc: number; statut: string; }

const ListeDecomptes: React.FC = () => {
  const [decomptes, setDecomptes] = useState<Decompte[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [statutFiltre, setStatutFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerDecomptes = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Decompte[]>("SELECT d.*, c.nom_complet as client_nom FROM decomptes d JOIN clients c ON d.idClient = c.idClient ORDER BY d.date_decompte DESC");
    setDecomptes(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerDecomptes(); }, []);

  const getStatutBadge = (statut: string) => {
    switch (statut) { case "EN_ATTENTE": return { label: "En attente", color: "orange" }; case "VALIDE": return { label: "Validé", color: "blue" }; case "PAYE": return { label: "Payé", color: "green" }; default: return { label: statut, color: "gray" }; }
  };

  const decomptesFiltres = decomptes.filter(d => d.code_decompte.toLowerCase().includes(recherche.toLowerCase()) || d.client_nom.toLowerCase().includes(recherche.toLowerCase()));
  const totalPages = Math.ceil(decomptesFiltres.length / itemsPerPage);
  const paginatedData = decomptesFiltres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalMontant = decomptesFiltres.reduce((sum, d) => sum + d.montant_ttc, 0);

  if (vueForm) return <NouveauDecompte onSuccess={() => { setVueForm(false); chargerDecomptes(); }} onCancel={() => setVueForm(false)} />;
  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d"><Group justify="space-between"><Stack gap={4}><Group gap="xs"><IconFileText size={24} color="white" /><Title order={2} c="white">Décomptes revendeurs</Title></Group><Text size="sm" c="gray.3">Gestion des décomptes</Text></Stack><Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconFileText size={28} /></ThemeIcon></Group></Group></Card>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md"><Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Total décomptes</Text><ThemeIcon size={30} color="blue" variant="light"><IconFileText size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{decomptes.length}</Text></Card><Card withBorder radius="md" p="md" bg="green.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Montant total</Text><ThemeIcon size={30} color="green" variant="light"><IconCash size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{totalMontant.toLocaleString()} FCFA</Text></Card><Card withBorder radius="md" p="md" bg="orange.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">En attente</Text><ThemeIcon size={30} color="orange" variant="light"><IconClock size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="orange">{decomptes.filter(d => d.statut === "EN_ATTENTE").length}</Text></Card></SimpleGrid>
        <Card withBorder radius="md" p="md"><Group justify="space-between"><Group><TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 250 }} /><Select placeholder="Statut" data={[{ value: "", label: "Tous" }, { value: "EN_ATTENTE", label: "En attente" }, { value: "VALIDE", label: "Validé" }, { value: "PAYE", label: "Payé" }]} value={statutFiltre} onChange={setStatutFiltre} size="sm" style={{ width: 130 }} clearable /></Group><Group><Button leftSection={<IconPlus size={16} />} onClick={() => setVueForm(true)} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Nouveau décompte</Button></Group></Group></Card>
        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover><Table.Thead style={{ backgroundColor: "#1b365d" }}><Table.Tr><Table.Th style={{ color: "white" }}>Code</Table.Th><Table.Th style={{ color: "white" }}>Client</Table.Th><Table.Th style={{ color: "white" }}>Date</Table.Th><Table.Th style={{ color: "white", textAlign: "right" }}>Montant</Table.Th><Table.Th style={{ color: "white", textAlign: "center" }}>Statut</Table.Th><Table.Th style={{ color: "white", textAlign: "center" }}>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{paginatedData.map((d) => (<Table.Tr key={d.idDecompte}><Table.Td><Badge color="gray" variant="light" size="sm">{d.code_decompte}</Badge></Table.Td><Table.Td fw={500}>{d.client_nom}</Table.Td><Table.Td><Group gap={4}><IconCalendar size={12} /><Text size="sm">{new Date(d.date_decompte).toLocaleDateString("fr-FR")}</Text></Group></Table.Td><Table.Td ta="right" fw={600}>{d.montant_ttc.toLocaleString()} FCFA</Table.Td><Table.Td ta="center"><Badge color={getStatutBadge(d.statut).color} variant="light" size="sm">{getStatutBadge(d.statut).label}</Badge></Table.Td><Table.Td><Tooltip label="Voir"><ActionIcon size="sm" color="blue"><IconEye size={16} /></ActionIcon></Tooltip></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          {totalPages > 1 && <Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>}
        </Card>
        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}><Stack gap="md"><Text size="sm">1. Créez un décompte pour un revendeur</Text><Text size="sm">2. Sélectionnez les produits vendus</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack></Modal>
      </Stack>
    </Box>
  );
};

export default ListeDecomptes;