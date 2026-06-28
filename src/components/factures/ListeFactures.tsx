// src/components/factures/ListeFactures.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Group, Badge, Stack, Title, Card, Text,
  Pagination, Select, Grid, Box, Loader, Paper, Flex, ThemeIcon, SimpleGrid,
  TextInput, Modal, Divider, ActionIcon, Tooltip, Alert, List, Code
} from '@mantine/core';
import {
  IconPrinter, IconSearch, IconRefresh, IconX,
  IconFileInvoice, IconCalendar, IconBuildingStore,
  IconTruck, IconCurrencyFrank, IconReceipt, IconArrowBackUp,
  IconShoppingBag, IconPlus, IconEye, IconDownload,
  IconCash, IconTrash, IconAlertCircle, IconInfoCircle
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
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [factureToDelete, setFactureToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactDetails, setDeleteImpactDetails] = useState<{
    hasReglements: boolean;
    hasDetails: boolean;
    nbReglements: number;
    montantTotal: number;
    isRevendeur: boolean;
  } | null>(null);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refresh]);

  useEffect(() => {
    if (factures) {
      setLocalFactures(factures);
    }
  }, [factures]);

  const chargerFacturesDirectement = useCallback(async () => {
    try {
      const db = await getDb();

      const tablesExistantes = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name IN ('factures', 'factures_revendeur')
      `);
      const noms = tablesExistantes.map((t: any) => t.name);

      let facturesStandard: any[] = [];
      let facturesRevendeur: any[] = [];

      if (noms.includes('factures')) {
        facturesStandard = await db.select<any[]>(`
          SELECT 
            f.*,
            cl.NomComplet,
            cl.Societe,
            cl.Tel,
            'standard' as type
          FROM factures f
          LEFT JOIN clients cl ON cl.idClient = f.idClient
          ORDER BY f.date_facture DESC
        `);
      }

      if (noms.includes('factures_revendeur')) {
        facturesRevendeur = await db.select<any[]>(`
          SELECT 
            fr.*,
            cl.NomComplet,
            cl.Societe,
            cl.Tel,
            'revendeur' as type
          FROM factures_revendeur fr
          LEFT JOIN clients cl ON cl.idClient = fr.idRevendeur
          ORDER BY fr.date_facture DESC
        `);
      }

      const toutes = [...facturesStandard, ...facturesRevendeur].sort((a, b) => {
        const da = new Date(a.date_facture || 0).getTime();
        const db2 = new Date(b.date_facture || 0).getTime();
        return db2 - da;
      });

      setLocalFactures(toutes);
    } catch (error) {
      console.error('Erreur chargement direct factures:', error);
    }
  }, []);

  useEffect(() => {
    chargerFacturesDirectement();
  }, [chargerFacturesDirectement]);

  const handleRefresh = useCallback(async () => {
    refresh();
    await chargerFacturesDirectement();
  }, [refresh, chargerFacturesDirectement]);

  // ✅ Analyser l'impact de la suppression
  const analyzeDeleteImpact = async (facture: any) => {
    try {
      const db = await getDb();
      const isRevendeur = isRevendeurFacture(facture);
      const idFacture = isRevendeur ? facture.idFactureRevendeur : facture.idFacture;

      let reglements: any[] = [];
      let details: any[] = [];

      if (isRevendeur) {
        reglements = await db.select<any[]>(`
          SELECT idReglement, montant, date_reglement 
          FROM reglements_revendeur 
          WHERE idFactureRevendeur = ?
        `, [idFacture]);

        details = await db.select<any[]>(`
          SELECT * FROM factures_revendeur_details 
          WHERE idFactureRevendeur = ?
        `, [idFacture]);
      } else {
        reglements = await db.select<any[]>(`
          SELECT idReglement, montant, date_reglement 
          FROM reglements 
          WHERE idFacture = ?
        `, [idFacture]);

        details = await db.select<any[]>(`
          SELECT * FROM facture_details 
          WHERE idFacture = ?
        `, [idFacture]);
      }

      setDeleteImpactDetails({
        hasReglements: reglements.length > 0,
        hasDetails: details.length > 0,
        nbReglements: reglements.length,
        montantTotal: facture.montant_ttc || 0,
        isRevendeur: isRevendeur
      });

      setFactureToDelete(facture);
      setDeleteModalOpened(true);

    } catch (error) {
      console.error('Erreur analyse impact:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Impossible d\'analyser l\'impact de la suppression',
        color: 'red'
      });
    }
  };

// ✅ Supprimer une facture - Version sans transaction imbriquée
const handleDeleteFacture = async () => {
  if (!factureToDelete) return;

  setDeleting(true);

  try {
    const db = await getDb();
    const isRevendeur = isRevendeurFacture(factureToDelete);
    const idFacture = isRevendeur ? factureToDelete.idFactureRevendeur : factureToDelete.idFacture;

    // Désactiver les contraintes DIRECTEMENT (sans transaction)
    await db.execute('PRAGMA foreign_keys = OFF');

    try {
      if (isRevendeur) {
        // Supprimer les règlements revendeur
        await db.execute(`
          DELETE FROM reglements_revendeur WHERE idFactureRevendeur = ?
        `, [idFacture]);

        // Supprimer les détails revendeur
        await db.execute(`
          DELETE FROM factures_revendeur_details WHERE idFactureRevendeur = ?
        `, [idFacture]);

        // Supprimer la facture revendeur
        await db.execute(`
          DELETE FROM factures_revendeur WHERE idFactureRevendeur = ?
        `, [idFacture]);
      } else {
        // Supprimer les règlements standard
        await db.execute(`
          DELETE FROM reglements WHERE idFacture = ?
        `, [idFacture]);

        // Supprimer les détails standard
        await db.execute(`
          DELETE FROM facture_details WHERE idFacture = ?
        `, [idFacture]);

        // Supprimer la facture standard
        await db.execute(`
          DELETE FROM factures WHERE idFacture = ?
        `, [idFacture]);
      }

      // Réactiver les contraintes
      await db.execute('PRAGMA foreign_keys = ON');

      notifications.show({
        title: '✅ Succès',
        message: `Facture ${factureToDelete.code_facture} supprimée avec succès.`,
        color: 'green',
        autoClose: 5000
      });

      setDeleteModalOpened(false);
      setFactureToDelete(null);
      setDeleteImpactDetails(null);
      await handleRefresh();

    } catch (error) {
      // Réactiver les contraintes en cas d'erreur
      await db.execute('PRAGMA foreign_keys = ON');
      throw error;
    }

  } catch (error: any) {
    console.error('Erreur suppression:', error);
    
    let errorMessage = 'Impossible de supprimer la facture.';
    if (error?.message?.includes('database is locked')) {
      errorMessage = '⚠️ La base de données est verrouillée. Veuillez réessayer dans quelques instants.';
    } else if (error?.message?.includes('FOREIGN KEY')) {
      errorMessage = '❌ Cette facture a des dépendances qui empêchent sa suppression.';
    }

    notifications.show({
      title: '❌ Erreur',
      message: errorMessage,
      color: 'red',
      autoClose: 5000
    });

    try {
      const db = await getDb();
      await db.execute('PRAGMA foreign_keys = ON');
    } catch (e) {}
  } finally {
    setDeleting(false);
  }
};

  const formatMontant = (value: any): string => {
    if (value === undefined || value === null) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    return num.toLocaleString('fr-FR');
  };

  const getTypeFactureLabel = (facture: any): string => {
    if (
      facture.type === 'revendeur' ||
      facture.idFactureRevendeur !== undefined ||
      facture.type_commande === 'REVENDEUR'
    ) {
      return 'Revendeur';
    }
    return 'Standard';
  };

  const isRevendeurFacture = (facture: any): boolean => {
    return (
      facture.type === 'revendeur' ||
      facture.idFactureRevendeur !== undefined ||
      facture.type_commande === 'REVENDEUR'
    );
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

      if (type === 'revendeur') {
        // Naviguer vers NouveauDecompte avec le revendeur pré-sélectionné
        navigate('/decomptes/nouveau', {
          state: { clientId: facture.idRevendeur || facture.idClient }
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
      const clientNom = facture.NomComplet || facture.client_nom || 'Client';

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

      const totalRegle = reglements.reduce((sum: number, r: any) => sum + (r.montant || 0), 0);
      const montantTotal = facture.montant_ttc || 0;
      const resteAPayer = montantTotal - totalRegle;

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reçu de règlement - ${codeFacture}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .title { color: #1b365d; font-size: 24px; margin: 0; }
    .info { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #1b365d; color: white; }
    .total { font-weight: bold; font-size: 16px; text-align: right; margin-top: 20px; }
    .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #666; }
    @media print { .no-print { display: none; } }
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
      ${reglements.map((r: any) => `
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
    <p><strong>Montant total : ${formatMontant(montantTotal)} FCFA</strong></p>
  </div>
  <div class="footer"><p>Merci de votre confiance</p></div>
  <div class="no-print" style="text-align:center;margin-top:30px">
    <button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer">Imprimer</button>
  </div>
</body>
</html>`;
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

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
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const codeFacture = (completeFacture as any).code_facture || 'facture';
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
      .filter((date): date is string => date !== null);

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
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderBottom: '3px solid #e94560',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Group gap="md">
                <ThemeIcon size={45} radius="md" color="grape" variant="filled">
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
                onClick={handleRefresh}
              >
                Actualiser
              </Button>
            </Group>
          </Flex>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="white" variant="light" size="lg"><IconFileInvoice size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Total factures</Text><Text c="white" fw={700} size="xl">{stats.total}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="blue" variant="light" size="lg"><IconBuildingStore size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Factures standard</Text><Text c="white" fw={700} size="xl">{stats.standards}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg"><IconTruck size={20} /></ThemeIcon>
                <div><Text c="white" size="xs">Factures revendeurs</Text><Text c="white" fw={700} size="xl">{stats.revendeurs}</Text></div>
              </Group>
            </Card>
            <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
              <Group>
                <ThemeIcon color="yellow" variant="light" size="lg"><IconCurrencyFrank size={20} /></ThemeIcon>
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
          <Paper bg="rgba(255,255,255,0.08)" p="md" radius="md">
            <Flex justify="space-between" align="center">
              <Group>
                <IconFileInvoice size={20} color="#1b365d" />
                <Title order={3} size="h4">Liste des factures</Title>
                <Badge size="lg" variant="light" color="blue">{filteredFactures.length} factures</Badge>
              </Group>
            </Flex>
          </Paper>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="sm" style={{ minWidth: 950, tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                  <Table.Th c="white" style={{ width: 50, textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>N°</Table.Th>
                  <Table.Th c="white" style={{ width: 170, fontSize: '12px', whiteSpace: 'nowrap' }}>Client</Table.Th>
                  <Table.Th c="white" style={{ width: 100, fontSize: '12px', whiteSpace: 'nowrap' }}>Date</Table.Th>
                  <Table.Th c="white" style={{ width: 100, fontSize: '12px', whiteSpace: 'nowrap' }}>Type</Table.Th>
                  <Table.Th c="white" style={{ width: 130, textAlign: 'right', fontSize: '12px', whiteSpace: 'nowrap' }}>Montant TTC</Table.Th>
                  <Table.Th c="white" style={{ width: 210, fontSize: '12px', whiteSpace: 'nowrap' }}>Code Facture</Table.Th>
                  <Table.Th c="white" style={{ width: 280, textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>Actions</Table.Th>
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
                        <Table.Td ta="center" fw={600} style={{ whiteSpace: 'nowrap' }}>{num}</Table.Td>
                        <Table.Td fw={500} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                          <Text truncate size="sm">{facture.NomComplet || facture.client_nom || '-'}</Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {facture.date_facture
                            ? new Date(facture.date_facture).toLocaleDateString('fr-FR')
                            : '-'}
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          <Badge
                            size="sm"
                            color={isRevendeur ? 'green' : 'blue'}
                            variant="light"
                            leftSection={isRevendeur ? <IconTruck size={12} /> : <IconBuildingStore size={12} />}
                          >
                            {isRevendeur ? 'Revendeur' : 'Standard'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text fw={700} c="green">
                            {formatMontant(facture.montant_ttc || 0)} FCFA
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>
                          <Text fw={600} size="sm" c={facture.code_facture ? 'blue' : 'dimmed'} truncate>
                            {facture.code_facture || 'FAC-XXXX'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center" style={{ whiteSpace: 'nowrap' }}>
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
                            {/* ✅ BOUTON SUPPRIMER */}
                            <Tooltip label="Supprimer">
                              <ActionIcon
                                variant="light"
                                color="red"
                                size="md"
                                onClick={() => analyzeDeleteImpact(facture)}
                              >
                                <IconTrash size={16} />
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
              <Button mt="md" variant="light" onClick={handleRefresh} leftSection={<IconRefresh size={16} />}>
                Actualiser
              </Button>
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
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px' },
          title: { color: 'white', fontWeight: 600 }
        }}
      >
        {selectedFacture && (
          <>
            <Group justify="flex-end" mb="md" className="no-print">
              <Button variant="outline" onClick={() => setFactureModalOpened(false)} leftSection={<IconX size={16} />}>
                Fermer
              </Button>
              <Button variant="filled" color="blue" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>
                Imprimer
              </Button>
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
          handleRefresh();
        }}
        idFacture={reglementData.idFacture}
        idClient={reglementData.idClient}
        montantMax={reglementData.montantMax}
      />

      {/* MODAL DE CONFIRMATION DE SUPPRESSION */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setFactureToDelete(null);
          setDeleteImpactDetails(null);
        }}
        title="⚠️ Suppression de facture"
        centered
        size="lg"
        styles={{
          header: {
            backgroundColor: '#1a1a2e',
            padding: '16px 20px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert
            icon={<IconAlertCircle size={24} />}
            color="red"
            title="⚠️ Attention - Action irréversible !"
            variant="filled"
          >
            <Text size="sm" c="white">
              Vous êtes sur le point de supprimer définitivement cette facture.
            </Text>
          </Alert>

          {factureToDelete && (
            <Paper p="md" withBorder style={{ backgroundColor: '#fff8e1' }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Facture</Text>
                  <Code>{factureToDelete.code_facture || 'N/A'}</Code>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Client</Text>
                  <Text>{factureToDelete.NomComplet || factureToDelete.client_nom || 'Inconnu'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Type</Text>
                  <Badge color={isRevendeurFacture(factureToDelete) ? 'green' : 'blue'}>
                    {isRevendeurFacture(factureToDelete) ? 'Revendeur' : 'Standard'}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Montant</Text>
                  <Text fw={700} c="red">{formatMontant(factureToDelete.montant_ttc)} FCFA</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Date</Text>
                  <Text>{factureToDelete.date_facture
                    ? new Date(factureToDelete.date_facture).toLocaleDateString('fr-FR')
                    : '-'}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          )}

          {deleteImpactDetails && (
            <>
              <Divider label="📊 Impact de la suppression" labelPosition="center" />

              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                <Paper p="sm" withBorder bg={deleteImpactDetails.hasReglements ? 'red.0' : 'green.0'}>
                  <Text size="xs" c="dimmed">Règlements</Text>
                  <Text fw={700} size="lg" c={deleteImpactDetails.hasReglements ? 'red' : 'green'}>
                    {deleteImpactDetails.hasReglements
                      ? `${deleteImpactDetails.nbReglements} règlement(s)`
                      : '✅ Aucun'}
                  </Text>
                </Paper>
                <Paper p="sm" withBorder bg={deleteImpactDetails.hasDetails ? 'orange.0' : 'green.0'}>
                  <Text size="xs" c="dimmed">Détails</Text>
                  <Text fw={700} size="lg" c={deleteImpactDetails.hasDetails ? 'orange' : 'green'}>
                    {deleteImpactDetails.hasDetails ? '⚠️ Oui' : '✅ Aucun'}
                  </Text>
                </Paper>
                <Paper p="sm" withBorder bg="blue.0">
                  <Text size="xs" c="dimmed">Montant</Text>
                  <Text fw={700} size="lg" c="blue">{formatMontant(deleteImpactDetails.montantTotal)} F</Text>
                </Paper>
              </SimpleGrid>

              {deleteImpactDetails.hasReglements && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  <Text size="sm" fw={600}>❌ Suppression impossible</Text>
                  <Text size="sm" c="dimmed">
                    Des règlements ont déjà été effectués sur cette facture.
                    Vous ne pouvez pas supprimer une facture qui a fait l'objet de règlements.
                  </Text>
                </Alert>
              )}

              {!deleteImpactDetails.hasReglements && (
                <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />}>
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>Ce que la suppression va faire :</Text>
                    <List size="xs" spacing={4}>
                      <List.Item>✅ Supprimer les détails de la facture</List.Item>
                      <List.Item>✅ Supprimer la facture</List.Item>
                      {deleteImpactDetails.isRevendeur && (
                        <List.Item>✅ Supprimer les règlements associés (si existants)</List.Item>
                      )}
                    </List>
                  </Stack>
                </Alert>
              )}
            </>
          )}

          <Divider />

          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpened(false);
                setFactureToDelete(null);
                setDeleteImpactDetails(null);
              }}
              disabled={deleting}
              leftSection={<IconX size={16} />}
            >
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleDeleteFacture}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeFactures;
