// src/components/utilisateurs/ListeUtilisateurs.tsx
import React, { useEffect, useState } from "react";
import {
  Stack, Card, Title, Text, Group, Button, Table, Badge, ActionIcon,
  Box, Pagination, Tooltip, Modal, Divider, ThemeIcon,
  SimpleGrid, TextInput, Select, PasswordInput, Paper, Flex, Avatar,
  Loader, Alert, Checkbox, ScrollArea, Grid, Chip
} from "@mantine/core";
import {
  IconUsers, IconPlus, IconEdit, IconTrash, IconSearch, IconInfoCircle,
  IconUserShield, IconUserCheck, IconUser, IconBuildingStore, IconCash,
  IconRefresh, IconX, IconAlertCircle, IconLock, IconMail,
  IconDashboard, IconPackage, IconShoppingCart, IconFileInvoice,
  IconTruck, IconReceipt, IconCreditCard, IconSettings, IconList,
  IconCheck, IconChevronDown, IconChevronRight,
  IconShieldCheck
} from "@tabler/icons-react";
import { getDb } from "../../database/db";
import bcrypt from "bcryptjs";
import { notifications } from "@mantine/notifications";

interface Utilisateur {
  id: number;
  nom: string;
  email: string;
  login: string;
  mot_de_passe: string;
  role: string;
  telephone: string;
  permissions: string;
  created_at: string;
}

interface Permission {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: string;
  defaultRoles: string[];
}

// =====================================================
// DÉFINITION DES PERMISSIONS
// =====================================================

const PERMISSIONS: Permission[] = [
  // Dashboard
  {
    id: 'dashboard.view',
    label: 'Voir le tableau de bord',
    icon: <IconDashboard size={16} />,
    description: 'Accès au tableau de bord principal',
    category: 'Tableau de bord',
    defaultRoles: ['admin', 'gestionnaire', 'commercial', 'caissier']
  },
  // Produits
  {
    id: 'products.view',
    label: 'Voir les produits',
    icon: <IconPackage size={16} />,
    description: 'Consulter la liste des produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire', 'commercial', 'caissier']
  },
  {
    id: 'products.create',
    label: 'Créer des produits',
    icon: <IconPlus size={16} />,
    description: 'Ajouter de nouveaux produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'products.edit',
    label: 'Modifier les produits',
    icon: <IconEdit size={16} />,
    description: 'Modifier les informations des produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'products.delete',
    label: 'Supprimer des produits',
    icon: <IconTrash size={16} />,
    description: 'Supprimer des produits de la base',
    category: 'Produits',
    defaultRoles: ['admin']
  },
  // Clients
  {
    id: 'clients.view',
    label: 'Voir les clients',
    icon: <IconUsers size={16} />,
    description: 'Consulter la liste des clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.create',
    label: 'Créer des clients',
    icon: <IconPlus size={16} />,
    description: 'Ajouter de nouveaux clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.edit',
    label: 'Modifier les clients',
    icon: <IconEdit size={16} />,
    description: 'Modifier les informations des clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.delete',
    label: 'Supprimer des clients',
    icon: <IconTrash size={16} />,
    description: 'Supprimer des clients de la base',
    category: 'Clients',
    defaultRoles: ['admin']
  },
  // Commandes
  {
    id: 'commandes.view',
    label: 'Voir les commandes',
    icon: <IconShoppingCart size={16} />,
    description: 'Consulter la liste des commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'commandes.create',
    label: 'Créer des commandes',
    icon: <IconPlus size={16} />,
    description: 'Créer de nouvelles commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'commandes.edit',
    label: 'Modifier les commandes',
    icon: <IconEdit size={16} />,
    description: 'Modifier les commandes existantes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'commandes.delete',
    label: 'Supprimer des commandes',
    icon: <IconTrash size={16} />,
    description: 'Supprimer des commandes',
    category: 'Commandes',
    defaultRoles: ['admin']
  },
  {
    id: 'commandes.validate',
    label: 'Valider les commandes',
    icon: <IconShieldCheck size={16} />,
    description: 'Valider et confirmer les commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Factures
  {
    id: 'factures.view',
    label: 'Voir les factures',
    icon: <IconFileInvoice size={16} />,
    description: 'Consulter la liste des factures',
    category: 'Factures',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'factures.create',
    label: 'Créer des factures',
    icon: <IconPlus size={16} />,
    description: 'Générer des factures',
    category: 'Factures',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'factures.delete',
    label: 'Supprimer des factures',
    icon: <IconTrash size={16} />,
    description: 'Supprimer des factures',
    category: 'Factures',
    defaultRoles: ['admin']
  },
  // Ventes
  {
    id: 'ventes.view',
    label: 'Voir les ventes',
    icon: <IconReceipt size={16} />,
    description: 'Consulter la liste des ventes',
    category: 'Ventes',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'ventes.create',
    label: 'Créer des ventes',
    icon: <IconPlus size={16} />,
    description: 'Enregistrer de nouvelles ventes',
    category: 'Ventes',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'ventes.delete',
    label: 'Supprimer des ventes',
    icon: <IconTrash size={16} />,
    description: 'Supprimer des ventes',
    category: 'Ventes',
    defaultRoles: ['admin']
  },
  // Revendeurs
  {
    id: 'revendeurs.view',
    label: 'Voir les revendeurs',
    icon: <IconTruck size={16} />,
    description: 'Consulter les informations des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.commandes',
    label: 'Gérer les commandes revendeurs',
    icon: <IconShoppingCart size={16} />,
    description: 'Gérer les commandes des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.factures',
    label: 'Gérer les factures revendeurs',
    icon: <IconFileInvoice size={16} />,
    description: 'Gérer les factures des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.stock',
    label: 'Gérer le stock revendeurs',
    icon: <IconPackage size={16} />,
    description: 'Gérer le stock des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin']
  },
  {
    id: 'revendeurs.decomptes',
    label: 'Gérer les décomptes',
    icon: <IconReceipt size={16} />,
    description: 'Gérer les décomptes des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin']
  },
  // Caisse
  {
    id: 'caisse.view',
    label: 'Voir le journal de caisse',
    icon: <IconCash size={16} />,
    description: 'Consulter le journal de caisse',
    category: 'Caisse',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'caisse.charges',
    label: 'Gérer les charges',
    icon: <IconCreditCard size={16} />,
    description: 'Gérer les charges de fonctionnement',
    category: 'Caisse',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Finances
  {
    id: 'finances.reglements',
    label: 'Gérer les règlements',
    icon: <IconReceipt size={16} />,
    description: 'Gérer les règlements des factures',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'finances.credits',
    label: 'Gérer les crédits',
    icon: <IconCreditCard size={16} />,
    description: 'Gérer les crédits clients et fournisseurs',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'finances.remboursements',
    label: 'Gérer les remboursements',
    icon: <IconCash size={16} />,
    description: 'Gérer les remboursements de crédits',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Administration
  {
    id: 'admin.users',
    label: 'Gérer les utilisateurs',
    icon: <IconUserShield size={16} />,
    description: 'Gérer les utilisateurs et leurs droits',
    category: 'Administration',
    defaultRoles: ['admin']
  },
  {
    id: 'admin.parametres',
    label: 'Gérer les paramètres',
    icon: <IconSettings size={16} />,
    description: 'Configurer les paramètres de l\'application',
    category: 'Administration',
    defaultRoles: ['admin']
  },
  {
    id: 'admin.config',
    label: 'Gérer la configuration',
    icon: <IconSettings size={16} />,
    description: 'Configurer l\'application',
    category: 'Administration',
    defaultRoles: ['admin']
  },
  {
    id: 'admin.diagnostic',
    label: 'Accéder au diagnostic',
    icon: <IconList size={16} />,
    description: 'Accéder aux outils de diagnostic',
    category: 'Administration',
    defaultRoles: ['admin']
  },
];

// =====================================================
// COMPOSANT PRINCIPAL
// =====================================================

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
  const [saving, setSaving] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Toutes']));
  const [selectAll, setSelectAll] = useState(true);
  
  const [formData, setFormData] = useState({
    nom: "",
    login: "",
    password: "",
    role: "admin",
    telephone: "",
    permissions: {} as Record<string, boolean>
  });

  const itemsPerPage = 10;

  // Initialiser toutes les permissions à true par défaut
  useEffect(() => {
    if (modalOpen && !editing) {
      const allPermissions: Record<string, boolean> = {};
      PERMISSIONS.forEach(p => { allPermissions[p.id] = true; });
      setFormData(prev => ({ ...prev, permissions: allPermissions }));
      setSelectAll(true);
    }
  }, [modalOpen, editing]);

  // Charger les permissions d'un utilisateur existant
  useEffect(() => {
    if (editing && modalOpen) {
      try {
        const perms = editing.permissions ? JSON.parse(editing.permissions) : {};
        const allPermissions: Record<string, boolean> = {};
        PERMISSIONS.forEach(p => {
          allPermissions[p.id] = perms[p.id] !== undefined ? perms[p.id] : true;
        });
        setFormData(prev => ({ ...prev, permissions: allPermissions }));
        const allChecked = Object.values(allPermissions).every(v => v === true);
        setSelectAll(allChecked);
      } catch (e) {
        // En cas d'erreur, tout cocher
        const allPermissions: Record<string, boolean> = {};
        PERMISSIONS.forEach(p => { allPermissions[p.id] = true; });
        setFormData(prev => ({ ...prev, permissions: allPermissions }));
        setSelectAll(true);
      }
    }
  }, [editing, modalOpen]);

  const chargerUtilisateurs = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      // Vérifier si la colonne permissions existe
      const tableInfo = await db.select<any[]>(`PRAGMA table_info(users)`);
      const hasPermissionsCol = tableInfo.some(col => col.name === 'permissions');
      
      let query = 'SELECT id, nom, email, mot_de_passe, role, telephone, created_at';
      if (hasPermissionsCol) {
        query += ', permissions';
      }
      query += ' FROM users ORDER BY nom';
      
      const result = await db.select<Utilisateur[]>(query);
      setUtilisateurs(result || []);
    } catch (error) {
      console.error("Erreur chargement:", error);
      notifications.show({ title: 'Erreur', message: 'Erreur de chargement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Ajouter la colonne permissions si elle n'existe pas
  const ensurePermissionsColumn = async () => {
    try {
      const db = await getDb();
      const tableInfo = await db.select<any[]>(`PRAGMA table_info(users)`);
      const hasPermissionsCol = tableInfo.some(col => col.name === 'permissions');
      
      if (!hasPermissionsCol) {
        await db.execute(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}'`);
        console.log('✅ Colonne permissions ajoutée à la table users');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la colonne permissions:', error);
    }
  };

  useEffect(() => {
    ensurePermissionsColumn();
    chargerUtilisateurs();
  }, []);

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

      const permissionsJson = JSON.stringify(formData.permissions);

      if (editing) {
        if (formData.password) {
          const hash = await bcrypt.hash(formData.password, 10);
          await db.execute(`
            UPDATE users 
            SET nom=?, email=?, mot_de_passe=?, role=?, telephone=?, permissions=? 
            WHERE id=?
          `, [formData.nom, formData.login, hash, formData.role, formData.telephone, permissionsJson, editing.id]);
        } else {
          await db.execute(`
            UPDATE users 
            SET nom=?, email=?, role=?, telephone=?, permissions=? 
            WHERE id=?
          `, [formData.nom, formData.login, formData.role, formData.telephone, permissionsJson, editing.id]);
        }
        notifications.show({ title: 'Succès', message: 'Utilisateur modifié', color: 'green' });
      } else {
        const hash = await bcrypt.hash(formData.password, 10);
        await db.execute(`
          INSERT INTO users (nom, email, mot_de_passe, role, telephone, permissions) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [formData.nom, formData.login, hash, formData.role, formData.telephone, permissionsJson]);
        notifications.show({ title: 'Succès', message: 'Utilisateur créé', color: 'green' });
      }
      
      setModalOpen(false);
      setEditing(null);
      setFormData({ 
        nom: "", 
        login: "", 
        password: "", 
        role: "admin", 
        telephone: "",
        permissions: {}
      });
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

  const handlePermissionToggle = (permissionId: string) => {
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      newPermissions[permissionId] = !newPermissions[permissionId];
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleSelectAll = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    const newPermissions: Record<string, boolean> = {};
    PERMISSIONS.forEach(p => {
      newPermissions[p.id] = newState;
    });
    setFormData(prev => ({ ...prev, permissions: newPermissions }));
  };

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({ ...prev, role }));
    
    // Charger les permissions par défaut pour le rôle sélectionné
    const defaultPerms: Record<string, boolean> = {};
    PERMISSIONS.forEach(p => {
      defaultPerms[p.id] = p.defaultRoles.includes(role);
    });
    setFormData(prev => ({ ...prev, permissions: defaultPerms }));
    
    const allChecked = Object.values(defaultPerms).every(v => v === true);
    setSelectAll(allChecked);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getCategoryPermissions = (category: string) => {
    return PERMISSIONS.filter(p => p.category === category);
  };

  const getCategories = () => {
    const cats = new Set(PERMISSIONS.map(p => p.category));
    return Array.from(cats);
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
    commerciaux: utilisateurs.filter(u => u.role === "commercial").length,
    caissiers: utilisateurs.filter(u => u.role === "caissier").length
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

          <SimpleGrid cols={5} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Total</Text>
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
                  <Text c="white" size="xs">Admins</Text>
                  <Text c="white" fw={700} size="xl">{stats.admins}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="orange" variant="light" size="lg">
                  <IconUserCheck size={20} />
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
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Commerciaux</Text>
                  <Text c="white" fw={700} size="xl">{stats.commerciaux}</Text>
                </div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCash size={20} />
                </ThemeIcon>
                <div>
                  <Text c="white" size="xs">Caissiers</Text>
                  <Text c="white" fw={700} size="xl">{stats.caissiers}</Text>
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
                  setFormData({ 
                    nom: "", 
                    login: "", 
                    password: "", 
                    role: "admin", 
                    telephone: "",
                    permissions: {}
                  });
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
                                login: u.email || "",
                                password: "",
                                role: u.role || "admin",
                                telephone: u.telephone || "",
                                permissions: {}
                              });
                              // Charger les permissions de l'utilisateur
                              try {
                                const perms = u.permissions ? JSON.parse(u.permissions) : {};
                                const allPermissions: Record<string, boolean> = {};
                                PERMISSIONS.forEach(p => {
                                  allPermissions[p.id] = perms[p.id] !== undefined ? perms[p.id] : true;
                                });
                                setFormData(prev => ({ ...prev, permissions: allPermissions }));
                              } catch (e) {
                                const allPermissions: Record<string, boolean> = {};
                                PERMISSIONS.forEach(p => { allPermissions[p.id] = true; });
                                setFormData(prev => ({ ...prev, permissions: allPermissions }));
                              }
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
                  setFormData({ 
                    nom: "", 
                    login: "", 
                    password: "", 
                    role: "admin", 
                    telephone: "",
                    permissions: {}
                  });
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

      {/* MODAL UTILISATEUR AVEC PERMISSIONS */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        size="xl"
        centered
        padding={0}
        styles={{
          header: { backgroundColor: '#1b365d', padding: '20px 24px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 700, fontSize: '1.2rem', width: '100%' },
          body: { padding: 0 }
        }}
        title={
          <Group gap="md" style={{ width: '100%' }}>
            <ThemeIcon size="lg" radius="md" color="blue" variant="light">
              <IconUserShield size={24} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={700} c="white">{editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</Text>
              <Text size="xs" c="gray.4">
                {editing ? "Modifiez les informations et les permissions" : "Créez un nouveau compte avec des permissions personnalisées"}
              </Text>
            </div>
          </Group>
        }
      >
        <ScrollArea h="calc(100vh - 200px)" type="auto">
          <Paper p="xl" radius={0}>
            <Stack gap="lg">
              {/* Informations de base */}
              <Card withBorder p="md" radius="md">
                <Title order={4} size="sm" mb="md">Informations de l'utilisateur</Title>
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Nom complet"
                      placeholder="Nom de l'utilisateur"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Login (identifiant)"
                      placeholder="Nom d'utilisateur pour la connexion"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      required
                      leftSection={<IconUser size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <PasswordInput
                      label="Mot de passe"
                      placeholder={editing ? "Laisser vide pour conserver" : "Nouveau mot de passe"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editing}
                      leftSection={<IconLock size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Téléphone"
                      placeholder="Numéro de téléphone"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      leftSection={<IconMail size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Select
                      label="Rôle par défaut"
                      placeholder="Sélectionner un rôle"
                      data={[
                        { value: "admin", label: "👑 Admin - Accès total" },
                        { value: "gestionnaire", label: "📊 Gestionnaire - Gestion commerciale" },
                        { value: "caissier", label: "💰 Caissier - Ventes uniquement" },
                        { value: "commercial", label: "🏪 Commercial - Clients et commandes" }
                      ]}
                      value={formData.role}
                      onChange={(val) => handleRoleChange(val || "admin")}
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      ⚡ Changer le rôle charge automatiquement les permissions par défaut
                    </Text>
                  </Grid.Col>
                </Grid>
              </Card>

              {/* Permissions */}
              <Card withBorder p="md" radius="md">
                <Group justify="space-between" mb="md">
                  <Group>
                    <IconShieldCheck size={20} color="#1b365d" />
                    <Title order={4} size="sm">Permissions</Title>
                    <Badge size="sm" variant="light" color="blue">
                      {Object.values(formData.permissions).filter(v => v).length}/{PERMISSIONS.length}
                    </Badge>
                  </Group>
                  <Group>
                    <Chip
                      checked={selectAll}
                      onChange={handleSelectAll}
                      size="sm"
                      color="blue"
                    >
                      Tout {selectAll ? 'désélectionner' : 'sélectionner'}
                    </Chip>
                  </Group>
                </Group>

                <Divider mb="md" />

                {getCategories().map((category) => {
                  const perms = getCategoryPermissions(category);
                  const checkedCount = perms.filter(p => formData.permissions[p.id]).length;
                  const allChecked = checkedCount === perms.length;
                  const isExpanded = expandedCategories.has(category);

                  return (
                    <Box key={category} mb="sm">
                      <Group 
                        justify="space-between" 
                        p="xs" 
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: isExpanded ? 'rgba(27, 54, 93, 0.05)' : 'transparent',
                          borderRadius: 6,
                          transition: 'background 0.2s'
                        }}
                        onClick={() => toggleCategory(category)}
                      >
                        <Group>
                          <Text size="sm" fw={600} c={isExpanded ? '#1b365d' : 'dimmed'}>
                            {category}
                          </Text>
                          <Badge size="xs" variant="light" color={allChecked ? 'green' : 'orange'}>
                            {checkedCount}/{perms.length}
                          </Badge>
                        </Group>
                        <Group>
                          {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </Group>
                      </Group>

                      {isExpanded && (
                        <Box pl="md" pt="xs">
                          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                            {perms.map((perm) => (
                              <Checkbox
                                key={perm.id}
                                label={
                                  <Group gap={6}>
                                    <Box style={{ color: '#4a6cf7' }}>{perm.icon}</Box>
                                    <Text size="xs">{perm.label}</Text>
                                    <Tooltip label={perm.description} position="top">
                                      <IconInfoCircle size={12} color="#868e96" style={{ cursor: 'help' }} />
                                    </Tooltip>
                                  </Group>
                                }
                                checked={formData.permissions[perm.id] || false}
                                onChange={() => handlePermissionToggle(perm.id)}
                                size="xs"
                              />
                            ))}
                          </SimpleGrid>
                        </Box>
                      )}
                      <Divider mt="xs" />
                    </Box>
                  );
                })}
              </Card>

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
                  leftSection={<IconCheck size={16} />}
                >
                  {editing ? "Modifier" : "Créer"}
                </Button>
              </Group>
            </Stack>
          </Paper>
        </ScrollArea>
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
          <Text size="sm">2. Chaque rôle a des permissions par défaut</Text>
          <Text size="sm">3. Vous pouvez personnaliser les permissions individuellement</Text>
          <Text size="sm">4. Admin : accès total à l'application</Text>
          <Text size="sm">5. Gestionnaire : gestion commerciale (clients, commandes, factures)</Text>
          <Text size="sm">6. Caissier : accès aux ventes uniquement</Text>
          <Text size="sm">7. Commercial : gestion des clients et commandes</Text>
          <Divider />
          <Text size="xs" c="dimmed" ta="center">Version 2.0.0 - Gestion Commerciale Pro</Text>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeUtilisateurs;