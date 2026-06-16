// src/components/factures/FactureRevendeur.tsx
import React, { useMemo, useRef, useEffect } from 'react';
import {
  Paper, Text, Table, Group, Box,
  Button, Image, Divider, SimpleGrid, Badge, Flex
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconPercentage
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';

interface FactureRevendeurProps {
  facture: any;
}

interface DetailCalcul {
  numero: number;
  designation: string;
  categorie: string;
  unite: string;
  qte: number;
  prix_achat: number;
  prix_vente: number;
  benefice_ligne: number;
  commission_ligne: number;
  total_vente: number;
}

export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({ facture }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  // Récupérer le taux de commission UNIQUE de la facture/commande
  const tauxCommissionUnique = useMemo(() => {
    const taux = facture?.taux_commission_revendeur 
      || facture?.commande?.commission_pourcentage
      || facture?.commission_pourcentage 
      || 60;
    
    return Number(taux);
  }, [facture]);

  useEffect(() => {
    console.log('=== 🔍 FACTURE REVENDEUR ===');
    console.log('Taux commission unique:', tauxCommissionUnique, '%');
  }, [facture, tauxCommissionUnique]);

  const { detailsWithCalculs, totalVente, totalCommission, totalBenefice } = useMemo(() => {
    const details = facture?.details || [];
    let totalVenteValue = 0;
    let totalCommissionValue = 0;
    let totalBeneficeValue = 0;

    const detailsWithCalculsValue: DetailCalcul[] = details.map((detail: any, idx: number) => {
      const qte = Number(detail.qte_commande || detail.quantite || 1);
      const prixAchat = Number(detail.prix_achat_base || detail.prix_achat || 0);
      const prixVente = Number(detail.prix_unitaire_vente || detail.prix_vente || 0);
      const unite = detail.unite_base || detail.unite_mesure || detail.unite || 'pièce';
      
      const totalVenteLigne = prixVente * qte;
      const totalAchatLigne = prixAchat * qte;
      const beneficeLigne = totalVenteLigne - totalAchatLigne;
      const commissionLigne = (beneficeLigne * tauxCommissionUnique) / 100;

      totalVenteValue += totalVenteLigne;
      totalCommissionValue += commissionLigne;
      totalBeneficeValue += beneficeLigne;

      return {
        numero: idx + 1,
        designation: detail.designation || detail.produit_designation || 'Produit',
        categorie: detail.categorie || '-',
        unite,
        qte,
        prix_achat: prixAchat,
        prix_vente: prixVente,
        benefice_ligne: beneficeLigne,
        commission_ligne: commissionLigne,
        total_vente: totalVenteLigne,
      };
    });

    return {
      detailsWithCalculs: detailsWithCalculsValue,
      totalVente: totalVenteValue,
      totalCommission: totalCommissionValue,
      totalBenefice: totalBeneficeValue,
    };
  }, [facture, tauxCommissionUnique]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Facture_${facture?.code_facture || 'facture'}`,
  });

  const formatMontant = (value: number | string | undefined | null): string => {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
      return '-';
    }
  };

  const atelier = atelierConfig || {
    nom_atelier: 'MON ATELIER',
    telephone: '',
    adresse: '',
    email: '',
    message_facture: 'Merci de votre confiance',
    logo_base64: ''
  };

  if (atelierLoading || !facture) {
    return (
      <Paper p="xl" ta="center">
        <Text>Chargement...</Text>
      </Paper>
    );
  }

  const factureData = {
    code_facture: facture.code_facture || '-',
    date_facture: facture.date_facture || new Date().toISOString(),
    client_nom: facture.NomComplet || facture.client_nom || 'Revendeur',
    client_societe: facture.Societe || facture.client_societe || '',
  };

  const netAReverser = totalVente - totalCommission;

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb="xs" className="no-print">
        <Button size="xs" variant="subtle" onClick={handlePrint} leftSection={<IconPrinter size={12} />}>
          Imprimer
        </Button>
        <Button size="xs" variant="subtle" color="teal" onClick={handlePrint} leftSection={<IconDownload size={12} />}>
          PDF
        </Button>
      </Group>

      <div ref={printRef}>
        <Paper p="xs" style={{ maxWidth: '1300px', margin: '0 auto', backgroundColor: 'white' }}>
          
          {/* En-tête compact */}
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs" style={{ borderBottom: '1px solid #1b365d', paddingBottom: 6, marginBottom: 8 }}>
            <Flex align="center" gap="xs">
              {atelier.logo_base64 && (
                <Image src={atelier.logo_base64} alt="Logo" style={{ height: '30px', objectFit: 'contain' }} />
              )}
              <Box>
                <Text fw={700} size="xs">{atelier.nom_atelier}</Text>
                <Text size="xs" c="dimmed">{atelier.telephone}</Text>
              </Box>
            </Flex>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={600}>N°{factureData.code_facture}</Text>
              <Text size="xs" c="dimmed">{formatDate(factureData.date_facture)}</Text>
            </Box>
          </Flex>

          {/* Titre */}
          <Text ta="center" fw={700} size="xs" style={{ backgroundColor: '#f2d2bc', padding: '2px', borderRadius: '4px', marginBottom: 8 }}>
            FACTURE REVENDEUR
          </Text>

          {/* Infos client */}
          <Flex justify="space-between" wrap="wrap" gap="xs" mb="xs" style={{ fontSize: '14px' }}>
            <Text><Text span fw={600}>Revendeur:</Text> {factureData.client_nom}</Text>
            <Text><Text span fw={600}>Société:</Text> {factureData.client_societe || '-'}</Text>
          </Flex>

          <Divider my={4} />

          {/* Tableau */}
          <Table withColumnBorders style={{ fontSize: '14px', marginBottom: 12 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" ta="center" w={25}>#</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white">Catégorie</Table.Th>
                <Table.Th c="white" ta="center" w={80}>Unité</Table.Th>
                <Table.Th c="white" ta="center" w={60}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={90}>P.A (F)</Table.Th>
                <Table.Th c="white" ta="right" w={90}>P.V (F)</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Bénéf (F)</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total (F)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailsWithCalculs.map((detail) => (
                <Table.Tr key={detail.numero}>
                  <Table.Td ta="center">{detail.numero}</Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={500}>{detail.designation}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{detail.categorie}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="xs" variant="light" color="gray" style={{ fontSize: '12px' }}>
                      {detail.unite}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="center">{detail.qte}</Table.Td>
                  <Table.Td ta="right">{formatMontant(detail.prix_achat)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatMontant(detail.prix_vente)}</Table.Td>
                  <Table.Td ta="right" c="green.7">{formatMontant(detail.benefice_ligne)}</Table.Td>
                  <Table.Td ta="right" fw={700}>{formatMontant(detail.total_vente)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Divider my={4} />

          {/* Section bas compacte - 2 lignes seulement */}
          {/* Ligne 1: Totaux */}
          <SimpleGrid cols={3} spacing={6} mb={6}>
            <Paper p="xs" withBorder>
              <Flex justify="space-between" gap={8}>
                <Text size="xs" fw={600}>Total Ventes:</Text>
                <Text size="xs" fw={700}>{formatMontant(totalVente)} FCFA</Text>
              </Flex>
            </Paper>
            <Paper p="xs" withBorder style={{ backgroundColor: '#e8f5e9' }}>
              <Flex justify="space-between" gap={8}>
                <Text size="xs" fw={600}>Bénéfice Total:</Text>
                <Text size="xs" fw={600} c="green">{formatMontant(totalBenefice)} FCFA</Text>
              </Flex>
            </Paper>
            <Paper p="xs" withBorder style={{ backgroundColor: '#fff3e0' }}>
              <Flex justify="space-between" gap={8}>
                <Text size="xs" fw={600}>Commission ({tauxCommissionUnique}%):</Text>
                <Text size="xs" fw={600} c="orange">{formatMontant(totalCommission)} FCFA</Text>
              </Flex>
            </Paper>
          </SimpleGrid>

          {/* Ligne 2: Net à reverser */}
          <Paper p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs">
                <IconPercentage size={16} color="#2e7d32" />
                <Text fw={700} size="sm">NET À REVERSER :</Text>
              </Group>
              <Text fw={800} size="lg" c="green">{formatMontant(netAReverser)} FCFA</Text>
            </Flex>
          </Paper>

          {/* Message */}
          <Text size="xs" ta="center" fs="italic" c="dimmed" mt="sm">
            {atelier.message_facture}
          </Text>
        </Paper>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default FactureRevendeur;