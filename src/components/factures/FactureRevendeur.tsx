// src/components/factures/FactureRevendeur.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Paper,
  Text,
  Table,
  Group,
  Box,
  Divider,
  Button,
  Flex,
  SimpleGrid,
  Loader,
  Center,
  Badge,
  Grid
} from '@mantine/core';
import { IconPrinter, IconDownload } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { generateFactureCode } from '../../services/codeGeneratorService';
import { getDb } from '../../database/db';

interface FactureRevendeurProps {
  facture: any;
  onPrint?: () => void;
  onDownload?: () => void;
  formatPapier?: 'a4' | 'a5' | 'a6' | 'b5';
}

interface DetailsWithCalculs {
  numero: number;
  designation: string;
  categorie: string;
  unite: string;
  qte: number;
  prix_achat: number;
  prix_vente: number;
  benefice_ligne: number;
  total_vente: number;
}

export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({
  facture,
  formatPapier = 'a4'
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();
  const [codeFacture, setCodeFacture] = useState<string>(facture?.code_facture || '');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const generateCode = async () => {
      if (!facture?.code_facture && !codeFacture) {
        setGenerating(true);
        try {
          const code = await generateFactureCode();
          setCodeFacture(code);

          if (facture?.idFactureRevendeur) {
            const db = await getDb();
            await db.execute(
              `UPDATE factures_revendeur SET code_facture = ? WHERE idFactureRevendeur = ?`,
              [code, facture.idFactureRevendeur]
            );
          }
        } catch (error) {
          console.error('Erreur génération code facture revendeur:', error);
        } finally {
          setGenerating(false);
        }
      } else if (facture?.code_facture) {
        setCodeFacture(facture.code_facture);
      }
    };

    generateCode();
  }, [facture, codeFacture]);

  const formatMontant = (value: number | undefined | null): string => {
    return (value || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('fr-FR');
    } catch {
      return 'N/A';
    }
  };

  const getStatutInfo = (statut?: string) => {
    const s = (statut || '').toLowerCase();
    if (['payée', 'paye'].includes(s)) return { color: 'green', label: 'PAYÉE' };
    if (['en_attente', 'en attente'].includes(s)) return { color: 'orange', label: 'EN ATTENTE' };
    if (['en cours'].includes(s)) return { color: 'orange', label: 'EN COURS' };
    if (['annulee', 'annulée'].includes(s)) return { color: 'red', label: 'ANNULÉE' };
    if (['valide', 'validée'].includes(s)) return { color: 'blue', label: 'VALIDÉE' };
    if (['brouillon'].includes(s)) return { color: 'gray', label: 'BROUILLON' };
    return { color: 'gray', label: 'EN ATTENTE' };
  };

  const statutInfo = getStatutInfo(facture?.statut);
  const tauxCommission = facture?.taux_commission || 60;
  const totalTTC = facture?.montant_ttc || facture?.total_ttc || 0;

  const detailsWithCalculs = useMemo<DetailsWithCalculs[]>(() => {
    return (facture?.details || []).map((detail: any, idx: number) => {
      const qte = detail.qte_commande || detail.quantite || detail.qte || 0;
      const prixAchat = detail.prix_achat_base || detail.prix_achat || 0;
      const prixVente = detail.prix_unitaire_vente || detail.prix_vente || detail.prix_unitaire || 0;

      return {
        numero: idx + 1,
        designation: detail.designation || detail.nom_produit || detail.produit_nom || '-',
        categorie: detail.categorie || detail.categorie_produit || '-',
        unite: detail.unite_base || detail.unite_mesure || 'pièce',
        qte,
        prix_achat: prixAchat,
        prix_vente: prixVente,
        benefice_ligne: (prixVente - prixAchat) * qte,
        total_vente: prixVente * qte
      };
    });
  }, [facture]);

  const totalBenefice = useMemo(() => {
    return detailsWithCalculs.reduce((sum, d) => sum + d.benefice_ligne, 0);
  }, [detailsWithCalculs]);

  const commission = totalBenefice > 0 ? (totalBenefice * tauxCommission) / 100 : 0;
  const netAReverser = totalTTC - commission;

  const revendeurNom = facture?.NomComplet || facture?.nom_revendeur || 'N/A';
  const revendeurSociete = facture?.Societe || facture?.societe_revendeur || '';
  const revendeurTel = facture?.Tel || facture?.telephone_revendeur || '';
  const revendeurAdresse = facture?.Adresse || facture?.adresse_revendeur || '';

  const atelier = atelierConfig || {
    nom_atelier: 'MON ATELIER',
    telephone: '',
    adresse: '',
    message_facture: 'Merci de votre confiance',
    logo_base64: ''
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Facture_${codeFacture || 'facture'}`
  });


  const handleOpenPdfNewTab = async () => {
    if (!printRef.current) return;

    const worker = html2pdf().set({
      margin: 0.2,
      filename: `Facture_${codeFacture || 'facture'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: formatPapier, orientation: 'portrait' }
    }).from(printRef.current);

    const pdfBlob = await worker.outputPdf('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank', 'noopener,noreferrer');
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
      <Group justify="flex-end" mb="sm" className="no-print">
        <Button
          size="xs"
          variant="light"
          onClick={handlePrint}
          leftSection={<IconPrinter size={14} />}
        >
          Imprimer
        </Button>
        <Button
          size="xs"
          variant="light"
          color="teal"
          onClick={handleOpenPdfNewTab}
          leftSection={<IconDownload size={14} />}
        >
          Télécharger PDF
        </Button>
      </Group>

      <div ref={printRef} className="print-area">
        <Paper
          p="md"
          maw={1200}
          mx="auto"
          style={{ backgroundColor: 'white' }}
        >
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap="xs"
            style={{
              borderBottom: '1px solid #1b365d',
              paddingBottom: 6,
              marginBottom: 10
            }}
          >
            <Box>
              <Text fw={800} size="sm">{atelier.nom_atelier}</Text>
              <Text size="xs" c="dimmed">{atelier.adresse}</Text>
              <Text size="xs" c="dimmed">Tel: {atelier.telephone}</Text>
            </Box>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed">N°: {displayCodeFacture}</Text>
              <Text size="xs" c="dimmed">Date: {formatDate(facture?.date_facture)}</Text>
            </Box>
          </Flex>

          <Text
            ta="center"
            fw={700}
            size="xs"
            style={{
              backgroundColor: '#f2d2bc',
              padding: '3px',
              borderRadius: '4px',
              marginBottom: 8
            }}
          >
            FACTURE REVENDEUR
          </Text>

          <Grid mb="xs">
            <Grid.Col span={7}>
              <Text size="xs">
                <Text span fw={600}>Revendeur:</Text> {revendeurNom}
              </Text>
              {revendeurSociete && <Text size="xs" c="dimmed">{revendeurSociete}</Text>}
              {revendeurAdresse && <Text size="xs" c="dimmed">{revendeurAdresse}</Text>}
              {revendeurTel && <Text size="xs" c="dimmed">📞 {revendeurTel}</Text>}
            </Grid.Col>
            <Grid.Col span={5} style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed">Commande: {facture?.code_commande || facture?.idCommande || '-'}</Text>
              <Text size="xs" c="dimmed">Taux commission: {tauxCommission}%</Text>
              <Badge size="sm" color={statutInfo.color} variant="filled" mt={3}>
                {statutInfo.label}
              </Badge>
            </Grid.Col>
          </Grid>

          <Divider my="xs" />

          <Table withColumnBorders striped highlightOnHover style={{ fontSize: '12px', marginBottom: 12 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" ta="center" w={28}>#</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white">Catégorie</Table.Th>
                <Table.Th c="white" ta="center" w={80}>Unité</Table.Th>
                <Table.Th c="white" ta="center" w={55}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={75}>P.A</Table.Th>
                <Table.Th c="white" ta="right" w={75}>P.V</Table.Th>
                <Table.Th c="white" ta="right" w={75}>Bénéf.</Table.Th>
                <Table.Th c="white" ta="right" w={85}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailsWithCalculs.length > 0 ? (
                detailsWithCalculs.map((detail) => (
                  <Table.Tr key={detail.numero}>
                    <Table.Td ta="center">{detail.numero}</Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>{detail.designation}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{detail.categorie}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge size="xs" variant="light" color="gray">
                        {detail.unite}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">{detail.qte}</Table.Td>
                    <Table.Td ta="right">{formatMontant(detail.prix_achat)}</Table.Td>
                    <Table.Td ta="right" fw={600}>{formatMontant(detail.prix_vente)}</Table.Td>
                    <Table.Td ta="right" c={detail.benefice_ligne >= 0 ? 'green' : 'red'}>
                      {formatMontant(detail.benefice_ligne)}
                    </Table.Td>
                    <Table.Td ta="right" fw={700}>{formatMontant(detail.total_vente)}</Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text ta="center" c="dimmed" size="sm">
                      Aucun article dans cette facture
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Divider my="xs" />

          <SimpleGrid cols={4} spacing="xs" mb="xs">
            <Paper p="xs" withBorder bg="gray.0">
              <Text size="xs" c="dimmed">Total TTC</Text>
              <Text size="sm" fw={700} c="blue">{formatMontant(totalTTC)} FCFA</Text>
            </Paper>
            <Paper p="xs" withBorder bg={totalBenefice >= 0 ? 'green.0' : 'red.0'}>
              <Text size="xs" c={totalBenefice >= 0 ? 'green' : 'red'}>Bénéfice</Text>
              <Text size="sm" fw={700} c={totalBenefice >= 0 ? 'green' : 'red'}>
                {formatMontant(totalBenefice)} FCFA
              </Text>
            </Paper>
            <Paper p="xs" withBorder bg={commission > 0 ? 'orange.0' : 'gray.0'}>
              <Text size="xs" c="orange">Commission</Text>
              <Text size="sm" fw={700} c="orange">{formatMontant(commission)} FCFA</Text>
            </Paper>
            <Paper p="xs" withBorder bg={netAReverser >= 0 ? 'teal.0' : 'red.0'}>
              <Text size="xs" c={netAReverser >= 0 ? 'teal' : 'red'}>Net à reverser</Text>
              <Text size="sm" fw={700} c={netAReverser >= 0 ? 'teal' : 'red'}>
                {formatMontant(netAReverser)} FCFA
              </Text>
            </Paper>
          </SimpleGrid>

          <Paper
            p="xs"
            withBorder
            style={{
              backgroundColor: netAReverser >= 0 ? '#e8f5e9' : '#ffebee',
              border: `2px solid ${netAReverser >= 0 ? '#4caf50' : '#ef5350'}`
            }}
          >
            <Flex justify="space-between" align="center">
              <Text fw={700} size="sm" c={netAReverser >= 0 ? 'green.8' : 'red.8'}>
                NET À REVERSER :
              </Text>
              <Text fw={800} size="lg" c={netAReverser >= 0 ? 'green.8' : 'red.8'}>
                {formatMontant(netAReverser)} FCFA
              </Text>
            </Flex>
          </Paper>

          <Divider my="xs" />

          <Box style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed" fw={500}>
              Merci de votre confiance - Gestion Pro
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              Généré le {new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })} à {new Date().toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            <Text size="xs" c="dimmed" mt={4} fs="italic">
              Tous les montants sont en FCFA
            </Text>
          </Box>
        </Paper>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .print-area {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-area * {
            visibility: visible !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default FactureRevendeur;