// src/hooks/useAtelierConfig.ts
import { useEffect, useState } from 'react';
import { getDb } from '../database/db';

interface AtelierConfig {
  id: number;
  nom_atelier: string;
  telephone: string;
  adresse: string;
  email: string;
  nif: string;
  message_facture: string;
  logo_base64: string;
}

export const useAtelierConfig = () => {
  const [config, setConfig] = useState<AtelierConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      try {
        const db = await getDb();
        const data = await db.select<AtelierConfig[]>("SELECT * FROM configuration_atelier WHERE id = 1");
        if (data.length) {
          setConfig(data[0]);
        } else {
          // Valeurs par défaut
          setConfig({
            id: 1,
            nom_atelier: 'SAID TELECOM',
            telephone: '5130 61 16',
            adresse: 'Saaba à Kossodo',
            email: 'contact@saidtelecom.ci',
            nif: '',
            message_facture: 'Merci de votre confiance',
            logo_base64: ''
          });
        }
      } catch (error) {
        console.error('Erreur chargement config atelier:', error);
      } finally {
        setLoading(false);
      }
    };
    charger();
  }, []);

  return { config, loading };
};