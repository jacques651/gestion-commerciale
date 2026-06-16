// src/components/factures/FactureStandard.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  Paper, Text, Table, Group, Box, Divider, 
  Button, Image, Flex, SimpleGrid, Loader, Center
} from '@mantine/core';
import { 
  IconPrinter, IconDownload
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { generateFactureCode } from '../../services/codeGeneratorService';
import { getDb } from '../../database/db';

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
  const [codeFacture, setCodeFacture] = useState<string>(facture?.code_facture || '');
  const [generating, setGenerating] = useState(false);

  // Générer le code facture si non existant
  useEffect(() => {
    const generateCode = async () => {
      if (!facture?.code_facture && !codeFacture) {
        setGenerating(true);
        try {
          const code = await generateFactureCode();
          setCodeFacture(code);
          
          // Mettre à jour la facture dans la base de données
          if (facture?.idFacture) {
            const db = await getDb();
            await db.execute(
              `UPDATE factures SET code_facture = ? WHERE idFacture = ?`,
              [code, facture.idFacture]
            );
            console.log(`✅ Code facture généré: ${code}`);
          }
        } catch (error) {
          console.error('Erreur génération code facture:', error);
        } finally {
          setGenerating(false);
        }
      } else if (facture?.code_facture) {
        setCodeFacture(facture.code_facture);
      }
    };
    generateCode();
  }, [facture, codeFacture]);

  const { detailsWithCalculs, totalHT, totalTTC } = useMemo<{
    detailsWithCalculs: DetailsWithCalculs[];
    totalHT: number;
    totalTTC: number;
  }>(() => {
    let totalHTValue = 0;
    const details = (facture?.details || []).map((detail: any, idx: number): DetailsWithCalculs => {
      const qte = detail.qte_commande || detail.quantite || detail.qte || 0;
      const prix = detail.prix_unitaire_vente || detail.prix_vente || detail.prix_unitaire || 0;
      const totalLigne = prix * qte;
      totalHTValue += totalLigne;
      
      return {
        numero: idx + 1,
        qte,
        prix_unitaire: prix,
        total_ligne: totalLigne,
        designation: detail.designation || detail.produit_nom || detail.produit_designation || '-'
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
    documentTitle: `Facture_${codeFacture || 'facture'}`,
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
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('fr-FR');
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

  if (atelierLoading || generating) {
    return (
      <Center py={50}>
        <Loader size="xl" />
        <Text ml="md">Génération de la facture...</Text>
      </Center>
    );
  }

  if (!facture) {
    return (
      <Paper p="xl" ta="center">
        <Text>Aucune facture à afficher</Text>
      </Paper>
    );
  }

  const displayCodeFacture = codeFacture || facture?.code_facture || 'FACT-XXXX';

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb="md" className="no-print">
        <Button size="xs" variant="light" onClick={handlePrint} leftSection={<IconPrinter size={14} />}>
          Imprimer
        </Button>
        <Button size="xs" variant="light" color="teal" onClick={handleDownload} leftSection={<IconDownload size={14} />}>
          PDF
        </Button>
      </Group>

      {/* Facture */}
      <div ref={printRef}>
        <Paper p="sm" style={{ maxWidth: '100%', margin: '0 auto', backgroundColor: 'white' }}>
          
          {/* En-tête compact */}
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs" style={{ borderBottom: '1px solid #1b365d', paddingBottom: 8, marginBottom: 12 }}>
            <Flex align="center" gap="sm">
              {atelier.logo_base64 && (
                <Image src={atelier.logo_base64} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
              )}
              <Box>
                <Text fw={800} size="sm">{atelier.nom_atelier}</Text>
                <Text size="xs" c="dimmed">{atelier.adresse}</Text>
                <Text size="xs" c="dimmed">Tel: {atelier.telephone}</Text>
              </Box>
            </Flex>
            <Box>
              <Text size="xs" c="dimmed">N°: {displayCodeFacture}</Text>
              <Text size="xs" c="dimmed">Date: {formatDate(facture.date_facture)}</Text>
            </Box>
          </Flex>

          {/* Titre */}
          <Text ta="center" fw={700} size="xs" style={{ backgroundColor: '#f2d2bc', padding: '3px', borderRadius: '4px', marginBottom: 10 }}>
            FACTURE STANDARD
          </Text>

          {/* Infos client compactes */}
          <Flex justify="space-between" wrap="wrap" gap="xs" mb="xs" style={{ fontSize: '10px' }}>
            <Text><Text span fw={400}>Client:</Text> {facture.NomComplet || facture.client_nom || 'Client'}</Text>
            <Text><Text span fw={400}>Commande:</Text> {facture.code_commande || facture.idCommande || '-'}</Text>
          </Flex>

          <Divider my="xs" />

          {/* Tableau compact */}
          <Table withColumnBorders style={{ fontSize: '9px', marginBottom: 12 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" ta="center" w={30}>#</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white" ta="center" w={40}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={65}>Prix HT</Table.Th>
                <Table.Th c="white" ta="right" w={65}>Total HT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailsWithCalculs.map((detail) => (
                <Table.Tr key={detail.numero}>
                  <Table.Td ta="center">{detail.numero}</Table.Td>
                  <Table.Td>
                    <Text size="xs" fw={500}>{detail.designation}</Text>
                  </Table.Td>
                  <Table.Td ta="center">{detail.qte}</Table.Td>
                  <Table.Td ta="right">{formatMontant(detail.prix_unitaire)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatMontant(detail.total_ligne)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Divider my="xs" />

          {/* Totaux compacts */}
          <Box style={{ textAlign: 'right', marginBottom: 12 }}>
            <SimpleGrid cols={3} spacing="xs" style={{ maxWidth: '350px', marginLeft: 'auto' }}>
              <Paper p="xs" withBorder>
                <Flex justify="space-between" gap={8} style={{ fontSize: '10px' }}>
                  <Text fw={400}>Total HT:</Text>
                  <Text>{formatMontant(totalHT)} FCFA</Text>
                </Flex>
              </Paper>
              <Paper p="xs" withBorder style={{ backgroundColor: '#fff3e0' }}>
                <Flex justify="space-between" gap={8} style={{ fontSize: '10px' }}>
                  <Text fw={400}>TVA 18%:</Text>
                  <Text c="orange">{formatMontant(totalTTC - totalHT)} FCFA</Text>
                </Flex>
              </Paper>
              <Paper p="xs" withBorder style={{ backgroundColor: '#e8f5e9' }}>
                <Flex justify="space-between" gap={8} style={{ fontSize: '10px' }}>
                  <Text fw={400}>Total TTC:</Text>
                  <Text fw={400} c="green">{formatMontant(totalTTC)} FCFA</Text>
                </Flex>
              </Paper>
            </SimpleGrid>
          </Box>

          <Divider my="xs" />

          {/* Montant en lettres */}
          <Paper p="xs" withBorder style={{ backgroundColor: '#f8f9fa', marginTop: 8 }}>
            <Text size="xs" fw={500} ta="center">
              Arrêté la présente facture à la somme de : {formatMontant(totalTTC)} Francs CFA
            </Text>
          </Paper>

          {/* Signature */}
          <Flex justify="flex-end" mt={16}>
            <Box>
              <Text fw={600} size="xs">Le responsable</Text>
              <Text size="xs" c="dimmed" mt={12}>Signature et cachet</Text>
            </Box>
          </Flex>

          {/* Message */}
          <Text size="xs" ta="center" fs="italic" c="dimmed" mt={12}>
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