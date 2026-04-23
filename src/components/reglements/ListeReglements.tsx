import React, { useEffect, useState } from "react";
import { Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon, LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon, SimpleGrid, Select, TextInput } from "@mantine/core";
import { IconMoneybag, IconEye, IconSearch, IconInfoCircle, IconCalendar, IconCash, IconPlus } from "@tabler/icons-react";
import { getDb } from "../../database/db";
import FormulaireReglement from "./FormulaireReglement";

interface Reglement {
  idReglement: number;
  code_reglement: string;
  idClient: number;
  client_nom: string;
  date_reglement: string;
  montant_regle: number;
  mode_reglement: string;
  reference: string;
}

const ListeReglements: React.FC = () => {
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [modeFiltre, setModeFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [vueForm, setVueForm] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerReglements = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Reglement[]>(`
      SELECT r.*, c.nom_complet as client_nom 
      FROM reglements r 
      LEFT JOIN clients c ON r.idClient = c.idClient 
      ORDER BY r.date_reglement DESC
    `);
    setReglements(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerReglements(); }, []);

  const reglementsFiltres = reglements.filter(r => 
    r.code_reglement.toLowerCase().includes(recherche.toLowerCase()) ||
    (r.client_nom && r.client_nom.toLowerCase().includes(recherche.toLowerCase()))
  );
  const totalPages = Math.ceil(reglementsFiltres.length / itemsPerPage);
  const paginatedData = reglementsFiltres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalMontant = reglementsFiltres.reduce((sum, r) => sum + r.montant_regle, 0);

  if (vueForm) return <FormulaireReglement onSuccess={() => { setVueForm(false); chargerReglements(); }} onCancel={() => setVueForm(false)} />;
  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Stack gap={4}><Group gap="xs"><IconMoneybag size={24} color="white" /><Title order={2} c="white">Règlements</Title></Group><Text size="sm" c="gray.3">Suivi des paiements</Text></Stack>
            <Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconMoneybag size={28} /></ThemeIcon></Group>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Total encaissé</Text><ThemeIcon size={30} color="green" variant="light"><IconCash size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="green">{totalMontant.toLocaleString()} FCFA</Text></Card>
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Nombre de règlements</Text><ThemeIcon size={30} color="blue" variant="light"><IconMoneybag size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{reglements.length}</Text></Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Group>
              <TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 250 }} />
              <Select placeholder="Mode" data={[{ value: "", label: "Tous" }, { value: "ESPECES", label: "Espèces" }, { value: "MOBILE_MONEY", label: "Mobile Money" }, { value: "VIREMENT", label: "Virement" }, { value: "CHEQUE", label: "Chèque" }]} value={modeFiltre} onChange={setModeFiltre} size="sm" style={{ width: 130 }} clearable />
            </Group>
            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setVueForm(true)} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Nouveau règlement</Button>
            </Group>
          </Group>
        </Card>

        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover>
            <Table.Thead style={{ backgroundColor: "#1b365d" }}><Table.Tr><Table.Th style={{ color: "white" }}>Code</Table.Th><Table.Th style={{ color: "white" }}>Client</Table.Th><Table.Th style={{ color: "white" }}>Date</Table.Th><Table.Th style={{ color: "white" }}>Mode</Table.Th><Table.Th style={{ color: "white", textAlign: "right" }}>Montant</Table.Th><Table.Th style={{ color: "white", textAlign: "center" }}>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{paginatedData.map((r) => (<Table.Tr key={r.idReglement}><Table.Td><Badge color="gray" variant="light" size="sm">{r.code_reglement}</Badge></Table.Td><Table.Td fw={500}>{r.client_nom || "-"}</Table.Td><Table.Td><Group gap={4}><IconCalendar size={12} /><Text size="sm">{new Date(r.date_reglement).toLocaleDateString("fr-FR")}</Text></Group></Table.Td><Table.Td><Badge color="blue" variant="light" size="sm">{r.mode_reglement}</Badge></Table.Td><Table.Td ta="right" fw={600} c="green">{r.montant_regle.toLocaleString()} FCFA</Table.Td><Table.Td><Tooltip label="Voir"><ActionIcon size="sm" color="blue"><IconEye size={16} /></ActionIcon></Tooltip></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          {totalPages > 1 && <Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>}
        </Card>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack gap="md"><Text size="sm">1. Enregistrez les paiements des clients</Text><Text size="sm">2. Associez le règlement à une facture ou un décompte</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeReglements;