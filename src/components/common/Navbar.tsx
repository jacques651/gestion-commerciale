// src/components/common/Navbar.tsx
import React, { useState } from 'react';
import {
  Stack,
  Text,
  Box,
  Divider,
  useMantineTheme,
  ScrollArea,
  Group,
  Tooltip,
  Badge,
  Avatar,
  Menu,
  UnstyledButton,
  Modal,
  TextInput,
  Button,
  Switch,
  Select,
  PasswordInput,
  LoadingOverlay
} from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import {
  IconLayoutDashboard,
  IconUsers,
  IconShoppingBag,
  IconReceipt,
  IconMoneybag,
  IconBuildingStore,
  IconPackage,
  IconUserCog,
  IconSettings,
  IconLogout,
  IconChevronRight,
  IconChevronDown,
  IconBusinessplan,
  IconTruck,
  IconFileInvoice,
  IconUser,
  IconReportAnalytics,
  IconHelp,
  IconStar,
  IconPercentage,
  IconReceipt2
} from '@tabler/icons-react';
import { Role } from '../../types/auth';
import { userService, UserProfile } from '../../services/userService';
import ParametresAtelier from '../parametres/ParametresAtelier';

// ============================================================
// TYPES
// ============================================================
interface NavItemProps {
  label: string;
  path: string;
  icon?: React.ReactNode;
  roles?: Role[];
  userRole?: Role;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  userRole?: Role;
  roles?: Role[];
  description?: string;
  count?: number;
}

// ============================================================
// COMPOSANT MODAL PROFIL
// ============================================================
interface ModalProfilProps {
  opened: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
}

const ModalProfil: React.FC<ModalProfilProps> = ({ opened, onClose, userName, userRole }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    telephone: '',
    theme: 'light',
    notifications: true
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  React.useEffect(() => {
    if (opened) {
      loadProfile();
    }
  }, [opened]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await userService.getCurrentUserProfile();
      setProfile(data);
      if (data) {
        setFormData({
          email: data.email || '',
          telephone: data.telephone || '',
          theme: data.theme || 'light',
          notifications: data.notifications !== false
        });
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const success = await userService.updateUserProfile(profile.id, {
        email: formData.email,
        telephone: formData.telephone,
        theme: formData.theme,
        notifications: formData.notifications
      });
      if (success) {
        notifications.show({ title: '✅ Succès', message: 'Profil mis à jour', color: 'green' });
        onClose();
      } else {
        notifications.show({ title: '❌ Erreur', message: 'Erreur lors de la mise à jour', color: 'red' });
      }
    } catch (error) {
      notifications.show({ title: '❌ Erreur', message: 'Erreur lors de la mise à jour', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notifications.show({ title: 'Erreur', message: 'Les mots de passe ne correspondent pas', color: 'red' });
      return;
    }
    if (passwordData.newPassword.length < 4) {
      notifications.show({ title: 'Erreur', message: 'Mot de passe trop court (min 4 caractères)', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const success = await userService.changePassword(profile!.id, passwordData.oldPassword, passwordData.newPassword);
      if (success) {
        notifications.show({ title: '✅ Succès', message: 'Mot de passe modifié', color: 'green' });
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        notifications.show({ title: '❌ Erreur', message: 'Ancien mot de passe incorrect', color: 'red' });
      }
    } catch (error) {
      notifications.show({ title: '❌ Erreur', message: 'Erreur lors du changement', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Mon profil" size="md" centered padding="lg">
      <LoadingOverlay visible={loading} />
      <Stack gap="md">
        <Group justify="center">
          <Avatar size={100} radius={100} color="blue">{getInitials(userName)}</Avatar>
        </Group>
        <Group justify="center">
          <Text fw={700} size="lg">{userName}</Text>
          <Badge color="yellow" variant="light">{userRole}</Badge>
        </Group>
        <Divider label="Informations personnelles" labelPosition="center" />
        <TextInput label="Email" placeholder="votre@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
        <TextInput label="Téléphone" placeholder="+225 XX XX XX XX" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} />
        <Select label="Thème" value={formData.theme} onChange={(value) => setFormData({ ...formData, theme: value || 'light' })} data={[{ value: 'light', label: '☀️ Clair' }, { value: 'dark', label: '🌙 Sombre' }]} />
        <Switch label="Activer les notifications" checked={formData.notifications} onChange={(e) => setFormData({ ...formData, notifications: e.currentTarget.checked })} />
        <Divider label="Changer le mot de passe" labelPosition="center" />
        <PasswordInput label="Mot de passe actuel" value={passwordData.oldPassword} onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })} />
        <PasswordInput label="Nouveau mot de passe" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
        <PasswordInput label="Confirmer" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
        <Button variant="light" color="blue" onClick={handleChangePassword} disabled={!passwordData.oldPassword || !passwordData.newPassword}>Changer le mot de passe</Button>
        <Divider />
        <Group justify="flex-end">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleUpdateProfile} color="green">Enregistrer</Button>
        </Group>
      </Stack>
    </Modal>
  );
};

// ============================================================
// COMPOSANT MODAL PARAMÈTRES (utilise ParametresAtelier)
// ============================================================
const ModalParametres: React.FC<{ opened: boolean; onClose: () => void }> = ({ opened, onClose }) => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Paramètres de l'entreprise"
      size="xl"
      centered
      padding={0}
      styles={{
        header: { padding: '16px 20px', borderBottom: '1px solid #dee2e6' },
        body: { padding: 0 }
      }}
    >
      <ParametresAtelier />
    </Modal>
  );
};

