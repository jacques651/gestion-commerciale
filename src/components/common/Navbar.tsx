// src/components/common/Navbar.tsx
import { useState, useEffect } from 'react';
import {
  ScrollArea, Group, Text, Box, Tooltip,
  Avatar, UnstyledButton, Badge, Stack,
  Modal, Paper, ThemeIcon, ActionIcon, Divider, Button,
} from '@mantine/core';
import {
  IconDashboard, IconPackage, IconUsers,
  IconShoppingCart, IconFileInvoice, IconTruckDelivery,
  IconCash, IconReceipt, IconMoneybag, IconChartBar,
  IconSettings, IconUserCog, IconLogout, IconHistory,
  IconBuildingWarehouse, IconCoin, IconCreditCard,
  IconReceipt2, IconUser, IconMail, IconPhone,
  IconBuilding, IconDatabase, IconBug, IconMenu2,
  IconChevronLeft, IconPercentage, IconAlertCircle,
} from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import { getDb } from '../../database/db';

interface NavbarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userCompany?: string;
  onLogout: () => void;
  onProfileUpdate?: () => void;
  onNavClose?: () => void;
}

interface NavItemConfig {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

interface NavSectionConfig {
  title: string;
  icon: React.ReactNode;
  items: NavItemConfig[];
  adminOnly?: boolean;
  defaultOpen?: boolean;
}

// ─── Item de navigation ──────────────────────────────────────────────────────
function NavItem({
  to, label, icon, badge, badgeColor = 'blue', collapsed, active, onNavClose,
}: NavItemConfig & { collapsed: boolean; active: boolean; onNavClose?: () => void }) {
  const inner = (
    <UnstyledButton
      component={Link}
      to={to}
      onClick={onNavClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '10px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 8,
        width: '100%',
        transition: 'all 0.2s ease',
        backgroundColor: active ? 'rgba(244,180,0,0.12)' : 'transparent',
        borderLeft: collapsed ? 'none' : active ? '3px solid #f4b400' : '3px solid transparent',
        position: 'relative',
      }}
      onMouseEnter={e => !active && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => !active && (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <Box style={{ color: active ? '#f4b400' : 'rgba(255,255,255,0.5)', flexShrink: 0, display: 'flex' }}>
        {icon}
      </Box>
      {!collapsed && (
        <>
          <Text size="sm" fw={active ? 600 : 400}
            style={{ flex: 1, color: active ? '#fff' : 'rgba(255,255,255,0.75)' }}>
            {label}
          </Text>
          {badge !== undefined && badge !== 0 && (
            <Badge size="xs" color={badgeColor} variant="filled" radius="sm"
              styles={{ root: { fontSize: 9, padding: '2px 6px', minWidth: 18 } }}>
              {badge}
            </Badge>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge !== 0 && (
        <Box style={{
          position: 'absolute', top: 4, right: 4,
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: badgeColor === 'orange' ? '#f97316' : badgeColor === 'red' ? '#ef4444' : '#3b82f6',
        }} />
      )}
    </UnstyledButton>
  );

  if (collapsed) {
    return (
      <Tooltip label={label} position="right" withArrow
        styles={{ tooltip: { backgroundColor: '#1e3a5f', color: '#fff', fontSize: 12 } }}>
        {inner}
      </Tooltip>
    );
  }
  return inner;
}

// ─── Section de navigation ────────────────────────────────────────────────────
function NavSection({
  title, icon, items, collapsed, activePathname, onNavClose,
}: NavSectionConfig & { collapsed: boolean; activePathname: string; onNavClose?: () => void }) {
  const hasActive = items.some(i => activePathname === i.to || activePathname.startsWith(i.to + '/'));
  const [open, setOpen] = useState<boolean>(hasActive);

  if (collapsed) {
    return (
      <Box mb={4}>
        <Divider style={{ borderColor: 'rgba(255,255,255,0.06)' }} my={6} />
        {items.map(item => (
          <NavItem key={item.to} {...item} collapsed={true} onNavClose={onNavClose}
            active={activePathname === item.to || activePathname.startsWith(item.to + '/')} />
        ))}
      </Box>
    );
  }

  return (
    <Box mb={2}>
      <UnstyledButton
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '6px 12px', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 2,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Box style={{ color: 'rgba(255,255,255,0.25)', display: 'flex' }}>{icon}</Box>
        <Text size="xs" fw={700} tt="uppercase"
          style={{ flex: 1, letterSpacing: '0.8px', color: '#7a9cc4', fontSize: 11 }}>
          {title}
        </Text>
        <Box style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          ›
        </Box>
      </UnstyledButton>
      {open && (
        <Box pl={4}>
          {items.map(item => (
            <NavItem key={item.to} {...item} collapsed={false} onNavClose={onNavClose}
              active={activePathname === item.to || activePathname.startsWith(item.to + '/')} />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Navbar principale ────────────────────────────────────────────────────────
export default function Navbar({ userRole, userName, userEmail, userPhone, userCompany, onLogout, onNavClose }: NavbarProps) {
  const location = useLocation();
  const isAdmin = userRole === 'admin';
  const [collapsed, setCollapsed] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [stats, setStats] = useState({ commandesEnAttente: 0, facturesImpayees: 0 });

  // Charger les indicateurs dynamiques
  useEffect(() => {
    const loadStats = async () => {
      try {
        const db = await getDb();
        const [cmdResult, factResult] = await Promise.all([
          db.select<{ count: number }[]>(`SELECT COUNT(*) as count FROM commandes WHERE statut NOT IN ('LIVREE','ANNULEE')`),
          db.select<{ count: number }[]>(`SELECT COUNT(*) as count FROM factures WHERE statut = 'EN_ATTENTE'`),
        ]);
        setStats({
          commandesEnAttente: cmdResult[0]?.count || 0,
          facturesImpayees: factResult[0]?.count || 0,
        });
      } catch (_) {
        // silencieux si tables pas encore créées
      }
    };
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getRoleColor = () => userRole === 'admin' ? 'red' : userRole === 'gestionnaire' ? 'blue' : 'gray';
  const getRoleLabel = () => userRole === 'admin' ? 'Administrateur' : userRole === 'gestionnaire' ? 'Gestionnaire' : 'Utilisateur';

  const sections: NavSectionConfig[] = [
    {
      title: 'Catalogue',
      icon: <IconPackage size={14} />,
      items: [
        { to: '/products', label: 'Produits', icon: <IconPackage size={17} /> },
        { to: '/clients', label: 'Clients', icon: <IconUsers size={17} /> },
      ],
    },
    {
      title: 'Ventes',
      icon: <IconShoppingCart size={14} />,
      items: [
        {
          to: '/commandes', label: 'Commandes', icon: <IconShoppingCart size={17} />,
          badge: stats.commandesEnAttente || undefined, badgeColor: 'orange',
        },
        {
          to: '/factures', label: 'Factures', icon: <IconFileInvoice size={17} />,
          badge: stats.facturesImpayees || undefined, badgeColor: 'red',
        },
        { to: '/ventes', label: 'Ventes comptoir', icon: <IconChartBar size={17} /> },
      ],
    },
    ...(isAdmin ? [{
      title: 'Revendeurs',
      icon: <IconTruckDelivery size={14} />,
      adminOnly: true,
      items: [
        { to: '/commandes-revendeur', label: 'Commandes', icon: <IconShoppingCart size={17} /> },
        { to: '/factures-revendeur', label: 'Factures', icon: <IconFileInvoice size={17} /> },
        { to: '/decomptes', label: 'Décomptes', icon: <IconReceipt size={17} /> },
        { to: '/stock-revendeurs', label: 'Stock', icon: <IconBuildingWarehouse size={17} /> },
      ],
    }] : []),
    {
      title: 'Finances',
      icon: <IconCoin size={14} />,
      items: [
        { to: '/caisse', label: 'Caisse', icon: <IconCash size={17} />, badge: 'Live', badgeColor: 'green' },
        { to: '/charges', label: 'Charges', icon: <IconMoneybag size={17} /> },
        { to: '/reglements', label: 'Règlements', icon: <IconReceipt2 size={17} /> },
        { to: '/credits', label: 'Crédits', icon: <IconCreditCard size={17} /> },
        { to: '/remboursements', label: 'Remboursements', icon: <IconPercentage size={17} /> },
      ],
    },
    ...(isAdmin ? [{
      title: 'Administration',
      icon: <IconSettings size={14} />,
      adminOnly: true,
      items: [
        { to: '/utilisateurs', label: 'Utilisateurs', icon: <IconUserCog size={17} /> },
        { to: '/parametres', label: 'Paramètres', icon: <IconSettings size={17} /> },
        { to: '/diagnostic', label: 'Diagnostic DB', icon: <IconDatabase size={17} />, badge: 'Admin', badgeColor: 'red' },
        { to: '/debug', label: 'Débogage', icon: <IconBug size={17} />, badge: 'Dev', badgeColor: 'violet' },
      ],
    }] : []),
  ];

  const width = collapsed ? 64 : 280;

  return (
    <>
      <Box
        style={{
          width,
          minWidth: width,
          background: 'linear-gradient(180deg, #0a1628 0%, #122040 50%, #162a4a 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          transition: 'width 0.25s ease, min-width 0.25s ease',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* HEADER */}
        <Box style={{
          padding: '16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          minHeight: 64,
        }}>
          {!collapsed && (
            <Text style={{
              fontSize: 17, fontWeight: 900, letterSpacing: 3,
              color: '#f4b400', fontFamily: 'Georgia, serif',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              GESTION PRO
            </Text>
          )}
          <Tooltip label={collapsed ? 'Développer' : 'Réduire'} position="right">
            <ActionIcon
              variant="subtle"
              onClick={() => setCollapsed(c => !c)}
              style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
            >
              {collapsed ? <IconMenu2 size={18} /> : <IconChevronLeft size={18} />}
            </ActionIcon>
          </Tooltip>
        </Box>

        {/* LIEN DASHBOARD */}
        <Box px={collapsed ? 8 : 12} pt={10} pb={4}>
          <NavItem
            to="/"
            label="Tableau de bord"
            icon={<IconDashboard size={18} />}
            collapsed={collapsed}
            active={location.pathname === '/'}
            onNavClose={onNavClose}
          />
        </Box>

        {/* MENU */}
        <ScrollArea flex={1} px={collapsed ? 8 : 10} styles={{
          scrollbar: { width: 3 },
          thumb: { backgroundColor: 'rgba(255,255,255,0.06)' },
        }}>
          <Stack gap={0} pb={8}>
            {sections.map(section => (
              <NavSection
                key={section.title}
                {...section}
                collapsed={collapsed}
                activePathname={location.pathname}
                onNavClose={onNavClose}
              />
            ))}
          </Stack>
        </ScrollArea>

        {/* FOOTER */}
        <Box style={{
          padding: '10px 10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {/* Indicateurs si collapsed */}
          {collapsed && (stats.commandesEnAttente > 0 || stats.facturesImpayees > 0) && (
            <Tooltip label={`${stats.commandesEnAttente} commandes · ${stats.facturesImpayees} factures impayées`} position="right">
              <Box style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <IconAlertCircle size={18} style={{ color: '#f97316' }} />
              </Box>
            </Tooltip>
          )}

          {/* Profil */}
          <Tooltip label={collapsed ? (userName || 'Profil') : ''} position="right" disabled={!collapsed}>
            <UnstyledButton
              onClick={() => setProfileModalOpen(true)}
              style={{
                width: '100%', padding: collapsed ? '8px 0' : '8px 10px',
                borderRadius: 8, display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Avatar radius="xl" size={34} style={{
                backgroundColor: 'rgba(74,108,247,0.2)',
                color: '#4a6cf7',
                border: '2px solid rgba(74,108,247,0.3)',
                flexShrink: 0, fontSize: 14,
              }}>
                {userName?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              {!collapsed && (
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.85)' }} lineClamp={1}>
                    {userName || 'Utilisateur'}
                  </Text>
                  <Badge size="xs" color={getRoleColor()} variant="dot"
                    styles={{ root: { textTransform: 'none', color: 'rgba(255,255,255,0.5)' } }}>
                    {getRoleLabel()}
                  </Badge>
                </Box>
              )}
            </UnstyledButton>
          </Tooltip>

          {/* Déconnexion */}
          <Tooltip label={collapsed ? 'Déconnexion' : ''} position="right" disabled={!collapsed}>
            <UnstyledButton
              onClick={onLogout}
              style={{
                width: '100%', padding: collapsed ? '8px 0' : '7px 10px',
                borderRadius: 8, display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start',
                color: 'rgba(239,68,68,0.7)', marginTop: 4,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(239,68,68,0.7)';
              }}
            >
              <IconLogout size={17} />
              {!collapsed && <Text size="sm" fw={500}>Déconnexion</Text>}
            </UnstyledButton>
          </Tooltip>
        </Box>
      </Box>

      {/* MODAL PROFIL */}
      <Modal
        opened={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        size="sm"
        centered
        padding={0}
        styles={{
          header: { position: 'absolute', top: 0, right: 0, zIndex: 100, background: 'transparent', padding: '8px' },
          close: { color: 'rgba(255,255,255,0.6)', '&:hover': { background: 'rgba(255,255,255,0.1)' } },
          body: { padding: 0 },
          content: { borderRadius: 14, overflow: 'hidden' },
        }}
      >
        {/* Bannière */}
        <Box style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #122040 60%, #1b365d 100%)',
          padding: '40px 24px 28px',
          textAlign: 'center',
        }}>
          <Avatar
            radius="xl"
            size={76}
            mx="auto"
            mb="sm"
            style={{
              backgroundColor: 'rgba(74,108,247,0.2)',
              color: '#4a6cf7',
              border: '3px solid rgba(74,108,247,0.45)',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {userName?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Text fw={700} size="lg" c="white" mb={6}>{userName || 'Utilisateur'}</Text>
          <Badge
            color={getRoleColor()}
            variant="filled"
            size="md"
            radius="sm"
            style={{ letterSpacing: 0.5 }}
          >
            {getRoleLabel()}
          </Badge>
        </Box>

        {/* Infos */}
        <Box p="lg">
          <Stack gap="xs">
            {userEmail && (
              <Group gap="sm" p="sm" style={{ borderRadius: 8, background: '#f1f3f5' }}>
                <ThemeIcon size={32} color="blue" variant="light" radius="md">
                  <IconMail size={15} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">Email</Text>
                  <Text size="sm" fw={500}>{userEmail}</Text>
                </Box>
              </Group>
            )}
            <Group gap="sm" p="sm" style={{ borderRadius: 8, background: '#f1f3f5' }}>
              <ThemeIcon size={32} color={getRoleColor()} variant="light" radius="md">
                <IconUserCog size={15} />
              </ThemeIcon>
              <Box>
                <Text size="xs" c="dimmed">Rôle</Text>
                <Text size="sm" fw={500}>{getRoleLabel()}</Text>
              </Box>
            </Group>
          </Stack>

          <Button
            fullWidth
            mt="lg"
            color="red"
            variant="light"
            leftSection={<IconLogout size={16} />}
            onClick={() => {
              setProfileModalOpen(false);
              onLogout?.();
            }}
          >
            Se déconnecter
          </Button>
        </Box>
      </Modal>
    </>
  );
};

