// src/components/factures/DetailFactureRevendeur.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, Center, Text } from '@mantine/core';
import { FactureRevendeur } from './FactureRevendeur';
import { factureRevendeurRepository } from '../../database/repositories/factureRevendeurRepository';

export default function DetailFactureRevendeur() {
  const { id } = useParams();
  const [facture, setFacture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFacture = async () => {
      try {
        const data = await factureRevendeurRepository.getById(Number(id));
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
        <Text>Facture revendeur non trouvée</Text>
      </Center>
    );
  }

  // ✅ Utiliser le composant FactureRevendeur avec le design complet
  return <FactureRevendeur facture={facture} />;
}