// src/components/ventes/FicheVente.tsx
import React, { useEffect, useState } from 'react';
import { Stack, Card, Title, Text, Group, Button, Badge, LoadingOverlay, Box, SimpleGrid } from '@mantine/core';
import { IconArrowLeft, IconBuildingStore, IconUser, IconCalendar, IconCash, IconPrinter } from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface VenteDetail { idVente: number; code_vente: string; idClient: number; client_nom: string; nom_prenom: string; contact: string; date_vente: string; montant_total: number; type_vente: string; observation: string; }
interface FicheVenteProps { venteId: number; onBack: () => void; }

const FicheVente: React.FC<FicheVenteProps> = ({ venteId, onBack }) => {
  const [vente, setVente] = useState<VenteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const chargerVente = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<VenteDetail[]>(`SELECT v.*, c.nom_complet as client_nom FROM ventes v LEFT JOIN clients c ON v.idClient = c.idClient WHERE v.idVente = ?`, [venteId]);
    setVente(result[0] || null);
    setLoading(false);
  };

  useEffect(() => { chargerVente(); }, [venteId]);
  const handlePrint = () => window.print();

  if (loading) return (<Card withBorder radius="md" p="lg"><LoadingOverlay visible={true} /><Text>Chargement...</Text></Card>);
  if (!vente) return (<Card withBorder radius="md" p="lg"><Text>Vente introuvable</Text><Button mt="md" onClick={onBack}>Retour</Button></Card>);

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1a1a2e">
          <Group justify="space-between"><Group gap="xs"><IconBuildingStore size={24} color="white" /><Title order={2} c="white">Vente {vente.code_vente}</Title></Group>
          <Button variant="light" color="white" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>Retour</Button></Group>
        </Card>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md"><Group gap="xs" mb="xs"><IconUser size={16} /><Text fw={600}>Client</Text></Group><Text size="lg" fw={500}>{vente.client_nom || vente.nom_prenom}</Text>{vente.contact && <Text size="sm" c="dimmed">{vente.contact}</Text>}</Card>
          <Card withBorder radius="md" p="md"><Group gap="xs" mb="xs"><IconCalendar size={16} /><Text fw={600}>Date</Text></Group><Text>{new Date(vente.date_vente).toLocaleDateString('fr-FR')}</Text></Card>
          <Card withBorder radius="md" p="md"><Group gap="xs" mb="xs"><IconBuildingStore size={16} /><Text fw={600}>Type</Text></Group><Badge color={vente.type_vente === 'COMPTOIR' ? 'blue' : 'orange'} variant="light" size="lg">{vente.type_vente === 'COMPTOIR' ? 'Comptoir' : 'Revendeur'}</Badge></Card>
          <Card withBorder radius="md" p="md"><Group gap="xs" mb="xs"><IconCash size={16} /><Text fw={600}>Montant</Text></Group><Text size="xl" fw={700} c="blue">{vente.montant_total.toLocaleString()} FCFA</Text></Card>
        </SimpleGrid>
        {vente.observation && (<Card withBorder radius="md" p="md"><Text fw={600} mb="xs">Observation</Text><Text>{vente.observation}</Text></Card>)}
        <Group justify="flex-end"><Button onClick={handlePrint} leftSection={<IconPrinter size={16} />}>Imprimer</Button></Group>
      </Stack>
    </Box>
  );
};

export default FicheVente;