// src/components/common/Navbar.tsx
// Barre latérale « Vert-ardoise » (lucide-react). Le profil et la déconnexion
// sont dans TopBar. Styles : theme-gestion-commerciale.css (classes tk-nav-*).
import { useState, useEffect } from 'react';
import { ScrollArea, Tooltip, Badge, UnstyledButton } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { Store, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react';
import { getDb } from '../../database/db';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import {
  buildSections, topItems, isActivePath,
  type NavItemConfig, type NavSectionConfig, type NavStats,
} from './navConfig';

interface NavbarProps {
  userRole?: string;
  onNavClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Sous 900 px : bandeau horizontal en haut, sans bouton de réduction. */
  horizontal?: boolean;
}

function NavItem({
  item, collapsed, active, onNavClose,
}: { item: NavItemConfig; collapsed: boolean; active: boolean; onNavClose?: () => void }) {
  const Icon = item.icon;
  const hasBadge = item.badge !== undefined && item.badge !== 0;
  const link = (
    <Link
      to={item.to}
      onClick={onNavClose}
      className="tk-nav-link"
      data-active={active || undefined}
      data-collapsed={collapsed || undefined}
    >
      <Icon size={18} className="tk-nav-icon" />
      {!collapsed && <span className="tk-nav-label">{item.label}</span>}
      {!collapsed && hasBadge && (
        <Badge size="xs" color={item.badgeColor} variant="filled" radius="sm">{item.badge}</Badge>
      )}
      {collapsed && hasBadge && <span className="tk-nav-dot" />}
    </Link>
  );
  return collapsed
    ? <Tooltip label={item.label} position="right" withArrow>{link}</Tooltip>
    : link;
}

function NavSection({
  section, collapsed, pathname, onNavClose,
}: { section: NavSectionConfig; collapsed: boolean; pathname: string; onNavClose?: () => void }) {
  const hasActive = section.items.some(i => isActivePath(pathname, i.to));
  const [open, setOpen] = useState<boolean>(hasActive);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  if (collapsed) {
    return (
      <div className="tk-nav-section">
        <div className="tk-nav-sep" />
        {section.items.map(item => (
          <NavItem key={item.to} item={item} collapsed onNavClose={onNavClose} active={isActivePath(pathname, item.to)} />
        ))}
      </div>
    );
  }

  return (
    <div className="tk-nav-section">
      <UnstyledButton className="tk-nav-section-title" onClick={() => setOpen(o => !o)}>
        <span>{section.title}</span>
        <ChevronRight size={14} className="tk-nav-chevron" data-open={open || undefined} />
      </UnstyledButton>
      {open && section.items.map(item => (
        <NavItem key={item.to} item={item} collapsed={false} onNavClose={onNavClose} active={isActivePath(pathname, item.to)} />
      ))}
    </div>
  );
}

export default function Navbar({ userRole, onNavClose, collapsed: collapsedProp, onToggleCollapse, horizontal = false }: NavbarProps) {
  const location = useLocation();
  const { config } = useAtelierConfig();
  const isAdmin = userRole === 'admin';
  const collapsed = !horizontal && (collapsedProp ?? false);
  const [stats, setStats] = useState<NavStats>({ commandesEnAttente: 0, facturesImpayees: 0 });

  // Indicateurs dynamiques (requêtes inchangées)
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

  const sections = buildSections(isAdmin, stats);
  const pathname = location.pathname;

  if (horizontal) {
    return (
      <nav className="tk-nav tk-nav--horizontal">
        <div className="tk-nav-brand">
          <Store size={18} className="tk-nav-icon" />
          <span className="tk-nav-title">Gestion Pro</span>
        </div>
        <div className="tk-nav-row">
          {[...topItems, ...sections.flatMap(s => s.items)].map(item => (
            <NavItem key={item.to} item={item} collapsed={false} onNavClose={onNavClose} active={isActivePath(pathname, item.to)} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="tk-nav" data-collapsed={collapsed || undefined}>
      <div className="tk-nav-header">
        {!collapsed && (
          <div className="tk-nav-brand-block">
            <div className="tk-nav-eyebrow">{config?.nom_atelier ?? ''}</div>
            <div className="tk-nav-brand">
              <Store size={18} className="tk-nav-icon" />
              <span className="tk-nav-title">Gestion Pro</span>
            </div>
          </div>
        )}
        <Tooltip label={collapsed ? 'Développer' : 'Réduire'} position="right" withArrow>
          <UnstyledButton className="tk-nav-toggle" onClick={() => onToggleCollapse?.()}
            aria-label={collapsed ? 'Développer' : 'Réduire'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </UnstyledButton>
        </Tooltip>
      </div>

      <ScrollArea className="tk-nav-scroll" type="hover" scrollbarSize={6}>
        <div className="tk-nav-section">
          {topItems.map(item => (
            <NavItem key={item.to} item={item} collapsed={collapsed} onNavClose={onNavClose} active={isActivePath(pathname, item.to)} />
          ))}
        </div>
        {sections.map(section => (
          <NavSection key={section.title} section={section} collapsed={collapsed} pathname={pathname} onNavClose={onNavClose} />
        ))}
      </ScrollArea>

      <div className="tk-nav-footer">
        {collapsed ? (
          <Tooltip label="Gestion Pro v1.0 · Licence Active" position="right" withArrow>
            <span className="tk-nav-pill tk-nav-pill--dot"><span className="tk-nav-pill-dot" /></span>
          </Tooltip>
        ) : (
          <span className="tk-nav-pill"><span className="tk-nav-pill-dot" />Gestion Pro v1.0 · Licence Active</span>
        )}
      </div>
    </nav>
  );
}
