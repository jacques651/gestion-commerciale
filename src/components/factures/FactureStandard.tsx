// src/components/factures/FactureStandard.tsx
import React, { useState } from 'react';
import { Paper, Text, Table, Group, Stack, Box, Divider, Title, Badge, Flex, Loader } from '@mantine/core';

interface FactureStandardProps {
  facture: any;
}

interface DetailCalcul {
  numero: number;
  qte: number;
  prix_unitaire: number;
  total_ligne: number;
  unite: string;
  designation: string;
  code: string;
}

export const FactureStandard: React.FC<FactureStandardProps> = ({ facture }) => {
  const [loading] = useState(false);

  if (!facture) {
    return (
      <Paper p="xl" ta="center">
        <Text c="red">Données de facture manquantes</Text>
      </Paper>
    );
  }

  const formatMontant = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  // Calcul des détails
  let totalHT = 0;
  const detailsWithCalculs: DetailCalcul[] = (facture.details || []).map((detail: any, idx: number) => {
    const qte = detail.qte_commande || detail.quantite || 0;
    const prix = detail.prix_unitaire_vente || detail.prix_vente || 0;
    const totalLigne = prix * qte;
    totalHT += totalLigne;
    
    return {
      numero: idx + 1,
      qte,
      prix_unitaire: prix,
      total_ligne: totalLigne,
      unite: detail.unite || 'pièce',
      designation: detail.produit_designation || detail.designation || detail.nom_produit || '-',
      code: detail.code_produit || ''
    };
  });

  const tva = totalHT * 0.18;
  const totalTTC = totalHT + tva;

  const factureData = {
    code_facture: facture.code_facture || facture.CodeFacture || '-',
    date_facture: facture.date_facture || facture.DateFacture || new Date().toISOString(),
    client_nom: facture.client_nom || 'Client',
    client_societe: facture.client_societe || '',
    client_tel: facture.client_tel || '-',
    client_email: facture.client_email || '',
    client_adresse: facture.client_adresse || '',
    code_commande: facture.code_commande || '-',
  };

  if (loading) {
    return (
      <Paper p="xl" ta="center">
        <Loader />
        <Text mt="md">Chargement...</Text>
      </Paper>
    );
  }

  return (
    <Box id="facture-content">
      <Paper 
        shadow="lg" 
        radius="md" 
        withBorder 
        style={{ 
          width: '1200px', 
          margin: '0 auto',
          fontFamily: "'Inter', system-ui, sans-serif"
        }}
      >
        <Box 
          style={{ 
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            padding: '24px',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            color: 'white'
          }}
        >
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={2} style={{ color: 'white', margin: 0 }}>FACTURE STANDARD</Title>
              <Text size="sm" opacity={0.8}>Document commercial</Text>
            </Stack>
            <Stack gap={4} align="flex-end">
              <Title order={3} style={{ color: 'white', margin: 0 }}>SAID TELECOM</Title>
              <Text size="xs" opacity={0.8}>Saaba à Kossodo</Text>
              <Text size="xs" opacity={0.8}>Tel: 5130 61 16</Text>
              <Text size="xs" opacity={0.8}>contact@saidtelecom.ci</Text>
            </Stack>
          </Group>
        </Box>

        <Box p="xl">
          <Flex justify="space-between" wrap="wrap" gap="md" mb="xl">
            <Stack gap={8}>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={120}>N° Facture :</Text>
                <Text fw={600} size="sm">{factureData.code_facture}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={120}>Date :</Text>
                <Text size="sm">{new Date(factureData.date_facture).toLocaleDateString('fr-FR')}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={120}>N° Commande :</Text>
                <Badge color="blue" variant="light" size="sm">{factureData.code_commande}</Badge>
              </Group>
            </Stack>
            <Stack gap={8} align="flex-end">
              <Badge color="blue" size="lg">TVA 18%</Badge>
            </Stack>
          </Flex>

          <Box 
            style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px'
            }}
          >
            <Text fw={600} size="sm" mb="md" c="adminBlue">📋 INFORMATIONS CLIENT</Text>
            <Flex gap="xl" wrap="wrap">
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="xs" c="dimmed">Client</Text>
                <Text fw={500} size="sm">{factureData.client_nom}</Text>
                {factureData.client_societe && <Text size="sm" c="dimmed">{factureData.client_societe}</Text>}
              </Stack>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="xs" c="dimmed">Contact</Text>
                <Text size="sm">{factureData.client_tel}</Text>
                <Text size="xs" c="dimmed" mt="xs">Email</Text>
                <Text size="sm">{factureData.client_email || '-'}</Text>
              </Stack>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="xs" c="dimmed">Adresse</Text>
                <Text size="sm">{factureData.client_adresse || '-'}</Text>
              </Stack>
            </Flex>
          </Box>

          {/* Tableau des produits standard */}
          <Box style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#eef3f9' }}>
                  <Table.Th ta="center" w={50}>N°</Table.Th>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th ta="center" w={80}>Unité</Table.Th>
                  <Table.Th ta="center" w={80}>Qté</Table.Th>
                  <Table.Th ta="right" w={120}>P.U HT</Table.Th>
                  <Table.Th ta="right" w={140}>Total HT</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detailsWithCalculs.length > 0 ? (
                  detailsWithCalculs.map((detail: DetailCalcul) => (
                    <Table.Tr key={detail.numero}>
                      <Table.Td ta="center">{detail.numero}</Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{detail.designation}</Text>
                        <Text size="xs" c="dimmed">{detail.code}</Text>
                      </Table.Td>
                      <Table.Td ta="center">{detail.unite}</Table.Td>
                      <Table.Td ta="center">{detail.qte}</Table.Td>
                      <Table.Td ta="right">{formatMontant(detail.prix_unitaire)} FCFA</Table.Td>
                      <Table.Td ta="right" fw={500}>{formatMontant(detail.total_ligne)} FCFA</Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={6} ta="center" py="xl">
                      <Text c="dimmed">Aucun produit trouvé</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>

          <Flex justify="flex-end">
            <Box style={{ width: '320px' }}>
              <Stack gap="sm">
                <Flex justify="space-between">
                  <Text size="sm" c="dimmed">Total HT :</Text>
                  <Text fw={500}>{formatMontant(totalHT)} FCFA</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text size="sm" c="dimmed">TVA (18%) :</Text>
                  <Text fw={500}>{formatMontant(tva)} FCFA</Text>
                </Flex>
                <Divider />
                <Flex justify="space-between" align="center">
                  <Text fw={700} size="lg">Total TTC :</Text>
                  <Text fw={800} size="xl" c="adminBlue">{formatMontant(totalTTC)} FCFA</Text>
                </Flex>
              </Stack>
            </Box>
          </Flex>

          <Divider my="md" />
          <Box style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text size="xs" c="dimmed">
              Merci de votre confiance - SAID TELECOM - Tel: 5130 61 16
            </Text>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};