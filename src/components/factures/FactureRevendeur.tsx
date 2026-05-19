// src/components/factures/FactureRevendeur.tsx
import React from 'react';
import { Paper, Title, Text, Table, Group, Stack, Badge, Box, Divider, Flex } from '@mantine/core';

interface FactureRevendeurProps {
  facture: any;
}

interface DetailCalcul {
  numero: number;
  qte: number;
  prix_achat: number;
  prix_vente: number;
  commission_percent: number;
  benefice: number;
  commission: number;
  produit_designation?: string;
  code_produit?: string;
  unite?: string;
}

export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({ facture }) => {
  console.log('📄 Facture reçue dans FactureRevendeur:', facture); // Debug

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

  // Récupérer les détails depuis plusieurs sources possibles
  const detailsFromFacture = facture.details || [];
  const detailsFromCommande = facture.commande?.details || [];
  const details = detailsFromFacture.length > 0 ? detailsFromFacture : detailsFromCommande;

  console.log('📦 Détails trouvés:', details.length); // Debug

  // Calcul des détails avec bénéfice et commission
  let totalHT = 0;
  let totalBenefice = 0;
  let totalCommission = 0;
  
  const detailsWithCalculs: DetailCalcul[] = details.map((detail: any, idx: number) => {
    const qte = detail.qte_commande || detail.quantite || 1;
    const prixAchat = detail.prix_achat_base || detail.prix_achat || 0;
    const prixVente = detail.prix_unitaire_vente || detail.prix_vente || detail.prixVente || 0;
    const commissionPercent = detail.commission_pourcentage || detail.commission || 0;
    
    const totalLigneVente = prixVente * qte;
    const totalLigneAchat = prixAchat * qte;
    const beneficeLigne = totalLigneVente - totalLigneAchat;
    const commissionLigne = (beneficeLigne * commissionPercent) / 100;
    
    totalHT += totalLigneVente;
    totalBenefice += beneficeLigne;
    totalCommission += commissionLigne;
    
    return {
      numero: idx + 1,
      qte,
      prix_achat: prixAchat,
      prix_vente: prixVente,
      commission_percent: commissionPercent,
      benefice: beneficeLigne,
      commission: commissionLigne,
      produit_designation: detail.produit_designation || detail.designation || detail.nom_produit || detail.produit_nom || 'Produit sans nom',
      code_produit: detail.code_produit || '',
      unite: detail.unite || detail.unite_mesure || 'pièce'
    };
  });

  const factureData = {
    code_facture: facture.code_facture || facture.CodeFacture || '-',
    date_facture: facture.date_facture || facture.DateFacture || new Date().toISOString(),
    date_echeance: facture.date_echeance || facture.DateEcheance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    client_nom: facture.client_nom || facture.NomComplet || facture.nom_client || 'Revendeur',
    client_societe: facture.client_societe || facture.Societe || '',
    client_tel: facture.client_tel || facture.Tel || '-',
    client_email: facture.client_email || facture.Email || '',
    client_adresse: facture.client_adresse || facture.Adresse || '',
    client_ville: facture.client_ville || facture.Ville || '',
    code_commande: facture.code_commande || facture.CodeCommande || '-',
  };

  const totalTTC = totalHT;
  const beneficeNet = totalBenefice - totalCommission;
  const tauxCommission = totalBenefice > 0 ? (totalCommission / totalBenefice) * 100 : 0;

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
        {/* Header vert pour revendeur */}
        <Box 
          style={{ 
            background: 'linear-gradient(135deg, #1b5e1f 0%, #2e7d32 100%)',
            padding: '24px',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            color: 'white'
          }}
        >
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={2} style={{ color: 'white', margin: 0 }}>FACTURE REVENDEUR</Title>
              <Text size="sm" opacity={0.8}>Document commercial - Détail des commissions</Text>
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
          {/* Infos facture */}
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
                <Text size="sm" c="dimmed" w={120}>Date échéance :</Text>
                <Text size="sm">{new Date(factureData.date_echeance).toLocaleDateString('fr-FR')}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={120}>N° Commande :</Text>
                <Badge color="green" variant="light" size="sm">{factureData.code_commande}</Badge>
              </Group>
            </Stack>
            <Stack gap={8} align="flex-end">
              <Badge color="green" size="lg">Exonéré TVA</Badge>
              <Badge color="orange" size="sm">Paiement 30 jours</Badge>
            </Stack>
          </Flex>

          {/* Infos client revendeur */}
          <Box 
            style={{ 
              backgroundColor: '#e8f5e9', 
              padding: '16px', 
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid #c8e6c9'
            }}
          >
            <Text fw={600} size="sm" mb="md" c="green.8">🏪 INFORMATIONS REVENDEUR</Text>
            <Flex gap="xl" wrap="wrap">
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="xs" c="dimmed">Nom / Société</Text>
                <Text fw={500} size="sm">{factureData.client_nom}</Text>
                {factureData.client_societe && (
                  <Text size="sm" c="dimmed">{factureData.client_societe}</Text>
                )}
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
                <Text size="xs" c="dimmed" mt="xs">Ville</Text>
                <Text size="sm">{factureData.client_ville || '-'}</Text>
              </Stack>
            </Flex>
          </Box>

          {/* Tableau des produits */}
          <Box style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#e8f5e9' }}>
                  <Table.Th ta="center" w={50}>N°</Table.Th>
                  <Table.Th>Désignation</Table.Th>
                  <Table.Th ta="center" w={80}>Unité</Table.Th>
                  <Table.Th ta="center" w={80}>Qté</Table.Th>
                  <Table.Th ta="right" w={120}>Prix d'achat</Table.Th>
                  <Table.Th ta="right" w={120}>Prix vente</Table.Th>
                  <Table.Th ta="right" w={100}>Bénéfice</Table.Th>
                  <Table.Th ta="center" w={100}>Commission %</Table.Th>
                  <Table.Th ta="right" w={120}>Commission</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detailsWithCalculs.length > 0 ? (
                  detailsWithCalculs.map((detail) => (
                    <Table.Tr key={detail.numero}>
                      <Table.Td ta="center">{detail.numero}</Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{detail.produit_designation}</Text>
                        <Text size="xs" c="dimmed">{detail.code_produit || ''}</Text>
                      </Table.Td>
                      <Table.Td ta="center">{detail.unite}</Table.Td>
                      <Table.Td ta="center">{detail.qte}</Table.Td>
                      <Table.Td ta="right">{formatMontant(detail.prix_achat)} FCFA</Table.Td>
                      <Table.Td ta="right">{formatMontant(detail.prix_vente)} FCFA</Table.Td>
                      <Table.Td ta="right" c="green">{formatMontant(detail.benefice)} FCFA</Table.Td>
                      <Table.Td ta="center">
                        <Badge color="orange" size="sm">{detail.commission_percent}%</Badge>
                      </Table.Td>
                      <Table.Td ta="right" c="blue">{formatMontant(detail.commission)} FCFA</Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={9} ta="center" py="xl">
                      <Text c="dimmed">Aucun produit trouvé</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>

          {/* Récapitulatif */}
          <Flex justify="flex-end">
            <Box style={{ width: '400px' }}>
              <Stack gap="sm">
                <Flex justify="space-between" p="xs" style={{ backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                  <Text size="sm" c="dimmed">Total HT (ventes) :</Text>
                  <Text fw={600}>{formatMontant(totalHT)} FCFA</Text>
                </Flex>
                <Flex justify="space-between" p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                  <Text size="sm" c="dimmed">Bénéfice total :</Text>
                  <Text fw={600} c="green">{formatMontant(totalBenefice)} FCFA</Text>
                </Flex>
                <Flex justify="space-between" p="xs" style={{ backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                  <Text size="sm" c="dimmed">Commission totale ({tauxCommission.toFixed(1)}%) :</Text>
                  <Text fw={600} c="orange">{formatMontant(totalCommission)} FCFA</Text>
                </Flex>
                <Divider />
                <Flex justify="space-between" p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                  <Text fw={700} size="lg">Bénéfice net revendeur :</Text>
                  <Text fw={800} size="lg" c="green">{formatMontant(beneficeNet)} FCFA</Text>
                </Flex>
                <Flex justify="space-between" p="xs" style={{ backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
                  <Text fw={700} size="lg">Total TTC :</Text>
                  <Text fw={800} size="xl" c="green">{formatMontant(totalTTC)} FCFA</Text>
                </Flex>
              </Stack>
            </Box>
          </Flex>

          {/* Footer */}
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

export default FactureRevendeur;