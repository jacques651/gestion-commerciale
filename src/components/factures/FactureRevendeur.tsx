// src/components/factures/FactureRevendeur.tsx
import React, { useMemo, useRef } from 'react';
import {
  Paper, Text, Table, Group, Stack, Box,
  Button, Tooltip, LoadingOverlay, Card, Image, Divider
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconFileInvoice, IconCalendar
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  commission_percent: number;
}


export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({ facture }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  const { detailsWithCalculs, totalVente, totalCommission } = useMemo(() => {
    const detailsFromFacture = facture?.details || [];
    const detailsFromCommande = facture?.commande?.details || [];
    const details = detailsFromFacture.length > 0 ? detailsFromFacture : detailsFromCommande;

    let totalVenteValue = 0;
    let totalCommissionValue = 0;

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
        commission_percent: commissionPercent,
      };
    });

    return {
      detailsWithCalculs: detailsWithCalculsValue,
      totalVente: totalVenteValue,
      totalCommission: totalCommissionValue,
    };
  }, [facture]);

  if (!facture) {
    return (
      <Card withBorder p="xl" ta="center">
        <Text c="red">Données de facture manquantes</Text>
      </Card>
    );
  }

  if (atelierLoading) {
    return (
      <Card withBorder p="xl" ta="center">
        <LoadingOverlay visible />
        <Text>Chargement des paramètres...</Text>
      </Card>
    );
  }

  const formatMontant = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const nombreEnLettres = (nombre: number): string => {
    if (!Number.isFinite(nombre)) return '-';
    if (nombre === 0) return 'zéro';
    return `${formatMontant(nombre)} francs CFA`;
  };

  const factureData = {
    code_facture: facture.code_facture || '-',
    date_facture: facture.date_facture || new Date().toISOString(),
    client_nom: facture.NomComplet || facture.client_nom || 'Revendeur',
    client_societe: facture.Societe || facture.client_societe || '',
    client_tel: facture.Tel || facture.client_tel || '-',
    client_email: facture.Email || facture.client_email || '',
    client_ville: facture.Ville || facture.client_ville || '',
  };

  const atelier = atelierConfig || {
    nom_atelier: 'CHRISTOPHE TELECOM',
    telephone: '72101081/07537979',
    adresse: "Saaba route de l'Université USTA",
    email: 'contact@christophetelecom.ci',
    message_facture: 'Merci de votre confiance',
    logo_base64: '',
  };

  const handlePrint = () => {
    if (!printRef.current) {
      notifications.show({ title: 'Erreur', message: 'Zone d’impression introuvable', color: 'red' });
      return;
    }

    const oldTitle = document.title;
    document.title = `Facture_${factureData.code_facture}`;

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = oldTitle;
      }, 1000);
    }, 300);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) {
      notifications.show({ title: 'Erreur', message: 'Zone de facture introuvable', color: 'red' });
      return;
    }

    try {
      notifications.show({ title: 'Génération PDF', message: 'Création du document...', color: 'blue' });

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Facture_${factureData.code_facture}.pdf`);

      notifications.show({ title: 'Succès', message: 'PDF téléchargé', color: 'green' });
    } catch (error) {
  console.error("ERREUR PDF COMPLETE", error);

  notifications.show({
    title: "Erreur",
    message: String(error),
    color: "red"
  });
}
  };

  return (
    <Box>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <Group
        justify="flex-end"
        mb="md"
        className="no-print"
        style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'white', padding: '12px 0' }}
      >
        <Tooltip label="Imprimer la facture">
          <Button
            variant="light"
            color="gray"
            leftSection={<IconPrinter size={18} />}
            onClick={handlePrint}
            radius="md"
          >
            Imprimer
          </Button>
        </Tooltip>

        <Tooltip label="Télécharger en PDF">
          <Button
            variant="light"
            color="teal"
            leftSection={<IconDownload size={18} />}
            onClick={handleDownloadPdf}
            radius="md"
          >
            PDF
          </Button>
        </Tooltip>
      </Group>

      <div ref={printRef} className="print-area">
        <Paper shadow="xl" radius="lg" withBorder style={{ maxWidth: '1200px', margin: '0 auto', overflow: 'hidden' }}>
          <Box style={{ padding: '24px 32px', borderBottom: '2px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {atelier.logo_base64 && <Image src={atelier.logo_base64} w={60} h={60} fit="contain" />}
                <Stack gap={2}>
                  <Text fw={800} size="24px" style={{ letterSpacing: '1px' }}>
                    {atelier.nom_atelier}
                  </Text>
                  <Text size="sm" fw={500}>Commerce général</Text>
                  <Text size="sm" c="dimmed">{atelier.adresse}</Text>
                  <Text size="sm" c="dimmed">Tel: {atelier.telephone}</Text>
                  <Text size="xs" c="dimmed" fs="italic">Vente des accessoires et téléphones en gros et détails</Text>
                </Stack>
              </div>
              <Stack gap={4} align="flex-end">
                <Text size="xs" c="dimmed">Date : {formatDate(new Date().toISOString())}</Text>
                <Text size="xs" c="dimmed">Heure : {new Date().toLocaleTimeString('fr-FR')}</Text>
              </Stack>
            </div>
          </Box>

          <Box style={{ padding: '16px 32px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Group gap={8}>
                <IconCalendar size={18} color="#1b365d" />
                <Text size="sm">Date de la Facture: <strong>{formatDate(factureData.date_facture)}</strong></Text>
              </Group>
              <Group gap={8}>
                <IconFileInvoice size={18} color="#1b365d" />
                <Text size="sm">Facture N° : <strong>{factureData.code_facture}</strong></Text>
              </Group>
            </div>
          </Box>

          <Box style={{ padding: '24px 32px', borderBottom: '1px solid #e9ecef' }}>
            <Text fw={700} size="16px" mb="md" c="#1b365d">Informations du revendeur</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div><Text size="xs" c="dimmed">Nom du client</Text><Text fw={600}>{factureData.client_nom}</Text></div>
              <div><Text size="xs" c="dimmed">Société</Text><Text>{factureData.client_societe || '-'}</Text></div>
              <div><Text size="xs" c="dimmed">Tel</Text><Text>{factureData.client_tel}</Text></div>
              <div><Text size="xs" c="dimmed">Email</Text><Text>{factureData.client_email || '-'}</Text></div>
              <div><Text size="xs" c="dimmed">Ville</Text><Text>{factureData.client_ville || '-'}</Text></div>
            </div>
          </Box>

          <Box style={{ padding: '24px 32px', overflowX: 'auto' }}>
            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                  <Table.Th c="white" ta="center" w={50}>N°</Table.Th>
                  <Table.Th c="white">Désignation</Table.Th>
                  <Table.Th c="white">Catégorie</Table.Th>
                  <Table.Th c="white" ta="center" w={60}>Qté</Table.Th>
                  <Table.Th c="white" ta="right" w={100}>P.U.A</Table.Th>
                  <Table.Th c="white" ta="right" w={100}>P.U.V</Table.Th>
                  <Table.Th c="white" ta="right" w={120}>Bénéfice</Table.Th>
                  <Table.Th c="white" ta="center" w={80}>Commis</Table.Th>
                  <Table.Th c="white" ta="right" w={120}>Total Vente</Table.Th>
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
                    <Table.Td ta="center">{detail.commission_percent}%</Table.Td>
                    <Table.Td ta="right" fw={700}>{formatMontant(detail.total_vente)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>

          <Box style={{ padding: '20px 32px', backgroundColor: '#f8f9fa', borderTop: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px' }}>
                  <Text fw={600}>Montant total</Text>
                  <Text fw={700} c="blue.8">{formatMontant(totalVente)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px' }}>
                  <Text fw={600}>Total Commission</Text>
                  <Text fw={700} c="orange.8">{formatMontant(totalCommission)}</Text>
                </div>
                <Divider my={8} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '12px' }}>
                  <Text fw={700}>Net à verser</Text>
                  <Text fw={700} size="lg" c="blue.8">{formatMontant(totalVente - totalCommission)}</Text>
                </div>
              </div>
            </div>
          </Box>

          <Box style={{ padding: '20px 32px' }}>
            <Text size="sm" fw={500}>
              Arrêté la présente facture à la somme de : {nombreEnLettres(totalVente)}
            </Text>
          </Box>

          <Box style={{ padding: '16px 32px', textAlign: 'center', borderTop: '1px solid #e9ecef', backgroundColor: '#f8f9fa' }}>
            <Text size="xs" c="dimmed">
              {atelier.message_facture || 'Merci de votre confiance'} - {atelier.nom_atelier}
            </Text>
            <Text size="xs" c="dimmed">Tel: {atelier.telephone} | Email: {atelier.email} | {atelier.adresse}</Text>
          </Box>
        </Paper>
      </div>
    </Box>
  );
};

export default FactureRevendeur;