// src/components/factures/DetailFacture.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, Center, Text } from '@mantine/core';
import { FactureStandard } from './FactureStandard';
import { factureRepository } from '../../database/repositories/factureRepository';

export default function DetailFacture() {
  const { id } = useParams();
  const [facture, setFacture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacture = async () => {
      try {
        const data = await factureRepository.getById(Number(id));
        setFacture(data);
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadFacture();
  }, [id]);

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  if (!facture) {
    return (
      <Center py={100}>
        <Text>Facture non trouvée</Text>
      </Center>
    );
  }

  // ✅ Utiliser le composant FactureStandard avec le design complet
  return <FactureStandard facture={facture} />;
}