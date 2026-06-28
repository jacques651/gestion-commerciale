// src/components/factures/FactureStandard.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Paper, Text, Table, Group, Box, Divider,
  Button, Flex, SimpleGrid, Loader, Center,
  Badge, Grid, Alert
} from '@mantine/core';
import { IconPrinter, IconDownload, IconAlertCircle } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { getDb } from '../../database/db';

interface FactureStandardProps {
  facture: any;
  onPrint?: () => void;
  onDownload?: () => void;
}

const fmt = (v: number | undefined | null): string =>
  (v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d?: string): string => {
  if (!d) return '-';
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('fr-FR');
  } catch { return '-'; }
};

const statutColor = (s?: string) => {
  const v = (s || '').toLowerCase();
  if (['payée', 'paye', 'reglee'].includes(v)) return 'green';
  if (['annulee', 'annulée'].includes(v)) return 'red';
  return 'orange';
};

const statutLabel = (s?: string) => {
  const v = (s || '').toLowerCase();
  if (['payée', 'paye', 'reglee'].includes(v)) return 'PAYÉE';
  if (['annulee', 'annulée'].includes(v)) return 'ANNULÉE';
  return 'EN ATTENTE';
};

export const FactureStandard: React.FC<FactureStandardProps> = ({ facture }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();
  const [codeFacture, setCodeFacture] = useState<string>(facture?.code_facture || '');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (facture?.code_facture) { setCodeFacture(facture.code_facture); return; }
    if (codeFacture) return;
    const gen = async () => {
      setGenerating(true);
      try {
        const now = new Date();
        const prefix = `FAC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
        const db = await getDb();
        const r = await db.select<any[]>(`SELECT COUNT(*) as n FROM factures WHERE code_facture LIKE ?`, [prefix + '%']);
        const code = `${prefix}${String((r[0]?.n || 0) + 1).padStart(4, '0')}`;
        setCodeFacture(code);
        if (facture?.idFacture) {
          await db.execute(`UPDATE factures SET code_facture = ? WHERE idFacture = ?`, [code, facture.idFacture]);
        }
      } catch (e) {
        console.error('Erreur génération code facture:', e);
      } finally {
        setGenerating(false);
      }
    };
    gen();
  }, [facture]);

  const { details, totalHT, totalTVA, totalTTC } = useMemo(() => {
    const src = facture?.details || [];
    let ht = 0;
    const rows = src.map((d: any, i: number) => {
      const qte = d.qte ?? d.qte_commande ?? d.quantite ?? 0;
      const prix = d.prix_unitaire ?? d.prix_unitaire_vente ?? d.prix_vente ?? 0;
      const total = qte * prix;
      ht += total;
      return { num: i + 1, designation: d.designation || '-', qte, prix, total };
    });
    const tva = ht * 0.18;
    return { details: rows, totalHT: ht, totalTVA: tva, totalTTC: ht + tva };
  }, [facture]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Facture_${codeFacture || 'standard'}`
  });

  const handlePdf = async () => {
    if (!printRef.current) return;
    try {
      const worker = html2pdf().set({
        margin: 0.2,
        filename: `Facture_${codeFacture || 'standard'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).from(printRef.current);
      const blob = await worker.outputPdf('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Erreur PDF:', e);
    }
  };

  if (!facture) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Facture non trouvée" color="red">
        <Text>Les données de cette facture sont introuvables.</Text>
      </Alert>
    );
  }

  if (atelierLoading || generating) {
    return (
      <Center py={50}>
        <Loader size="xl" />
        <Text ml="md">Génération de la facture...</Text>
      </Center>
    );
  }

  const atelier = atelierConfig || { nom_atelier: 'MON COMMERCE', telephone: '', adresse: '', message_facture: '' };
  const code = codeFacture || facture?.code_facture || 'FAC-XXXX';

  return (
    <Box>
      <Group justify="flex-end" mb="sm" className="no-print">
        <Button size="xs" variant="light" onClick={handlePrint} leftSection={<IconPrinter size={14} />}>
          Imprimer
        </Button>
        <Button size="xs" variant="light" color="teal" onClick={handlePdf} leftSection={<IconDownload size={14} />}>
          Télécharger PDF
        </Button>
      </Group>

      <div ref={printRef} className="print-area">
        <Paper p="md" maw={1200} mx="auto" style={{ backgroundColor: 'white' }}>

          {/* En-tête identique à FactureRevendeur */}
          <Flex
            justify="space-between" align="center" wrap="wrap" gap="xs"
            style={{ borderBottom: '1px solid #1b365d', paddingBottom: 6, marginBottom: 10 }}
          >
            <Box>
              <Text fw={800} size="sm">{atelier.nom_atelier}</Text>
              <Text size="xs" c="dimmed">{atelier.adresse}</Text>
              <Text size="xs" c="dimmed">Tel: {atelier.telephone}</Text>
            </Box>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed">N° : {code}</Text>
              <Text size="xs" c="dimmed">Date : {fmtDate(facture.date_facture)}</Text>
            </Box>
          </Flex>

          <Text
            ta="center" fw={700} size="xs"
            style={{ backgroundColor: '#d0e8ff', padding: '3px', borderRadius: '4px', marginBottom: 8 }}
          >
            FACTURE STANDARD
          </Text>

          {/* Infos client */}
          <Grid mb="xs">
            <Grid.Col span={7}>
              <Text size="xs"><Text span fw={600}>Client :</Text> {facture.NomComplet || facture.client_nom || '-'}</Text>
              {facture.Societe && <Text size="xs" c="dimmed">{facture.Societe}</Text>}
              {facture.Adresse && <Text size="xs" c="dimmed">{facture.Adresse}</Text>}
              {facture.Tel && <Text size="xs" c="dimmed">📞 {facture.Tel}</Text>}
            </Grid.Col>
            <Grid.Col span={5} style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed">Commande : {facture.code_commande || '-'}</Text>
              <Badge size="sm" color={statutColor(facture.statut)} variant="filled" mt={3}>
                {statutLabel(facture.statut)}
              </Badge>
            </Grid.Col>
          </Grid>

          <Divider my="xs" />

          {/* Tableau produits */}
          <Table withColumnBorders striped highlightOnHover style={{ fontSize: '12px', marginBottom: 12 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                <Table.Th c="white" ta="center" w={28}>#</Table.Th>
                <Table.Th c="white">Désignation</Table.Th>
                <Table.Th c="white" ta="center" w={55}>Qté</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Prix unit. HT</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Total HT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {details.length > 0 ? details.map((d: {num:number; designation:string; qte:number; prix:number; total:number}) => (
                <Table.Tr key={d.num}>
                  <Table.Td ta="center">{d.num}</Table.Td>
                  <Table.Td><Text size="xs" fw={500}>{d.designation}</Text></Table.Td>
                  <Table.Td ta="center">{d.qte}</Table.Td>
                  <Table.Td ta="right">{fmt(d.prix)}</Table.Td>
                  <Table.Td ta="right" fw={700}>{fmt(d.total)}</Table.Td>
                </Table.Tr>
              )) : (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" size="sm" py="md">Aucun article dans cette facture</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Divider my="xs" />

          {/* Récapitulatif — même structure que FactureRevendeur */}
          <SimpleGrid cols={3} spacing="xs" mb="xs">
            <Paper p="xs" withBorder bg="gray.0">
              <Text size="xs" c="dimmed">Total HT</Text>
              <Text size="sm" fw={700} c="blue">{fmt(totalHT)} FCFA</Text>
            </Paper>
            <Paper p="xs" withBorder bg="orange.0">
              <Text size="xs" c="orange">TVA 18%</Text>
              <Text size="sm" fw={700} c="orange">{fmt(totalTVA)} FCFA</Text>
            </Paper>
            <Paper p="xs" withBorder bg="green.0">
              <Text size="xs" c="green">Total TTC</Text>
              <Text size="sm" fw={700} c="green">{fmt(totalTTC)} FCFA</Text>
            </Paper>
          </SimpleGrid>

          {/* Total TTC en grand */}
          <Paper p="xs" withBorder style={{ backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
            <Flex justify="space-between" align="center">
              <Text fw={700} size="sm" c="green.8">TOTAL TTC :</Text>
              <Text fw={800} size="lg" c="green.8">{fmt(totalTTC)} FCFA</Text>
            </Flex>
          </Paper>

          <Divider my="xs" />

          {/* Pied de page */}
          <Box style={{ textAlign: 'center' }}>
            <Text size="xs" c="dimmed" fw={500}>
              {atelier.message_facture || `Merci de votre confiance — ${atelier.nom_atelier}`}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text size="xs" c="dimmed" mt={4} fs="italic">Tous les montants sont en FCFA</Text>
          </Box>
        </Paper>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { width: 100% !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </Box>
  );
};

export default FactureStandard;
