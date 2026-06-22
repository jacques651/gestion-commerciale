// src/types/permissions.ts

export interface Permission {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  defaultRoles: string[];
}

export const PERMISSIONS: Permission[] = [
  // Dashboard
  {
    id: 'dashboard.view',
    label: 'Voir le tableau de bord',
    icon: '📊',
    description: 'Accès au tableau de bord principal',
    category: 'Tableau de bord',
    defaultRoles: ['admin', 'gestionnaire', 'commercial', 'caissier']
  },
  // Produits
  {
    id: 'products.view',
    label: 'Voir les produits',
    icon: '📦',
    description: 'Consulter la liste des produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire', 'commercial', 'caissier']
  },
  {
    id: 'products.create',
    label: 'Créer des produits',
    icon: '➕',
    description: 'Ajouter de nouveaux produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'products.edit',
    label: 'Modifier les produits',
    icon: '✏️',
    description: 'Modifier les informations des produits',
    category: 'Produits',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'products.delete',
    label: 'Supprimer des produits',
    icon: '🗑️',
    description: 'Supprimer des produits de la base',
    category: 'Produits',
    defaultRoles: ['admin']
  },
  // Clients
  {
    id: 'clients.view',
    label: 'Voir les clients',
    icon: '👥',
    description: 'Consulter la liste des clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.create',
    label: 'Créer des clients',
    icon: '➕',
    description: 'Ajouter de nouveaux clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.edit',
    label: 'Modifier les clients',
    icon: '✏️',
    description: 'Modifier les informations des clients',
    category: 'Clients',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'clients.delete',
    label: 'Supprimer des clients',
    icon: '🗑️',
    description: 'Supprimer des clients de la base',
    category: 'Clients',
    defaultRoles: ['admin']
  },
  // Commandes
  {
    id: 'commandes.view',
    label: 'Voir les commandes',
    icon: '🛒',
    description: 'Consulter la liste des commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'commandes.create',
    label: 'Créer des commandes',
    icon: '➕',
    description: 'Créer de nouvelles commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'commandes.edit',
    label: 'Modifier les commandes',
    icon: '✏️',
    description: 'Modifier les commandes existantes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'commandes.delete',
    label: 'Supprimer des commandes',
    icon: '🗑️',
    description: 'Supprimer des commandes',
    category: 'Commandes',
    defaultRoles: ['admin']
  },
  {
    id: 'commandes.validate',
    label: 'Valider les commandes',
    icon: '✅',
    description: 'Valider et confirmer les commandes',
    category: 'Commandes',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Factures
  {
    id: 'factures.view',
    label: 'Voir les factures',
    icon: '📄',
    description: 'Consulter la liste des factures',
    category: 'Factures',
    defaultRoles: ['admin', 'gestionnaire', 'commercial']
  },
  {
    id: 'factures.create',
    label: 'Créer des factures',
    icon: '➕',
    description: 'Générer des factures',
    category: 'Factures',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'factures.delete',
    label: 'Supprimer des factures',
    icon: '🗑️',
    description: 'Supprimer des factures',
    category: 'Factures',
    defaultRoles: ['admin']
  },
  // Ventes
  {
    id: 'ventes.view',
    label: 'Voir les ventes',
    icon: '💳',
    description: 'Consulter la liste des ventes',
    category: 'Ventes',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'ventes.create',
    label: 'Créer des ventes',
    icon: '➕',
    description: 'Enregistrer de nouvelles ventes',
    category: 'Ventes',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'ventes.delete',
    label: 'Supprimer des ventes',
    icon: '🗑️',
    description: 'Supprimer des ventes',
    category: 'Ventes',
    defaultRoles: ['admin']
  },
  // Revendeurs
  {
    id: 'revendeurs.view',
    label: 'Voir les revendeurs',
    icon: '🚚',
    description: 'Consulter les informations des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.commandes',
    label: 'Gérer les commandes revendeurs',
    icon: '🛒',
    description: 'Gérer les commandes des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.factures',
    label: 'Gérer les factures revendeurs',
    icon: '📄',
    description: 'Gérer les factures des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'revendeurs.stock',
    label: 'Gérer le stock revendeurs',
    icon: '📦',
    description: 'Gérer le stock des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin']
  },
  {
    id: 'revendeurs.decomptes',
    label: 'Gérer les décomptes',
    icon: '🧾',
    description: 'Gérer les décomptes des revendeurs',
    category: 'Revendeurs',
    defaultRoles: ['admin']
  },
  // Caisse
  {
    id: 'caisse.view',
    label: 'Voir le journal de caisse',
    icon: '💰',
    description: 'Consulter le journal de caisse',
    category: 'Caisse',
    defaultRoles: ['admin', 'gestionnaire', 'caissier']
  },
  {
    id: 'caisse.charges',
    label: 'Gérer les charges',
    icon: '💳',
    description: 'Gérer les charges de fonctionnement',
    category: 'Caisse',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Finances
  {
    id: 'finances.reglements',
    label: 'Gérer les règlements',
    icon: '💳',
    description: 'Gérer les règlements des factures',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'finances.credits',
    label: 'Gérer les crédits',
    icon: '💳',
    description: 'Gérer les crédits clients et fournisseurs',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  {
    id: 'finances.remboursements',
    label: 'Gérer les remboursements',
    icon: '💸',
    description: 'Gérer les remboursements de crédits',
    category: 'Finances',
    defaultRoles: ['admin', 'gestionnaire']
  },
  // Administration
  {
    id: 'admin.users',
    label: 'Gérer les utilisateurs',
    icon: '👤',
    description: 'Gérer les utilisateurs et leurs droits',
    category: 'Administration',
    defaultRoles: ['admin']
  },
  {
    id: 'admin.parametres',
    label: 'Gérer les paramètres',
    icon: '⚙️',
    description: 'Configurer les paramètres de l\'application',
    category: 'Administration',
    defaultRoles: ['admin']
  },
  {
    id: 'admin.diagnostic',
    label: 'Accéder au diagnostic',
    icon: '🔧',
    description: 'Accéder aux outils de diagnostic',
    category: 'Administration',
    defaultRoles: ['admin']
  },
];