// src/hooks/useAtelierConfig.ts
import { useEffect, useState } from 'react';
import { getDb } from '../database/db';

export interface AtelierConfig {
  id: number;
  nom_atelier: string;
  forme_juridique: string;
  telephone: string;
  adresse: string;
  adresse_postale: string;
  adresse_cadastrale: string;
  email: string;
  ifu: string;
  rccm: string;
  compte_bancaire: string;
  regime_fiscal: string;
  service_impots: string;
  message_facture: string;
  logo_base64: string;
  tva_active: number; // 1 = TVA 18% activée, 0 = sans TVA (prix TTC direct)
}

const DEFAULTS: AtelierConfig = {
  id: 1,
  nom_atelier: 'MON COMMERCE',
  forme_juridique: '',
  telephone: '',
  adresse: '',
  adresse_postale: '',
  adresse_cadastrale: '',
  email: '',
  ifu: '',
  rccm: '',
  compte_bancaire: '',
  regime_fiscal: '',
  service_impots: '',
  message_facture: 'Merci de votre confiance',
  logo_base64: '',
  tva_active: 0,
};

export const useAtelierConfig = () => {
  const [config, setConfig] = useState<AtelierConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      try {
        const db = await getDb();
        const data = await db.select<any[]>('SELECT * FROM configuration_atelier WHERE id = 1');
        if (data.length) {
          // Fusionner avec les defaults pour les colonnes potentiellement absentes
          setConfig({ ...DEFAULTS, ...data[0] });
        } else {
          setConfig(DEFAULTS);
        }
      } catch (error) {
        console.error('Erreur chargement config atelier:', error);
        setConfig(DEFAULTS);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  return { config, loading };
};
