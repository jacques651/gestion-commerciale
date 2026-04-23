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
  IconFileText,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react';
import { Role } from '../../types/auth';

interface NavItemProps {
  label: string;
  path: string;
  icon?: React.ReactNode;
  roles?: Role[];
  userRole?: Role;
}

function NavItem({ label, path, icon, roles, userRole }: NavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useMantineTheme();

  if (roles && userRole && !roles.includes(userRole)) {
    return null;
  }

  const active = location.pathname === path;

  const lightBlue = theme.colors.adminBlue?.[5] || '#799bba';
  const hoverBlue = theme.colors.adminBlue?.[6] || '#5c85ad';
  const yellow = theme.colors.yellow?.[4] || '#e6e600';

  return (
    <Box
      onClick={() => navigate(path)}
      style={{
        cursor: 'pointer',
        padding: '6px 10px 6px 28px',
        borderRadius: theme.radius.sm,
        backgroundColor: active ? lightBlue : 'transparent',
        color: yellow,
        fontWeight: active ? 600 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        if (!active) e.currentTarget.style.backgroundColor = hoverBlue;
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
      <Text size="xs">{label}</Text>
    </Box>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function NavSection({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [opened, setOpened] = useState(defaultOpen);
  const theme = useMantineTheme();

  return (
    <Box>
      <Box
        onClick={() => setOpened(!opened)}
        style={{
          cursor: 'pointer',
          padding: '8px 10px',
          borderRadius: theme.radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[6];
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Group gap="xs">
          {icon}
          <Text size="xs" fw={500} c="gray.3">
            {title}
          </Text>
        </Group>
        {opened ? (
          <IconChevronDown size={14} color="gray.4" />
        ) : (
          <IconChevronRight size={14} color="gray.4" />
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

  const adminOnly: Role[] = ['admin'];
  const adminAndManager: Role[] = ['admin', 'gestionnaire' as Role];

  return (
    <Stack gap={0} style={{ height: '100%', backgroundColor: darkBlue }}>
      {/* HEADER FIXE - Logo */}
      <Box p="sm" pb="xs">
        <Text
          fw={700}
          size="xl"
          c="yellow"
          style={{ fontFamily: 'Times New Roman', textAlign: 'center', letterSpacing: '2px', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
          GESTION COMMERCIALE
        </Text>
        {userName && (
          <>
            <Divider color={theme.colors.adminBlue?.[6]} my="xs" />
            <Box style={{ textAlign: 'center' }}>
              <Text size="sm" c="white">{userName}</Text>
              <Text size="xs" c="gray.4" tt="capitalize">{userRole}</Text>
            </Box>
          </>
        )}
      </Box>

      <Divider color={theme.colors.adminBlue?.[6]} />

      {/* ZONE DE DÉFILEMENT */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Stack gap={0} p="sm">
          {/* DASHBOARD */}
          <NavItem
            label="Dashboard"
            path="/"
            icon={<IconLayoutDashboard size={18} />}
            userRole={userRole}
          />

          <Divider color={theme.colors.adminBlue?.[6]} my="xs" />

          {/* SECTION COMMERCIAL */}
          <NavSection title="COMMERCIAL" icon={<IconShoppingBag size={24} color="white" />}>
            <NavItem label="Clients" path="/clients" icon={<IconUsers size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Commandes" path="/commandes" icon={<IconShoppingBag size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Factures" path="/factures" icon={<IconReceipt size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Ventes" path="/ventes" icon={<IconBuildingStore size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
          </NavSection>

          {/* SECTION PRODUITS & STOCK */}
          <NavSection title="PRODUITS & STOCK" icon={<IconPackage size={24} color="white" />}>
            <NavItem label="Produits" path="/products" icon={<IconPackage size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
            <NavItem label="Stock" path="/stock" icon={<IconBuildingStore size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
          </NavSection>

          {/* SECTION FINANCES */}
          <NavSection title="FINANCES" icon={<IconMoneybag size={24} color="white" />}>
            <NavItem label="Décomptes" path="/decomptes" icon={<IconFileText size={18} color="white" />} roles={adminOnly} userRole={userRole} />
            <NavItem label="Règlements" path="/reglements" icon={<IconMoneybag size={18} color="white" />} roles={adminAndManager} userRole={userRole} />
          </NavSection>

          {/* SECTION PARAMÈTRES */}
          <NavSection title="PARAMÈTRES" icon={<IconSettings size={24} color="white" />}>
            <NavItem label="Utilisateurs" path="/utilisateurs" icon={<IconUserCog size={18} color="white" />} roles={adminOnly} userRole={userRole} />
            <NavItem label="Atelier" path="/parametres" icon={<IconSettings size={18} color="white" />} roles={adminOnly} userRole={userRole} />
          </NavSection>
        </Stack>
      </ScrollArea>

      {/* FOOTER FIXE */}
      <Box p="sm" pt="xs">
        <Divider color={theme.colors.adminBlue?.[6]} mb="xs" />
        {onLogout && (
          <Box
            onClick={onLogout}
            style={{
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: theme.radius.sm,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.backgroundColor = theme.colors.adminBlue?.[6];
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <IconLogout size={18} />
            <Text size="sm" c="yellow">Déconnexion</Text>
          </Box>
        )}
        <Text size="xs" c="dimmed" ta="center" mt={4}>
          © 2026 Gestion Commerciale
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          v1.0.0
        </Text>
      </Box>
    </Stack>
  );
}