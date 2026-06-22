// src/components/common/Navbar.tsx
import { useState } from 'react';
import {
  ScrollArea,
  Group,
  Text,
  Box,
  NavLink as MantineNavLink,
  Divider,
  Avatar,
  UnstyledButton,
  Badge,
  Stack,
  Modal,
  Paper,
  SimpleGrid,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Button,
  Grid,
} from '@mantine/core';
import {
  IconDashboard,
  IconPackage,
  IconUsers,
  IconShoppingCart,
  IconFileInvoice,
  IconTruckDelivery,
  IconCash,
  IconReceipt,
  IconMoneybag,
  IconChartBar,
  IconSettings,
  IconUserCog,
  IconLogout,
  IconHistory,
  IconBuildingWarehouse,
  IconCoin,
  IconPercentage,
  IconReportAnalytics,
  IconChevronDown,
  IconChevronRight,
  IconCreditCard,
  IconReceipt2,
  IconUser,
  IconMail,
  IconPhone,
  IconBuilding,
  IconEdit,
  IconLock,
  IconShield,
  IconDatabase,
  IconBug,
  IconDashboard as IconDashboardRevendeur,
} from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userCompany?: string;
  onLogout: () => void;
  onProfileUpdate?: () => void;
}

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
  onClick?: () => void;
}

interface NavSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

// Composant pour un élément de navigation
const NavItem: React.FC<NavItemProps> = ({
  to,
  label,
  icon,
  active,
  badge,
  badgeColor = 'blue',
  disabled = false,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (disabled) {
    return (
      <MantineNavLink
        label={label}
        leftSection={icon}
        disabled
        opacity={0.4}
        styles={{
          root: {
            borderRadius: 8,
            marginBottom: 2,
          },
          label: {
            color: 'rgba(255,255,255,0.4)',
          },
        }}
      />
    );
  }

  return (
    <MantineNavLink
      component={Link}
      to={to}
      label={
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text
            size="sm"
            fw={active ? 600 : 400}
            style={{
              color: active ? '#ffffff' : (isHovered ? '#ffffff' : 'rgba(255,255,255,0.7)'),
              transition: 'color 0.2s ease',
            }}
          >
            {label}
          </Text>
          {badge && (
            <Badge
              size="xs"
              color={badgeColor}
              variant="filled"
              radius="sm"
              styles={{
                root: {
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  fontWeight: 600,
                  fontSize: 9,
                  padding: '2px 8px',
                }
              }}
            >
              {badge}
            </Badge>
          )}
        </Group>
      }
      leftSection={
        <Box style={{
          color: active ? '#4a6cf7' : (isHovered ? '#4a6cf7' : 'rgba(255,255,255,0.45)'),
          transition: 'color 0.2s ease',
        }}>
          {icon}
        </Box>
      }
      active={active}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      styles={{
        root: {
          borderRadius: 8,
          marginBottom: 2,
          padding: '8px 12px',
          transition: 'all 0.2s ease',
          backgroundColor: active
            ? 'rgba(255,255,255,0.12)'
            : (isHovered ? 'rgba(255,255,255,0.06)' : 'transparent'),
          boxShadow: active
            ? '0 4px 12px rgba(0,0,0,0.15)'
            : 'none',
          borderLeft: active
            ? '4px solid #f4b400'
            : '4px solid transparent',
          '&:hover': {
            backgroundColor: active
              ? 'rgba(74, 108, 247, 0.20)'
              : 'rgba(255, 255, 255, 0.08)',
          },
        },
        label: {
          fontSize: 14,
          fontWeight: active ? 600 : 400,
        },
      }}
    />
  );
};

// Composant pour une section de navigation
const NavSection: React.FC<NavSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Box mb={4}>
      <UnstyledButton
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        }}
      >
        {icon && (
          <Box style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </Box>
        )}
        <Text
          size="xs"
          fw={700}
          tt="uppercase"
          style={{
            flex: 1,
            letterSpacing: '0.8px',
            fontSize: 12,
            color: '#B8C7E0',
            fontWeight: 700,
          }}
        >
          {title}
        </Text>
        <Box style={{ color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }}>
          {isOpen ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
        </Box>
      </UnstyledButton>
      {isOpen && (
        <Box pl={8} mt={2}>
          {children}
        </Box>
      )}
    </Box>
  );
};

export default function Navbar({
  userRole,
  userName,
  userEmail,
  userPhone,
  userCompany,
  onLogout,
  onProfileUpdate,
}: NavbarProps) {
  const location = useLocation();
  const isAdmin = userRole === 'admin';
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const getRoleColor = () => {
    switch (userRole) {
      case 'admin':
        return 'red';
      case 'gestionnaire':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'admin':
        return 'Administrateur';
      case 'gestionnaire':
        return 'Gestionnaire';
      default:
        return 'Utilisateur';
    }
  };

  // Vérifie si la section revendeurs est active
  const isRevendeursSectionActive = () => {
    const revendeursPaths = [
      '/commandes-revendeur',
      '/factures-revendeur',
      '/stock-revendeurs',
      '/decomptes',
      '/revendeurs/historique',
      '/dashboard-revendeurs'
    ];
    return revendeursPaths.some(path => location.pathname === path);
  };

  return (
    <>
      <Box
        style={{
          width: 280,
          background: 'linear-gradient(180deg, #0d1520 0%, #162a44 40%, #1a3355 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'relative',
        }}
      >
        {/* HEADER */}
        <Box
          p="md"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
            paddingTop: 25,
            paddingBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '4px',
              color: '#f4b400',
              fontFamily: 'Georgia, Times New Roman, serif',
              textTransform: 'uppercase',
              textShadow: `
                1px 1px 0 #000,
                -1px 1px 0 #000,
                1px -1px 0 #000,
                -1px -1px 0 #000,
                0 3px 6px rgba(0,0,0,0.5)
              `,
            }}
          >
            GESTION PRO
          </Text>

          <Divider
            my="md"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          />
        </Box>

        {/* MENU */}
        <ScrollArea
          flex={1}
          px="sm"
          py="sm"
          style={{ flex: 1 }}
          styles={{
            scrollbar: {
              width: 3,
            },
            thumb: {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          <Stack gap={1}>
            {/* DASHBOARD */}
            <NavItem
              to="/"
              label="Tableau de bord"
              icon={<IconDashboard size={18} />}
              active={location.pathname === '/'}
            />

            <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} my="sm" />

            {/* CATALOGUE */}
            <NavSection
              title="Catalogue"
              icon={<IconPackage size={18} />}
              defaultOpen
            >
              <NavItem
                to="/products"
                label="Produits"
                icon={<IconPackage size={17} />}
                active={location.pathname === '/products'}
              />
              <NavItem
                to="/clients"
                label="Clients"
                icon={<IconUsers size={17} />}
                active={location.pathname === '/clients'}
              />
            </NavSection>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} my="sm" />

            {/* VENTES */}
            <NavSection title="Ventes" icon={<IconShoppingCart size={18} />} defaultOpen>
              <NavItem
                to="/commandes"
                label="Commandes"
                icon={<IconShoppingCart size={18} />}
                active={location.pathname === '/commandes'}
                badge="En cours"
                badgeColor="orange"
              />
              <NavItem
                to="/factures"
                label="Factures"
                icon={<IconFileInvoice size={17} />}
                active={location.pathname === '/factures'}
              />
              <NavItem
                to="/ventes"
                label="Ventes"
                icon={<IconChartBar size={18} />}
                active={location.pathname === '/ventes'}
              />
            </NavSection>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} my="sm" />

            {/* REVENDEURS */}
            {isAdmin && (
              <>
                <NavSection 
                  title="Revendeurs" 
                  icon={<IconTruckDelivery size={18} />} 
                  defaultOpen={isRevendeursSectionActive()}
                >
                  <NavItem
                    to="/commandes-revendeur"
                    label="Commandes"
                    icon={<IconShoppingCart size={18} />}
                    active={location.pathname === '/commandes-revendeur'}
                  />
                  <NavItem
                    to="/factures-revendeur"
                    label="Factures"
                    icon={<IconFileInvoice size={18} />}
                    active={location.pathname === '/factures-revendeur'}
                  />
                  <NavItem
                    to="/stock-revendeurs"
                    label="Stock"
                    icon={<IconBuildingWarehouse size={18} />}
                    active={location.pathname === '/stock-revendeurs'}
                  />
                  <NavItem
                    to="/decomptes"
                    label="Décomptes"
                    icon={<IconReceipt size={18} />}
                    active={location.pathname === '/decomptes'}
                  />
                  <NavItem
                    to="/revendeurs/historique"
                    label="Historique"
                    icon={<IconHistory size={18} />}
                    active={location.pathname === '/revendeurs/historique'}
                  />
                  <NavItem
                    to="/dashboard-revendeurs"
                    label="Dashboard Revendeurs"
                    icon={<IconDashboardRevendeur size={18} />}
                    active={location.pathname === '/dashboard-revendeurs'}
                  />
                </NavSection>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} my="sm" />
              </>
            )}

            {/* FINANCES */}
            <NavSection title="Finances" icon={<IconCoin size={18} />} defaultOpen>
              <NavItem
                to="/caisse"
                label="Journal de caisse"
                icon={<IconCash size={18} />}
                active={location.pathname === '/caisse'}
                badge="Live"
                badgeColor="green"
              />
              <NavItem
                to="/charges"
                label="Charges"
                icon={<IconMoneybag size={18} />}
                active={location.pathname === '/charges'}
              />
              <NavItem
                to="/reglements"
                label="Règlements"
                icon={<IconReceipt size={18} />}
                active={location.pathname === '/reglements'}
              />
              <NavItem
                to="/credits"
                label="Crédits"
                icon={<IconCreditCard size={18} />}
                active={location.pathname === '/credits'}
                badge="Suivi"
                badgeColor="blue"
              />
              <NavItem
                to="/remboursements"
                label="Remboursements"
                icon={<IconReceipt2 size={18} />}
                active={location.pathname === '/remboursements'}
                badge="Historique"
                badgeColor="teal"
              />
              {isAdmin && (
                <>
                  <NavItem
                    to="/commissions"
                    label="Commissions"
                    icon={<IconPercentage size={18} />}
                    active={location.pathname === '/commissions'}
                    disabled
                    badge="Soon"
                    badgeColor="gray"
                  />
                  <NavItem
                    to="/rapports"
                    label="Rapports"
                    icon={<IconReportAnalytics size={18} />}
                    active={location.pathname === '/rapports'}
                    disabled
                    badge="Soon"
                    badgeColor="gray"
                  />
                </>
              )}
            </NavSection>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.05)' }} my="sm" />

            {/* ADMINISTRATION */}
            {isAdmin && (
              <NavSection title="Administration" icon={<IconSettings size={18} />}>
                <NavItem
                  to="/utilisateurs"
                  label="Utilisateurs"
                  icon={<IconUserCog size={18} />}
                  active={location.pathname === '/utilisateurs'}
                />
                <NavItem
                  to="/parametres"
                  label="Paramètres"
                  icon={<IconSettings size={18} />}
                  active={location.pathname === '/parametres'}
                />
                <NavItem
                  to="/diagnostic"
                  label="Diagnostic DB"
                  icon={<IconDatabase size={18} />}
                  active={location.pathname === '/diagnostic'}
                  badge="Admin"
                  badgeColor="red"
                />
                <NavItem
                  to="/debug"
                  label="Débogage"
                  icon={<IconBug size={18} />}
                  active={location.pathname === '/debug'}
                  badge="Dev"
                  badgeColor="violet"
                />
              </NavSection>
            )}
          </Stack>
        </ScrollArea>

        {/* FOOTER */}
        <Box
          p="md"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <UnstyledButton
            onClick={() => setProfileModalOpen(true)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Avatar
              radius="xl"
              size={40}
              style={{
                backgroundColor: 'rgba(74, 108, 247, 0.2)',
                color: '#4a6cf7',
                border: '2px solid rgba(74, 108, 247, 0.3)',
                flexShrink: 0,
              }}
            >
              {userName?.charAt(0).toUpperCase() || 'U'}
            </Avatar>

            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.85)' }} lineClamp={1}>
                {userName || 'Utilisateur'}
              </Text>
              <Group gap="xs">
                <Badge size="xs" color={getRoleColor()} variant="light" style={{ textTransform: 'none' }}>
                  {getRoleLabel()}
                </Badge>
                <Text size="xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <IconChevronRight size={12} />
                </Text>
              </Group>
            </Box>
          </UnstyledButton>

          <UnstyledButton
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              color: 'rgba(239, 68, 68, 0.7)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(239, 68, 68, 0.7)';
            }}
          >
            <IconLogout size={18} />
            <Text size="sm" fw={500}>
              Déconnexion
            </Text>
          </UnstyledButton>
        </Box>
      </Box>

      {/* MODAL PROFIL */}
      <Modal
        opened={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={28} radius="xl" color="blue" variant="light">
              <IconUser size={16} />
            </ThemeIcon>
            <Text fw={600}>Mon Profil</Text>
          </Group>
        }
        size="md"
        centered
        styles={{
          header: {
            backgroundColor: '#1b365d',
            padding: '16px 20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          },
          title: { color: 'white', fontWeight: 600, flex: 1 },
          body: { padding: '20px' },
        }}
      >
        <Stack gap="md">
          <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
            <Avatar
              radius="xl"
              size={80}
              style={{
                backgroundColor: 'rgba(74, 108, 247, 0.15)',
                color: '#4a6cf7',
                border: '3px solid #4a6cf7',
                margin: '0 auto',
              }}
            >
              {userName?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Text fw={700} size="lg" mt="sm">
              {userName || 'Utilisateur'}
            </Text>
            <Badge color={getRoleColor()} variant="light" size="sm" mt={4}>
              {getRoleLabel()}
            </Badge>
          </Paper>

          <SimpleGrid cols={2} spacing="sm">
            <Paper withBorder p="sm" radius="md">
              <Group gap="xs">
                <ThemeIcon color="gray" variant="light" size="sm">
                  <IconUser size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">Nom</Text>
                  <Text size="sm" fw={500}>{userName || '-'}</Text>
                </Box>
              </Group>
            </Paper>

            <Paper withBorder p="sm" radius="md">
              <Group gap="xs">
                <ThemeIcon color="gray" variant="light" size="sm">
                  <IconShield size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">Rôle</Text>
                  <Text size="sm" fw={500}>{getRoleLabel()}</Text>
                </Box>
              </Group>
            </Paper>

            <Paper withBorder p="sm" radius="md">
              <Group gap="xs">
                <ThemeIcon color="gray" variant="light" size="sm">
                  <IconMail size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">Email</Text>
                  <Text size="sm" fw={500}>{userEmail || '-'}</Text>
                </Box>
              </Group>
            </Paper>

            <Paper withBorder p="sm" radius="md">
              <Group gap="xs">
                <ThemeIcon color="gray" variant="light" size="sm">
                  <IconPhone size={14} />
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">Téléphone</Text>
                  <Text size="sm" fw={500}>{userPhone || '-'}</Text>
                </Box>
              </Group>
            </Paper>

            {userCompany && (
              <Grid.Col span={2}>
                <Paper withBorder p="sm" radius="md">
                  <Group gap="xs">
                    <ThemeIcon color="gray" variant="light" size="sm">
                      <IconBuilding size={14} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="dimmed">Entreprise</Text>
                      <Text size="sm" fw={500}>{userCompany}</Text>
                    </Box>
                  </Group>
                </Paper>
              </Grid.Col>
            )}
          </SimpleGrid>

          <Divider />

          <Group justify="space-between">
            <Group>
              <Tooltip label="Modifier le profil">
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={() => {
                    setProfileModalOpen(false);
                    if (onProfileUpdate) onProfileUpdate();
                  }}
                >
                  <IconEdit size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Changer le mot de passe">
                <ActionIcon variant="light" color="orange">
                  <IconLock size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Button variant="light" onClick={() => setProfileModalOpen(false)} size="sm">
              Fermer
            </Button>
          </Group>

          <Text size="xs" c="dimmed" ta="center">
            Dernière connexion: {new Date().toLocaleString()}
          </Text>
        </Stack>
      </Modal>
    </>
  );
}