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
} from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';
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
  IconChartBar,
  IconCash,
  IconBusinessplan,
  IconTruck,
  IconFileInvoice,
  IconCalculator,
  IconList,
  IconTruckDelivery,
  IconUser,
  IconReportAnalytics,
  IconHelp,
  IconStar,
  IconDatabase,
  IconPercentage,
} from '@tabler/icons-react';
import { Role } from '../../types/auth';

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

function NavItem({ label, path, icon, roles, userRole, badge, badgeColor = 'yellow', onClick, disabled }: NavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();

  if ((roles && userRole && !roles.includes(userRole)) || disabled) {
    return null;
  }

  const active = location.pathname === path;

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      navigate(path);
    }
  };

  const lightBlue = theme.colors.adminBlue?.[5] || '#4f82c3';
  const hoverBlue = theme.colors.adminBlue?.[6] || '#3669a9';
  const yellow = theme.colors.yellow?.[4] || '#f59f00';

  return (
    <Tooltip label={badge} position="right" offset={10} disabled={!badge}>
      <Box
        onClick={handleClick}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '10px 12px 10px 28px',
          borderRadius: theme.radius.sm,
          backgroundColor: active ? lightBlue : 'transparent',
          color: active ? 'white' : yellow,
          fontWeight: active ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'all 0.2s ease',
          marginBottom: '2px',
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!active && !disabled) {
            e.currentTarget.style.backgroundColor = hoverBlue;
            e.currentTarget.style.paddingLeft = '32px';
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!active && !disabled) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.paddingLeft = '28px';
          }
        }}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center', width: 20 }}>{icon}</span>}
        <Text size="sm" fw={active ? 600 : 500}>
          {label}
        </Text>
        {badge && (
          <Badge
            size="xs"
            color={badgeColor}
            variant="filled"
            style={{ marginLeft: 'auto' }}
          >
            {badge}
          </Badge>
        )}
      </Box>
    </Tooltip>
  );
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

function NavSection({ title, icon, children, defaultOpen = false, userRole, roles, description, count }: SectionProps) {
  const [opened, setOpened] = useState(defaultOpen);
  const theme = useMantineTheme();

  if (roles && userRole && !roles.includes(userRole)) {
    return null;
  }

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
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7] || '#295080';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={600} c="gray.2" tt="uppercase" style={{ letterSpacing: '1px' }}>
                {title}
              </Text>
              {description && (
                <Text size="xs" c="gray.5" style={{ fontSize: '10px' }}>
                  {description}
                </Text>
              )}
            </div>
          </Group>
          <Group gap="xs">
            {count !== undefined && count > 0 && (
              <Badge size="xs" color="blue" variant="filled" radius="xl">
                {count}
              </Badge>
            )}
            {opened ? (
              <IconChevronDown size={14} color="gray.4" />
            ) : (
              <IconChevronRight size={14} color="gray.4" />
            )}
          </Group>
        </Group>
      </UnstyledButton>
      {opened && <Box ml="md" mt={4}>{children}</Box>}
    </Box>
  );
}

interface NavbarProps {
  userRole?: Role;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
}

