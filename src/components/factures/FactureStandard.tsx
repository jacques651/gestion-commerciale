// src/components/factures/FactureStandard.tsx
import React, { useMemo, useRef } from 'react';
import { 
  Paper, Text, Table, Group, Box, Divider, 
  Title, Button, Image,
  SimpleGrid
} from '@mantine/core';
import { 
  IconPrinter, IconDownload, 
  IconFileInvoice, IconCalendar, IconUser, 
  IconBuildingStore} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';

interface FactureStandardProps {
  facture: any;
  onPrint?: () => void;
  onDownload?: () => void;
}

interface DetailsWithCalculs {
  numero: number;
  designation: string;
  qte: number;
  prix_unitaire: number;
  total_ligne: number;
}

export const FactureStandard: React.FC<FactureStandardProps> = ({
  facture,
  onDownload
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  const { detailsWithCalculs, totalHT, totalTTC } = useMemo<{
    detailsWithCalculs: DetailsWithCalculs[];
    totalHT: number;
    totalTTC: number;
  }>(() => {
    let totalHTValue = 0;
    const details = (facture?.details || []).map((detail: any, idx: number): DetailsWithCalculs => {
      const qte = detail.qte_commande || detail.quantite || 0;
      const prix = detail.prix_unitaire_vente || detail.prix_vente || 0;
      const totalLigne = prix * qte;
      totalHTValue += totalLigne;
      
      return {
        numero: idx + 1,
        qte,
        prix_unitaire: prix,
        total_ligne: totalLigne,
        designation: detail.designation || detail.produit_nom || '-'
      };
    });

    return {
      detailsWithCalculs: details,
      totalHT: totalHTValue,
      totalTTC: totalHTValue * 1.18
    };
  }, [facture]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Facture_${facture?.code_facture || 'facture'}`,
  });

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      handlePrint();
    }
  };

  const formatMontant = (value: number | undefined | null): string => {
    if (!value) return '0';
    return value.toLocaleString('fr-FR');
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

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb="md" className="no-print">
        <Button size="sm" variant="light" onClick={handlePrint} leftSection={<IconPrinter size={16} />}>
          Imprimer
        </Button>
        <Button size="sm" variant="light" color="teal" onClick={handleDownload} leftSection={<IconDownload size={16} />}>
          PDF
        </Button>
      </Group>

      {/* Facture */}
      <div ref={printRef}>
        <Paper p="md" style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white' }}>
          
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
            FACTURE STANDARD
          </Title>

          {/* Infos facture */}
          <SimpleGrid cols={2} spacing="xs" mb="md" style={{ fontSize: '12px' }}>
            <Group gap={4}><IconFileInvoice size={14} /><Text size="xs" fw={600}>N°:</Text><Text size="xs">{facture.code_facture}</Text></Group>
            <Group gap={4}><IconCalendar size={14} /><Text size="xs" fw={600}>Date:</Text><Text size="xs">{formatDate(facture.date_facture)}</Text></Group>
            <Group gap={4}><IconUser size={14} /><Text size="xs" fw={600}>Client:</Text><Text size="xs">{facture.NomComplet || facture.client_nom}</Text></Group>
            <Group gap={4}><IconBuildingStore size={14} /><Text size="xs" fw={600}>Commande:</Text><Text size="xs">{facture.code_commande || '-'}</Text></Group>
          </SimpleGrid>

          <Divider my="xs" />

          {/* Tableau des produits */}
          <Table withColumnBorders style={{ fontSize: '12px', marginBottom: 16 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" ta="center" w={40}>#</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white" ta="center" w={60}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Prix HT</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total HT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailsWithCalculs.map((detail) => (
                <Table.Tr key={detail.numero}>
                  <Table.Td ta="center">{detail.numero}</Table.Td>
                  <Table.Td>{detail.designation}</Table.Td>
                  <Table.Td ta="center">{detail.qte}</Table.Td>
                  <Table.Td ta="right">{formatMontant(detail.prix_unitaire)}</Table.Td>
                  <Table.Td ta="right">{formatMontant(detail.total_ligne)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {/* Totaux */}
          <Box style={{ textAlign: 'right', marginBottom: 16 }}>
            <Group justify="flex-end" gap="md" style={{ fontSize: '12px' }}>
              <Text fw={600}>Total HT:</Text>
              <Text>{formatMontant(totalHT)} FCFA</Text>
            </Group>
            <Group justify="flex-end" gap="md" style={{ fontSize: '12px' }}>
              <Text fw={600} c="orange">TVA (18%):</Text>
              <Text c="orange">{formatMontant(totalTTC - totalHT)} FCFA</Text>
            </Group>
            <Group justify="flex-end" gap="md" style={{ fontSize: '14px', marginTop: 8, backgroundColor: '#e8f5e9', padding: '8px', borderRadius: '4px' }}>
              <Text fw={800}>Total TTC:</Text>
              <Text fw={800} c="green">{formatMontant(totalTTC)} FCFA</Text>
            </Group>
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

export default FactureStandard;