// ============================================================
// COMPOSANT NAVIGATION ITEM
// ============================================================
function NavItem({ label, path, icon, roles, userRole, badge, badgeColor = 'yellow', onClick, disabled }: NavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();

  if ((roles && userRole && !roles.includes(userRole)) || disabled) return null;

  const active = location.pathname === path;
  const lightBlue = theme.colors.adminBlue?.[5] || '#4f82c3';
  const hoverBlue = theme.colors.adminBlue?.[6] || '#3669a9';

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    else navigate(path);
  };

  return (
    <Tooltip label={badge} position="right" offset={10} disabled={!badge}>
      <UnstyledButton
        onClick={handleClick}
        style={{
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '10px 12px 10px 28px',
          borderRadius: theme.radius.sm,
          backgroundColor: active ? lightBlue : 'transparent',
          transition: 'all 0.2s ease',
          marginBottom: '2px',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.backgroundColor = hoverBlue; }}
        onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <Group gap="sm" wrap="nowrap">
          <Box style={{ width: 24, display: 'flex', alignItems: 'center', color: 'white' }}>{icon}</Box>
          <Text size="sm" fw={active ? 600 : 500} c={active ? 'white' : 'gray.3'} style={{ flex: 1 }}>{label}</Text>
          {badge && <Badge size="xs" color={badgeColor} variant="filled">{badge}</Badge>}
        </Group>
      </UnstyledButton>
    </Tooltip>
  );
}

