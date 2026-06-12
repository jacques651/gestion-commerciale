// src/components/reglements/ReçuReglement.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Paper, Text, Title, Group, Stack, Divider, Box, Flex, Button, Image, Loader, Center, Table, SimpleGrid } from '@mantine/core';
import { IconPrinter, IconCash, IconUser, IconFileInvoice, IconBuildingStore, IconPhone, IconMapPin, IconMail } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { getDb } from '../../database/db';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReçuReglementProps {
  reglement: {
    code_reglement: string;
    date_reglement: string;
    montant: number;
    mode_reglement: string;
    reference: string;
    observation: string;
    client_nom: string;
    code_facture: string;
    idFacture?: number;
  };
  onClose?: () => void;
}

export const ReçuReglement: React.FC<ReçuReglementProps> = ({ reglement, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();
  const [factureInfo, setFactureInfo] = useState<{
    montant_total: number;
    total_regle_avant: number;
    reste_apres: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFactureInfo = async () => {
      try {
        const db = await getDb();
        
        const facture = await db.select<any[]>(`
          SELECT montant_ttc, idFacture
          FROM factures 
          WHERE code_facture = ? OR idFacture = ?
        `, [reglement.code_facture, reglement.idFacture || 0]);
        
        if (facture.length > 0) {
          const idFacture = facture[0].idFacture;
          const totalFacture = facture[0].montant_ttc;
          
          const reglementsTotal = await db.select<any[]>(`
            SELECT COALESCE(SUM(montant), 0) as total
            FROM reglements 
            WHERE idFacture = ?
          `, [idFacture]);
          
          const totalRegle = reglementsTotal[0].total;
          const reste = totalFacture - totalRegle;
          
          setFactureInfo({
            montant_total: totalFacture,
            total_regle_avant: totalRegle - reglement.montant,
            reste_apres: reste
          });
        } else {
          setFactureInfo({
            montant_total: reglement.montant,
            total_regle_avant: 0,
            reste_apres: 0
          });
        }
      } catch (error) {
        console.error('Erreur chargement facture:', error);
        setFactureInfo({
          montant_total: reglement.montant,
          total_regle_avant: 0,
          reste_apres: 0
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadFactureInfo();
  }, [reglement.idFacture, reglement.code_facture, reglement.montant]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reçu_Reglement_${reglement.code_reglement}`,
  });

  const atelier = atelierConfig || {
    nom_atelier: 'MON ATELIER',
    telephone: '',
    adresse: '',
    email: '',
    nif: '',
    message_facture: 'Merci de votre confiance',
    logo_base64: ''
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy à HH:mm', { locale: fr });
    } catch {
      return '-';
    }
  };

  const formatMontant = (value: number) => {
    return (value || 0).toLocaleString('fr-FR');
  };

  if (atelierLoading || loading) {
    return (
      <Center py={50}>
        <Loader size="xl" />
      </Center>
    );
  }

  const montantActuel = reglement.montant;
  const montantTotal = factureInfo?.montant_total || montantActuel;
  const totalRegleAvant = factureInfo?.total_regle_avant || 0;
  const nouveauCumul = totalRegleAvant + montantActuel;
  const resteApres = factureInfo?.reste_apres || (montantTotal - nouveauCumul);

  return (
    <Box>
      {/* Barre d'outils */}
      <Group justify="flex-end" mb="md" p="md" className="no-print" style={{ borderBottom: '1px solid #e9ecef' }}>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
        <Button onClick={handlePrint} leftSection={<IconPrinter size={16} />} color="blue">
          Imprimer
        </Button>
      </Group>

      {/* Contenu à imprimer */}
      <div ref={printRef}>
        <Paper p="lg" style={{ maxWidth: '650px', margin: '0 auto', backgroundColor: 'white' }}>
          
          {/* En-tête atelier */}
          <Box style={{ textAlign: 'center', borderBottom: '2px solid #1b365d', paddingBottom: 12, marginBottom: 16 }}>
            {atelier.logo_base64 && (
              <Image 
                src={atelier.logo_base64} 
                alt="Logo" 
                style={{ height: '50px', marginBottom: '8px', objectFit: 'contain', margin: '0 auto' }}
              />
            )}
            <Title order={2} style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>
              {atelier.nom_atelier}
            </Title>
            <Text size="xs" c="dimmed">{atelier.adresse}</Text>
            <Text size="xs" c="dimmed">📞 {atelier.telephone}</Text>
            {atelier.email && <Text size="xs" c="dimmed">✉️ {atelier.email}</Text>}
            {atelier.nif && <Text size="xs" c="dimmed">🏷️ NIF: {atelier.nif}</Text>}
          </Box>

          {/* Titre */}
          <Title order={3} ta="center" mb="md" style={{ fontSize: '14px', backgroundColor: '#f2d2bc', display: 'inline-block', padding: '4px 16px', borderRadius: '4px', width: '100%' }}>
            REÇU DE RÈGLEMENT N° {reglement.code_reglement}
          </Title>

          {/* Infos générales en grille compacte */}
          <SimpleGrid cols={2} spacing="xs" mb="md" style={{ fontSize: '12px' }}>
            <Group gap={4}><Text size="xs" fw={600}>Date :</Text><Text size="xs">{formatDate(reglement.date_reglement)}</Text></Group>
            <Group gap={4}><Text size="xs" fw={600}>Mode :</Text><Text size="xs">{reglement.mode_reglement}</Text></Group>
            <Group gap={4}><Text size="xs" fw={600}>Client :</Text><Text size="xs">{reglement.client_nom}</Text></Group>
            <Group gap={4}><Text size="xs" fw={600}>Facture :</Text><Text size="xs">{reglement.code_facture}</Text></Group>
            {reglement.reference && (
              <Group gap={4}><Text size="xs" fw={600}>Réf :</Text><Text size="xs">{reglement.reference}</Text></Group>
            )}
          </SimpleGrid>

          {/* Tableau des montants */}
          <Table withColumnBorders style={{ fontSize: '12px', marginBottom: 16 }}>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td style={{ width: '65%', padding: '6px 8px' }}>Montant total de la facture</Table.Td>
                <Table.Td ta="right" style={{ padding: '6px 8px' }}>{formatMontant(montantTotal)} FCFA</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td style={{ padding: '6px 8px' }}>Déjà réglé avant ce paiement</Table.Td>
                <Table.Td ta="right" style={{ padding: '6px 8px' }}>{formatMontant(totalRegleAvant)} FCFA</Table.Td>
              </Table.Tr>
              <Table.Tr style={{ backgroundColor: '#e8f5e9' }}>
                <Table.Td style={{ fontWeight: 700, padding: '8px 8px' }}>▶ Montant du présent règlement</Table.Td>
                <Table.Td ta="right" fw={800} style={{ fontSize: '16px', padding: '8px 8px', color: '#2e7d32' }}>{formatMontant(montantActuel)} FCFA</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td style={{ padding: '6px 8px' }}>Nouveau cumul réglé</Table.Td>
                <Table.Td ta="right" style={{ padding: '6px 8px' }}>{formatMontant(nouveauCumul)} FCFA</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td style={{ padding: '6px 8px' }}>Reste à payer</Table.Td>
                <Table.Td ta="right" fw={700} style={{ padding: '6px 8px', color: resteApres > 0 ? '#d32f2f' : '#2e7d32' }}>
                  {resteApres > 0 ? formatMontant(resteApres) : 'SOLDÉ'} FCFA
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {/* Observation */}
          {reglement.observation && (
            <Box mb="md">
              <Text size="xs" c="dimmed">Observation :</Text>
              <Text size="xs">{reglement.observation}</Text>
            </Box>
          )}

          {/* Montant en lettres */}
          <Divider my="sm" />
          <Text size="xs" ta="center" fs="italic" style={{ marginTop: 12 }}>
            Arrêté le présent reçu à la somme de : {formatMontant(montantActuel)} Francs CFA
          </Text>

          {/* Footer */}
          <Box style={{ textAlign: 'center', marginTop: 20, paddingTop: 12, borderTop: '1px solid #e9ecef' }}>
            <Text size="xs" c="dimmed" fs="italic">{atelier.message_facture || 'Merci de votre confiance'}</Text>
            <Text size="xs" c="dimmed" mt={4}>{atelier.nom_atelier} - {atelier.telephone}</Text>
          </Box>
        </Paper>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            padding: 0;
            margin: 0;
          }
        }
      `}</style>
    </Box>
  );
};

export default ReçuReglement;