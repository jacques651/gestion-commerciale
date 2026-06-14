// src/components/factures/FactureRevendeur.tsx
import React, { useMemo, useRef } from 'react';
import {
  Paper, Text, Table, Group, Box,
  Button, Image, Divider, SimpleGrid, Title, Badge
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconFileInvoice, IconCalendar, IconUser, IconBuildingStore
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
  qte: number;
  prix_achat: number;
  prix_vente: number;
  benefice_ligne: number;
  commission_ligne: number;
  total_vente: number;
  total_commission: number;
  commission_percent: number;
}

export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({ facture }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  const { detailsWithCalculs, totalVente, totalCommission, totalBenefice } = useMemo(() => {
    const details = facture?.details || [];
    let totalVenteValue = 0;
    let totalCommissionValue = 0;
    let totalBeneficeValue = 0;

    const detailsWithCalculsValue: DetailCalcul[] = details.map((detail: any, idx: number) => {
      const qte = Number(detail.qte_commande || detail.quantite || 1);
      const prixAchat = Number(detail.prix_achat_base || detail.prix_achat || 0);
      const prixVente = Number(detail.prix_unitaire_vente || detail.prix_vente || 0);
      const commissionPercent = Number(detail.commission_pourcentage || detail.commission_percent || 60);
      
      const totalVenteLigne = prixVente * qte;
      const totalAchatLigne = prixAchat * qte;
      const beneficeLigne = totalVenteLigne - totalAchatLigne;
      const commissionLigne = (beneficeLigne * commissionPercent) / 100;

      totalVenteValue += totalVenteLigne;
      totalCommissionValue += commissionLigne;
      totalBeneficeValue += beneficeLigne;

      return {
        numero: idx + 1,
        designation: detail.designation || detail.produit_designation || 'Produit',
        categorie: detail.categorie || '-',
        qte,
        prix_achat: prixAchat,
        prix_vente: prixVente,
        benefice_ligne: beneficeLigne,
        commission_ligne: commissionLigne,
        total_vente: totalVenteLigne,
        total_commission: commissionLigne,
        commission_percent: commissionPercent,
      };
    });

    return {
      detailsWithCalculs: detailsWithCalculsValue,
      totalVente: totalVenteValue,
      totalCommission: totalCommissionValue,
      totalBenefice: totalBeneficeValue,
    };
  }, [facture]);

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
    client_tel: facture.Tel || facture.client_tel || '-',
  };

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb="md" className="no-print">
        <Button size="sm" variant="light" onClick={handlePrint} leftSection={<IconPrinter size={16} />}>
          Imprimer
        </Button>
        <Button size="sm" variant="light" color="teal" onClick={handlePrint} leftSection={<IconDownload size={16} />}>
          PDF
        </Button>
      </Group>

      {/* Facture */}
      <div ref={printRef}>
        <Paper p="md" style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: 'white' }}>
          
          {/* En-tête */}
          <Box style={{ textAlign: 'center', borderBottom: '2px solid #1b365d', paddingBottom: 12, marginBottom: 16 }}>
            {atelier.logo_base64 && (
              <Image src={atelier.logo_base64} alt="Logo" style={{ height: '50px', margin: '0 auto 8px', objectFit: 'contain' }} />
            )}
            <Title order={2} style={{ fontSize: '18px', margin: 0 }}>{atelier.nom_atelier}</Title>
            <Text size="xs" c="dimmed">{atelier.adresse}</Text>
            <Text size="xs" c="dimmed">Tel: {atelier.telephone}</Text>
          </Box>

          {/* Titre */}
          <Title order={3} ta="center" mb="md" style={{ fontSize: '14px', backgroundColor: '#f2d2bc', padding: '4px', borderRadius: '4px' }}>
            FACTURE REVENDEUR
          </Title>

          {/* Infos facture */}
          <SimpleGrid cols={2} spacing="xs" mb="md" style={{ fontSize: '12px' }}>
            <Group gap={4}><IconFileInvoice size={14} /><Text size="xs" fw={600}>N°:</Text><Text size="xs">{factureData.code_facture}</Text></Group>
            <Group gap={4}><IconCalendar size={14} /><Text size="xs" fw={600}>Date:</Text><Text size="xs">{formatDate(factureData.date_facture)}</Text></Group>
            <Group gap={4}><IconUser size={14} /><Text size="xs" fw={600}>Revendeur:</Text><Text size="xs">{factureData.client_nom}</Text></Group>
            <Group gap={4}><IconBuildingStore size={14} /><Text size="xs" fw={600}>Société:</Text><Text size="xs">{factureData.client_societe || '-'}</Text></Group>
          </SimpleGrid>

          <Divider my="xs" />

          {/* Tableau des produits - Version complète comme dans la capture */}
          <Table withColumnBorders style={{ fontSize: '11px', marginBottom: 16 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" ta="center" w={40}>N°</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white">Catégorie</Table.Th>
                <Table.Th c="white" ta="center" w={50}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={80}>P.U.A</Table.Th>
                <Table.Th c="white" ta="right" w={80}>P.U.V</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total Bénéfice</Table.Th>
                <Table.Th c="white" ta="center" w={60}>Commis</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total Vente</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total Commis</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailsWithCalculs.map((detail) => (
                <Table.Tr key={detail.numero}>
                  <Table.Td ta="center">{detail.numero}</Table.Td>
                  <Table.Td fw={500}>{detail.designation}</Table.Td>
                  <Table.Td>{detail.categorie}</Table.Td>
                  <Table.Td ta="center">{detail.qte}</Table.Td>
                  <Table.Td ta="right">{formatMontant(detail.prix_achat)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatMontant(detail.prix_vente)}</Table.Td>
                  <Table.Td ta="right" c="green.7">{formatMontant(detail.benefice_ligne)}</Table.Td>
                  <Table.Td ta="center">
                    <Badge color="orange" variant="light" size="xs">
                      {detail.commission_percent}%
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>{formatMontant(detail.total_vente)}</Table.Td>
                  <Table.Td ta="right" c="orange">{formatMontant(detail.total_commission)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {/* Totaux */}
          <Box style={{ textAlign: 'right', marginBottom: 16 }}>
            <SimpleGrid cols={2} spacing="xs" style={{ maxWidth: '450px', marginLeft: 'auto' }}>
              <Group justify="space-between" style={{ fontSize: '12px' }}>
                <Text fw={600}>Total Ventes:</Text>
                <Text fw={700}>{formatMontant(totalVente)} FCFA</Text>
              </Group>
              <Group justify="space-between" style={{ fontSize: '12px' }}>
                <Text fw={600} c="green.7">Bénéfice Total:</Text>
                <Text c="green.7">{formatMontant(totalBenefice)} FCFA</Text>
              </Group>
              <Group justify="space-between" style={{ fontSize: '12px' }}>
                <Text fw={600} c="orange">Total Commission:</Text>
                <Text c="orange">{formatMontant(totalCommission)} FCFA</Text>
              </Group>
              <Divider my={4} />
              <Group justify="space-between" style={{ fontSize: '14px', marginTop: 8, backgroundColor: '#e8f5e9', padding: '8px', borderRadius: '4px', gridColumn: 'span 2' }}>
                <Text fw={800}>Net à reverser:</Text>
                <Text fw={800} c="green" size="lg">{formatMontant(totalVente - totalCommission)} FCFA</Text>
              </Group>
            </SimpleGrid>
          </Box>

          <Divider my="xs" />

          {/* Message */}
          <Text size="xs" ta="center" fs="italic" c="dimmed">
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