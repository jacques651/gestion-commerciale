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
  IconReportAnalytics,
  IconList,
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
}

function NavItem({ label, path, icon, roles, userRole, badge, badgeColor = 'yellow', onClick }: NavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();

  if (roles && userRole && !roles.includes(userRole)) {
    return null;
  }

  const active = location.pathname === path;

  const handleClick = () => {
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
          cursor: 'pointer',
          padding: '8px 12px 8px 28px',
          borderRadius: theme.radius.sm,
          backgroundColor: active ? lightBlue : 'transparent',
          color: active ? 'white' : yellow,
          fontWeight: active ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.2s ease',
          marginBottom: '2px',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = hoverBlue;
            e.currentTarget.style.paddingLeft = '32px';
          }
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.paddingLeft = '28px';
          }
        }}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <Text size="sm" fw={active ? 600 : 400}>
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
}

function NavSection({ title, icon, children, defaultOpen = false, userRole, roles }: SectionProps) {
  const [opened, setOpened] = useState(defaultOpen);
  const theme = useMantineTheme();

  if (roles && userRole && !roles.includes(userRole)) {
    return null;
  }

  return (
    <Box mb="xs">
      <Box
        onClick={() => setOpened(!opened)}
        style={{
          cursor: 'pointer',
          padding: '10px 12px',
          borderRadius: theme.radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7] || '#295080';
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Group gap="xs">
          <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
          <Text size="sm" fw={600} c="gray.2" tt="uppercase" style={{ letterSpacing: '1px' }}>
            {title}
          </Text>
        </Group>
        {opened ? (
          <IconChevronDown size={16} color="gray.4" />
        ) : (
          <IconChevronRight size={16} color="gray.4" />
        )}
      </Box>
      {opened && <Box ml="md">{children}</Box>}
    </Box>
  );
}

interface NavbarProps {
  userRole?: Role;
  userName?: string;
  onLogout?: () => void;
}

export default function Navbar({ userRole, userName, onLogout }: NavbarProps) {
  const theme = useMantineTheme();
  const darkBlue = theme.colors.adminBlue?.[8] || '#1b365d';

  // Rôles prédéfinis
  const adminOnly: Role[] = ['admin'];
  const adminAndManager: Role[] = ['admin', 'gestionnaire'];
  const allRoles: Role[] = ['admin', 'gestionnaire', 'commercial', 'stockiste', 'comptable'];
  const revendeurAccess: Role[] = ['admin', 'gestionnaire', 'commercial'];

  return (
    <Stack gap={0} style={{ height: '100%', backgroundColor: darkBlue }}>
      {/* HEADER FIXE - Logo */}
      <Box p="md" pb="xs">
        <Text
          fw={800}
          size="lg"
          c="yellow"
          style={{
            fontFamily: "'Times New Roman', serif",
            textAlign: 'center',
            letterSpacing: '3px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            fontSize: '18px',
          }}
        >
          GESTION PRO
        </Text>
        {userName && (
          <>
            <Divider color={theme.colors.adminBlue?.[6]} my="sm" />
            <Box style={{ textAlign: 'center' }}>
              <Text size="sm" fw={500} c="white">
                {userName}
              </Text>
              <Text size="xs" c="gray.4" tt="capitalize" mt={2}>
                {userRole === 'gestionnaire' ? 'Gestionnaire' : userRole}
              </Text>
            </Box>
          </>
        )}
      </Box>

      <Divider color={theme.colors.adminBlue?.[6]} />

      {/* ZONE DE DÉFILEMENT */}
      <ScrollArea style={{ flex: 1 }} scrollbarSize={6} offsetScrollbars>
        <Stack gap={4} p="md" pt="sm">
          {/* DASHBOARD */}
          <NavItem
            label="Tableau de bord"
            path="/"
            icon={<IconLayoutDashboard size={18} />}
            userRole={userRole}
          />

          <Divider color={theme.colors.adminBlue?.[6]} my="md" />

          {/* SECTION COMMERCIAL */}
          <NavSection
            title="COMMERCIAL"
            icon={<IconShoppingBag size={20} color="white" />}
            userRole={userRole}
            roles={allRoles}
          >
            <NavItem
              label="Clients"
              path="/clients"
              icon={<IconUsers size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Commandes"
              path="/commandes"
              icon={<IconShoppingBag size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Factures"
              path="/factures"
              icon={<IconReceipt size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Ventes"
              path="/ventes"
              icon={<IconBuildingStore size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
          </NavSection>

          {/* SECTION PRODUITS & STOCK */}
          <NavSection
            title="STOCK"
            icon={<IconPackage size={20} color="white" />}
            userRole={userRole}
            roles={allRoles}
          >
            <NavItem
              label="Produits"
              path="/products"
              icon={<IconPackage size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Stock"
              path="/stock"
              icon={<IconBuildingStore size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
          </NavSection>

          {/* SECTION REVENDEURS */}
          <NavSection
            title="REVENDEURS"
            icon={<IconTruck size={20} color="white" />}
            userRole={userRole}
            roles={revendeurAccess}
          >
            <NavItem
              label="Stocks revendeurs"
              path="/commandes-revendeur"
              icon={<IconList size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
              badge="Stock"
              badgeColor="green"
            />
            <NavItem
              label="Décomptes"
              path="/decomptes"
              icon={<IconCalculator size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
              badge="Ventes"
              badgeColor="orange"
            />
            <NavItem
              label="Factures revendeur"
              path="/factures-revendeur"
              icon={<IconFileInvoice size={16} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Commission"
              badgeColor="blue"
            />
          </NavSection>

          {/* SECTION FINANCES */}
          <NavSection
            title="FINANCES"
            icon={<IconMoneybag size={20} color="white" />}
            userRole={userRole}
            roles={adminAndManager}
          >
            <NavItem
              label="Règlements"
              path="/reglements"
              icon={<IconCash size={16} color="gray.4" />}
              roles={adminAndManager}
              userRole={userRole}
            />
            <NavItem
              label="Rapports"
              path="/rapports"
              icon={<IconReportAnalytics size={16} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Nouveau"
              badgeColor="cyan"
            />
          </NavSection>

          {/* SECTION STATISTIQUES */}
          <NavItem
            label="Statistiques"
            path="/statistiques"
            icon={<IconChartBar size={18} />}
            userRole={userRole}
            roles={adminAndManager}
          />

          <Divider color={theme.colors.adminBlue?.[6]} my="md" />

          {/* SECTION PARAMÈTRES */}
          <NavSection
            title="PARAMÈTRES"
            icon={<IconSettings size={20} color="white" />}
            userRole={userRole}
            roles={adminOnly}
            defaultOpen={userRole === 'admin'}
          >
            <NavItem
              label="Utilisateurs"
              path="/utilisateurs"
              icon={<IconUserCog size={16} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
            />
            <NavItem
              label="Atelier"
              path="/parametres"
              icon={<IconSettings size={16} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
            />
            <NavItem
              label="Configuration commerce"
              path="/config-commerce"
              icon={<IconBusinessplan size={16} color="gray.4" />}
              roles={adminOnly}
              userRole={userRole}
              badge="Nouveau"
              badgeColor="cyan"
            />
          </NavSection>
        </Stack>
      </ScrollArea>

      {/* FOOTER FIXE */}
      <Box p="md" pt="xs">
        <Divider color={theme.colors.adminBlue?.[6]} mb="sm" />
        {onLogout && (
          <Box
            onClick={onLogout}
            style={{
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: theme.radius.sm,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              marginBottom: '8px',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[7];
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <IconLogout size={18} color={theme.colors.yellow?.[4]} />
            <Text size="sm" fw={500} c="yellow">
              Déconnexion
            </Text>
          </Box>
        )}
        <Text size="xs" c="dimmed" ta="center" mt={8}>
          © 2026 Gestion Commerciale Pro
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          v3.0.0
        </Text>
      </Box>
    </Stack>
  );
}