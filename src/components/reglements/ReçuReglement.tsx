// src/components/reglements/ReçuReglement.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  Paper, Text, Table, Group, Box,
  Button, Image, Divider, SimpleGrid, Badge, Flex, Loader, Center
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconCheck
} from '@tabler/icons-react';
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

  // 🔥 Fonction pour convertir un nombre en lettres (corrigée)
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
        
        if (d === 7 || d === 9) {
          return `${dizaine}-${unites[u + 10]}`;
        }
        
        if (d === 8) {
          return `quatre-vingt-${unites[u]}`;
        }
        
        return `${dizaine}-${unites[u]}`;
      }
      return '';
    };
    
    const convertir = (n: number): string => {
      if (n < 100) return convertirMoinsDeCent(n);
      
      if (n < 1000) {
        const centaines = Math.floor(n / 100);
        const reste = n % 100;
        let result = '';
        
        if (centaines === 1) {
          result = 'cent';
        } else {
          result = unites[centaines] + ' cents';
        }
        
        if (reste > 0) {
          result += ' ' + convertirMoinsDeCent(reste);
        }
        
        return result;
      }
      
      if (n < 1000000) {
        const milliers = Math.floor(n / 1000);
        const reste = n % 1000;
        let result = '';
        
        if (milliers === 1) {
          result = 'mille';
        } else {
          result = convertir(milliers) + ' mille';
        }
        
        if (reste > 0) {
          result += ' ' + convertir(reste);
        }
        
        return result;
      }
      
      if (n < 1000000000) {
        const millions = Math.floor(n / 1000000);
        const reste = n % 1000000;
        let result = '';
        
        if (millions === 1) {
          result = 'un million';
        } else {
          result = convertir(millions) + ' millions';
        }
        
        if (reste > 0) {
          result += ' ' + convertir(reste);
        }
        
        return result;
      }
      
      // Pour les nombres plus grands, retourner le nombre formaté
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

  // 🔥 Montant en lettres
  const montantEnLettres = nombreEnLettres(montantActuel);
  const montantEnLettresMaj = montantEnLettres.charAt(0).toUpperCase() + montantEnLettres.slice(1);

  return (
    <Box>
      {/* Boutons d'action */}
      <Group justify="flex-end" mb="xs" className="no-print">
        <Button size="xs" variant="subtle" onClick={onClose}>
          Fermer
        </Button>
        <Button size="xs" variant="subtle" onClick={handlePrint} leftSection={<IconPrinter size={12} />}>
          Imprimer
        </Button>
        <Button size="xs" variant="subtle" color="teal" onClick={handlePrint} leftSection={<IconDownload size={12} />}>
          PDF
        </Button>
      </Group>

      <div ref={printRef}>
        <Paper p="xs" style={{ maxWidth: '1300px', margin: '0 auto', backgroundColor: 'white' }}>
          
          {/* En-tête */}
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs" style={{ borderBottom: '1px solid #1b365d', paddingBottom: 6, marginBottom: 8 }}>
            <Flex align="center" gap="xs">
              {atelier.logo_base64 && (
                <Image src={atelier.logo_base64} alt="Logo" style={{ height: '30px', objectFit: 'contain' }} />
              )}
              <Box>
                <Text fw={700} size="md" c="#1b365d">{atelier.nom_atelier}</Text>
                <Text size="xs" c="dimmed">{atelier.telephone}</Text>
              </Box>
            </Flex>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={600}>N°{reglement.code_reglement}</Text>
              <Text size="xs" c="dimmed">{formatDate(reglement.date_reglement)}</Text>
            </Box>
          </Flex>

          {/* Titre */}
          <Text ta="center" fw={700} size="sm" style={{ backgroundColor: '#f2d2bc', padding: '4px', borderRadius: '4px', marginBottom: 12 }}>
            REÇU DE RÈGLEMENT DE FACTURES
          </Text>

          {/* Infos client */}
          <SimpleGrid cols={2} spacing="xs" mb="xs" style={{ fontSize: '13px' }}>
            <Text><Text span fw={600}>Reçu N°:</Text> {reglement.code_reglement}</Text>
            <Text><Text span fw={600}>Date:</Text> {formatDate(reglement.date_reglement)}</Text>
            <Text><Text span fw={600}>Nom du client:</Text> {reglement.client_nom}</Text>
            <Text><Text span fw={600}>Facture:</Text> {reglement.code_facture}</Text>
          </SimpleGrid>

          <Divider my={4} />

          {/* Tableau */}
          <Table withColumnBorders style={{ fontSize: '12px', marginBottom: 12 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#1b365d' }}>
                <Table.Th c="white" w={120}>Références</Table.Th>
                <Table.Th c="white" w={100}>Date</Table.Th>
                <Table.Th c="white" w={120}>Mode Règlement</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Montant</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Versement</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Cumul</Table.Th>
                <Table.Th c="white" ta="right" w={100}>Reste à payer</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <Text size="xs" fw={500}>{reglement.code_facture}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{formatDate(reglement.date_reglement)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color="blue">
                    {(reglement.mode_reglement || 'ESPECES').toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs">{formatMontant(montantTotal)}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs" fw={600}>{formatMontant(montantActuel)}</Text>
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

          {/* Montant versé */}
          <Paper p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #c8e6c9', marginBottom: 8 }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text fw={700} size="sm">Montant versé :</Text>
              <Text fw={800} size="lg" c="green">{formatMontant(montantActuel)} FCFA</Text>
            </Flex>
          </Paper>

          {/* Reste à payer */}
          {resteApres > 0 && (
            <Paper p="xs" style={{ backgroundColor: '#fff3e0', borderRadius: '4px', border: '1px solid #ffcc80', marginBottom: 8 }}>
              <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
                <Text fw={700} size="sm" c="orange">Reste à payer :</Text>
                <Text fw={800} size="lg" c="orange">{formatMontant(resteApres)} FCFA</Text>
              </Flex>
            </Paper>
          )}

          {resteApres <= 0 && (
            <Paper p="xs" style={{ backgroundColor: '#c8e6c9', borderRadius: '4px', border: '1px solid #4caf50', marginBottom: 8 }}>
              <Flex justify="center" align="center" wrap="wrap" gap="xs">
                <IconCheck size={16} color="#2e7d32" />
                <Text fw={700} size="sm" c="green">✅ Facture entièrement soldée</Text>
              </Flex>
            </Paper>
          )}

          {/* 🔥 Montant en lettres */}
          <Paper p="xs" withBorder style={{ backgroundColor: '#f8f9fa', marginTop: 8 }}>
            <Text size="xs" fw={500} ta="center">
              Arrêté le présent reçu à la somme de : {montantEnLettresMaj} ({formatMontant(montantActuel)}) Francs CFA
            </Text>
          </Paper>

          {/* Date et signature */}
          <Flex justify="space-between" mt={16}>
            <Box>
              <Text size="xs" fw={600}>Fait à.................................................................. le {new Date().toLocaleDateString('fr-FR')}</Text>
            </Box>
            <Box>
              <Text fw={600} size="xs" ta="center">Signature et cachet</Text>
            </Box>
          </Flex>

          {/* Message */}
          <Text size="xs" ta="center" fs="italic" c="dimmed" mt={12}>
            {atelier.message_facture}
          </Text>

          {/* Numéro de page */}
          <Flex justify="flex-end" mt={8}>
            <Text size="xs" c="dimmed">Page 1 sur 1</Text>
          </Flex>
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

export default ReçuReglement;