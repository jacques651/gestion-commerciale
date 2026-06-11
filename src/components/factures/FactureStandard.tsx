// src/components/factures/FactureStandard.tsx
import React, { useMemo, useRef } from 'react';
import { 
  Paper, Text, Table, Group, Stack, Box, Divider, 
  Title, Badge, Flex, Card, LoadingOverlay, Button, 
  Tooltip, ThemeIcon, Grid 
} from '@mantine/core';
import { 
  IconBuildingStore, IconPrinter, IconDownload, 
  IconFileInvoice, IconCalendar, IconUser, IconPhone, 
  IconMapPin, IconCurrencyFrank, IconReceipt,
  IconCheck, IconShoppingCart
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';

interface FactureStandardProps {
  facture: any;
  onPrint?: () => void;
  onDownload?: () => void;
}

interface DetailCalcul {
  numero: number;
  qte: number;
  prix_unitaire: number;
  total_ligne: number;
  unite: string;
  designation: string;
  code: string;
}

export const FactureStandard: React.FC<FactureStandardProps> = ({ 
  facture, 
  onPrint, 
  onDownload 
}) => {
  // ============================================================
  // TOUS LES HOOKS ICI - NIVEAU SUPÉRIEUR
  // ============================================================
  const printRef = useRef<HTMLDivElement>(null);
  const { config: atelierConfig, loading: atelierLoading } = useAtelierConfig();

  // useMemo pour les calculs des détails
  const { detailsWithCalculs, totalHT, tva, totalTTC } = useMemo(() => {
    let totalHTValue = 0;
    const details = (facture?.details || []).map((detail: any, idx: number) => {
      const qte = detail.qte_commande || detail.quantite || 0;
      const prix = detail.prix_unitaire_vente || detail.prix_vente || 0;
      const totalLigne = prix * qte;
      totalHTValue += totalLigne;
      
      return {
        numero: idx + 1,
        qte,
        prix_unitaire: prix,
        total_ligne: totalLigne,
        unite: detail.unite || detail.unite_mesure || 'pièce',
        designation: detail.produit_designation || detail.designation || detail.nom_produit || '-',
        code: detail.code_produit || detail.codeProduit || ''
      };
    });

    const tvaValue = totalHTValue * 0.18;
    const totalTTCValue = totalHTValue + tvaValue;

    return {
      detailsWithCalculs: details,
      totalHT: totalHTValue,
      tva: tvaValue,
      totalTTC: totalTTCValue
    };
  }, [facture]);

  // ============================================================
  // CONDITIONS DE RETOUR APRÈS TOUS LES HOOKS
  // ============================================================
  if (!facture) {
    return (
      <Paper p="xl" ta="center">
        <Text c="red">Données de facture manquantes</Text>
      </Paper>
    );
  }

  if (atelierLoading) {
    return (
      <Card withBorder p="xl" ta="center">
        <LoadingOverlay visible={true} />
        <Text>Chargement des paramètres...</Text>
      </Card>
    );
  }

  // ============================================================
  // FONCTIONS UTILITAIRES
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
    date_facture: facture.date_facture || facture.DateFacture || new Date().toISOString(),
    date_echeance: facture.date_echeance || facture.DateEcheance || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    client_nom: facture.client_nom || facture.NomComplet || facture.nom_client || 'Client',
    client_societe: facture.client_societe || facture.Societe || '',
    client_tel: facture.client_tel || facture.Tel || '-',
    client_email: facture.client_email || facture.Email || '',
    client_adresse: facture.client_adresse || facture.Adresse || '',
    client_ville: facture.client_ville || facture.Ville || '',
    code_commande: facture.code_commande || facture.CodeCommande || '-',
    notes: facture.notes || '',
    statut: facture.statut || 'EN_ATTENTE'
  };

  const atelier = atelierConfig || {
    nom_atelier: 'SAID TELECOM',
    telephone: '5130 61 16',
    adresse: 'Saaba à Kossodo',
    email: 'contact@saidtelecom.ci',
    message_facture: 'Merci de votre confiance',
    logo_base64: '',
    nif: ''
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
        return { color: '#ed6c02', bg: '#fff3e0', label: 'En attente', icon: null };
      case 'ANNULEE':
        return { color: '#d32f2f', bg: '#ffebee', label: 'Annulée', icon: null };
      default:
        return { color: '#757575', bg: '#f5f5f5', label: statut, icon: null };
    }
  };

  const statutInfo = getStatutColor(factureData.statut);

  return (
    <Box>
      {/* Barre d'outils */}
      <Group justify="flex-end" mb="md" style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'white', padding: '12px 0' }}>
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
          {/* Header avec dégradé */}
          <Box 
            style={{ 
              background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
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
                      Facture Standard - Document commercial
                    </Text>
                  </div>
                </Group>
              </Stack>
              <Stack gap={4} align="flex-end">
                <Title order={2} style={{ color: 'white', margin: 0, fontSize: '22px', fontWeight: 600 }}>
                  FACTURE STANDARD
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
                        <IconFileInvoice size={18} color="#1b365d" />
                        <Text fw={800} size="xl" style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                          {factureData.code_facture}
                        </Text>
                      </Group>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>N° COMMANDE</Text>
                      <Badge color="blue" variant="light" size="lg" leftSection={<IconShoppingCart size={14} />}>
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
                      <IconCalendar size={16} color="#1b365d" />
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
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef'
              }}
            >
              <Flex justify="space-between" align="center" mb="md">
                <Group gap="xs">
                  <ThemeIcon color="blue" size="md" variant="light" radius="xl">
                    <IconUser size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="lg" c="blue.8">INFORMATIONS CLIENT</Text>
                </Group>
                <Badge color="blue" variant="light" size="sm" radius="xl">Client</Badge>
              </Flex>
              
              <Grid>
                <Grid.Col span={4}>
                  <Group gap="xs" align="flex-start">
                    <IconUser size={18} color="#1b365d" />
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Nom / Société</Text>
                      <Text fw={700} size="md" c="blue.8">{factureData.client_nom}</Text>
                      {factureData.client_societe && (
                        <Text size="sm" c="dimmed">{factureData.client_societe}</Text>
                      )}
                    </Stack>
                  </Group>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Group gap="xs" align="flex-start">
                    <IconPhone size={18} color="#1b365d" />
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
                    <IconMapPin size={18} color="#1b365d" />
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
                  <Table.Tr style={{ backgroundColor: '#17b408ee' }}>
                    <Table.Th ta="center" w={50} style={{ fontSize: 13, fontWeight: 700 }}>#</Table.Th>
                    <Table.Th style={{ fontSize: 13, fontWeight: 700 }}>Désignation</Table.Th>
                    <Table.Th ta="center" w={80} style={{ fontSize: 13, fontWeight: 700 }}>Unité</Table.Th>
                    <Table.Th ta="center" w={80} style={{ fontSize: 13, fontWeight: 700 }}>Qté</Table.Th>
                    <Table.Th ta="right" w={120} style={{ fontSize: 13, fontWeight: 700 }}>P.U HT</Table.Th>
                    <Table.Th ta="right" w={140} style={{ fontSize: 13, fontWeight: 700 }}>Total HT</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {detailsWithCalculs.length > 0 ? (
                    detailsWithCalculs.map((detail: DetailCalcul) => (
                      <Table.Tr key={detail.numero} style={{ transition: 'background 0.2s' }}>
                        <Table.Td ta="center" fw={600}>{detail.numero}</Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{detail.designation}</Text>
                          {detail.code && (
                            <Text size="xs" c="dimmed" mt={2}>
                              Réf: {detail.code}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge variant="light" color="gray" radius="sm" size="sm">
                            {detail.unite}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge variant="light" color="blue" radius="sm" size="sm">
                            {detail.qte}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} size="sm">{formatMontant(detail.prix_unitaire)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right" fw={700} c="blue.8">
                          {formatMontant(detail.total_ligne)} F
                        </Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={6} ta="center" py="xl">
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
              <Box style={{ width: '400px' }}>
                <Card withBorder radius="md" p="md" style={{ backgroundColor: '#fafafa' }}>
                  <Stack gap="sm">
                    <Flex justify="space-between" p="xs" style={{ borderRadius: '8px' }}>
                      <Group gap="xs">
                        <IconCurrencyFrank size={18} color="#666" />
                        <Text fw={500}>Total HT</Text>
                      </Group>
                      <Text fw={700} size="lg">{formatMontant(totalHT)} FCFA</Text>
                    </Flex>
                    
                    <Flex justify="space-between" p="xs" style={{ backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                      <Group gap="xs">
                        <IconReceipt size={18} color="#2e7d32" />
                        <Text fw={500} c="green.8">TVA (18%)</Text>
                      </Group>
                      <Text fw={700} size="lg" c="green.8">{formatMontant(tva)} FCFA</Text>
                    </Flex>
                    
                    <Divider my={4} style={{ borderColor: '#e0e0e0' }} />
                    
                    <Flex justify="space-between" p="md" style={{ backgroundColor: '#e3f2fd', borderRadius: '12px' }}>
                      <Group gap="xs">
                        <IconCurrencyFrank size={24} color="#1565c0" />
                        <Text fw={800} size="lg" c="blue.8">Total TTC</Text>
                      </Group>
                      <Text fw={800} size="xl" c="blue.8">{formatMontant(totalTTC)} FCFA</Text>
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

export default FactureStandard;