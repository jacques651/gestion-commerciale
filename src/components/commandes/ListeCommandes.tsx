// src/components/commandes/ListeCommandes.tsx
import React, { useState, useEffect } from 'react';
import {
  Stack, Card, Title, Text, Group, Button, Table, ActionIcon,
  Pagination, Tooltip, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, Grid, ScrollArea, Alert, Avatar,
  Modal, Divider, List, Code,
  Box
} from '@mantine/core';
import {
  IconShoppingCart, IconSearch, IconRefresh, IconPlus,
  IconEye, IconPrinter, IconEdit, IconTrash,
  IconCash,
  IconAlertCircle, IconFileInvoice,
  IconCheck, IconX, IconClock,
  IconInfoCircle, IconListDetails, IconReceipt
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../database/db';
import { factureRepository } from '../../database/repositories/factureRepository';
import { factureRevendeurRepository } from '../../database/repositories/factureRevendeurRepository';
import { PageHeader } from '../common/PageHeader';

interface Commande {
  idCommande: number;
  code_commande: string;
  idClient: number;
  type_commande: 'STANDARD' | 'REVENDEUR';
  date_commande: string;
  montant_ht: number;
  montant_ttc: number;
  montant_net: number;
  statut: 'BROUILLON' | 'CONFIRMEE' | 'LIVREE' | 'ANNULEE';
  source: string;
  NomComplet: string;
  Societe: string;
  Tel: string;
  code_facture?: string;
  idFacture?: number;
  details?: any[];
}

interface Statistiques {
  total: number;
  totalStandard: number;
  totalRevendeur: number;
  totalConfirmée: number;
  totalLivree: number;
  totalAnnulee: number;
  montantTotal: number;
}

const typeLabels: Record<string, string> = {
  'STANDARD': 'Standard',
  'REVENDEUR': 'Revendeur'
};

const statutColors: Record<string, string> = {
  'BROUILLON': 'gray',
  'CONFIRMEE': 'blue',
  'LIVREE': 'green',
  'ANNULEE': 'red'
};

const statutLabels: Record<string, string> = {
  'BROUILLON': 'Brouillon',
  'CONFIRMEE': 'Confirmée',
  'LIVREE': 'Livrée',
  'ANNULEE': 'Annulée'
};

export const ListeCommandes: React.FC = () => {
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [filteredCommandes, setFilteredCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [commandeToDelete, setCommandeToDelete] = useState<Commande | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteImpactDetails, setDeleteImpactDetails] = useState<{
    nbProduits: number;
    nbMouvements: number;
    montantTotal: number;
    hasFacture: boolean;
    hasPaiement: boolean;
    hasDecompte: boolean;
    hasStockRevendeur: boolean;
    details: any[];
    factures: any[];
    reglements: any[];
    decomptes: any[];
  } | null>(null);
  const [statistiques, setStatistiques] = useState<Statistiques>({
    total: 0,
    totalStandard: 0,
    totalRevendeur: 0,
    totalConfirmée: 0,
    totalLivree: 0,
    totalAnnulee: 0,
    montantTotal: 0
  });

  const itemsPerPage = 10;

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const formatDateHeure = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return '-';
    }
  };

  const chargerCommandes = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();

      const tableExists = await db.select<any[]>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='commandes'
      `);

      if (tableExists.length === 0) {
        setCommandes([]);
        setFilteredCommandes([]);
        setLoading(false);
        return;
      }

      const result = await db.select<any[]>(`
        SELECT 
          c.*,
          cl.NomComplet,
          cl.Societe,
          cl.Tel,
          f.idFacture,
          f.code_facture,
          fr.idFactureRevendeur,
          fr.code_facture as code_facture_revendeur
        FROM commandes c
        LEFT JOIN clients cl ON cl.idClient = c.idClient
        LEFT JOIN factures f ON f.idCommande = c.idCommande
        LEFT JOIN factures_revendeur fr ON fr.idCommande = c.idCommande
        ORDER BY c.date_commande DESC
      `);

      const commandesData = result.map((row: any) => ({
        ...row,
        NomComplet: row.NomComplet || 'Client inconnu',
        Societe: row.Societe || '',
        Tel: row.Tel || '',
        idFacture: row.idFacture || row.idFactureRevendeur || null,
        code_facture: row.code_facture || row.code_facture_revendeur || null
      }));

      setCommandes(commandesData);
      setFilteredCommandes(commandesData);

      const stats: Statistiques = {
        total: commandesData.length,
        totalStandard: commandesData.filter((c: Commande) => c.type_commande === 'STANDARD').length,
        totalRevendeur: commandesData.filter((c: Commande) => c.type_commande === 'REVENDEUR').length,
        totalConfirmée: commandesData.filter((c: Commande) => c.statut === 'CONFIRMEE').length,
        totalLivree: commandesData.filter((c: Commande) => c.statut === 'LIVREE').length,
        totalAnnulee: commandesData.filter((c: Commande) => c.statut === 'ANNULEE').length,
        montantTotal: commandesData.reduce((sum: number, c: Commande) => sum + (c.montant_ttc || 0), 0)
      };
      setStatistiques(stats);

    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      setError('Impossible de charger les commandes');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les commandes',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerCommandes();
  }, []);

  useEffect(() => {
    let filtered = [...commandes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code_commande?.toLowerCase().includes(term) ||
        c.NomComplet?.toLowerCase().includes(term) ||
        c.Societe?.toLowerCase().includes(term) ||
        c.code_facture?.toLowerCase().includes(term)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(c => c.type_commande === typeFilter);
    }

    if (statutFilter) {
      filtered = filtered.filter(c => c.statut === statutFilter);
    }

    if (dateDebut) {
      filtered = filtered.filter(c => c.date_commande >= dateDebut);
    }

    if (dateFin) {
      filtered = filtered.filter(c => c.date_commande <= dateFin + ' 23:59:59');
    }

    setFilteredCommandes(filtered);
    setCurrentPage(1);
  }, [commandes, searchTerm, typeFilter, statutFilter, dateDebut, dateFin]);

  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge color={type === 'STANDARD' ? 'blue' : 'green'} variant="light" size="sm">
        {typeLabels[type] || type}
      </Badge>
    );
  };

  const getStatutBadge = (statut: string) => {
    return (
      <Badge color={statutColors[statut] || 'gray'} variant="light" size="sm">
        {statutLabels[statut] || statut}
      </Badge>
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter(null);
    setStatutFilter(null);
    setDateDebut('');
    setDateFin('');
    setCurrentPage(1);
  };

  const handleVoirFacture = (commande: Commande) => {
    if (commande.idFacture) {
      if (commande.type_commande === 'REVENDEUR') {
        navigate(`/factures-revendeur/${commande.idFacture}`);
      } else {
        navigate(`/factures/${commande.idFacture}`);
      }
    } else {
      notifications.show({
        title: 'Information',
        message: 'Aucune facture n\'a été générée pour cette commande',
        color: 'blue'
      });
    }
  };

  const handleGenererFacture = async (commande: Commande) => {
    if (!commande.idCommande) {
      notifications.show({
        title: 'Erreur',
        message: 'Commande invalide',
        color: 'red'
      });
      return;
    }

    try {
      const db = await getDb();

      if (commande.type_commande === 'REVENDEUR') {
        const existing = await db.select<any[]>(`
          SELECT idFactureRevendeur, code_facture 
          FROM factures_revendeur 
          WHERE idCommande = ?
        `, [commande.idCommande]);

        if (existing.length > 0) {
          notifications.show({
            title: 'ℹ️ Information',
            message: `Facture revendeur ${existing[0].code_facture} existe déjà.`,
            color: 'blue'
          });
          navigate(`/factures-revendeur/${existing[0].idFactureRevendeur}`);
          return;
        }

        const idFacture = await factureRevendeurRepository.createFromCommande(commande.idCommande);
        const facture = await db.select<any[]>(`
          SELECT code_facture FROM factures_revendeur WHERE idFactureRevendeur = ?
        `, [idFacture]);

        notifications.show({
          title: '✅ Succès',
          message: `Facture revendeur ${facture[0]?.code_facture || idFacture} générée !`,
          color: 'green'
        });
        await chargerCommandes();
        navigate(`/factures-revendeur/${idFacture}`);
        return;
      }

      // Commande standard
      const existing = await db.select<any[]>(`
        SELECT idFacture, code_facture FROM factures WHERE idCommande = ?
      `, [commande.idCommande]);

      if (existing.length > 0) {
        notifications.show({
          title: 'ℹ️ Information',
          message: `Facture ${existing[0].code_facture} existe déjà.`,
          color: 'blue'
        });
        navigate(`/factures/${existing[0].idFacture}`);
        return;
      }

      const idFacture = await factureRepository.createFromCommande(commande.idCommande);
      const facture = await db.select<any[]>(`
        SELECT code_facture FROM factures WHERE idFacture = ?
      `, [idFacture]);

      notifications.show({
        title: '✅ Succès',
        message: `Facture ${facture[0]?.code_facture || idFacture} générée !`,
        color: 'green'
      });
      await chargerCommandes();
      navigate(`/factures/${idFacture}`);

    } catch (error: any) {
      console.error('Erreur génération facture:', error);
      notifications.show({
        title: '❌ Erreur',
        message: error?.message || 'Impossible de générer la facture',
        color: 'red'
      });
    }
  };

  // ✅ Analyser l'impact de la suppression — version corrigée
  const analyzeDeleteImpact = async (commande: Commande) => {
    try {
      const db = await getDb();

      // Détails de la commande
      const details = await db.select<any[]>(`
        SELECT cd.*, p.designation, p.code_produit
        FROM commande_details cd
        JOIN products p ON p.idProduit = cd.idProduit
        WHERE cd.idCommande = ?
      `, [commande.idCommande]);

      // ✅ Utiliser UNION ALL et un champ id unifié
      const factures = await db.select<any[]>(`
        SELECT idFacture as id, code_facture, 'standard' as type 
        FROM factures WHERE idCommande = ?
        UNION ALL
        SELECT idFactureRevendeur as id, code_facture, 'revendeur' as type 
        FROM factures_revendeur WHERE idCommande = ?
      `, [commande.idCommande, commande.idCommande]);

      // Règlements directs sur ces factures
      let reglements: any[] = [];
      let hasPaiement = false;

      for (const facture of factures) {
        let regs: any[] = [];
        if (facture.type === 'standard') {
          regs = await db.select<any[]>(`
            SELECT idReglement, montant, date_reglement, mode_reglement 
            FROM reglements WHERE idFacture = ?
          `, [facture.id]);
        } else {
          regs = await db.select<any[]>(`
            SELECT idReglement, montant, date_reglement, mode_reglement 
            FROM reglements_revendeur WHERE idFactureRevendeur = ?
          `, [facture.id]);
        }
        if (regs.length > 0) {
          hasPaiement = true;
          reglements = [...reglements, ...regs];
        }
      }

      // ✅ Décomptes — méthode directe (idCommande) ou indirecte (produits)
      let decomptes: any[] = [];
      let hasDecompte = false;
      let hasDecompteSolde = false;

      if (commande.type_commande === 'REVENDEUR') {
        // Vérifier si la colonne idCommande existe dans decomptes
        const hasIdCommandeCol = await db.select<any[]>(`
          SELECT COUNT(*) as cnt FROM pragma_table_info('decomptes') 
          WHERE name = 'idCommande'
        `);

        if (hasIdCommandeCol[0]?.cnt > 0) {
          // Méthode directe
          decomptes = await db.select<any[]>(`
            SELECT idDecompte, code_decompte, montant_net, statut, date_decompte
            FROM decomptes WHERE idCommande = ?
          `, [commande.idCommande]);
        } else if (details.length > 0) {
          // Méthode indirecte via les produits
          const productIds = details.map(d => d.idProduit);
          const placeholders = productIds.map(() => '?').join(',');
          decomptes = await db.select<any[]>(`
            SELECT DISTINCT d.idDecompte, d.code_decompte, d.montant_net, d.statut, d.date_decompte
            FROM decomptes d
            JOIN decompte_details dd ON dd.idDecompte = d.idDecompte
            WHERE dd.idProduit IN (${placeholders}) AND d.idClient = ?
          `, [...productIds, commande.idClient]);
        }

        if (decomptes.length > 0) {
          hasDecompte = true;

          // ✅ Bloquer si un décompte est soldé ou a des règlements
          for (const dec of decomptes) {
            if (dec.statut === 'SOLDE' || dec.statut === 'PAYE') {
              hasDecompteSolde = true;
              break;
            }
            try {
              const regsDecompte = await db.select<any[]>(`
                SELECT COUNT(*) as cnt FROM reglements_decomptes WHERE idDecompte = ?
              `, [dec.idDecompte]);
              if (regsDecompte[0]?.cnt > 0) {
                hasDecompteSolde = true;
                break;
              }
            } catch {
              // Table reglements_decomptes absente, on ignore
            }
          }
        }
      }

      // Mouvements de stock principal
      const mouvements = await db.select<any[]>(`
        SELECT COUNT(*) as count FROM mouvements_stock WHERE reference = ?
      `, [commande.code_commande]);

      let nbMouvementsRevendeur = 0;
      if (commande.type_commande === 'REVENDEUR') {
        try {
          const res = await db.select<any[]>(`
            SELECT COUNT(*) as count FROM mouvements_revendeur WHERE idCommande = ?
          `, [commande.idCommande]);
          nbMouvementsRevendeur = res[0]?.count || 0;
        } catch { /* table absente */ }
      }

      let stockRevendeurCount = 0;
      if (commande.type_commande === 'REVENDEUR') {
        try {
          const res = await db.select<any[]>(`
            SELECT COUNT(*) as count FROM stock_revendeur WHERE idRevendeur = ?
          `, [commande.idClient]);
          stockRevendeurCount = res[0]?.count || 0;
        } catch { /* table absente */ }
      }

      setDeleteImpactDetails({
        nbProduits: details.length,
        nbMouvements: (mouvements[0]?.count || 0) + nbMouvementsRevendeur,
        montantTotal: commande.montant_ttc || 0,
        hasFacture: factures.length > 0,
        // ✅ hasPaiement est vrai si règlement direct OU décompte soldé
        hasPaiement: hasPaiement || hasDecompteSolde,
        hasDecompte,
        hasStockRevendeur: stockRevendeurCount > 0,
        details,
        factures,
        reglements,
        decomptes
      });

      setCommandeToDelete(commande);
      setDeleteModalOpened(true);

    } catch (error) {
      console.error('Erreur analyse impact:', error);
      notifications.show({
        title: 'Erreur',
        message: "Impossible d'analyser l'impact de la suppression",
        color: 'red'
      });
    }
  };

  // ✅ Suppression en cascade — version corrigée
  const handleDelete = async () => {
    if (!commandeToDelete) return;
    setDeleting(true);

    try {
      const db = await getDb();

      if (deleteImpactDetails?.hasPaiement) {
        notifications.show({
          title: '❌ Suppression impossible',
          message: 'Des paiements ou des décomptes soldés existent pour cette commande.',
          color: 'red'
        });
        setDeleteModalOpened(false);
        setCommandeToDelete(null);
        setDeleteImpactDetails(null);
        setDeleting(false);
        return;
      }

      // 1. Lire les détails AVANT toute suppression (pour restaurer stocks)
      const details = await db.select<any[]>(
        'SELECT idProduit, qte_commande FROM commande_details WHERE idCommande = ?',
        [commandeToDelete.idCommande]
      );

      // 2. Règlements + détails + factures
      for (const facture of deleteImpactDetails?.factures || []) {
        if (facture.type === 'standard') {
          await db.execute('DELETE FROM reglements WHERE idFacture = ?', [facture.id]);
          for (const tbl of ['facture_details', 'factures_details', 'commande_facture_details']) {
            try { await db.execute(`DELETE FROM ${tbl} WHERE idFacture = ?`, [facture.id]); } catch { }
          }
          await db.execute('DELETE FROM factures WHERE idFacture = ?', [facture.id]);
        } else {
          await db.execute('DELETE FROM reglements_revendeur WHERE idFactureRevendeur = ?', [facture.id]);
          for (const tbl of ['factures_revendeur_details', 'facture_revendeur_details']) {
            try { await db.execute(`DELETE FROM ${tbl} WHERE idFactureRevendeur = ?`, [facture.id]); } catch { }
          }
          await db.execute('DELETE FROM factures_revendeur WHERE idFactureRevendeur = ?', [facture.id]);
        }
      }

      // 3. Décomptes liés (règlements → mouvements → factures_appro → détails → décompte)
      for (const dec of deleteImpactDetails?.decomptes || []) {
        try { await db.execute('DELETE FROM reglements_decomptes WHERE idDecompte = ?', [dec.idDecompte]); } catch { }
        try { await db.execute('DELETE FROM mouvements_revendeur WHERE idDecompte = ?', [dec.idDecompte]); } catch { }
        try { await db.execute('DELETE FROM factures_approvisionnement WHERE idDecompte = ?', [dec.idDecompte]); } catch { }
        await db.execute('DELETE FROM decompte_details WHERE idDecompte = ?', [dec.idDecompte]);
        await db.execute('DELETE FROM decomptes WHERE idDecompte = ?', [dec.idDecompte]);
      }

      // 4. Restaurer stock principal
      for (const d of details) {
        await db.execute(
          'UPDATE products SET qte_stock = qte_stock + ? WHERE idProduit = ?',
          [d.qte_commande, d.idProduit]
        );
      }

      // 5. Stock revendeur
      if (commandeToDelete.type_commande === 'REVENDEUR') {
        // Récupérer idClient directement depuis la DB pour être sûr
        const cmdRow = await db.select<any[]>(
          'SELECT idClient FROM commandes WHERE idCommande = ?',
          [commandeToDelete.idCommande]
        );
        const idRevendeur = cmdRow.length > 0 ? cmdRow[0].idClient : commandeToDelete.idClient;

        for (const d of details) {
          await db.execute(
            `UPDATE stock_revendeur
             SET qte_stock = CASE WHEN qte_stock >= ? THEN qte_stock - ? ELSE 0 END
             WHERE idRevendeur = ? AND idProduit = ?`,
            [d.qte_commande, d.qte_commande, idRevendeur, d.idProduit]
          );
        }
        try { await db.execute('DELETE FROM mouvements_revendeur WHERE idCommande = ?', [commandeToDelete.idCommande]); } catch { }
      }

      // 6. Détails commande
      await db.execute('DELETE FROM commande_details WHERE idCommande = ?', [commandeToDelete.idCommande]);

      // 7. Mouvements stock
      try { await db.execute('DELETE FROM mouvements_stock WHERE reference = ?', [commandeToDelete.code_commande]); } catch { }

      // 8. La commande
      await db.execute('DELETE FROM commandes WHERE idCommande = ?', [commandeToDelete.idCommande]);

      notifications.show({
        title: '✅ Succès',
        message: `Commande ${commandeToDelete.code_commande} supprimée. ${details.length} produit(s) restauré(s) en stock.`,
        color: 'green',
        autoClose: 5000
      });

      setDeleteModalOpened(false);
      setCommandeToDelete(null);
      setDeleteImpactDetails(null);
      chargerCommandes();

    } catch (error: any) {
      console.error('[DELETE] Erreur suppression:', error);

      let msg = 'Impossible de supprimer la commande.';
      if (error?.message?.includes('database is locked')) {
        msg = '⚠️ Base de données verrouillée. Réessayez dans quelques instants.';
      } else if (error?.message?.includes('FOREIGN KEY')) {
        msg = `❌ Contrainte FK : ${error.message}`;
      } else if (error?.message) {
        msg = error.message;
      }

      notifications.show({
        title: '❌ Erreur',
        message: msg,
        color: 'red',
        autoClose: 8000
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(filteredCommandes.length / itemsPerPage);
  const paginatedCommandes = filteredCommandes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement des commandes...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md" style={{ maxWidth: 500 }}>
          <Alert icon={<IconAlertCircle size={16} />} title="Erreur" color="red">
            {error}
          </Alert>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={chargerCommandes}
            variant="light"
          >
            Réessayer
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <Stack gap="lg" p="md">
        <PageHeader
          title="Commandes"
          subtitle="Gestion des commandes clients et revendeurs"
          icon={<IconShoppingCart size={20} />}
          color="orange"
          action={{ label: 'Nouvelle commande', onClick: () => navigate('/commandes/nouveau'), color: 'orange' }}
          stats={[
            { label: 'Total', value: statistiques.total, icon: <IconShoppingCart size={13} /> },
            { label: 'Livrées', value: statistiques.totalLivree, icon: <IconCheck size={13} />, color: '#40c057' },
            { label: 'Confirmées', value: statistiques.totalConfirmée, icon: <IconClock size={13} />, color: '#4dabf7' },
            { label: 'Montant total', value: `${formatMontant(statistiques.montantTotal)} F`, icon: <IconCash size={13} />, color: '#f59f00' },
          ]}
        />

        {/* FILTRES */}
        <Card withBorder radius="lg" shadow="sm" p="sm">
          <Grid align="flex-end">
            <Grid.Col span={3}>
              <TextInput
                label="Rechercher"
                placeholder="Code, client, facture..."
                leftSection={<IconSearch size={14} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Select
                label="Type"
                placeholder="Tous"
                data={[
                  { value: 'STANDARD', label: 'Standard' },
                  { value: 'REVENDEUR', label: 'Revendeur' }
                ]}
                value={typeFilter}
                onChange={setTypeFilter}
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Select
                label="Statut"
                placeholder="Tous"
                data={[
                  { value: 'BROUILLON', label: 'Brouillon' },
                  { value: 'CONFIRMEE', label: 'Confirmée' },
                  { value: 'LIVREE', label: 'Livrée' },
                  { value: 'ANNULEE', label: 'Annulée' }
                ]}
                value={statutFilter}
                onChange={setStatutFilter}
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <TextInput
                label="Date début"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Group justify="flex-end" gap="xs">
                <TextInput
                  label="Date fin"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  size="xs"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<IconX size={14} />}
                  onClick={resetFilters}
                  size="xs"
                  style={{ marginTop: 20 }}
                >
                  Effacer
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>

        {/* TABLEAU */}
        <Card withBorder radius="lg" shadow="sm" p={0}>
          {filteredCommandes.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="sm">
                <IconShoppingCart size={48} color="#868e96" />
                <Text c="dimmed" size="lg" fw={500}>
                  Aucune commande trouvée
                </Text>
                <Text c="dimmed" size="sm">
                  {searchTerm || typeFilter || statutFilter || dateDebut || dateFin
                    ? 'Aucune commande ne correspond aux filtres appliqués'
                    : 'Commencez par créer une nouvelle commande'}
                </Text>
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/commandes/nouveau')}
                >
                  Nouvelle commande
                </Button>
              </Stack>
            </Center>
          ) : (
            <>
              <ScrollArea h={500} style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover verticalSpacing="xs" style={{ minWidth: 900, tableLayout: 'fixed' }}>
                  <Table.Thead>
                    <Table.Tr style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                      <Table.Th c="white" w={40} ta="center" style={{ whiteSpace: 'nowrap' }}>N°</Table.Th>
                      <Table.Th c="white" w={140} style={{ whiteSpace: 'nowrap' }}>Code</Table.Th>
                      <Table.Th c="white" w={180} style={{ whiteSpace: 'nowrap' }}>Client</Table.Th>
                      <Table.Th c="white" w={100} style={{ whiteSpace: 'nowrap' }}>Type</Table.Th>
                      <Table.Th c="white" w={110} style={{ whiteSpace: 'nowrap' }}>Date</Table.Th>
                      <Table.Th c="white" w={120} ta="right" style={{ whiteSpace: 'nowrap' }}>Montant</Table.Th>
                      <Table.Th c="white" w={110} ta="center" style={{ whiteSpace: 'nowrap' }}>Statut</Table.Th>
                      <Table.Th c="white" ta="center" w={200} style={{ whiteSpace: 'nowrap' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedCommandes.map((commande, idx) => {
                      const num = (currentPage - 1) * itemsPerPage + idx + 1;
                      const hasFacture = commande.idFacture && commande.code_facture;

                      return (
                        <Table.Tr key={commande.idCommande}>
                          <Table.Td ta="center" fw={600} style={{ whiteSpace: 'nowrap' }}>{num}</Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text fw={500} size="xs" style={{ whiteSpace: 'nowrap' }}>{commande.code_commande}</Text>
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                            <Group gap="xs" wrap="nowrap">
                              <Avatar size="sm" radius="xl" color="blue" style={{ flexShrink: 0 }}>
                                {(commande.NomComplet || 'C').charAt(0).toUpperCase()}
                              </Avatar>
                              <Stack gap={0} style={{ overflow: 'hidden', minWidth: 0 }}>
                                <Text size="xs" fw={500} truncate>{commande.NomComplet || 'Inconnu'}</Text>
                                {commande.Societe && (
                                  <Text size="xs" c="dimmed" truncate>{commande.Societe}</Text>
                                )}
                              </Stack>
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>{getTypeBadge(commande.type_commande)}</Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text size="xs">{formatDate(commande.date_commande)}</Text>
                          </Table.Td>
                          <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                            <Text fw={600} c="blue" size="xs">{formatMontant(commande.montant_ttc)} F</Text>
                          </Table.Td>
                          <Table.Td ta="center" style={{ whiteSpace: 'nowrap' }}>
                            {getStatutBadge(commande.statut)}
                          </Table.Td>
                          <Table.Td ta="center" style={{ whiteSpace: 'nowrap' }}>
                            <Group gap={4} justify="center" wrap="nowrap">
                              <Tooltip label="Voir détails">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  size="sm"
                                  onClick={() => navigate(`/commandes/${commande.idCommande}`)}
                                >
                                  <IconEye size={14} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label={hasFacture ? "Voir facture" : "Générer facture"}>
                                <ActionIcon
                                  variant="light"
                                  color={hasFacture ? "grape" : "orange"}
                                  size="sm"
                                  onClick={() => {
                                    if (hasFacture) {
                                      handleVoirFacture(commande);
                                    } else {
                                      handleGenererFacture(commande);
                                    }
                                  }}
                                >
                                  <IconFileInvoice size={14} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Imprimer">
                                <ActionIcon
                                  variant="light"
                                  color="teal"
                                  size="sm"
                                  onClick={() => navigate(`/commandes/${commande.idCommande}?print=true`)}
                                >
                                  <IconPrinter size={14} />
                                </ActionIcon>
                              </Tooltip>

                              {commande.statut === 'BROUILLON' && (
                                <Tooltip label="Modifier">
                                  <ActionIcon
                                    variant="light"
                                    color="orange"
                                    size="sm"
                                    onClick={() => navigate(`/commandes/${commande.idCommande}/edit`)}
                                  >
                                    <IconEdit size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}

                              <Tooltip label="Supprimer">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={() => analyzeDeleteImpact(commande)}
                                  disabled={commande.statut === 'LIVREE'}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination
                    total={totalPages}
                    value={currentPage}
                    onChange={setCurrentPage}
                    size="sm"
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* RÉSUMÉ */}
        <Paper withBorder p="sm" radius="lg">
          <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="lg">
              <Text size="xs" c="dimmed">
                Total: <strong>{filteredCommandes.length}</strong> commandes
              </Text>
              <Text size="xs" c="dimmed">
                Montant total: <strong>{formatMontant(statistiques.montantTotal)} FCFA</strong>
              </Text>
            </Group>
            <Group gap="xs">
              <Badge color="blue" size="sm">Standard: {statistiques.totalStandard}</Badge>
              <Badge color="green" size="sm">Revendeur: {statistiques.totalRevendeur}</Badge>
              <Badge color="gray" size="sm">Brouillon: {commandes.filter(c => c.statut === 'BROUILLON').length}</Badge>
            </Group>
          </Flex>
        </Paper>
      </Stack>

      {/* MODAL DE CONFIRMATION DE SUPPRESSION */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setCommandeToDelete(null);
          setDeleteImpactDetails(null);
        }}
        title="⚠️ Suppression de commande"
        centered
        size="xl"
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
              Vous êtes sur le point de supprimer définitivement cette commande.
              Cette action est irréversible et aura les conséquences suivantes :
            </Text>
          </Alert>

          {commandeToDelete && (
            <Paper p="md" withBorder style={{ backgroundColor: '#fff8e1' }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Commande</Text>
                  <Code>{commandeToDelete.code_commande}</Code>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Client</Text>
                  <Text>{commandeToDelete.NomComplet || 'Inconnu'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Type</Text>
                  <Badge color={commandeToDelete.type_commande === 'REVENDEUR' ? 'green' : 'blue'}>
                    {commandeToDelete.type_commande === 'REVENDEUR' ? 'Revendeur' : 'Standard'}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Montant</Text>
                  <Text fw={700} c="red">{formatMontant(commandeToDelete.montant_ttc)} FCFA</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Date</Text>
                  <Text>{formatDateHeure(commandeToDelete.date_commande)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text fw={700}>Statut</Text>
                  {getStatutBadge(commandeToDelete.statut)}
                </Group>
              </Stack>
            </Paper>
          )}

          {deleteImpactDetails && (
            <>
              <Divider label="📊 Impact de la suppression" labelPosition="center" />

              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <Paper p="sm" withBorder bg="blue.0">
                  <Text size="xs" c="dimmed">Produits concernés</Text>
                  <Text fw={700} size="lg" c="blue">{deleteImpactDetails.nbProduits}</Text>
                </Paper>
                <Paper p="sm" withBorder bg="orange.0">
                  <Text size="xs" c="dimmed">Mouvements de stock</Text>
                  <Text fw={700} size="lg" c="orange">{deleteImpactDetails.nbMouvements}</Text>
                </Paper>
                <Paper p="sm" withBorder bg={deleteImpactDetails.hasFacture ? 'yellow.0' : 'green.0'}>
                  <Text size="xs" c="dimmed">Facture(s)</Text>
                  <Text fw={700} size="lg" c={deleteImpactDetails.hasFacture ? 'orange' : 'green'}>
                    {deleteImpactDetails.hasFacture
                      ? `${deleteImpactDetails.factures.length} facture(s)`
                      : '✅ Aucune'}
                  </Text>
                </Paper>
                <Paper p="sm" withBorder bg={deleteImpactDetails.hasPaiement ? 'red.0' : 'green.0'}>
                  <Text size="xs" c="dimmed">Paiement(s)</Text>
                  <Text fw={700} size="lg" c={deleteImpactDetails.hasPaiement ? 'red' : 'green'}>
                    {deleteImpactDetails.hasPaiement ? '⚠️ Oui' : '✅ Non'}
                  </Text>
                </Paper>
              </SimpleGrid>

              {deleteImpactDetails.hasPaiement && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  <Text size="sm" fw={600}>❌ Suppression impossible</Text>
                  <Text size="sm" c="dimmed">
                    Des paiements ont déjà été effectués sur cette commande (règlements directs ou décomptes soldés).
                    Vous ne pouvez pas supprimer une commande ayant fait l'objet de paiements.
                  </Text>
                  {deleteImpactDetails.reglements.length > 0 && (
                    <List size="xs" spacing={4} mt="xs">
                      {deleteImpactDetails.reglements.map((r, i) => (
                        <List.Item key={i}>
                          {formatMontant(r.montant)} FCFA — {r.mode_reglement || 'Espèces'} — {formatDate(r.date_reglement)}
                        </List.Item>
                      ))}
                    </List>
                  )}
                </Alert>
              )}

              {deleteImpactDetails.hasDecompte && !deleteImpactDetails.hasPaiement && (
                <Alert color="orange" variant="light" icon={<IconReceipt size={16} />}>
                  <Text size="sm" fw={600}>📄 Décomptes associés (non soldés)</Text>
                  <Text size="sm" c="dimmed">
                    Des décomptes non soldés sont liés à cette commande. Ils seront supprimés automatiquement avec leurs détails.
                  </Text>
                  {deleteImpactDetails.decomptes.length > 0 && (
                    <List size="xs" spacing={4} mt="xs">
                      {deleteImpactDetails.decomptes.map((d, i) => (
                        <List.Item key={i}>
                          {d.code_decompte} — {formatMontant(d.montant_net)} FCFA — {d.statut}
                        </List.Item>
                      ))}
                    </List>
                  )}
                </Alert>
              )}

              {deleteImpactDetails.details.length > 0 && (
                <Box>
                  <Text size="xs" c="dimmed" mb="xs">Produits dans la commande :</Text>
                  <List size="xs" spacing="xs" icon={<IconListDetails size={12} />}>
                    {deleteImpactDetails.details.slice(0, 5).map((d, i) => (
                      <List.Item key={i}>
                        {d.designation || `Produit ${d.idProduit}`} — {d.qte_commande} x {formatMontant(d.prix_unitaire_vente)} F
                      </List.Item>
                    ))}
                    {deleteImpactDetails.details.length > 5 && (
                      <List.Item c="dimmed">... et {deleteImpactDetails.details.length - 5} autre(s)</List.Item>
                    )}
                  </List>
                </Box>
              )}

              <Divider />

              <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />}>
                <Stack gap={4}>
                  <Text size="sm" fw={600}>Ce que la suppression va faire :</Text>
                  <List size="xs" spacing={4}>
                    <List.Item>✅ Restaurer les stocks des produits en magasin</List.Item>
                    <List.Item>✅ Supprimer les mouvements de stock associés</List.Item>
                    {commandeToDelete?.type_commande === 'REVENDEUR' && (
                      <List.Item>✅ Restaurer le stock du revendeur</List.Item>
                    )}
                    {deleteImpactDetails.hasFacture && !deleteImpactDetails.hasPaiement && (
                      <List.Item>✅ Supprimer {deleteImpactDetails.factures.length} facture(s) sans paiement</List.Item>
                    )}
                    {deleteImpactDetails.hasDecompte && !deleteImpactDetails.hasPaiement && (
                      <List.Item>✅ Supprimer {deleteImpactDetails.decomptes.length} décompte(s) non soldé(s)</List.Item>
                    )}
                    <List.Item>✅ Supprimer les détails de la commande</List.Item>
                    <List.Item>❌ Supprimer définitivement la commande</List.Item>
                  </List>
                </Stack>
              </Alert>
            </>
          )}

          <Divider />

          <Group justify="flex-end">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpened(false);
                setCommandeToDelete(null);
                setDeleteImpactDetails(null);
              }}
              disabled={deleting}
              leftSection={<IconX size={16} />}
            >
              Annuler
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              leftSection={<IconTrash size={16} />}
              disabled={deleting || deleteImpactDetails?.hasPaiement}
            >
              {deleteImpactDetails?.hasPaiement
                ? '❌ Suppression impossible'
                : '⚠️ Confirmer la suppression'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default ListeCommandes;
