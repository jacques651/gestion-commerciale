// src/components/reglements/ReçuReglement.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  Paper, Text, Table, Group, Box, Button, Image, Divider, 
  SimpleGrid, Badge, Flex, Loader, Center
} from '@mantine/core';
import { IconPrinter, IconDownload, IconCheck } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { getDb } from '../../database/db';

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
          const totalFacture = facture[0].montant_ttc || 0;
          
          const reglements = await db.select<any[]>(`
            SELECT COALESCE(SUM(montant), 0) as total
            FROM reglements 
            WHERE idFacture = ?
          `, [idFacture]);
          
          const totalRegle = reglements[0].total || 0;
          const totalRegleAvant = totalRegle - reglement.montant;
          const resteApres = totalFacture - totalRegle;
          
          setFactureInfo({
            montant_total: totalFacture,
            total_regle_avant: totalRegleAvant,
            reste_apres: resteApres
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

  const formatMontant = (value: number | string | undefined | null): string => {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
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

  const nombreEnLettres = (nombre: number): string => {
    if (nombre === 0) return 'zéro';
    if (nombre < 0) return 'moins ' + nombreEnLettres(Math.abs(nombre));
    
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    const convertirMoinsDeCent = (n: number): string => {
      if (n < 20) return unites[n];
      if (n < 100) {
        const d = Math.floor(n / 10);
        const u = n % 10;
        let dizaine = dizaines[d];
        if (u === 0) {
          if (d === 8) return 'quatre-vingts';
          return dizaine;
        }
        if (d === 7 || d === 9) return `${dizaine}-${unites[u + 10]}`;
        if (d === 8) return `quatre-vingt-${unites[u]}`;
        return `${dizaine}-${unites[u]}`;
      }
      return '';
    };
    
    const convertir = (n: number): string => {
      if (n < 100) return convertirMoinsDeCent(n);
      if (n < 1000) {
        const centaines = Math.floor(n / 100);
        const reste = n % 100;
        let result = centaines === 1 ? 'cent' : unites[centaines] + ' cents';
        if (reste > 0) result += ' ' + convertirMoinsDeCent(reste);
        return result;
      }
      if (n < 1000000) {
        const milliers = Math.floor(n / 1000);
        const reste = n % 1000;
        let result = milliers === 1 ? 'mille' : convertir(milliers) + ' mille';
        if (reste > 0) result += ' ' + convertir(reste);
        return result;
      }
      if (n < 1000000000) {
        const millions = Math.floor(n / 1000000);
        const reste = n % 1000000;
        let result = millions === 1 ? 'un million' : convertir(millions) + ' millions';
        if (reste > 0) result += ' ' + convertir(reste);
        return result;
      }
      return formatMontant(n);
    };
    return convertir(nombre);
  };

  const atelier = atelierConfig || {
    nom_atelier: 'KOSOFT',
    telephone: '72101081/07537979',
    adresse: 'Saaba route de l\'Université USTA',
    email: '',
    message_facture: 'Merci de votre confiance',
    logo_base64: '',
    nif: ''
  };

  if (atelierLoading || loading) {
    return (
      <Center py={50}>
        <Loader size="xl" />
      </Center>
    );
  }

  const montantActuel = reglement.montant || 0;
  const montantTotal = factureInfo?.montant_total || montantActuel;
  const totalRegleAvant = factureInfo?.total_regle_avant || 0;
  const nouveauCumul = totalRegleAvant + montantActuel;
  const resteApres = factureInfo?.reste_apres || (montantTotal - nouveauCumul);
  const montantEnLettres = nombreEnLettres(montantActuel);
  const montantEnLettresMaj = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1);

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb={4} className="no-print" gap="xs">
        <Button size="compact-xs" variant="subtle" onClick={onClose}>Fermer</Button>
        <Button size="compact-xs" variant="subtle" onClick={handlePrint} leftSection={<IconPrinter size={12} />}>
          Imprimer
        </Button>
        <Button size="compact-xs" variant="subtle" color="teal" onClick={handlePrint} leftSection={<IconDownload size={12} />}>
          PDF
        </Button>
      </Group>

      <div ref={printRef}>
        <Paper p={8} style={{ maxWidth: '1000px', margin: '0 auto', backgroundColor: 'white', fontSize: '11px' }}>
          
          {/* En-tête compact */}
          <Flex justify="space-between" align="center" wrap="wrap" gap={4} style={{ borderBottom: '2px solid #1b365d', paddingBottom: 4, marginBottom: 6 }}>
            <Flex align="center" gap={6}>
              {atelier.logo_base64 && (
                <Image src={atelier.logo_base64} alt="Logo" style={{ height: '28px', objectFit: 'contain' }} />
              )}
              <Box>
                <Text fw={700} size="sm" c="#1b365d">{atelier.nom_atelier}</Text>
                <Text size="xs" c="dimmed" lh={1.2}>{atelier.telephone}</Text>
              </Box>
            </Flex>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={600}>N° {reglement.code_reglement}</Text>
              <Text size="xs" c="dimmed">{formatDate(reglement.date_reglement)}</Text>
            </Box>
          </Flex>

          {/* Titre compact */}
          <Text ta="center" fw={700} size="sm" style={{ backgroundColor: '#f2d2bc', padding: '3px', borderRadius: '3px', marginBottom: 6 }}>
            REÇU DE RÈGLEMENT
          </Text>

          {/* Infos client - grille compacte 4 colonnes */}
          <SimpleGrid cols={4} spacing="xs" mb={4} style={{ fontSize: '11px' }}>
            <Text><Text span fw={600}>Reçu:</Text> {reglement.code_reglement}</Text>
            <Text><Text span fw={600}>Date:</Text> {formatDate(reglement.date_reglement)}</Text>
            <Text><Text span fw={600}>Client:</Text> {reglement.client_nom}</Text>
            <Text><Text span fw={600}>Facture:</Text> {reglement.code_facture}</Text>
          </SimpleGrid>

          <Divider my={4} />

          {/* Tableau compact */}
          <Table withColumnBorders style={{ fontSize: '10px', marginBottom: 6 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                <Table.Th c="white" ta="center" w="15%">Facture</Table.Th>
                <Table.Th c="white" ta="center" w="15%">Date</Table.Th>
                <Table.Th c="white" ta="center" w="18%">Mode</Table.Th>
                <Table.Th c="white" ta="right" w="13%">Total</Table.Th>
                <Table.Th c="white" ta="right" w="13%">Versé</Table.Th>
                <Table.Th c="white" ta="right" w="13%">Cumul</Table.Th>
                <Table.Th c="white" ta="right" w="13%">Reste</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td ta="center">
                  <Text size="xs" fw={500}>{reglement.code_facture}</Text>
                </Table.Td>
                <Table.Td ta="center">
                  <Text size="xs">{formatDate(reglement.date_reglement)}</Text>
                </Table.Td>
                <Table.Td ta="center">
                  <Badge size="xs" variant="light" color="blue">
                    {(reglement.mode_reglement || 'ESPECES').toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs">{formatMontant(montantTotal)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs" fw={700} c="green">{formatMontant(montantActuel)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs" fw={600}>{formatMontant(nouveauCumul)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs" fw={700} c={resteApres > 0 ? 'orange' : 'green'}>
                    {resteApres > 0 ? formatMontant(resteApres) : '0'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {/* Résumé compact */}
          <SimpleGrid cols={resteApres > 0 ? 3 : 2} spacing={4} mb={4}>
            <Paper p={4} style={{ backgroundColor: '#e8f5e9', borderRadius: '3px', border: '1px solid #c8e6c9' }}>
              <Flex justify="space-between" align="center" gap={4}>
                <Text fw={600} size="xs">Montant versé :</Text>
                <Text fw={800} size="sm" c="green">{formatMontant(montantActuel)} F</Text>
              </Flex>
            </Paper>

            {resteApres > 0 && (
              <Paper p={4} style={{ backgroundColor: '#fff3e0', borderRadius: '3px', border: '1px solid #ffcc80' }}>
                <Flex justify="space-between" align="center" gap={4}>
                  <Text fw={600} size="xs" c="orange">Reste à payer :</Text>
                  <Text fw={800} size="sm" c="orange">{formatMontant(resteApres)} F</Text>
                </Flex>
              </Paper>
            )}

            {resteApres <= 0 && (
              <Paper p={4} style={{ backgroundColor: '#c8e6c9', borderRadius: '3px', border: '1px solid #4caf50' }}>
                <Flex justify="center" align="center" gap={4}>
                  <IconCheck size={14} color="#2e7d32" />
                  <Text fw={700} size="xs" c="green">Facture soldée</Text>
                </Flex>
              </Paper>
            )}

            <Paper p={4} withBorder style={{ backgroundColor: '#f8f9fa' }}>
              <Flex justify="space-between" align="center" gap={4}>
                <Text fw={600} size="xs">Référence :</Text>
                <Text size="xs" fw={500}>{reglement.reference || '-'}</Text>
              </Flex>
            </Paper>
          </SimpleGrid>

          {/* Montant en lettres */}
          <Paper p={4} withBorder style={{ backgroundColor: '#f0f4fa', marginBottom: 4 }}>
            <Text size="xs" fw={500} ta="center" lh={1.3}>
              Arrêté le présent reçu à la somme de : <strong>{montantEnLettresMaj}</strong> ({formatMontant(montantActuel)}) FCFA
            </Text>
          </Paper>

          {/* Date et signature compact */}
          <Flex justify="space-between" mt={6}>
            <Box>
              <Text size="xs" fw={600}>Fait à <u>..................................</u> le {new Date().toLocaleDateString('fr-FR')}</Text>
            </Box>
            <Box>
              <Text fw={600} size="xs" ta="center">Signature & cachet</Text>
              <div style={{ borderTop: '1px solid #000', width: '120px', margin: '2px auto 0' }}></div>
            </Box>
          </Flex>

          {/* Message et numéro de page */}
          <Flex justify="space-between" mt={6} pt={4} style={{ borderTop: '1px solid #e8ecf1' }}>
            <Text size="xs" fs="italic" c="dimmed">{atelier.message_facture}</Text>
            <Text size="xs" c="dimmed">Page 1/1</Text>
          </Flex>

          {/* Pied de page compact */}
          <Flex justify="space-between" mt={2} style={{ fontSize: '8px', color: '#aaa' }}>
            <Text>{atelier.adresse}</Text>
            <Text>{atelier.nif && `NIF: ${atelier.nif}`}</Text>
          </Flex>
        </Paper>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </Box>
  );
};

export default ReçuReglement;