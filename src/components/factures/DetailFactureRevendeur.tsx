// src/components/factures/DetailFactureRevendeur.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, Center, Text, Button, Group, Paper, ThemeIcon, Box, Badge } from '@mantine/core';
import { IconArrowLeft, IconTruck, IconAlertCircle } from '@tabler/icons-react';

import { factureRevendeurRepository } from '../../database/repositories/factureRevendeurRepository';
import FactureRevendeur from './FactureRevendeur';

export default function DetailFactureRevendeur() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [facture, setFacture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFacture = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 Chargement facture revendeur ID:', id);
        
        const data = await factureRevendeurRepository.getById(Number(id));
        
        console.log('📄 Données facture revendeur reçues:', data);
        console.log('📄 Détails de la facture:', data?.details);
        console.log('📄 Nom du revendeur:', data?.NomComplet);
        
        if (!data) {
          setError('Facture revendeur non trouvée');
        } else {
          setFacture(data);
        }
      } catch (error) {
        console.error('❌ Erreur chargement:', error);
        setError('Erreur lors du chargement de la facture revendeur');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      loadFacture();
    } else {
      setError('ID de facture manquant');
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement de la facture...</Text>
      </Center>
    );
  }

  if (error || !facture) {
    return (
      <Center py={100}>
        <Paper p="xl" withBorder ta="center" style={{ maxWidth: 500 }}>
          <ThemeIcon size={60} radius="xl" color="red" variant="light" mx="auto">
            <IconAlertCircle size={30} />
          </ThemeIcon>
          <Text size="lg" mt="md" fw={600}>{error || 'Facture revendeur non trouvée'}</Text>
          <Text size="sm" c="dimmed" mb="md">
            La facture revendeur que vous recherchez n'existe pas ou a été supprimée.
          </Text>
          <Button onClick={() => navigate('/factures-revendeur')} variant="light" leftSection={<IconArrowLeft size={16} />}>
            Retour aux factures revendeurs
          </Button>
        </Paper>
      </Center>
    );
  }

  return (
    <Box>
      {/* En-tête avec bouton retour */}
      <Paper p="md" radius={0} style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
        <Group justify="space-between" align="center">
          <Button
            variant="light"
            onClick={() => navigate('/factures-revendeur')}
            leftSection={<IconArrowLeft size={16} />}
            size="sm"
          >
            Retour
          </Button>
          <Group gap="xs">
            <ThemeIcon size="sm" color="green" variant="light">
              <IconTruck size={14} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">Facture revendeur</Text>
            <Badge size="sm" color={facture.statut === 'EN_ATTENTE' ? 'orange' : 'green'}>
              {facture.statut || 'EN_ATTENTE'}
            </Badge>
          </Group>
        </Group>
      </Paper>
      
      {/* ✅ Passage des données complètes à FactureRevendeur */}
      <FactureRevendeur facture={facture} />
    </Box>
  );
}