export default function Navbar({ userRole, userName, userAvatar, onLogout }: NavbarProps) {
  const theme = useMantineTheme();
  const darkBlue = theme.colors.adminBlue?.[8] || '#1b365d';

  // Rôles prédéfinis
  const adminOnly: Role[] = ['admin'];
  const adminAndManager: Role[] = ['admin', 'gestionnaire'];
  const allRoles: Role[] = ['admin', 'gestionnaire', 'commercial', 'stockiste', 'comptable'];
  const revendeurAccess: Role[] = ['admin', 'gestionnaire', 'commercial'];

  // Récupérer les initiales pour l'avatar
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

  // État actif pour le footer

  return (
    <Stack gap={0} style={{ height: '100%', backgroundColor: darkBlue }}>
      {/* HEADER - Logo et profil utilisateur */}
      <Box p="lg" pb="md" style={{ borderBottom: `1px solid ${theme.colors.adminBlue?.[6]}` }}>
        <Text
          fw={800}
          size="xl"
          c="yellow"
          style={{
            fontFamily: "'Times New Roman', serif",
            textAlign: 'center',
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar 
                      size="md" 
                      radius="xl" 
                      color="yellow" 
                      src={userAvatar}
                      style={{ border: '2px solid yellow' }}
                    >
                      {getInitials(userName)}
                    </Avatar>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <Text size="sm" fw={600} c="white" truncate>
                        {userName}
                      </Text>
                      <Text size="xs" c="gray.4" tt="capitalize">
                        {roleLabels[userRole || ''] || userRole}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Mon compte</Menu.Label>
                <Menu.Item leftSection={<IconUser size={14} />}>Mon profil</Menu.Item>
                <Menu.Item leftSection={<IconSettings size={14} />}>Paramètres</Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  color="red" 
                  leftSection={<IconLogout size={14} />}
                  onClick={onLogout}
                >
                  Déconnexion
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        )}
      </Box>

      {/* ZONE DE NAVIGATION PRINCIPALE */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={6} offsetScrollbars>
        <Stack gap={6} p="md" pt="sm">
          
          {/* 1. ACCUEIL */}
          <NavItem
            label="Tableau de bord"
            path="/"
            icon={<IconLayoutDashboard size={20} />}
            userRole={userRole}
          />

          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />

          {/* 2. GESTION COMMERCIALE */}
          <NavSection
            title="VENTES & CLIENTS"
            icon={<IconShoppingBag size={20} color="white" />}
            description="Gestion commerciale"
            userRole={userRole}
            roles={allRoles}
          >
            <NavItem
              label="Clients"
              path="/clients"
              icon={<IconUsers size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Commandes"
              path="/commandes"
              icon={<IconShoppingBag size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Factures"
              path="/factures"
              icon={<IconReceipt size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Ventes comptoir"
              path="/ventes"
              icon={<IconBuildingStore size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
          </NavSection>

          {/* 3. CATALOGUE & STOCK */}
          <NavSection
            title="PRODUITS & STOCK"
            icon={<IconPackage size={20} color="white" />}
            description="Gestion des produits"
            userRole={userRole}
            roles={allRoles}
          >
            <NavItem
              label="Produits"
              path="/products"
              icon={<IconPackage size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Stock global"
              path="/stock"
              icon={<IconDatabase size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
          </NavSection>

          {/* 4. RÉSEAU DE REVENDEURS */}
          <NavSection
            title="RÉSEAU DE REVENDEURS"
            icon={<IconTruck size={20} color="white" />}
            description="Gestion des revendeurs"
            userRole={userRole}
            roles={revendeurAccess}
            count={5}
          >
            <NavItem
              label="Dashboard revendeurs"
              path="/dashboard-revendeurs"
              icon={<IconChartBar size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Stats"
              badgeColor="green"
            />
            <NavItem
              label="Commandes revendeurs"
              path="/commandes-revendeur"
              icon={<IconTruckDelivery size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
              badge="Gestion"
              badgeColor="teal"
            />
            <NavItem
              label="Stocks revendeurs"
              path="/stock-revendeurs"
              icon={<IconList size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Décomptes"
              path="/decomptes"
              icon={<IconCalculator size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Commission"
              badgeColor="orange"
            />
            <NavItem
              label="Factures revendeurs"
              path="/factures-revendeur"
              icon={<IconFileInvoice size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Documents"
              badgeColor="blue"
            />
          </NavSection>

          {/* 5. FINANCES & COMPTABILITÉ */}
          <NavSection
            title="FINANCES"
            icon={<IconMoneybag size={20} color="white" />}
            description="Suivi financier"
            userRole={userRole}
            roles={adminAndManager}
          >
            <NavItem
              label="Règlements clients"
              path="/reglements"
              icon={<IconCash size={18} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Rapports financiers"
              path="/rapports"
              icon={<IconReportAnalytics size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Bientôt"
              badgeColor="gray"
              disabled
            />
            <NavItem
              label="Commissions"
              path="/commissions"
              icon={<IconPercentage size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Bientôt"
              badgeColor="gray"
              disabled
            />
          </NavSection>

          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />

          {/* 6. ADMINISTRATION & PARAMÈTRES */}
          <NavSection
            title="ADMINISTRATION"
            icon={<IconSettings size={20} color="white" />}
            description="Configuration système"
            userRole={userRole}
            roles={adminOnly}
            defaultOpen={userRole === 'admin'}
          >
            <NavItem
              label="Utilisateurs"
              path="/utilisateurs"
              icon={<IconUserCog size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
            />
            <NavItem
              label="Configuration atelier"
              path="/parametres"
              icon={<IconSettings size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
            />
            <NavItem
              label="Configuration commerce"
              path="/config-commerce"
              icon={<IconBusinessplan size={18} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Premium"
              badgeColor="cyan"
            />
          </NavSection>

          {/* 7. AIDE & SUPPORT */}
          <Divider color={theme.colors.adminBlue?.[6]} my="sm" />
          <NavItem
            label="Aide & Support"
            path="/aide"
            icon={<IconHelp size={20} />}
            userRole={userRole}
            disabled
          />
        </Stack>
      </ScrollArea>

      {/* FOOTER - Informations et version */}
      <Box p="md" pt="xs" style={{ borderTop: `1px solid ${theme.colors.adminBlue?.[6]}` }}>
        <Divider color={theme.colors.adminBlue?.[6]} mb="sm" />
        {onLogout && (
          <UnstyledButton
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: theme.radius.sm,
              transition: 'all 0.2s ease',
              marginBottom: '12px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Group gap="sm">
              <IconLogout size={18} color={theme.colors.yellow?.[4]} />
              <Text size="sm" fw={500} c="yellow">
                Déconnexion
              </Text>
            </Group>
          </UnstyledButton>
        )}
        
        <Box style={{ textAlign: 'center' }}>
          <Group justify="center" gap="xs" mb={4}>
            <IconStar size={12} color="yellow" />
            <Text size="xs" c="dimmed">
              Version 3.0.0
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            © 2026 Gestion Commerciale Pro
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Tous droits réservés
          </Text>
        </Box>
      </Box>
    </Stack>
  );
}