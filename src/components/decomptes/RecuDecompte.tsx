// src/components/decomptes/RecuDecompte.tsx
import React, { useMemo, useRef } from 'react';
import {
  Paper, Text, Table, Group, Box,
  Button, Image, Divider, SimpleGrid, Badge, Flex, Loader, Center
} from '@mantine/core';
import {
  IconPrinter, IconDownload, IconCash
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';

interface RecuDecompteProps {
  numero: string;
  date: string;
  client: string;
  details: Array<{
    qte_decompte: number;
    prix_achat: number;
    prix_vente: number;
    commission_pourcentage: number;
    designation: string;
    categorie: string;
    unite_base: string;
    qte_initiale?: number;
    reliquat_precedent?: number;
    qte_cumulee?: number;
    reliquat?: number;
    stock_actuel?: number;  // Stock actuel du revendeur
  }>;
  factureOriginale?: any;
}

interface DetailCalcul {
  numero: number;
  designation: string;
  categorie: string;
  unite: string;

  qte_initiale: number;
  qte_vendue: number;
  qte_cumulee: number;
  reliquat: number;

  prix_achat: number;
  prix_vente: number;
  benefice_ligne: number;
  commission_ligne: number;
  total_vente: number;
}

export const RecuDecompte: React.FC<RecuDecompteProps> = ({
  numero,
  date,
  client,
  details,
  factureOriginale
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  // Récupérer le taux de commission
  const tauxCommissionUnique = useMemo(() => {
    const taux = factureOriginale?.taux_commission_revendeur
      || factureOriginale?.taux_commission
      || factureOriginale?.commission_pourcentage
      || (details && details.length > 0 ? details[0]?.commission_pourcentage : null)
      || 60;

    return Number(taux) || 60;
  }, [factureOriginale, details]);

  const { detailsWithCalculs, totalVente, totalCommission, totalBenefice } = useMemo(() => {
    const safeDetails = Array.isArray(details) ? details : [];
    let totalVenteValue = 0;
    let totalCommissionValue = 0;
    let totalBeneficeValue = 0;

    const detailsWithCalculsValue: DetailCalcul[] = safeDetails.map(
      (detail: any, idx: number) => {

        // Quantité décomptée (vendue dans ce décompte)
        const qteVendue = Number(
          detail.qte_decompte ??
          detail.qteVendue ??
          detail.quantite ??
          0
        );

        // Quantité initiale avant ce décompte
        // - Pour un premier décompte : stock_actuel + qte_decompte (stock avant le décompte)
        // - Pour les décomptes suivants : reliquat du décompte précédent
        const stockActuel = Number(detail.stock_actuel || 0);
        const qteInitiale = Number(
          detail.qte_initiale ??                              // Si explicitement fourni
          detail.reliquat_precedent ??                        // Si c'est un décompte suivant
          (stockActuel + qteVendue)                           // Stock actuel + quantité décomptée
        );

        // Quantité cumulée = quantité initiale - quantité restante
        const qteCumulee = Number(
          detail.qte_cumulee ??
          (qteInitiale - (detail.reliquat ?? 0))
        );

        // Reliquat (stock restant après le décompte)
        const reliquat = Number(
          detail.reliquat ??
          (qteInitiale - qteVendue)
        );

        const prixAchat = Number(
          detail.prix_achat ??
          detail.prixAchat ??
          detail.prix_achat_base ??
          0
        );

        const prixVente = Number(
          detail.prix_vente ??
          detail.prixVente ??
          detail.prix_unitaire_vente ??
          0
        );

        const unite =
          detail.unite_base ||
          detail.unite_mesure ||
          detail.unite ||
          'pièce';

        const categorie =
          detail.categorie || '-';

        const designation =
          detail.designation ||
          detail.produit_designation ||
          'Produit';

        const totalVenteLigne =
          prixVente * qteVendue;

        const totalAchatLigne =
          prixAchat * qteVendue;

        const beneficeLigne =
          totalVenteLigne - totalAchatLigne;

        const commissionLigne =
          (beneficeLigne * tauxCommissionUnique) / 100;

        totalVenteValue += totalVenteLigne;
        totalCommissionValue += commissionLigne;
        totalBeneficeValue += beneficeLigne;

        return {
          numero: idx + 1,
          designation,
          categorie,
          unite,

          qte_initiale: qteInitiale,
          qte_vendue: qteVendue,
          qte_cumulee: qteCumulee,
          reliquat: reliquat,

          prix_achat: prixAchat,
          prix_vente: prixVente,

          benefice_ligne: beneficeLigne,
          commission_ligne: commissionLigne,
          total_vente: totalVenteLigne
        };
      }
    );
    return {
      detailsWithCalculs: detailsWithCalculsValue,
      totalVente: totalVenteValue,
      totalCommission: totalCommissionValue,
      totalBenefice: totalBeneficeValue,
    };
  }, [details, tauxCommissionUnique]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reçu_Decompte_${numero}`,
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
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  // Valeurs par défaut si l'atelier n'est pas chargé
  const atelier = atelierConfig || {
    nom_atelier: 'MON ATELIER',
    telephone: '',
    adresse: '',
    email: '',
    message_facture: 'Merci de votre confiance',
    logo_base64: ''
  };

  if (atelierLoading) {
    return (
      <Center py={50}>
        <Loader size="sm" />
        <Text ml="sm" size="sm">Chargement...</Text>
      </Center>
    );
  }

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
                {atelier.telephone && <Text size="xs" c="dimmed">{atelier.telephone}</Text>}
              </Box>
            </Flex>
            <Box style={{ textAlign: 'right' }}>
              <Text size="xs" fw={600}>N°{numero}</Text>
              <Text size="xs" c="dimmed">{formatDate(date)}</Text>
            </Box>
          </Flex>

          {/* Titre */}
          <Text ta="center" fw={700} size="xs" style={{ backgroundColor: '#f2d2bc', padding: '2px', borderRadius: '4px', marginBottom: 8 }}>
            REÇU DE DÉCOMPTE
          </Text>

          {/* Infos client */}
          <Flex justify="space-between" wrap="wrap" gap="xs" mb="xs" style={{ fontSize: '14px' }}>
            <Text><Text span fw={600}>Revendeur:</Text> {client || 'Non spécifié'}</Text>
            <Text><Text span fw={600}>Date décompte:</Text> {formatDate(date)}</Text>
          </Flex>

          <Divider my={4} />

          {/* Tableau */}
          {detailsWithCalculs.length === 0 ? (
            <Text ta="center" c="dimmed" py="xl" size="sm">Aucun détail disponible</Text>
          ) : (
            <>
              <Table withColumnBorders style={{ fontSize: '12px', marginBottom: 12 }}>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                    <Table.Th c="white" ta="center" w={25}>#</Table.Th>
                    <Table.Th c="white">Désignation</Table.Th>
                    <Table.Th c="white">Catégorie</Table.Th>
                    <Table.Th c="white" ta="center" w={60}>Unité</Table.Th>
                    <Table.Th c="white" ta="center" w={70}>Qté Init.</Table.Th>
                    <Table.Th c="white" ta="center" w={70}>Qté Décompt.</Table.Th>
                    <Table.Th c="white" ta="center" w={70}>Cumul</Table.Th>
                    <Table.Th c="white" ta="center" w={70}>Reliquat</Table.Th>
                    <Table.Th c="white" ta="right" w={80}>P.A (F)</Table.Th>
                    <Table.Th c="white" ta="right" w={80}>P.V (F)</Table.Th>
                    <Table.Th c="white" ta="right" w={90}>Bénéf (F)</Table.Th>
                    <Table.Th c="white" ta="right" w={90}>Total (F)</Table.Th>
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
                        <Badge size="xs" variant="light" color="gray" style={{ fontSize: '10px' }}>
                          {detail.unite}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge color="blue" variant="light" size="xs">
                          {detail.qte_initiale}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge color="green" variant="light" size="xs">
                          {detail.qte_vendue}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge color="orange" variant="light" size="xs">
                          {detail.qte_cumulee}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Badge
                          color={
                            detail.reliquat <= 0
                              ? 'red'
                              : detail.reliquat <= 5
                                ? 'orange'
                                : 'teal'
                          }
                          variant="filled"
                          size="xs"
                        >
                          {detail.reliquat}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{formatMontant(detail.prix_achat)}</Table.Td>
                      <Table.Td ta="right" fw={600}>{formatMontant(detail.prix_vente)}</Table.Td>
                      <Table.Td ta="right" c={detail.benefice_ligne >= 0 ? "green.7" : "red.7"}>
                        {formatMontant(detail.benefice_ligne)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>{formatMontant(detail.total_vente)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Divider my={4} />

              {/* Section bas compacte */}
              <SimpleGrid cols={3} spacing={6} mb={6}>
                <Paper p="xs" withBorder>
                  <Flex justify="space-between" gap={8}>
                    <Text size="xs" fw={600}>Total Ventes:</Text>
                    <Text size="xs" fw={700} c="blue">{formatMontant(totalVente)} FCFA</Text>
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

              {/* Net à reverser */}
              <Paper p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #c8e6c9' }}>
                <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
                  <Group gap="xs">
                    <IconCash size={16} color="#2e7d32" />
                    <Text fw={700} size="sm" c="green.8">NET À REVERSER :</Text>
                  </Group>
                  <Text fw={800} size="lg" c="green.8">{formatMontant(netAReverser)} FCFA</Text>
                </Flex>
              </Paper>

              {/* Montant en lettres */}
              <Paper p="xs" withBorder style={{ backgroundColor: '#f8f9fa', marginTop: 8 }}>
                <Text size="xs" fw={500} ta="center">
                  Arrêté le présent reçu à la somme de : {formatMontant(netAReverser)} Francs CFA
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
              {atelier.message_facture && (
                <Text size="xs" ta="center" fs="italic" c="dimmed" mt={12}>
                  {atelier.message_facture}
                </Text>
              )}
            </>
          )}
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
          .mantine-Paper-root {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default RecuDecompte;