// ============================================================
// COMPOSANT SECTION
// ============================================================
function NavSection({ title, icon, children, defaultOpen = false, userRole, roles, description, count }: SectionProps) {
  const [opened, setOpened] = useState(defaultOpen);
  const theme = useMantineTheme();

  if (roles && userRole && !roles.includes(userRole)) return null;

  return (
    <Box mb="xs">
      <UnstyledButton
        onClick={() => setOpened(!opened)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: theme.radius.sm,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7] || '#295080'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
            <Box style={{ width: 24, display: 'flex', alignItems: 'center', color: 'white' }}>{icon}</Box>
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={600} c="white" tt="uppercase" style={{ letterSpacing: '0.5px' }}>{title}</Text>
              {description && <Text size="xs" c="gray.5" style={{ fontSize: '10px' }}>{description}</Text>}
            </Box>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {count !== undefined && count > 0 && <Badge size="xs" color="blue" variant="filled" radius="xl">{count}</Badge>}
            {opened ? <IconChevronDown size={14} color="white" /> : <IconChevronRight size={14} color="white" />}
          </Group>
        </Group>
      </UnstyledButton>
      {opened && <Box ml="lg" mt={4}>{children}</Box>}
    </Box>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL NAVBAR
// ============================================================
interface NavbarProps {
  userRole?: Role;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
}

export default function Navbar({ userRole, userName, userAvatar, onLogout }: NavbarProps) {
  const theme = useMantineTheme();
  const darkBlue = theme.colors.adminBlue?.[8] || '#1b365d';
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const adminOnly: Role[] = ['admin'];
  const adminAndManager: Role[] = ['admin', 'gestionnaire'];
  const allRoles: Role[] = ['admin', 'gestionnaire', 'commercial', 'stockiste', 'comptable'];
  const revendeurAccess: Role[] = ['admin', 'gestionnaire', 'commercial'];

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    gestionnaire: 'Gestionnaire',
    commercial: 'Commercial',
    stockiste: 'Gestionnaire stock',
    comptable: 'Comptable'
  };

  return (
    <Stack gap={0} style={{ height: '100%', backgroundColor: darkBlue }}>
      {/* HEADER - Logo et profil utilisateur */}
      <Box p="lg" pb="md" style={{ borderBottom: `1px solid ${theme.colors.adminBlue?.[6]}` }}>
        <Text
          fw={800}
          size="xl"
          c="yellow"
          ta="center"
          style={{
            fontFamily: "'Times New Roman', serif",
            letterSpacing: '4px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            fontSize: '20px',
          }}
        >
          GESTION PRO
        </Text>

        {userName && (
          <>
            <Divider color={theme.colors.adminBlue?.[6]} my="md" />
            <Menu position="bottom-start" width={200}>
              <Menu.Target>
                <UnstyledButton
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: theme.radius.md,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7]}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size="md" radius="xl" color="yellow" src={userAvatar} style={{ border: '2px solid yellow' }}>{getInitials(userName)}</Avatar>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <Text size="sm" fw={600} c="white" truncate>{userName}</Text>
                      <Text size="xs" c="gray.4" tt="capitalize">{roleLabels[userRole || ''] || userRole}</Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Mon compte</Menu.Label>
                <Menu.Item leftSection={<IconUser size={14} />} onClick={() => setProfileModalOpen(true)}>Mon profil</Menu.Item>
                <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => setSettingsModalOpen(true)}>Paramètres</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={onLogout}>Déconnexion</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        )}
      </Box>

      {/* ZONE DE NAVIGATION PRINCIPALE */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={6} offsetScrollbars>
        <Stack gap={4} p="md" pt="sm">
          <NavItem label="Tableau de bord" path="/" icon={<IconLayoutDashboard size={20} color="white" />} userRole={userRole} />
          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />

          <NavSection title="VENTES & CLIENTS" icon={<IconShoppingBag size={20} color="white" />} description="Gestion commerciale" userRole={userRole} roles={allRoles}>
            <NavItem label="Clients" path="/clients" icon={<IconUsers size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Commandes" path="/commandes" icon={<IconShoppingBag size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Commandes Standard" path="/commandes/standard" icon={<IconBuildingStore size={18} color="white" />} roles={adminAndManager} userRole={userRole} badge="Filtre" badgeColor="cyan" />
            <NavItem label="Commandes Revendeurs" path="/commandes/revendeur" icon={<IconTruck size={18} color="white" />} roles={adminAndManager} userRole={userRole} badge="Filtre" badgeColor="green" />
            <NavItem label="Factures" path="/factures" icon={<IconReceipt size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Ventes comptoir" path="/ventes" icon={<IconBuildingStore size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
          </NavSection>

          <NavSection title="PRODUITS" icon={<IconPackage size={20} color="white" />} description="Gestion des produits" userRole={userRole} roles={allRoles}>
            <NavItem label="Produits" path="/products" icon={<IconPackage size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
          </NavSection>

          <NavSection title="REVENDEURS" icon={<IconTruck size={20} color="white" />} description="Gestion des revendeurs" userRole={userRole} roles={revendeurAccess}>
            <NavItem label="Stocks revendeurs" path="/stock-revendeurs" icon={<IconPackage size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Gestion Décomptes" path="/decomptes" icon={<IconReceipt2 size={18} color="white" />} roles={adminAndManager} userRole={userRole} badge="Principal" badgeColor="teal" /> 
            <NavItem label="Factures revendeurs" path="/factures-revendeur" icon={<IconFileInvoice size={18} color="white" />} roles={adminAndManager} userRole={userRole} badge="Documents" badgeColor="blue" />
          </NavSection>

          <NavSection title="FINANCES" icon={<IconMoneybag size={20} color="white" />} description="Suivi financier" userRole={userRole} roles={adminAndManager}>
            <NavItem label="Règlements" path="/reglements" icon={<IconMoneybag size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Commissions" path="/commissions" icon={<IconPercentage size={18} color="white" />} roles={adminOnly} userRole={userRole} badge="Bientôt" badgeColor="gray" disabled />
            <NavItem label="Rapports" path="/rapports" icon={<IconReportAnalytics size={18} color="white" />} roles={adminOnly} userRole={userRole} badge="Bientôt" badgeColor="gray" disabled />
          </NavSection>

          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />

          <NavSection title="ADMINISTRATION" icon={<IconSettings size={20} color="white" />} description="Configuration" userRole={userRole} roles={adminOnly} defaultOpen={userRole === 'admin'}>
            <NavItem label="Utilisateurs" path="/utilisateurs" icon={<IconUserCog size={18} color="white" />} roles={adminOnly} userRole={userRole} />
            <NavItem label="Configuration" path="/parametres" icon={<IconSettings size={18} color="white" />} roles={adminOnly} userRole={userRole} />
            <NavItem label="Commerce" path="/config-commerce" icon={<IconBusinessplan size={18} color="white" />} roles={adminOnly} userRole={userRole} badge="Premium" badgeColor="cyan" />
          </NavSection>

          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />
          <NavItem label="Aide & Support" path="/aide" icon={<IconHelp size={20} color="white" />} userRole={userRole} disabled />
        </Stack>
      </ScrollArea>

      {/* FOOTER */}
      <Box p="md" pt="xs" style={{ borderTop: `1px solid ${theme.colors.adminBlue?.[6]}` }}>
        <Divider color={theme.colors.adminBlue?.[6]} mb="sm" />
        {onLogout && (
          <UnstyledButton
            onClick={onLogout}
            style={{ width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, transition: 'all 0.2s ease', marginBottom: '12px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7]}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Group gap="sm" wrap="nowrap">
              <IconLogout size={18} color="white" />
              <Text size="sm" fw={500} c="white">Déconnexion</Text>
            </Group>
          </UnstyledButton>
        )}
        <Box ta="center">
          <Group justify="center" gap="xs" mb={4}>
            <IconStar size={12} color="white" />
            <Text size="xs" c="gray.5">Version 3.0.0</Text>
          </Group>
          <Text size="xs" c="gray.5">© 2026 Gestion Commerciale Pro</Text>
          <Text size="xs" c="gray.5" mt={2}>Tous droits réservés</Text>
        </Box>
      </Box>

      {/* MODALS */}
      <ModalProfil opened={profileModalOpen} onClose={() => setProfileModalOpen(false)} userName={userName || ''} userRole={userRole || ''} />
      <ModalParametres opened={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
    </Stack>
  );
}