// src/components/commandes/FicheCommande.tsx
import React, { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Title,
  Text,
  Group,
  Button,
  Badge,
  LoadingOverlay,
  Box,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconShoppingBag,
  IconUser,
  IconCalendar,
  IconCash,
  IconPrinter,
  IconFileInvoice,
} from '@tabler/icons-react';
import { getDb } from '../../database/db';

interface CommandeDetail {
  idCommande: number;
  code_commande: string;
  client_nom: string;
  type_commande: string;
  date_commande: string;
  objet: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  code_facture: string;
  date_facture: string;
  total_paye: number;
}

interface FicheCommandeProps {
  commandeId: number;
  onBack: () => void;
}

const FicheCommande: React.FC<FicheCommandeProps> = ({ commandeId, onBack }) => {
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const chargerCommande = async () => {
    setLoading(true);
    const db = await getDb();
    const result = await db.select<CommandeDetail[]>(`
      SELECT 
        c.*, 
        cl.nom_complet as client_nom,
        COALESCE(SUM(p.montant), 0) as total_paye
      FROM commandes c
      JOIN clients cl ON c.idClient = cl.idClient
      LEFT JOIN paiements_commandes p ON p.commande_id = c.idCommande
      WHERE c.idCommande = ?
      GROUP BY c.idCommande
    `, [commandeId]);
    
    if (result.length > 0) {
      const commandeData = result[0];
      // Calculer le statut basé sur le paiement
      const statut = commandeData.total_paye >= commandeData.montant_ttc ? 'PAYEE' :
                     commandeData.total_paye > 0 ? 'PARTIELLE' : 'NON_PAYEE';
      setCommande({ ...commandeData, statut });
    }
    setLoading(false);
  };

  useEffect(() => {
    chargerCommande();
  }, [commandeId]);

  const handlePrint = () => window.print();
  const genererFacture = async () => {
    if (!commande) return;
    const db = await getDb();
    const codeFacture = `FAC-${Date.now()}`;
    await db.execute(`
      UPDATE commandes 
      SET code_facture = ?, date_facture = date('now')
      WHERE idCommande = ?
    `, [codeFacture, commande.idCommande]);
    chargerCommande();
    alert(`Facture ${codeFacture} générée avec succès`);
  };

  const getStatutBadge = () => {
    if (!commande) return { label: 'Inconnu', color: 'gray' };
    switch (commande.statut) {
      case 'NON_PAYEE':
        return { label: 'Non payée', color: 'red' };
      case 'PARTIELLE':
        return { label: 'Partiellement payée', color: 'orange' };
      case 'PAYEE':
        return { label: 'Payée', color: 'green' };
      default:
        return { label: commande.statut, color: 'gray' };
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'SIMPLE' ? '📦 Simple' : '🔄 Revendeur';
  };

  if (loading) {
    return (
      <Card withBorder radius="md" p="lg" pos="relative">
        <LoadingOverlay visible={true} />
        <Text>Chargement...</Text>
      </Card>
    );
  }

  if (!commande) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text>Commande introuvable</Text>
        <Button mt="md" onClick={onBack}>Retour</Button>
      </Card>
    );
  }

  const statutBadge = getStatutBadge();
  const resteAPayer = commande.montant_ttc - (commande.total_paye || 0);

  return (
    <Box p="md">
      <Stack gap="lg">
        <Card withBorder radius="md" p="lg" bg="#1b365d">
          <Group justify="space-between">
            <Group gap="xs">
              <IconShoppingBag size={24} color="white" />
              <Title order={2} c="white">Commande {commande.code_commande}</Title>
            </Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Retour
            </Button>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group gap="xs" mb="xs">
              <IconUser size={16} />
              <Text fw={600}>Client</Text>
            </Group>
            <Text size="lg" fw={500}>{commande.client_nom}</Text>
          </Card>

          <Card withBorder radius="md" p="md">
            <Group gap="xs" mb="xs">
              <IconCalendar size={16} />
              <Text fw={600}>Date</Text>
            </Group>
            <Text>{new Date(commande.date_commande).toLocaleDateString('fr-FR')}</Text>
          </Card>

          <Card withBorder radius="md" p="md">
            <Group gap="xs" mb="xs">
              <IconShoppingBag size={16} />
              <Text fw={600}>Type</Text>
            </Group>
            <Badge color={commande.type_commande === 'SIMPLE' ? 'blue' : 'orange'} variant="light" size="lg">
              {getTypeLabel(commande.type_commande)}
            </Badge>
          </Card>

          <Card withBorder radius="md" p="md">
            <Group gap="xs" mb="xs">
              <IconCash size={16} />
              <Text fw={600}>Statut</Text>
            </Group>
            <Badge color={statutBadge.color} variant="light" size="lg">
              {statutBadge.label}
            </Badge>
          </Card>
        </SimpleGrid>

        {commande.objet && (
          <Card withBorder radius="md" p="md">
            <Text fw={600} mb="xs">Objet</Text>
            <Text>{commande.objet}</Text>
          </Card>
        )}

        <Card withBorder radius="md" p="md">
          <Title order={4} mb="md">Récapitulatif financier</Title>
          <Divider mb="md" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Group justify="space-between">
              <Text>Montant HT :</Text>
              <Text fw={700}>{commande.montant_ht.toLocaleString()} FCFA</Text>
            </Group>
            <Group justify="space-between">
              <Text>Montant TTC :</Text>
              <Text fw={700} size="lg" c="blue">{commande.montant_ttc.toLocaleString()} FCFA</Text>
            </Group>
            <Group justify="space-between">
              <Text>Total payé :</Text>
              <Text fw={700} c="green">{commande.total_paye?.toLocaleString() || '0'} FCFA</Text>
            </Group>
            <Group justify="space-between">
              <Text>Reste à payer :</Text>
              <Text fw={700} c="red">{resteAPayer.toLocaleString()} FCFA</Text>
            </Group>
          </SimpleGrid>
        </Card>

        <Group justify="flex-end">
          <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />}>
            Imprimer
          </Button>
          {!commande.code_facture && (
            <Button onClick={genererFacture} leftSection={<IconFileInvoice size={16} />} variant="outline">
              Générer facture
            </Button>
          )}
        </Group>
      </Stack>
    </Box>
  );
};

export default FicheCommande;