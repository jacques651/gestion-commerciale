// src/components/factures/ListeFactures.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Group, Badge, Stack, Title, Card, Text, 
  Pagination, Select, Grid, Box, Loader, Paper, Flex, ThemeIcon, SimpleGrid,
  TextInput, Modal, Divider, ActionIcon, Tooltip
} from '@mantine/core';
import {
  IconPrinter, IconSearch, IconRefresh, IconX,
  IconFileInvoice, IconCalendar, IconBuildingStore,
  IconTruck, IconCurrencyFrank, IconReceipt, IconArrowBackUp,
  IconShoppingBag, IconPlus, IconEye, IconDownload,
  IconCash
} from '@tabler/icons-react';
import { useFactures } from '../../hooks/useFactures';
import { factureRepository } from '../../database/repositories/factureRepository';
import { factureRevendeurRepository } from '../../database/repositories/factureRevendeurRepository';
import { FactureStandard } from './FactureStandard';

import { FormulaireReglement } from '../reglements/FormulaireReglement';
import { notifications } from '@mantine/notifications';
import { getDb } from '../../database/db';
import FactureRevendeur from './FactureRevendeur';

export const ListeFactures: React.FC = () => {
  const navigate = useNavigate();
  const { factures, loading, refresh } = useFactures();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchClient, setSearchClient] = useState('');
  const [typeFacture, setTypeFacture] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string | null>(null);
  const [dateFin, setDateFin] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<any>(null);
  const [factureModalOpened, setFactureModalOpened] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [localFactures, setLocalFactures] = useState<any[]>([]);
  
  // États pour le règlement
  const [reglementModalOpened, setReglementModalOpened] = useState(false);
  const [reglementData, setReglementData] = useState({
    idFacture: 0,
    idClient: 0,
    montantMax: 0,
    codeFacture: '',
    clientNom: '',
    type: 'standard' as 'standard' | 'revendeur'
  });

  const itemsPerPage = 10;

  // ✅ Mettre à jour les factures locales quand les factures du hook changent
  React.useEffect(() => {
    if (factures) {
      setLocalFactures(factures);
    }
  }, [factures]);

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const getTypeFactureLabel = (facture: any): string => {
    if (facture.idFactureRevendeur !== undefined || facture.type_commande === 'REVENDEUR' || facture.type === 'revendeur') {
      return 'Revendeur';
    }
    return 'Standard';
  };

  const isRevendeurFacture = (facture: any): boolean => {
    return facture.idFactureRevendeur !== undefined || facture.type_commande === 'REVENDEUR' || facture.type === 'revendeur';
  };

  const handleViewFacture = async (facture: any) => {
    try {
      setLoadingDetails(true);
      
      let completeFacture = null;
      const factureId = facture.idFacture || facture.idFactureRevendeur;
      
      if (isRevendeurFacture(facture)) {
        completeFacture = await factureRevendeurRepository.getById(factureId);
      } else {
        completeFacture = await factureRepository.getById(factureId);
      }
      
      if (completeFacture) {
        setSelectedFacture(completeFacture);
        setFactureModalOpened(true);
      } else {
        notifications.show({
          title: 'Erreur',
          message: 'Impossible de charger les détails de la facture',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Erreur chargement facture:', error);
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors du chargement',
        color: 'red'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRegler = async (facture: any) => {
    try {
      const db = await getDb();
      let idFacture = 0;
      let montantRestant = 0;
      let montantTotal = 0;
      let codeFacture = '';
      let type: 'standard' | 'revendeur' = 'standard';
      
      if (isRevendeurFacture(facture)) {
        type = 'revendeur';
        idFacture = facture.idFactureRevendeur || facture.idFacture;
        montantTotal = facture.montant_ttc || 0;
        
        const reglements = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant), 0) as total_regle 
          FROM reglements_revendeur 
          WHERE idFactureRevendeur = ?
        `, [idFacture]);
        
        const montantRegle = reglements[0]?.total_regle || 0;
        montantRestant = montantTotal - montantRegle;
        codeFacture = facture.code_facture || `FR-${idFacture}`;
      } else {
        type = 'standard';
        idFacture = facture.idFacture;
        montantTotal = facture.montant_ttc || 0;
        
        const reglements = await db.select<any[]>(`
          SELECT COALESCE(SUM(montant), 0) as total_regle 
          FROM reglements 
          WHERE idFacture = ?
        `, [idFacture]);
        
        const montantRegle = reglements[0]?.total_regle || 0;
        montantRestant = montantTotal - montantRegle;
        codeFacture = facture.code_facture || `F-${idFacture}`;
      }
      
      if (montantRestant <= 0) {
        notifications.show({
          title: 'Information',
          message: 'Cette facture est déjà entièrement réglée',
          color: 'blue'
        });
        return;
      }
      
      setReglementData({
        idFacture: idFacture,
        idClient: facture.idClient || facture.idRevendeur,
        montantMax: montantRestant,
        codeFacture: codeFacture,
        clientNom: facture.NomComplet || facture.client_nom || 'Client',
        type: type
      });
      setReglementModalOpened(true);
      
    } catch (error) {
      console.error('Erreur lors du règlement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les informations de règlement',
        color: 'red'
      });
    }
  };

  const handleGenererRecu = async (facture: any) => {
    try {
      const db = await getDb();
      let reglements: any[] = [];
      let codeFacture = '';
      let clientNom = facture.NomComplet || facture.client_nom || 'Client';
      
      if (isRevendeurFacture(facture)) {
        const idFacture = facture.idFactureRevendeur || facture.idFacture;
        codeFacture = facture.code_facture || `FR-${idFacture}`;
        
        reglements = await db.select(`
          SELECT r.*, 'revendeur' as type
          FROM reglements_revendeur r
          WHERE r.idFactureRevendeur = ?
          ORDER BY r.date_reglement DESC
        `, [idFacture]);
      } else {
        const idFacture = facture.idFacture;
        codeFacture = facture.code_facture || `F-${idFacture}`;
        
        reglements = await db.select(`
          SELECT r.*, 'standard' as type
          FROM reglements r
          WHERE r.idFacture = ?
          ORDER BY r.date_reglement DESC
        `, [idFacture]);
      }
      
      if (reglements.length === 0) {
        notifications.show({
          title: 'Information',
          message: 'Aucun règlement trouvé pour cette facture',
          color: 'blue'
        });
        return;
      }
      
      const totalRegle = reglements.reduce((sum, r) => sum + (r.montant || 0), 0);
      const montantTotal = facture.montant_ttc || 0;
      const resteAPayer = montantTotal - totalRegle;
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Reçu de règlement - ${codeFacture}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .title { color: #1b365d; font-size: 24px; }
              .info { margin: 20px 0; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #1b365d; color: white; }
              .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 20px; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 class="title">REÇU DE RÈGLEMENT</h1>
              <p>Facture N° ${codeFacture}</p>
            </div>
            <div class="info">
              <p><strong>Client :</strong> ${clientNom}</p>
              <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            <table>
              <thead>
                <tr><th>Date règlement</th><th>Montant</th><th>Mode de règlement</th></tr>
              </thead>
              <tbody>
                ${reglements.map(r => `
                  <tr>
                    <td>${new Date(r.date_reglement).toLocaleDateString('fr-FR')}</td>
                    <td>${formatMontant(r.montant)} FCFA</td>
                    <td>${r.mode_reglement || 'Espèces'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              <p>Total réglé : ${formatMontant(totalRegle)} FCFA</p>
              <p>Reste à payer : ${formatMontant(resteAPayer)} FCFA</p>
              <p><strong>Montant total de la facture : ${formatMontant(montantTotal)} FCFA</strong></p>
            </div>
            <div class="footer">
              <p>Merci de votre confiance</p>
            </div>
            <script>window.print();setTimeout(()=>window.close(),1000);</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      
    } catch (error) {
      console.error('Erreur génération reçu:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de générer le reçu',
        color: 'red'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (facture: any) => {
    try {
      let completeFacture = null;
      const factureId = facture.idFacture || facture.idFactureRevendeur;
      
      if (isRevendeurFacture(facture)) {
        completeFacture = await factureRevendeurRepository.getById(factureId);
      } else {
        completeFacture = await factureRepository.getById(factureId);
      }
      
      if (completeFacture) {
        const dataStr = JSON.stringify(completeFacture, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const codeFacture = completeFacture.code_facture || 'facture';
        const exportFileDefaultName = `${codeFacture}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        notifications.show({
          title: 'Succès',
          message: 'Facture téléchargée avec succès',
          color: 'green'
        });
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de télécharger la facture',
        color: 'red'
      });
    }
  };

  const datesDisponibles = useMemo(() => {
    const dates = localFactures
      .map(facture => {
        const dateStr = facture.date_facture || facture.date_commande;
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-FR');
      })
      .filter(date => date !== null);

    const uniqueDates = [...new Set(dates)];
    return uniqueDates.sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/');
      const [dayB, monthB, yearB] = b.split('/');
      const dateA = new Date(`${yearA}-${monthA}-${dayA}`);
      const dateB = new Date(`${yearB}-${monthB}-${dayB}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [localFactures]);

  const stringToDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return isNaN(date.getTime()) ? null : date;
  };

  const filteredFactures = useMemo(() => {
    let filtered = [...localFactures];

    if (searchClient) {
      filtered = filtered.filter(facture =>
        (facture.NomComplet || '').toLowerCase().includes(searchClient.toLowerCase())
      );
    }

    if (typeFacture && typeFacture !== 'all') {
      filtered = filtered.filter(facture => {
        const type = getTypeFactureLabel(facture).toLowerCase();
        return type === typeFacture.toLowerCase();
      });
    }

    const dateDebutObj = stringToDate(dateDebut);
    const dateFinObj = stringToDate(dateFin);

    if (dateDebutObj || dateFinObj) {
      filtered = filtered.filter(facture => {
        const dateFacture = new Date(facture.date_facture || facture.date_commande);

        if (dateDebutObj) {
          const debut = new Date(dateDebutObj);
          debut.setHours(0, 0, 0, 0);
          if (dateFacture < debut) return false;
        }

        if (dateFinObj) {
          const fin = new Date(dateFinObj);
          fin.setHours(23, 59, 59, 999);
          if (dateFacture > fin) return false;
        }

        return true;
      });
    }

    return filtered;
  }, [localFactures, searchClient, typeFacture, dateDebut, dateFin]);

  const resetFilters = () => {
    setSearchClient('');
    setTypeFacture(null);
    setDateDebut(null);
    setDateFin(null);
    setCurrentPage(1);
  };

  const stats = {
    total: localFactures.length,
    montantTotal: localFactures.reduce((sum, f: any) => sum + (f.montant_ttc || 0), 0),
    revendeurs: localFactures.filter(f => getTypeFactureLabel(f) === 'Revendeur').length,
    standards: localFactures.filter(f => getTypeFactureLabel(f) === 'Standard').length
  };

  const totalPages = Math.ceil(filteredFactures.length / itemsPerPage);
  const paginatedFactures = filteredFactures.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ✅ Fonction pour obtenir la clé unique d'une facture
  const getUniqueKey = (facture: any): string => {
    const isRevendeur = isRevendeurFacture(facture);
    const id = isRevendeur ? facture.idFactureRevendeur : facture.idFacture;
    const prefix = isRevendeur ? 'revendeur' : 'standard';
    return `${prefix}-${id}`;
  };

  if (loading && localFactures.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Loader size="xl" />
        <Text mt="md">Chargement des factures...</Text>
      </Card>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        {/* EN-TÊTE */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={50} radius="md" color="white" variant="light">
                  <IconFileInvoice size={30} />
                </ThemeIcon>
                <div>
                  <Title order={1} c="white" style={{ fontSize: '2rem' }}>Factures</Title>
                  <Text c="gray.3" size="sm">Gérez et suivez toutes vos factures</Text>
                </div>
              </Group>
            </Stack>
            <Group>
              <Button
                size="md"
                variant="light"
                color="white"
                leftSection={<IconArrowBackUp size={18} />}
                onClick={() => navigate('/commandes')}
              >
                Retour aux commandes
              </Button>
              <Button
                size="md"
                variant="light"
                color="white"
                leftSection={<IconRefresh size={18} />}
                onClick={refresh}
              >
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="white" variant="light" size="lg"><IconFileInvoice size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Total factures</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="blue" variant="light" size="lg"><IconBuildingStore size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Factures standard</Text><Text c="white" fw={700} size="xl">{stats.standards}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="green" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Factures revendeurs</Text><Text c="white" fw={700} size="xl">{stats.revendeurs}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group><ThemeIcon color="yellow" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Montant total</Text><Text c="white" fw={700} size="xl">{formatMontant(stats.montantTotal)} FCFA</Text></div>
              </Group>
            </Card>
          </SimpleGrid>
        </Paper>

        {/* RECHERCHE */}
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group><IconSearch size={20} color="#1b365d" /><Title order={3} size="h4">Rechercher</Title></Group>
            <Button variant="light" color="gray" onClick={resetFilters} size="xs" leftSection={<IconX size={14} />}>
              Réinitialiser
            </Button>
          </Group>

          <Grid>
            <Grid.Col span={4}>
              <TextInput
                label="Nom du client"
                placeholder="Rechercher par nom..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                leftSection={<IconSearch size={16} />}
                size="md"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Type de facture"
                placeholder="Tous les types"
                value={typeFacture}
                onChange={setTypeFacture}
                data={[
                  { value: 'all', label: 'Tous les types' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'revendeur', label: 'Revendeur' },
                ]}
                size="md"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Select
                label="Date de début"
                placeholder="Sélectionner"
                value={dateDebut}
                onChange={setDateDebut}
                data={datesDisponibles}
                size="md"
                clearable
                searchable
                leftSection={<IconCalendar size={14} />}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Select
                label="Date de fin"
                placeholder="Sélectionner"
                value={dateFin}
                onChange={setDateFin}
                data={datesDisponibles}
                size="md"
                clearable
                searchable
                leftSection={<IconCalendar size={14} />}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* BARRE DE NAVIGATION */}
        <Card withBorder radius="lg" shadow="sm" p="md">
          <Group justify="center" gap="md" wrap="wrap">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconShoppingBag size={18} />}
              onClick={() => navigate('/commandes')}
            >
              Commandes Standard
            </Button>
            <Button
              variant="light"
              color="green"
              leftSection={<IconTruck size={18} />}
              onClick={() => navigate('/commandes-revendeur')}
            >
              Commandes Revendeurs
            </Button>
            <Button
              variant="filled"
              color="orange"
              leftSection={<IconFileInvoice size={18} />}
              onClick={() => navigate('/factures')}
            >
              Factures Standard
            </Button>
            <Button
              variant="light"
              color="grape"
              leftSection={<IconReceipt size={18} />}
              onClick={() => navigate('/factures-revendeur')}
            >
              Factures Revendeurs
            </Button>
          </Group>
        </Card>

        {/* TABLEAU */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          <Paper bg="gray.0" p="md" style={{ borderBottom: '1px solid #e5e7eb' }}>
            <Flex justify="space-between" align="center">
              <Group>
                <IconFileInvoice size={20} color="#1b365d" />
                <Title order={3} size="h4">Liste des factures</Title>
                <Badge size="lg" variant="light" color="blue">{filteredFactures.length} factures</Badge>
              </Group>
            </Flex>
          </Paper>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1b365d 0%, #295080 100%)' }}>
                  <Table.Th c="white" style={{ width: 50, textAlign: 'center', fontSize: '12px' }}>N°</Table.Th>
                  <Table.Th c="white" style={{ width: 180, fontSize: '12px' }}>Client</Table.Th>
                  <Table.Th c="white" style={{ width: 100, fontSize: '12px' }}>Date</Table.Th>
                  <Table.Th c="white" style={{ width: 90, fontSize: '12px' }}>Type</Table.Th>
                  <Table.Th c="white" style={{ width: 120, textAlign: 'right', fontSize: '12px' }}>Montant TTC</Table.Th>
                  <Table.Th c="white" style={{ width: 130, fontSize: '12px' }}>Code Facture</Table.Th>
                  <Table.Th c="white" style={{ width: 280, textAlign: 'center', fontSize: '12px' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFactures.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} align="center">
                      <Stack align="center" py={50}>
                        <IconFileInvoice size={50} color="#ccc" />
                        <Text c="dimmed">Aucune facture trouvée</Text>
                        <Button 
                          variant="light" 
                          color="blue" 
                          leftSection={<IconPlus size={16} />} 
                          onClick={() => navigate('/commandes/nouveau')}
                        >
                          Créer une commande
                        </Button>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paginatedFactures.map((facture, index) => {
                    const num = (currentPage - 1) * itemsPerPage + index + 1;
                    const isRevendeur = isRevendeurFacture(facture);
                    const uniqueKey = getUniqueKey(facture);
                    
                    return (
                      <Table.Tr key={uniqueKey}>
                        <Table.Td ta="center" fw={600}>{num}</Table.Td>
                        <Table.Td fw={500}>{facture.NomComplet || facture.client_nom || '-'}</Table.Td>
                        <Table.Td>{facture.date_facture ? new Date(facture.date_facture).toLocaleDateString('fr-FR') : '-'}</Table.Td>
                        <Table.Td>
                          <Badge 
                            size="sm" 
                            color={isRevendeur ? 'green' : 'blue'} 
                            variant="light"
                            leftSection={isRevendeur ? <IconTruck size={12} /> : <IconBuildingStore size={12} />}
                          >
                            {isRevendeur ? 'Revendeur' : 'Standard'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={700} c="green">
                            {formatMontant(facture.montant_ttc || 0)} FCFA
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm" c={facture.code_facture ? 'blue' : 'dimmed'}>
                            {facture.code_facture || 'FAC-XXXX'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Group gap={4} justify="center" wrap="nowrap">
                            <Tooltip label="Voir la facture">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                size="md"
                                onClick={() => handleViewFacture(facture)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Régler">
                              <ActionIcon
                                variant="light"
                                color="green"
                                size="md"
                                onClick={() => handleRegler(facture)}
                              >
                                <IconCash size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Générer reçu">
                              <ActionIcon
                                variant="light"
                                color="grape"
                                size="md"
                                onClick={() => handleGenererRecu(facture)}
                              >
                                <IconReceipt size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Imprimer">
                              <ActionIcon
                                variant="light"
                                color="teal"
                                size="md"
                                onClick={() => {
                                  setSelectedFacture(facture);
                                  setFactureModalOpened(true);
                                  setTimeout(() => handlePrint(), 500);
                                }}
                              >
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Télécharger">
                              <ActionIcon
                                variant="light"
                                color="gray"
                                size="md"
                                onClick={() => handleDownload(facture)}
                              >
                                <IconDownload size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Box>

          {filteredFactures.length === 0 && (
            <Flex justify="center" align="center" direction="column" py={60}>
              <IconFileInvoice size={60} color="#ccc" />
              <Text ta="center" c="dimmed" mt="md">Aucune facture trouvée</Text>
              <Button mt="md" variant="light" onClick={refresh} leftSection={<IconRefresh size={16} />}>Actualiser</Button>
            </Flex>
          )}

          {totalPages > 1 && (
            <Group justify="center" p="md">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="md" />
            </Group>
          )}
        </Card>
      </Stack>

      {/* MODAL FACTURE */}
      <Modal 
        opened={factureModalOpened} 
        onClose={() => setFactureModalOpened(false)} 
        title={`Facture ${selectedFacture?.code_facture || ''}`} 
        size="xl" 
        fullScreen
        styles={{
          header: { backgroundColor: '#1b365d', padding: '16px 20px' },
          title: { color: 'white', fontWeight: 600 }
        }}
      >
        {selectedFacture && (
          <>
            <Group justify="flex-end" mb="md" className="no-print">
              <Button variant="outline" onClick={() => setFactureModalOpened(false)} leftSection={<IconX size={16} />}>Fermer</Button>
              <Button variant="filled" color="blue" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Imprimer</Button>
            </Group>
            <Divider mb="md" />
            {loadingDetails ? (
              <Flex justify="center" py={60}><Loader size="xl" /></Flex>
            ) : isRevendeurFacture(selectedFacture) ? (
              <FactureRevendeur facture={selectedFacture} />
            ) : (
              <FactureStandard facture={selectedFacture} />
            )}
          </>
        )}
      </Modal>

      {/* MODAL RÈGLEMENT */}
      <FormulaireReglement
        opened={reglementModalOpened}
        onClose={() => {
          setReglementModalOpened(false);
          refresh();
        }}
        idFacture={reglementData.idFacture}
        idClient={reglementData.idClient}
        montantMax={reglementData.montantMax}
      />
    </>
  );
};

export default ListeFactures;