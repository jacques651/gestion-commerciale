// src/components/utilisateurs/ListeUtilisateurs.tsx
import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon,
  Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, TextInput, Select, PasswordInput, Paper, Flex, Avatar,
  Loader, Alert
} from "@mantine/core";
import {
  IconUsers, IconPlus, IconEdit, IconTrash, IconSearch, IconInfoCircle,
  IconUserShield, IconUserCheck, IconUser, IconBuildingStore, IconCash,
  IconRefresh, IconX, IconAlertCircle, IconLock, IconMail
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import bcrypt from "bcryptjs";
import { notifications } from "@mantine/notifications";

interface Utilisateur {
  id: number;
  nom: string;
  email: string; // email sert de login
  mot_de_passe: string;
  role: string;
  telephone: string;
  created_at: string;
}

const ListeUtilisateurs: React.FC = () => {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [roleFiltre, setRoleFiltre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Utilisateur | null>(null);
  const [editing, setEditing] = useState<Utilisateur | null>(null);
  const [formData, setFormData] = useState({
    nom: "",
    email: "",
    login: "",
    password: "",
    role: "commercial",
    telephone: ""
  });
  const [saving, setSaving] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const itemsPerPage = 10;

  const chargerUtilisateurs = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<Utilisateur[]>(`
        SELECT id, nom, email, mot_de_passe, role, telephone, created_at 
        FROM users 
        ORDER BY nom
      `);
      setUtilisateurs(result || []);
    } catch (error) {
      console.error("Erreur chargement:", error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerUtilisateurs(); }, []);

  const handleSave = async () => {
    if (!formData.nom.trim() || !formData.login.trim()) {
      notifications.show({ title: 'Erreur', message: "Nom et login obligatoires", color: 'red' });
      return;
    }
    if (!editing && !formData.password.trim()) {
      notifications.show({ title: 'Erreur', message: "Mot de passe obligatoire", color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const db = await getDb();
      
      // Vérifier si le login existe déjà
      const existing = await db.select<any[]>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [formData.login, editing?.id || 0]
      );
      
      if (existing && existing.length > 0) {
        notifications.show({ 
          title: 'Erreur', 
          message: 'Ce login existe déjà', 
          color: 'red' 
        });
        setSaving(false);
        return;
      }

      if (editing) {
        if (formData.password) {
          // Si un nouveau mot de passe est fourni, le hasher
          const hash = await bcrypt.hash(formData.password, 10);
          await db.execute(`
            UPDATE users 
            SET nom=?, email=?, mot_de_passe=?, role=?, telephone=? 
            WHERE id=?
          `, [formData.nom, formData.login, hash, formData.role, formData.telephone, editing.id]);
        } else {
          // Garder l'ancien mot de passe
          await db.execute(`
            UPDATE users 
            SET nom=?, email=?, role=?, telephone=? 
            WHERE id=?
          `, [formData.nom, formData.login, formData.role, formData.telephone, editing.id]);
        }
        notifications.show({ title: 'Succès', message: 'Utilisateur modifié', color: 'green' });
      } else {
        const hash = await bcrypt.hash(formData.password, 10);
        await db.execute(`
          INSERT INTO users (nom, email, mot_de_passe, role, telephone) 
          VALUES (?, ?, ?, ?, ?)
        `, [formData.nom, formData.login, hash, formData.role, formData.telephone]);
        notifications.show({ title: 'Succès', message: 'Utilisateur créé', color: 'green' });
      }
      setModalOpen(false);
      setEditing(null);
      setFormData({ nom: "", email: "", login: "", password: "", role: "commercial", telephone: "" });
      chargerUtilisateurs();
    } catch (err) {
      console.error(err);
      notifications.show({ title: 'Erreur', message: "Erreur lors de l'enregistrement", color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (user: Utilisateur) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const db = await getDb();
      await db.execute("DELETE FROM users WHERE id = ?", [selectedUser.id]);
      notifications.show({ title: 'Succès', message: 'Utilisateur supprimé', color: 'green' });
      setDeleteModalOpen(false);
      setSelectedUser(null);
      chargerUtilisateurs();
    } catch (err) {
      notifications.show({ title: 'Erreur', message: "Erreur lors de la suppression", color: 'red' });
    }
  };

  const utilisateursFiltres = utilisateurs.filter(u => {
    const matchRecherche = recherche === "" ||
      u.nom?.toLowerCase().includes(recherche.toLowerCase()) ||
      u.email?.toLowerCase().includes(recherche.toLowerCase());
    const matchRole = !roleFiltre || u.role === roleFiltre;
    return matchRecherche && matchRole;
  });

  const totalPages = Math.ceil(utilisateursFiltres.length / itemsPerPage);
  const paginatedData = utilisateursFiltres.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const roleColors: Record<string, string> = {
    admin: "red",
    gestionnaire: "orange",
    caissier: "green",
    commercial: "blue"
  };

  const roleIcons: Record<string, React.ReactNode> = {
    admin: <IconUserShield size={12} />,
    gestionnaire: <IconUserCheck size={12} />,
    caissier: <IconCash size={12} />,
    commercial: <IconBuildingStore size={12} />
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    gestionnaire: "Gestionnaire",
    caissier: "Caissier",
    commercial: "Commercial"
  };

  const stats = {
    total: utilisateurs.length,
    admins: utilisateurs.filter(u => u.role === "admin").length,
    gestionnaires: utilisateurs.filter(u => u.role === "gestionnaire").length,
    commerciaux: utilisateurs.filter(u => u.role === "commercial").length
  };

  const resetFilters = () => {
    setRecherche("");
    setRoleFiltre(null);
    setCurrentPage(1);
  };

  if (loading && utilisateurs.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des utilisateurs...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconUsers size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Utilisateurs</Title>
                  <Text c="gray.3" size="sm">Gestion des accès et autorisations</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                variant="light"
                color="white"
                leftSection={<IconInfoCircle size={18} />}
                onClick={() => setInfoModalOpen(true)}
              >
                Instructions
              </Button>
            </Group>
          </Flex>

          {/* Cartes statistiques */}
          <SimpleGrid cols={4} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total utilisateurs</Text>
                  <Text c="white" fw={700} size="xl">{stats.total}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="red" variant="light" size="lg">
                  <IconUserShield size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Administrateurs</Text>
                  <Text c="white" fw={700} size="xl">{stats.admins}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Gestionnaires</Text>
                  <Text c="white" fw={700} size="xl">{stats.gestionnaires}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg">
                  <IconUser size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Commerciaux</Text>
                  <Text c="white" fw={700} size="xl">{stats.commerciaux}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* Barre d'outils */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Flex justify="space-between" align="flex-end" wrap="wrap" gap="md">
            <Group grow style={{ flex: 2 }}>
              <TextInput
                placeholder="Rechercher par nom ou login..."
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setCurrentPage(1); }}
                size="md"
              />
              <Select
                placeholder="Rôle"
                data={[
                  { value: "", label: "Tous les rôles" },
                  { value: "admin", label: "Admin" },
                  { value: "gestionnaire", label: "Gestionnaire" },
                  { value: "caissier", label: "Caissier" },
                  { value: "commercial", label: "Commercial" }
                ]}
                value={roleFiltre}
                onChange={setRoleFiltre}
                size="md"
                clearable
                style={{ width: 180 }}
              />
            </Group>
            <Group>
              <Tooltip label="Actualiser">
                <ActionIcon variant="light" onClick={chargerUtilisateurs} size="lg" color="blue">
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditing(null);
                  setFormData({ nom: "", email: "", login: "", password: "", role: "commercial", telephone: "" });
                  setModalOpen(true);
                }}
                variant="gradient"
                gradient={{ from: "blue", to: "cyan" }}
                size="md"
              >
                Nouvel utilisateur
              </Button>
            </Group>
          </Flex>
        </Card>

        {/* Tableau des utilisateurs */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Paper bg="gray.0" p="md" style={{ borderBottom: '1px solid #e5e7eb' }}>
            <Flex justify="space-between" align="center">
              <Group>
                <IconUsers size={20} color="#1b365d" />
                <Title order={3} size="h4">Liste des utilisateurs</Title>
                <Badge size="lg" variant="light" color="blue">{utilisateursFiltres.length} utilisateurs</Badge>
              </Group>
              <Button variant="subtle" onClick={resetFilters} size="sm" leftSection={<IconX size={14} />}>
                Réinitialiser
              </Button>
            </Flex>
          </Paper>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr style={{background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)', }}>
                  <Table.Th c="white">Utilisateur</Table.Th>
                  <Table.Th c="white">Login</Table.Th>
                  <Table.Th c="white">Rôle</Table.Th>
                  <Table.Th c="white" ta="center" w={120}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedData.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="md" radius="xl" color="blue">
                          {u.nom?.charAt(0).toUpperCase() || "U"}
                        </Avatar>
                        <div>
                          <Text fw={600} size="sm">{u.nom}</Text>
                          <Text size="xs" c="dimmed">{u.telephone || 'Pas de téléphone'}</Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <IconUser size={12} color="#1b365d" />
                        <Text size="sm">{u.email}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="md"
                        color={roleColors[u.role] || "gray"}
                        variant="light"
                        leftSection={roleIcons[u.role]}
                      >
                        {roleLabels[u.role] || u.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap={6} justify="center">
                        <Tooltip label="Modifier">
                          <ActionIcon
                            variant="light"
                            color="orange"
                            size="md"
                            onClick={() => {
                              setEditing(u);
                              setFormData({
                                nom: u.nom || "",
                                email: u.email || "",
                                login: u.email || "",
                                password: "",
                                role: u.role || "commercial",
                                telephone: u.telephone || ""
                              });
                              setModalOpen(true);
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="md"
                            onClick={() => handleDeleteClick(u)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>

          {utilisateursFiltres.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconUsers size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucun utilisateur trouvé</Text>
              <Button
                mt="md"
                variant="light"
                onClick={() => {
                  setEditing(null);
                  setFormData({ nom: "", email: "", login: "", password: "", role: "commercial", telephone: "" });
                  setModalOpen(true);
                }}
                leftSection={<IconPlus size={16} />}
              >
                Ajouter un utilisateur
              </Button>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size="md"
              />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL UTILISATEUR */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={
          <Group gap="md">
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconUserShield size={24} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="white">{editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</Text>
              <Text size="xs" c="gray.4">
                {editing ? "Modifiez les informations de l'utilisateur" : "Créez un nouveau compte utilisateur"}
              </Text>
            </div>
          </Group>
        }
        size="md"
        centered
        padding="xl"
        styles={{
          header: { backgroundColor: '#1b365d', padding: '20px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 700, fontSize: '1.2rem', width: '100%' },
          body: { padding: 0 }
        }}
      >
        <Paper p="xl" radius={0}>
          <Stack gap="md">
            <TextInput
              label="Nom complet"
              placeholder="Nom de l'utilisateur"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
              size="md"
            />

            <TextInput
              label="Login (identifiant)"
              placeholder="Nom d'utilisateur pour la connexion"
              value={formData.login}
              onChange={(e) => setFormData({ ...formData, login: e.target.value })}
              required
              size="md"
              leftSection={<IconUser size={16} />}
              description="Utilisé pour se connecter à l'application"
            />

            <TextInput
              label="Téléphone"
              placeholder="Numéro de téléphone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              size="md"
              leftSection={<IconMail size={16} />}
            />

            <PasswordInput
              label="Mot de passe"
              placeholder={editing ? "Laisser vide pour conserver" : "Nouveau mot de passe"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editing}
              size="md"
              leftSection={<IconLock size={16} />}
            />

            <Select
              label="Rôle"
              placeholder="Sélectionner un rôle"
              data={[
                { value: "admin", label: "👑 Admin - Accès total" },
                { value: "gestionnaire", label: "📊 Gestionnaire - Gestion commerciale" },
                { value: "caissier", label: "💰 Caissier - Ventes uniquement" },
                { value: "commercial", label: "🏪 Commercial - Clients et commandes" }
              ]}
              value={formData.role}
              onChange={(val) => setFormData({ ...formData, role: val || "commercial" })}
              size="md"
            />

            <Divider />

            <Group justify="flex-end">
              <Button variant="outline" onClick={() => setModalOpen(false)} size="md">
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
                variant="gradient"
                gradient={{ from: "blue", to: "cyan" }}
                size="md"
              >
                {editing ? "Modifier" : "Créer"}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Modal>

      {/* MODAL CONFIRMATION SUPPRESSION */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Supprimer l'utilisateur"
        centered
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack>
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Attention !">
            Êtes-vous sûr de vouloir supprimer cet utilisateur ?
            <Text size="sm" mt="md" c="red">
              Cette action est irréversible !
            </Text>
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Annuler
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL INSTRUCTIONS */}
      <Modal
        opened={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="📋 Instructions"
        size="md"
        centered
        styles={{
          header: { backgroundColor: "#1b365d", padding: "16px 20px", borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: "white", fontWeight: 600 },
          body: { padding: "20px" }
        }}
      >
        <Stack gap="md">
          <Text size="sm">1. Créez des utilisateurs avec différents rôles</Text>
          <Text size="sm">2. Admin : accès total à l'application</Text>
          <Text size="sm">3. Gestionnaire : gestion commerciale (clients, commandes, factures)</Text>
          <Text size="sm">4. Caissier : accès aux ventes uniquement</Text>
          <Text size="sm">5. Commercial : gestion des clients et commandes</Text>
          <Divider />
          <Text size="xs" c="dimmed" ta="center">Version 1.0.0 - Gestion Commerciale Pro</Text>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeUtilisateurs;