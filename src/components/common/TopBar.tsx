// src/components/common/TopBar.tsx
// Barre supérieure blanche (AppShell.Header) : mode clair/sombre + menu utilisateur.
import { useState } from 'react';
import { Menu, UnstyledButton, Tooltip, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { Moon, Sun, ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { ModalProfil } from './ModalProfil';

interface TopBarProps {
  userName?: string;
  userRole?: string;
  onLogout: () => void;
  onProfileUpdate?: () => void;
}

/** « Jacques Korgo » → « J. KORGO » */
export function formatUserName(nom?: string): string {
  const parts = (nom || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Utilisateur';
  if (parts.length === 1) return parts[0].toUpperCase();
  return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(' ').toUpperCase()}`;
}

function initials(nom?: string): string {
  const parts = (nom || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

const roleLabel = (role?: string) =>
  role === 'admin' ? 'Administrateur' : role === 'gestionnaire' ? 'Gestionnaire' : 'Utilisateur';

export default function TopBar({ userName, userRole, onLogout, onProfileUpdate }: TopBarProps) {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: false });
  const [profilOpen, setProfilOpen] = useState(false);
  const dark = computed === 'dark';

  return (
    <div className="tk-topbar">
      <Tooltip label={dark ? 'Mode clair' : 'Mode sombre'} withArrow>
        <UnstyledButton
          className="tk-topbar-round"
          onClick={() => setColorScheme(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Mode clair' : 'Mode sombre'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </UnstyledButton>
      </Tooltip>

      <Menu position="bottom-end" width={240} withinPortal>
        <Menu.Target>
          <UnstyledButton className="tk-user-pill">
            <span className="tk-user-avatar">{initials(userName)}</span>
            <span className="tk-user-text">
              <span className="tk-user-name">{formatUserName(userName)}</span>
              <span className="tk-user-role">{roleLabel(userRole)}</span>
            </span>
            <ChevronDown size={16} className="tk-user-chevron" />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<KeyRound size={16} />} onClick={() => setProfilOpen(true)}>
            Changer le mot de passe
          </Menu.Item>
          <Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={onLogout}>
            Déconnexion
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ModalProfil
        opened={profilOpen}
        onClose={() => setProfilOpen(false)}
        userName={userName || ''}
        userRole={userRole || ''}
        onUpdate={onProfileUpdate}
      />
    </div>
  );
}
