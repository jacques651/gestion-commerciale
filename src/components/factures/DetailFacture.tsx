// src/components/factures/DetailFacture.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, Center, Text, Button, Group, Paper, ThemeIcon, Box } from '@mantine/core';
import { IconArrowLeft, IconFileInvoice } from '@tabler/icons-react';
import { FactureStandard } from './FactureStandard';
import { factureRepository } from '../../database/repositories/factureRepository';

export default function DetailFacture() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [facture, setFacture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFacture = async () => {
      try {
        setError(null);
        const data = await factureRepository.getById(Number(id));
        if (!data) {
          setError('Facture non trouvée');
        } else {
          setFacture(data);
        }
      } catch (error) {
        console.error('Erreur:', error);
        setError('Erreur lors du chargement de la facture');
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

  if (error || !facture) {
    return (
      <Center py={100}>
        <Paper p="xl" withBorder ta="center" style={{ maxWidth: 400 }}>
          <ThemeIcon size={60} radius="xl" color="red" variant="light" mx="auto">
            <IconFileInvoice size={30} />
          </ThemeIcon>
          <Text size="lg" mt="md" fw={600}>{error || 'Facture non trouvée'}</Text>
          <Text size="sm" c="dimmed" mb="md">
            La facture que vous recherchez n'existe pas ou a été supprimée.
          </Text>
          <Button onClick={() => navigate('/factures')} variant="light" leftSection={<IconArrowLeft size={16} />}>
            Retour aux factures
          </Button>
        </Paper>
      </Center>
    );
  }

  return (
    <Box>
      {/* En-tête avec bouton retour */}
      <Paper p="md" radius={0} style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }} className="no-print">
        <Group justify="space-between" align="center">
          <Button
            variant="light"
            onClick={() => navigate('/factures')}
            leftSection={<IconArrowLeft size={16} />}
            size="sm"
          >
            Retour aux factures
          </Button>
          <Group gap="xs">
            <ThemeIcon size="sm" color="blue" variant="light">
              <IconFileInvoice size={14} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">Facture standard</Text>
          </Group>
        </Group>
      </Paper>
      
      {/* Contenu de la facture */}
      <FactureStandard facture={facture} />
    </Box>
  );
}