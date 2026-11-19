// src/hooks/useTVAConfig.ts
import { useCallback, useEffect, useState } from 'react';
import { tvaService, TVAConfig, TVA_DEFAULT } from '../services/tvaService';

/**
 * Hook de lecture de la configuration TVA (source de vérité unique).
 * Utilisé par les factures, reçus et tous les documents imprimés afin que la
 * désactivation de la TVA dans les paramètres s'applique partout.
 */
export const useTVAConfig = () => {
  const [config, setConfig] = useState<TVAConfig>(TVA_DEFAULT);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async (force = false) => {
    try {
      const cfg = await tvaService.get(force);
      setConfig(cfg);
    } catch (error) {
      console.error('Erreur chargement config TVA:', error);
      setConfig({ ...TVA_DEFAULT });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return {
    /** true si la TVA doit être appliquée */
    tvaActive: config.active,
    /** taux en pourcentage (18 = 18 %) */
    tauxTVA: config.taux,
    /** multiplicateur prêt à l'emploi : 0 si TVA désactivée */
    coefficientTVA: config.active ? config.taux / 100 : 0,
    config,
    loading,
    recharger: () => charger(true),
  };
};

export default useTVAConfig;
