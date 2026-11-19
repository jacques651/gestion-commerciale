// src/components/pages/revendeurs/ponctuels/utils/mouvementCycle.ts

export const CYCLE_DE_VIE = {
  // États possibles
  ETATS: {
    CREATION: 'CREATION',
    OUVERT: 'OUVERT',
    PARTIELLEMENT_RETOURNE: 'PARTIELLEMENT_RETOURNE',
    PARTIELLEMENT_VENDU: 'PARTIELLEMENT_VENDU',
    CLOTURE: 'CLOTURE'
  },

  // Transitions autorisées
  TRANSITIONS: {
    'CREATION': ['OUVERT'],
    'OUVERT': ['PARTIELLEMENT_RETOURNE', 'PARTIELLEMENT_VENDU', 'CLOTURE'],
    'PARTIELLEMENT_RETOURNE': ['PARTIELLEMENT_VENDU', 'CLOTURE'],
    'PARTIELLEMENT_VENDU': ['PARTIELLEMENT_RETOURNE', 'CLOTURE'],
    'CLOTURE': [] // Aucune transition depuis CLOTURE
  },

  // Labels
  LABELS: {
    'CREATION': 'Création',
    'OUVERT': 'En circulation',
    'PARTIELLEMENT_RETOURNE': 'Retours partiels',
    'PARTIELLEMENT_VENDU': 'Ventes partielles',
    'CLOTURE': 'Clôturé'
  },

  // Couleurs
  COULEURS: {
    'CREATION': 'gray',
    'OUVERT': 'blue',
    'PARTIELLEMENT_RETOURNE': 'orange',
    'PARTIELLEMENT_VENDU': 'teal',
    'CLOTURE': 'green'
  },

  // Icônes
  ICONES: {
    'CREATION': '📝',
    'OUVERT': '🔄',
    'PARTIELLEMENT_RETOURNE': '↩️',
    'PARTIELLEMENT_VENDU': '💰',
    'CLOTURE': '✅'
  }
};

/**
 * Vérifie si une transition est autorisée
 */
export const isTransitionAllowed = (from: string, to: string): boolean => {
  const allowed = CYCLE_DE_VIE.TRANSITIONS[from as keyof typeof CYCLE_DE_VIE.TRANSITIONS];
  return allowed ? (allowed as string[]).includes(to) : false;
};

/**
 * Récupère le prochain statut possible
 */
export const getNextStatus = (currentStatus: string): string[] => {
  return CYCLE_DE_VIE.TRANSITIONS[currentStatus as keyof typeof CYCLE_DE_VIE.TRANSITIONS] || [];
};