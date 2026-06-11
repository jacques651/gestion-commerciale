// src/components/factures/FactureRevendeur.tsx
import React, { useMemo, useRef } from 'react';
import { 
  Paper, Title, Text, Table, Group, Stack, Badge, Box, 
  Divider, Flex, Grid, ThemeIcon, Button, Tooltip, 
  LoadingOverlay, Alert, Card} from '@mantine/core';
import { 
  IconPrinter, IconDownload, IconBuildingStore, 
  IconReceipt, IconCash, IconTruck, IconFileInvoice,
  IconCalendar, IconUser, IconPhone, 
  IconMapPin, IconPercentage, IconCoin, IconDeviceMobile,
  IconCheck, IconReceipt2, IconBarcode
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';

interface FactureRevendeurProps {
  facture: any;
  onPrint?: () => void;
  onDownload?: () => void;
}

interface DetailCalcul {
  numero: number;
  qte: number;
  prix_achat: number;
  prix_vente: number;
  commission_percent: number;
  benefice: number;
  commission: number;
  produit_designation?: string;
  code_produit?: string;
  unite?: string;
  reference?: string;
}

export const FactureRevendeur: React.FC<FactureRevendeurProps> = ({ 
  facture, 
  onPrint, 
  onDownload 
}) => {
  // ============================================================
  // TOUS LES HOOKS DOIVENT ÊTRE APPELÉS ICI, AU MÊME NIVEAU
  // ============================================================
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  // useMemo doit être appelé APRÈS les autres hooks, MAIS AVANT les conditions de retour
  const { detailsWithCalculs, totalHT, totalBenefice, totalCommission, beneficeNet, tauxCommission } = useMemo(() => {
    const detailsFromFacture = facture?.details || [];
    const detailsFromCommande = facture?.commande?.details || [];
    const detailsFromPanier = facture?.panier || [];
    const details = detailsFromFacture.length > 0 
      ? detailsFromFacture 
      : detailsFromCommande.length > 0 
        ? detailsFromCommande 
        : detailsFromPanier;

    let totalHTValue = 0;
    let totalBeneficeValue = 0;
    let totalCommissionValue = 0;
    
    const detailsWithCalculsValue: DetailCalcul[] = details.map((detail: any, idx: number) => {
      const qte = detail.qte_commande || detail.quantite || detail.qteDecompte || detail.QteDecompte || 1;
      const prixAchat = detail.prix_achat_base || detail.prix_achat || detail.prixAchat || 0;
      const prixVente = detail.prix_unitaire_vente || detail.prix_vente || detail.prixVente || 0;
      const commissionPercent = detail.commission_pourcentage || detail.commission_percent || detail.commission || 60;
      
      const totalLigneVente = prixVente * qte;
      const totalLigneAchat = prixAchat * qte;
      const beneficeLigne = totalLigneVente - totalLigneAchat;
      const commissionLigne = (beneficeLigne * commissionPercent) / 100;
      
      totalHTValue += totalLigneVente;
      totalBeneficeValue += beneficeLigne;
      totalCommissionValue += commissionLigne;
      
      return {
        numero: idx + 1,
        qte,
        prix_achat: prixAchat,
        prix_vente: prixVente,
        commission_percent: commissionPercent,
        benefice: beneficeLigne,
        commission: commissionLigne,
        produit_designation: detail.produit_designation || detail.designation || detail.nom_produit || detail.produit_nom || 'Produit sans nom',
        code_produit: detail.code_produit || detail.codeProduit || '',
        unite: detail.unite || detail.unite_mesure || 'pièce',
        reference: detail.code_produit || detail.reference || ''
      };
    });

    const beneficeNetValue = totalBeneficeValue - totalCommissionValue;
    const tauxCommissionValue = totalBeneficeValue > 0 ? (totalCommissionValue / totalBeneficeValue) * 100 : 0;

    return {
      detailsWithCalculs: detailsWithCalculsValue,
      totalHT: totalHTValue,
      totalBenefice: totalBeneficeValue,
      totalCommission: totalCommissionValue,
      beneficeNet: beneficeNetValue,
      tauxCommission: tauxCommissionValue
    };
  }, [facture]);

  // ============================================================
  // LES CONDITIONS DE RETOUR VIENNENT APRÈS TOUS LES HOOKS
  // ============================================================
  
  // Vérification des données facture APRÈS tous les hooks
  if (!facture) {
    return (
      <Alert icon={<IconReceipt size={20} />} title="Erreur" color="red" variant="filled">
        Données de facture manquantes
      </Alert>
    );
  }

  // Vérification du chargement APRÈS tous les hooks
  if (atelierLoading) {
    return (
      <Card withBorder p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text>Chargement des paramètres...</Text>
      </Card>
    );
  }

  // ============================================================
  // FONCTIONS UTILITAIRES (pas des hooks, donc peuvent être après)
  // ============================================================
  
  const formatMontant = (value: number | undefined | null): string => {
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

  const factureData = {
    code_facture: facture.code_facture || facture.CodeFacture || '-',
    code_recu: facture.code_recu || facture.CodeReçu || facture.codeRecu || '-',
    date_facture: facture.date_facture || facture.DateFacture || new Date().toISOString(),
    date_echeance: facture.date_echeance || facture.DateEcheance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    client_nom: facture.client_nom || facture.NomComplet || facture.nom_client || facture.clientNom || 'Revendeur',
    client_societe: facture.client_societe || facture.Societe || '',
    client_tel: facture.client_tel || facture.Tel || facture.clientTel || '-',
    client_email: facture.client_email || facture.Email || '',
    client_adresse: facture.client_adresse || facture.Adresse || '',
    client_ville: facture.client_ville || facture.Ville || '',
    code_commande: facture.code_commande || facture.CodeCommande || '-',
    statut: facture.statut || 'EN_ATTENTE',
    notes: facture.notes || ''
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      const printContent = printRef.current;
      if (printContent) {
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload();
      }
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      notifications.show({
        title: 'Information',
        message: 'Fonctionnalité de téléchargement en développement',
        color: 'blue'
      });
    }
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'PAYE':
      case 'PAYEE':
      case 'REGLEE':
        return { color: '#2e7d32', bg: '#e8f5e9', label: 'Payée', icon: <IconCheck size={14} /> };
      case 'EN_ATTENTE':
        return { color: '#ed6c02', bg: '#fff3e0', label: 'En attente', icon: <IconReceipt2 size={14} /> };
      case 'ANNULEE':
        return { color: '#d32f2f', bg: '#ffebee', label: 'Annulée', icon: null };
      default:
        return { color: '#757575', bg: '#f5f5f5', label: statut, icon: null };
    }
  };

  const statutInfo = getStatutColor(factureData.statut);
  
  const atelier = atelierConfig || {
    nom_atelier: 'SAID TELECOM',
    telephone: '5130 61 16',
    adresse: 'Saaba à Kossodo',
    email: 'contact@saidtelecom.ci',
    message_facture: 'Merci de votre confiance',
    logo_base64: '',
    nif: ''
  };

  // ============================================================
  // RENDU JSX
  // ============================================================
  
  return (
    <Box>
      {/* Barre d'outils */}
      <Group justify="flex-end" mb="lg" style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'white', padding: '12px 0' }}>
        <Group gap="sm">
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
              onClick={handleDownload}
              radius="md"
            >
              PDF
            </Button>
          </Tooltip>
        </Group>
      </Group>

      {/* Contenu de la facture */}
      <div ref={printRef}>
        <Paper 
          shadow="xl" 
          radius="lg" 
          withBorder 
          style={{ 
            maxWidth: '1200px', 
            margin: '0 auto',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
            border: '1px solid #e9ecef'
          }}
        >
          {/* Header premium avec dégradé */}
          <Box 
            style={{ 
              background: 'linear-gradient(135deg, #0d3b0f 0%, #1b5e1f 50%, #2e7d32 100%)',
              padding: '32px 40px',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box style={{ position: 'absolute', top: -50, right: -50, opacity: 0.1 }}>
              <IconBuildingStore size={200} />
            </Box>
            
            <Flex justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Stack gap={8}>
                <Group gap="md">
                  {atelier.logo_base64 ? (
                    <Box 
                      style={{ 
                        backgroundColor: 'white', 
                        borderRadius: '16px', 
                        padding: '8px',
                        display: 'inline-flex'
                      }}
                    >
                      <img 
                        src={atelier.logo_base64} 
                        alt="Logo"
                        style={{ width: 60, height: 60, objectFit: 'contain' }}
                      />
                    </Box>
                  ) : (
                    <ThemeIcon size={60} radius="lg" color="white" variant="light" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <IconBuildingStore size={32} />
                    </ThemeIcon>
                  )}
                  <div>
                    <Title order={1} style={{ color: 'white', margin: 0, fontSize: '28px', fontWeight: 700 }}>
                      {atelier.nom_atelier}
                    </Title>
                    <Text size="sm" opacity={0.85} mt={4}>
                      Facture Revendeur - Détail des commissions
                    </Text>
                  </div>
                </Group>
              </Stack>
              <Stack gap={4} align="flex-end">
                <Title order={2} style={{ color: 'white', margin: 0, fontSize: '22px', fontWeight: 600 }}>
                  FACTURE REVENDEUR
                </Title>
                <Divider style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: '100%' }} />
                <Text size="xs" opacity={0.8}>{atelier.adresse}</Text>
                <Text size="xs" opacity={0.8}>📞 {atelier.telephone}</Text>
                <Text size="xs" opacity={0.8}>✉️ {atelier.email}</Text>
                {atelier.nif && <Text size="xs" opacity={0.8}>🏷️ NIF: {atelier.nif}</Text>}
              </Stack>
            </Flex>
          </Box>

          <Box p="xl" style={{ backgroundColor: '#ffffff' }}>
            {/* En-tête de la facture */}
            <Grid mb="xl">
              <Grid.Col span={8}>
                <Card 
                  withBorder 
                  radius="md" 
                  p="md" 
                  style={{ 
                    backgroundColor: '#f8f9fa',
                    borderLeft: `4px solid ${statutInfo.color}`
                  }}
                >
                  <Group gap="xl" wrap="wrap">
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>N° FACTURE</Text>
                      <Group gap="xs" align="center">
                        <IconFileInvoice size={18} color="#2e7d32" />
                        <Text fw={800} size="xl" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                          {factureData.code_facture}
                        </Text>
                      </Group>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>N° COMMANDE</Text>
                      <Badge color="green" variant="light" size="lg" leftSection={<IconTruck size={14} />}>
                        {factureData.code_commande}
                      </Badge>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>STATUT</Text>
                      <Badge 
                        color={statutInfo.color} 
                        style={{ backgroundColor: statutInfo.bg, color: statutInfo.color }}
                        size="lg"
                        leftSection={statutInfo.icon}
                      >
                        {statutInfo.label}
                      </Badge>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={4}>
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#f8f9fa' }}>
                  <Stack gap={6}>
                    <Group gap="xs">
                      <IconCalendar size={16} color="#2e7d32" />
                      <Text size="sm" c="dimmed">Date d'émission</Text>
                      <Text fw={600} size="sm" ml="auto">{formatDate(factureData.date_facture)}</Text>
                    </Group>
                    <Group gap="xs">
                      <IconCalendar size={16} color="#d32f2f" />
                      <Text size="sm" c="dimmed">Date d'échéance</Text>
                      <Text fw={600} size="sm" ml="auto">{formatDate(factureData.date_echeance)}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Informations client */}
            <Card 
              withBorder 
              radius="md" 
              p="lg" 
              mb="xl"
              style={{ 
                backgroundColor: '#e8f5e9',
                border: '1px solid #c8e6c9'
              }}
            >
              <Flex justify="space-between" align="center" mb="md">
                <Group gap="xs">
                  <ThemeIcon color="green" size="md" variant="light" radius="xl">
                    <IconTruck size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="lg" c="green.8">INFORMATIONS REVENDEUR</Text>
                </Group>
                <Badge color="green" variant="filled" size="sm" radius="xl">Partenaire commercial</Badge>
              </Flex>
              
              <Grid>
                <Grid.Col span={4}>
                  <Group gap="xs" align="flex-start">
                    <IconUser size={18} color="#2e7d32" />
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Nom / Société</Text>
                      <Text fw={700} size="md" c="green.8">{factureData.client_nom}</Text>
                      {factureData.client_societe && (
                        <Text size="sm" c="dimmed">{factureData.client_societe}</Text>
                      )}
                    </Stack>
                  </Group>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Group gap="xs" align="flex-start">
                    <IconPhone size={18} color="#2e7d32" />
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Téléphone</Text>
                      <Text fw={500} size="md">{factureData.client_tel || 'Non renseigné'}</Text>
                      <Text size="xs" c="dimmed" mt={4}>Email</Text>
                      <Text size="sm">{factureData.client_email || 'Non renseigné'}</Text>
                    </Stack>
                  </Group>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Group gap="xs" align="flex-start">
                    <IconMapPin size={18} color="#2e7d32" />
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Adresse</Text>
                      <Text fw={500}>{factureData.client_adresse || 'Non renseignée'}</Text>
                      {factureData.client_ville && (
                        <Text size="xs" c="dimmed">{factureData.client_ville}</Text>
                      )}
                    </Stack>
                  </Group>
                </Grid.Col>
              </Grid>
            </Card>

            {/* Tableau des produits */}
            <Box style={{ overflowX: 'auto', marginBottom: '32px' }}>
              <Table 
                striped 
                highlightOnHover 
                withColumnBorders
                style={{ 
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: 'rgba(18, 153, 74, 0.92)', width: '100%' }}>
                    <Table.Th ta="center" w={50} style={{ fontSize: 13, fontWeight: 700 }}>#</Table.Th>
                    <Table.Th style={{ fontSize: 13, fontWeight: 700 }}>Désignation</Table.Th>
                    <Table.Th ta="center" w={80} style={{ fontSize: 13, fontWeight: 700 }}>Qté</Table.Th>
                    <Table.Th ta="right" w={120} style={{ fontSize: 13, fontWeight: 700 }}>Prix achat</Table.Th>
                    <Table.Th ta="right" w={120} style={{ fontSize: 13, fontWeight: 700 }}>Prix vente</Table.Th>
                    <Table.Th ta="right" w={110} style={{ fontSize: 13, fontWeight: 700 }}>Bénéfice</Table.Th>
                    <Table.Th ta="center" w={90} style={{ fontSize: 13, fontWeight: 700 }}>Commission</Table.Th>
                    <Table.Th ta="right" w={130} style={{ fontSize: 13, fontWeight: 700 }}>Montant comm.</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {detailsWithCalculs.length > 0 ? (
                    detailsWithCalculs.map((detail) => (
                      <Table.Tr key={detail.numero} style={{ transition: 'background 0.2s' }}>
                        <Table.Td ta="center" fw={600}>{detail.numero}</Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{detail.produit_designation}</Text>
                          {detail.code_produit && (
                            <Text size="xs" c="dimmed" mt={2}>
                              <IconBarcode size={10} style={{ display: 'inline', marginRight: 4 }} />
                              Réf: {detail.code_produit}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge variant="light" color="blue" radius="sm" size="sm">
                            {detail.qte} {detail.unite}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c="dimmed">{formatMontant(detail.prix_achat)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} size="sm" c="green.8">{formatMontant(detail.prix_vente)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right" c="green.6">
                          <Text fw={600}>{formatMontant(detail.benefice)} F</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color="orange" size="sm" variant="light" radius="xl">
                            {detail.commission_percent}%
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" c="blue.7">
                          <Text fw={600}>{formatMontant(detail.commission)} F</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={8} ta="center" py="xl">
                        <Stack align="center" gap="xs">
                          <IconReceipt size={48} color="#ccc" />
                          <Text c="dimmed">Aucun produit trouvé</Text>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Box>

            {/* Récapitulatif */}
            <Flex justify="flex-end">
              <Box style={{ width: '460px' }}>
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#fafafa' }}>
                  <Stack gap="sm">
                    <Flex justify="space-between" p="xs" style={{ borderRadius: '8px' }}>
                      <Group gap="xs">
                        <IconCoin size={18} color="#666" />
                        <Text fw={500}>Total HT (ventes)</Text>
                      </Group>
                      <Text fw={700} size="lg">{formatMontant(totalHT)} FCFA</Text>
                    </Flex>
                    
                    <Flex justify="space-between" p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                      <Group gap="xs">
                        <IconDeviceMobile size={18} color="#2e7d32" />
                        <Text fw={500} c="green.8">Bénéfice total</Text>
                      </Group>
                      <Text fw={700} size="lg" c="green.8">{formatMontant(totalBenefice)} FCFA</Text>
                    </Flex>
                    
                    <Flex justify="space-between" p="xs" style={{ backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                      <Group gap="xs">
                        <IconPercentage size={18} color="#ed6c02" />
                        <Text fw={500} c="orange.8">Commission ({tauxCommission.toFixed(1)}%)</Text>
                      </Group>
                      <Text fw={700} size="lg" c="orange.8">{formatMontant(totalCommission)} FCFA</Text>
                    </Flex>
                    
                    <Divider my={4} style={{ borderColor: '#e0e0e0' }} />
                    
                    <Flex justify="space-between" p="md" style={{ backgroundColor: '#e8f5e9', borderRadius: '12px' }}>
                      <Group gap="xs">
                        <IconCash size={24} color="#2e7d32" />
                        <Text fw={800} size="lg" c="green.8">Bénéfice net revendeur</Text>
                      </Group>
                      <Text fw={800} size="xl" c="green.8">{formatMontant(beneficeNet)} FCFA</Text>
                    </Flex>
                    
                    <Flex justify="space-between" p="md" style={{ backgroundColor: '#e3f2fd', borderRadius: '12px' }}>
                      <Group gap="xs">
                        <IconReceipt size={24} color="#1565c0" />
                        <Text fw={800} size="lg" c="blue.8">Total TTC à payer</Text>
                      </Group>
                      <Text fw={800} size="xl" c="blue.8">{formatMontant(totalHT)} FCFA</Text>
                    </Flex>
                  </Stack>
                </Card>
              </Box>
            </Flex>

            {/* Notes */}
            {factureData.notes && (
              <>
                <Divider my="lg" />
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#f8f9fa' }}>
                  <Group gap="xs" mb={4}>
                    <IconFileInvoice size={16} color="#666" />
                    <Text size="xs" c="dimmed" fw={600}>NOTES</Text>
                  </Group>
                  <Text size="sm" c="dimmed">{factureData.notes}</Text>
                </Card>
              </>
            )}

            {/* Footer */}
            <Divider my="xl" />
            <Box style={{ textAlign: 'center' }}>
              <Stack gap={6}>
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  {atelier.message_facture || 'Merci de votre confiance'} - {atelier.nom_atelier}
                </Text>
                <Group justify="center" gap="xl" style={{ fontSize: 11, color: '#888' }}>
                  <Text>📞 {atelier.telephone}</Text>
                  <Text>✉️ {atelier.email}</Text>
                  <Text>📍 {atelier.adresse}</Text>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Document généré automatiquement - Fait foi
                </Text>
              </Stack>
            </Box>
          </Box>
        </Paper>
      </div>
    </Box>
  );
};

export default FactureRevendeur;