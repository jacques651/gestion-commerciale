import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput
} from "@mantine/core";
import {
  IconBuildingStore, IconTrash, IconSearch, IconRefresh,
  IconInfoCircle, IconCalendar, IconCash, IconPlus, IconPrinter
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import FormulaireVente from "./FormulaireVente";
import ReçuVente from "./ReçuVente";

interface Vente {
  idVente: number;
  code_vente: string;
  idClient: number;
  client_nom: string;
  nom_prenom: string;
  contact: string;
  date_vente: string;
  montant_total: number;
  type_vente: string;
}

const ListeVentes: React.FC = () => {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [showReçu, setShowReçu] = useState(false);
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerVentes = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Vente[]>(`
      SELECT v.*, c.nom_complet as client_nom
      FROM ventes v
      LEFT JOIN clients c ON v.idClient = c.idClient
      ORDER BY v.date_vente DESC
    `);
    setVentes(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerVentes(); }, []);

  const supprimerVente = async (id: number) => {
    if (!confirm("Supprimer cette vente ?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM ventes WHERE idVente = ?", [id]);
    chargerVentes();
  };

  const handlePrintReçu = (vente: Vente) => {
    setSelectedVente(vente);
    setShowReçu(true);
  };

  const ventesFiltrees = ventes.filter(v =>
    v.code_vente.toLowerCase().includes(recherche.toLowerCase()) ||
    (v.client_nom && v.client_nom.toLowerCase().includes(recherche.toLowerCase())) ||
    v.nom_prenom.toLowerCase().includes(recherche.toLowerCase())
  );

  const totalPages = Math.ceil(ventesFiltrees.length / itemsPerPage);
  const paginatedData = ventesFiltrees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalMontant = ventesFiltrees.reduce((sum, v) => sum + v.montant_total, 0);

  if (vueForm) return <FormulaireVente onSuccess={() => { setVueForm(false); chargerVentes(); }} onCancel={() => setVueForm(false)} />;
  if (showReçu && selectedVente) return <ReçuVente vente={selectedVente} onClose={() => setShowReçu(false)} />;
  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}><Group gap="xs"><IconBuildingStore size={24} color="white" /><Title order={2} c="white">Ventes au détail</Title></Group><Text size="sm" c="gray.3">Gestion des ventes directes</Text></Stack>
            <Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconBuildingStore size={28} /></ThemeIcon></Group>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Total ventes</Text><ThemeIcon size={30} color="blue" variant="light"><IconBuildingStore size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{ventes.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="green.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Chiffre d'affaires</Text><ThemeIcon size={30} color="green" variant="light"><IconCash size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{totalMontant.toLocaleString()} FCFA</Text></Card>
          <Card withBorder radius="md" p="md" bg="orange.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Ventes du jour</Text><ThemeIcon size={30} color="orange" variant="light"><IconCalendar size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="orange">{ventes.filter(v => new Date(v.date_vente).toDateString() === new Date().toDateString()).length}</Text></Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Group>
              <TextInput placeholder="Rechercher client..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 250 }} />
              <Select placeholder="Type" data={[{ value: "", label: "Tous" }, { value: "COMPTOIR", label: "Comptoir" }, { value: "REVENDEUR", label: "Revendeur" }]} value={typeFiltre} onChange={setTypeFiltre} size="sm" style={{ width: 130 }} clearable />
            </Group>
            <Group>
              <Tooltip label="Actualiser"><ActionIcon variant="light" onClick={() => chargerVentes()} size="lg"><IconRefresh size={18} /></ActionIcon></Tooltip>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setVueForm(true)} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Nouvelle vente</Button>
            </Group>
          </Group>
        </Card>

        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover>
              <Table.Thead style={{ backgroundColor: "#1b365d" }}>
                <Table.Tr>
                  <Table.Th style={{ color: "white" }}>N°</Table.Th>
                  <Table.Th style={{ color: "white" }}>Client</Table.Th>
                  <Table.Th style={{ color: "white" }}>Contact</Table.Th>
                  <Table.Th style={{ color: "white" }}>Date</Table.Th>
                  <Table.Th style={{ color: "white", textAlign: "right" }}>Montant</Table.Th>
                  <Table.Th style={{ color: "white", textAlign: "center" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedData.map((v, idx) => (
                  <Table.Tr key={v.idVente}>
                    <Table.Td>{(currentPage - 1) * itemsPerPage + idx + 1}</Table.Td>
                    <Table.Td fw={500}>{v.client_nom || v.nom_prenom}</Table.Td>
                    <Table.Td>{v.contact || "-"}</Table.Td>
                    <Table.Td><Group gap={4}><IconCalendar size={12} /><Text size="sm">{new Date(v.date_vente).toLocaleDateString("fr-FR")}</Text></Group></Table.Td>
                    <Table.Td ta="right" fw={600}>{v.montant_total.toLocaleString()} FCFA</Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="center">
                        <Tooltip label="Imprimer reçu"><ActionIcon size="sm" color="teal" onClick={() => handlePrintReçu(v)}><IconPrinter size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Supprimer"><ActionIcon size="sm" color="red" onClick={() => supprimerVente(v.idVente)}><IconTrash size={16} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
          {totalPages > 1 && <Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>}
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack gap="md"><Text size="sm">1. Enregistrez les ventes au comptoir</Text><Text size="sm">2. Imprimez le reçu pour le client</Text><Text size="sm">3. Le stock est mis à jour automatiquement</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeVentes;