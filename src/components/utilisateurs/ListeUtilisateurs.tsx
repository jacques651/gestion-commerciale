import React, { useEffect, useState } from "react";
import { Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon, LoadingOverlay, Box, Pagination, Tooltip, Modal, Divider, ThemeIcon, SimpleGrid, TextInput, Select, PasswordInput } from "@mantine/core";
import { IconUsers, IconPlus, IconEdit, IconTrash, IconSearch, IconInfoCircle, IconUserShield } from "@tabler/icons-react";
import { getDb } from "../../database/db";
import bcrypt from "bcryptjs";

interface Utilisateur { id: number; nom: string; login: string; role: string; est_actif: number; }

const ListeUtilisateurs: React.FC = () => {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Utilisateur | null>(null);
  const [formData, setFormData] = useState({ nom: "", login: "", password: "", role: "commercial" });
  const [saving, setSaving] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerUtilisateurs = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<Utilisateur[]>("SELECT id, nom, login, role, est_actif FROM utilisateurs ORDER BY nom");
    setUtilisateurs(result || []);
    setLoading(false);
  };

  useEffect(() => { chargerUtilisateurs(); }, []);

  const handleSave = async () => {
    if (!formData.nom.trim() || !formData.login.trim()) { alert("Nom et login obligatoires"); return; }
    if (!editing && !formData.password.trim()) { alert("Mot de passe obligatoire"); return; }
    setSaving(true);
    try {
      const db = await getDb();
      if (editing) {
        if (formData.password) {
          const hash = await bcrypt.hash(formData.password, 10);
          await db.execute("UPDATE utilisateurs SET nom=?, login=?, role=?, mot_de_passe_hash=? WHERE id=?", [formData.nom, formData.login, formData.role, hash, editing.id]);
        } else {
          await db.execute("UPDATE utilisateurs SET nom=?, login=?, role=? WHERE id=?", [formData.nom, formData.login, formData.role, editing.id]);
        }
      } else {
        const hash = await bcrypt.hash(formData.password, 10);
        await db.execute("INSERT INTO utilisateurs (nom, login, mot_de_passe_hash, role, est_actif) VALUES (?, ?, ?, ?, 1)", [formData.nom, formData.login, hash, formData.role]);
      }
      setModalOpen(false); setEditing(null); setFormData({ nom: "", login: "", password: "", role: "commercial" });
      chargerUtilisateurs();
    } catch (err) { console.error(err); alert("Erreur"); }
    finally { setSaving(false); }
  };

  const supprimer = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM utilisateurs WHERE id = ?", [id]);
    chargerUtilisateurs();
  };

  const utilisateursFiltres = utilisateurs.filter(u => u.nom.toLowerCase().includes(recherche.toLowerCase()) || u.login.toLowerCase().includes(recherche.toLowerCase()));
  const totalPages = Math.ceil(utilisateursFiltres.length / itemsPerPage);
  const paginatedData = utilisateursFiltres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const roleColors: Record<string, string> = { admin: "red", gestionnaire: "orange", caissier: "green", commercial: "blue" };

  if (loading) return <Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d"><Group justify="space-between"><Stack gap={4}><Group gap="xs"><IconUsers size={24} color="white" /><Title order={2} c="white">Utilisateurs</Title></Group><Text size="sm" c="gray.3">Gestion des accès</Text></Stack><Group gap="md"><Button variant="light" color="white" leftSection={<IconInfoCircle size={18} />} onClick={() => setInfoModalOpen(true)}>Instructions</Button><ThemeIcon size={48} radius="md" color="white" variant="light"><IconUsers size={28} /></ThemeIcon></Group></Group></Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Total utilisateurs</Text><ThemeIcon size={30} color="blue" variant="light"><IconUsers size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="blue">{utilisateurs.length}</Text></Card>
          <Card withBorder radius="md" p="md" bg="red.0"><Group justify="space-between" mb="xs"><Text size="xs" c="dimmed">Administrateurs</Text><ThemeIcon size={30} color="red" variant="light"><IconUserShield size={18} /></ThemeIcon></Group><Text fw={700} size="xl" c="red">{utilisateurs.filter(u => u.role === "admin").length}</Text></Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md"><Group justify="space-between"><TextInput placeholder="Rechercher..." leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }} size="sm" style={{ width: 300 }} /><Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setFormData({ nom: "", login: "", password: "", role: "commercial" }); setModalOpen(true); }} variant="gradient" gradient={{ from: "blue", to: "cyan" }}>Nouvel utilisateur</Button></Group></Card>

        <Card withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover><Table.Thead style={{ backgroundColor: "#1b365d" }}><Table.Tr><Table.Th style={{ color: "white" }}>Nom</Table.Th><Table.Th style={{ color: "white" }}>Login</Table.Th><Table.Th style={{ color: "white" }}>Rôle</Table.Th><Table.Th style={{ textAlign: "center", color: "white" }}>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{paginatedData.map((u) => (<Table.Tr key={u.id}><Table.Td fw={500}>{u.nom}</Table.Td><Table.Td>{u.login}</Table.Td><Table.Td><Badge color={roleColors[u.role] || "gray"} variant="light" size="sm">{u.role}</Badge></Table.Td><Table.Td><Group gap={6} justify="center"><Tooltip label="Modifier"><ActionIcon size="sm" color="orange" onClick={() => { setEditing(u); setFormData({ nom: u.nom, login: u.login, password: "", role: u.role }); setModalOpen(true); }}><IconEdit size={16} /></ActionIcon></Tooltip><Tooltip label="Supprimer"><ActionIcon size="sm" color="red" onClick={() => supprimer(u.id)}><IconTrash size={16} /></ActionIcon></Tooltip></Group></Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
          {totalPages > 1 && <Group justify="center" p="md"><Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} color="blue" size="sm" /></Group>}
        </Card>

        <Modal opened={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"} size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack><TextInput label="Nom" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required /><TextInput label="Login" value={formData.login} onChange={(e) => setFormData({ ...formData, login: e.target.value })} required /><PasswordInput label="Mot de passe" placeholder={editing ? "Laisser vide pour conserver" : "Nouveau mot de passe"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editing} /><Select label="Rôle" data={[{ value: "admin", label: "👑 Admin" }, { value: "gestionnaire", label: "📊 Gestionnaire" }, { value: "caissier", label: "💰 Caissier" }, { value: "commercial", label: "🏪 Commercial" }]} value={formData.role} onChange={(val) => setFormData({ ...formData, role: val || "commercial" })} /><Divider /><Group justify="flex-end"><Button variant="light" onClick={() => setModalOpen(false)}>Annuler</Button><Button onClick={handleSave} loading={saving}>Enregistrer</Button></Group></Stack>
        </Modal>

        <Modal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} title="📋 Instructions" size="md" centered styles={{ header: { backgroundColor: "#1b365d", padding: "16px 20px" }, title: { color: "white", fontWeight: 600 }, body: { padding: "20px" } }}>
          <Stack gap="md"><Text size="sm">1. Créez des utilisateurs avec différents rôles</Text><Text size="sm">2. Admin: accès total / Gestionnaire: gestion commerciale / Caissier: ventes / Commercial: clients</Text><Divider /><Text size="xs" c="dimmed" ta="center">Version 1.0.0</Text></Stack>
        </Modal>
      </Stack>
    </Box>
  );
};

export default ListeUtilisateurs;