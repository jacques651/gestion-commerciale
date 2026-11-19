// src/components/common/navConfig.ts
// Configuration de navigation partagée (Navbar + PageBanner).
// Sections, liens, badges et droits admin repris à l'identique de l'ancienne Navbar.
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, History, Route, Package, Users, ShoppingCart, FileText,
  ChartColumn, Briefcase, Smartphone, Truck, User, Receipt, Warehouse,
  CheckCheck, UserPlus, Coins, Banknote, Wallet, ReceiptText, CreditCard,
  Percent, Settings, UserCog, KeyRound, Database, Bug,
} from 'lucide-react';

export interface NavItemConfig {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
  badgeColor?: string;
}

export interface NavSectionConfig {
  title: string;
  icon: LucideIcon;
  items: NavItemConfig[];
  adminOnly?: boolean;
}

export interface NavStats {
  commandesEnAttente: number;
  facturesImpayees: number;
}

export const topItems: NavItemConfig[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/guide', label: 'Guide', icon: Route },
];

export function buildSections(isAdmin: boolean, stats: NavStats): NavSectionConfig[] {
  return [
    {
      title: 'Catalogue',
      icon: Package,
      items: [
        { to: '/products', label: 'Produits', icon: Package },
        { to: '/clients', label: 'Clients', icon: Users },
      ],
    },
    {
      title: 'Ventes',
      icon: ShoppingCart,
      items: [
        { to: '/commandes', label: 'Commandes', icon: ShoppingCart, badge: stats.commandesEnAttente || undefined, badgeColor: 'orange' },
        { to: '/factures', label: 'Factures', icon: FileText, badge: stats.facturesImpayees || undefined, badgeColor: 'red' },
        { to: '/ventes', label: 'Ventes comptoir', icon: ChartColumn },
        { to: '/prestations', label: 'Prestations', icon: Briefcase, badge: 'Nouveau', badgeColor: 'teal' },
        { to: '/seconde-main', label: 'Seconde main', icon: Smartphone, badge: 'Nouveau', badgeColor: 'teal' },
      ],
    },
    ...(isAdmin ? [{
      title: 'Revendeurs',
      icon: Truck,
      adminOnly: true,
      items: [
        { to: '/revendeurs/alertes', label: 'Tableau de bord', icon: LayoutDashboard, badge: 'Nouveau', badgeColor: 'blue' },
        { to: '/revendeurs/fiche', label: 'Fiche revendeur', icon: User, badge: 'Nouveau', badgeColor: 'blue' },
        { to: '/commandes-revendeur', label: 'Commandes', icon: ShoppingCart },
        { to: '/factures-revendeur', label: 'Factures', icon: FileText },
        { to: '/decomptes', label: 'Décomptes', icon: Receipt },
        { to: '/stock-revendeurs', label: 'Stock', icon: Warehouse },
        { to: '/revendeurs/coherence', label: 'Contrôle cohérence', icon: CheckCheck, badge: 'Nouveau', badgeColor: 'blue' },
        { to: '/revendeurs/ponctuels', label: 'Revendeurs ponctuels', icon: UserPlus, badge: 'Nouveau', badgeColor: 'teal' },
      ],
    }] : []),
    {
      title: 'Finances',
      icon: Coins,
      items: [
        { to: '/finances/tableau-de-bord', label: 'Tableau de bord', icon: ChartColumn, badge: 'Nouveau', badgeColor: 'teal' },
        { to: '/caisse', label: 'Caisse', icon: Banknote, badge: 'Live', badgeColor: 'green' },
        { to: '/charges', label: 'Charges', icon: Wallet },
        { to: '/reglements', label: 'Règlements', icon: ReceiptText },
        { to: '/credits', label: 'Crédits', icon: CreditCard },
        { to: '/remboursements', label: 'Remboursements', icon: Percent },
      ],
    },
    ...(isAdmin ? [{
      title: 'Administration',
      icon: Settings,
      adminOnly: true,
      items: [
        { to: '/utilisateurs', label: 'Utilisateurs', icon: UserCog },
        { to: '/parametres', label: 'Paramètres', icon: Settings },
        { to: '/licence', label: 'Licence', icon: KeyRound },
        { to: '/diagnostic', label: 'Diagnostic DB', icon: Database, badge: 'Admin', badgeColor: 'red' },
        { to: '/debug', label: 'Débogage', icon: Bug, badge: 'Dev', badgeColor: 'violet' },
        { to: '/dev/licence', label: 'Espace développeur', icon: KeyRound, badge: 'Dev', badgeColor: 'orange' },
      ],
    }] : []),
  ];
}

export const isActivePath = (pathname: string, to: string): boolean =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/');

// Titres de bannière pour les routes absentes du menu (ou plus précises).
const extraTitles: Record<string, string> = {
  '/dashboard-revendeurs': 'Tableau de bord revendeurs',
  '/revendeurs/historique': 'Historique revendeurs',
  '/commandes/nouveau': 'Commandes',
  '/ventes/nouvelle': 'Ventes comptoir',
  '/decomptes/nouveau': 'Décomptes',
};

/** Nom de l'onglet correspondant à la route (préfixe le plus long). */
export function routeTitle(pathname: string): string {
  if (extraTitles[pathname]) return extraTitles[pathname];
  const all = [...topItems, ...buildSections(true, { commandesEnAttente: 0, facturesImpayees: 0 }).flatMap(s => s.items)];
  let best: NavItemConfig | undefined;
  for (const it of all) {
    if (isActivePath(pathname, it.to) && (!best || it.to.length > best.to.length)) best = it;
  }
  return best?.label ?? 'Gestion Pro';
}
