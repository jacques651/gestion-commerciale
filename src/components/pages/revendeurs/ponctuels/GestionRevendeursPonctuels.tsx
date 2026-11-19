// src/components/pages/revendeurs/ponctuels/GestionRevendeursPonctuels.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Title, Table, Button, Group, Stack, Text,
  Modal, TextInput, Select, NumberInput, ActionIcon,
  Tooltip, Badge, Paper, ThemeIcon, SimpleGrid,
  Flex, Tabs, Divider, Alert, ScrollArea, Pagination,
  Center, Loader, Grid, Textarea, Avatar, Checkbox,
  LoadingOverlay, Menu, Chip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUserPlus, IconPackage, IconRefresh, IconSearch,
  IconTrash, IconEdit, IconEye, IconPlus, IconCheck,
  IconX, IconShoppingCart, IconRotate, IconCash,
  IconHistory, IconFileInvoice, IconPrinter, IconDownload,
  IconFileExcel, IconFileTypePdf, IconAlertCircle,
  IconUser, IconPhone, IconMail, IconBuildingStore,
  IconList, IconCalendar
} from '@tabler/icons-react';

import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveText, saveFile } from '../../../../utils/fileExport';

import { getDb } from '../../../../database/db';
import { useAuth } from '../../../../contexts/AuthContext';
import { journalCaisseService } from '../../../../services/journalCaisseService';
import TkFilters from '../../../TkFilters';

// ============================================================
// TYPES
// ============================================================

interface RevendeurPonctuel {
  idRevendeurPonctuel: number;
  nom_complet: string;
  telephone: string;
  email?: string;
  adresse?: string;
  piece_identite?: string;
  numero_piece?: string;
  date_inscription: string;
  est_actif: number;
  notes?: string;
}

interface ArticleEnCours {
  idMouvement: number;
  code_mouvement: string;
  idRevendeurPonctuel: number;
  idProduit: number;
  designation: string;
  code_produit: string;
  reference?: string; // Référence de l'article (champ optionnel)
  categorie: string;
  unite_base: string;
  quantite_sortie: number;
  quantite_restante: number;
  quantite_vendue?: number;
  quantite_retournee?: number;
  prix_unitaire: number;
  montant_total: number;
  date_sortie: string;
  destination: string;
  stock_avant_sortie?: number;
  stock_apres_sortie?: number;
  statut: 'EN_COURS' | 'RETOURNE' | 'VENDU' | 'PARTIELLEMENT_RETOURNE';
  nom_revendeur?: string;
  telephone_revendeur?: string;
  details_ventes?: any[];
  details_retours?: any[];
}

interface HistoriqueLigne {
  id: number;
  date: string;
  type_action: 'APPROVISIONNEMENT' | 'VENTE' | 'RETOUR';
  idRevendeurPonctuel: number;
  idProduit: number;
  designation: string;
  code_produit: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
  statut: string;
  notes?: string;
  nom_revendeur?: string;
  idUtilisateur?: number;
  nom_utilisateur?: string;
}

interface Statistiques {
  totalRevendeurs: number;
  articlesEnCours: number;
  valeurEnCours: number;
  totalVentes: number;
  totalRetours: number;
  montantTotalVentes: number;
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export const GestionRevendeursPonctuels: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // ÉTATS
  // ============================================================

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('articles');

  // Revendeurs
  const [revendeurs, setRevendeurs] = useState<RevendeurPonctuel[]>([]);
  const [selectedRevendeur, setSelectedRevendeur] = useState<RevendeurPonctuel | null>(null);

  // Articles en cours
  const [articlesEnCours, setArticlesEnCours] = useState<ArticleEnCours[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<ArticleEnCours[]>([]);
  const [selectedMouvement, setSelectedMouvement] = useState<ArticleEnCours | null>(null);

  // Historique
  const [historique, setHistorique] = useState<HistoriqueLigne[]>([]);
  const [filteredHistorique, setFilteredHistorique] = useState<HistoriqueLigne[]>([]);
  const printContentRef = useRef<HTMLDivElement>(null);

  // Statistiques
  const [stats, setStats] = useState<Statistiques>({
    totalRevendeurs: 0,
    articlesEnCours: 0,
    valeurEnCours: 0,
    totalVentes: 0,
    totalRetours: 0,
    montantTotalVentes: 0
  });

  // Produits disponibles
  const [produitsDisponibles, setProduitsDisponibles] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [approSearch, setApproSearch] = useState('');

  // Modals
  const [modalOpened, setModalOpened] = useState(false);
  const [modalType, setModalType] = useState<'add_revendeur' | 'edit_revendeur' | 'approvisionnement' | 'vente' | 'retour' | 'details'>('add_revendeur');

  // Formulaires
  const [revendeurForm, setRevendeurForm] = useState({
    nom_complet: '',
    telephone: '',
    email: '',
    adresse: '',
    piece_identite: 'CNI',
    numero_piece: '',
    notes: ''
  });

  const [approForm, setApproForm] = useState({
    idProduit: 0,
    quantite: 1,
    prix_unitaire: 0,
    notes: ''
  });

  const [venteForm, setVenteForm] = useState({
    quantite: 1,
    prix_vente: 0,
    client_nom: '',
    notes: ''
  });

  const [retourForm, setRetourForm] = useState({
    quantite: 1,
    etat: 'BON' as 'BON' | 'ABIME' | 'PERDU',
    notes: ''
  });

  // Panier d'approvisionnement
  const [cart, setCart] = useState<{ idProduit: number; designation: string; code_produit: string; reference?: string; quantite: number; prix_unitaire: number; total: number }[]>([]);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRevendeur, setFilterRevendeur] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState<string | null>(null);
  const [filterArticle, setFilterArticle] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ============================================================
  // FONCTIONS UTILITAIRES
  // ============================================================

  const formatNumber = (value: any): string => {
    const num = typeof value === 'number' ? value : 0;
    return num.toLocaleString('fr-FR');
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('fr-FR');
    } catch {
      return '-';
    }
  };

  const getStatutBadge = (statut: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'EN_COURS': { color: 'blue', label: 'En cours' },
      'RETOURNE': { color: 'green', label: 'Retourné' },
      'VENDU': { color: 'teal', label: 'Vendu' },
      'PARTIELLEMENT_RETOURNE': { color: 'orange', label: 'Retour partiel' }
    };
    const config = configs[statut] || { color: 'gray', label: statut };
    return <Badge color={config.color}>{config.label}</Badge>;
  };

  const getTypeActionBadge = (type: string) => {
    const configs: Record<string, { color: string; label: string }> = {
      'APPROVISIONNEMENT': { color: 'blue', label: '📦 Approvisionnement' },
      'VENTE': { color: 'teal', label: '💰 Vente' },
      'RETOUR': { color: 'green', label: '🔄 Retour' }
    };
    const config = configs[type] || { color: 'gray', label: type };
    return <Badge color={config.color}>{config.label}</Badge>;
  };

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();

      // 1. Charger les revendeurs
      const revendeursData = await db.select<any[]>(`
        SELECT * FROM revendeurs_ponctuels WHERE est_actif = 1 ORDER BY nom_complet ASC
      `);
      setRevendeurs(revendeursData);

      // 2. Charger les produits disponibles
      const products = await db.select<any[]>(`
        SELECT idProduit, code_produit, reference, designation, qte_stock, prix_vente_detail, prix_vente_gros, unite_base, categorie
        FROM products
        WHERE qte_stock > 0 AND est_supprime = 0 AND COALESCE(est_annule, 0) = 0
        ORDER BY designation
      `);
      setProduitsDisponibles(products);

      // 3. Charger les articles en cours avec statistiques
      const articlesData = await db.select<any[]>(`
        SELECT 
          m.*,
          r.nom_complet as nom_revendeur,
          r.telephone as telephone_revendeur,
          p.designation,
          p.code_produit,
          p.reference,
          p.categorie,
          p.unite_base,
          COALESCE((
            SELECT SUM(e.quantite) 
            FROM mouvement_evenements e 
            WHERE e.idMouvement = m.idMouvement 
            AND e.type_evenement = 'VENTE'
          ), 0) as quantite_vendue,
          COALESCE((
            SELECT SUM(e.quantite) 
            FROM mouvement_evenements e 
            WHERE e.idMouvement = m.idMouvement 
            AND e.type_evenement = 'RETOUR'
          ), 0) as quantite_retournee,
          (m.quantite_sortie - 
            COALESCE((
              SELECT SUM(e.quantite) 
              FROM mouvement_evenements e 
              WHERE e.idMouvement = m.idMouvement 
              AND e.type_evenement IN ('RETOUR', 'VENTE')
            ), 0)
          ) as quantite_restante
        FROM mouvements_revendeurs m
        JOIN revendeurs_ponctuels r ON m.idRevendeurPonctuel = r.idRevendeurPonctuel
        JOIN products p ON m.idProduit = p.idProduit
        ORDER BY m.date_sortie DESC
      `);

      // Charger les détails des ventes et retours pour chaque mouvement
      const articlesWithDetails = await Promise.all(articlesData.map(async (article) => {
        const ventes = await db.select<any[]>(`
          SELECT * FROM mouvement_evenements 
          WHERE idMouvement = ? AND type_evenement = 'VENTE'
          ORDER BY date_evenement DESC
        `, [article.idMouvement]);

        const retours = await db.select<any[]>(`
          SELECT * FROM mouvement_evenements 
          WHERE idMouvement = ? AND type_evenement = 'RETOUR'
          ORDER BY date_evenement DESC
        `, [article.idMouvement]);

        return {
          ...article,
          details_ventes: ventes,
          details_retours: retours
        };
      }));

      setArticlesEnCours(articlesWithDetails);

      // 4. Charger l'historique
      const historiqueData = await db.select<any[]>(`
        SELECT 
          e.idEvenement as id,
          e.date_evenement as date,
          e.type_evenement as type_action,
          e.idMouvement,
          e.quantite,
          e.prix_unitaire,
          e.montant,
          e.notes,
          e.type_evenement as statut,
          m.idRevendeurPonctuel,
          r.nom_complet as nom_revendeur,
          p.idProduit,
          p.designation,
          p.code_produit,
          u.nom as nom_utilisateur
        FROM mouvement_evenements e
        JOIN mouvements_revendeurs m ON e.idMouvement = m.idMouvement
        JOIN revendeurs_ponctuels r ON m.idRevendeurPonctuel = r.idRevendeurPonctuel
        JOIN products p ON m.idProduit = p.idProduit
        LEFT JOIN utilisateurs u ON e.idUtilisateur = u.id
        ORDER BY e.date_evenement DESC
        LIMIT 500
      `);

      // 5. Ajouter les approvisionnements à l'historique
      const approData = await db.select<any[]>(`
        SELECT 
          m.idMouvement as id,
          m.date_sortie as date,
          'APPROVISIONNEMENT' as type_action,
          m.quantite_sortie as quantite,
          m.prix_unitaire,
          m.montant_total as montant,
          m.notes,
          m.statut,
          m.idRevendeurPonctuel,
          r.nom_complet as nom_revendeur,
          p.idProduit,
          p.designation,
          p.code_produit
        FROM mouvements_revendeurs m
        JOIN revendeurs_ponctuels r ON m.idRevendeurPonctuel = r.idRevendeurPonctuel
        JOIN products p ON m.idProduit = p.idProduit
        ORDER BY m.date_sortie DESC
        LIMIT 500
      `);

      // Combiner et trier l'historique
      const allHistorique = [...historiqueData, ...approData];
      allHistorique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistorique(allHistorique as any[]);

      // 6. Calculer les statistiques
      const statsData: Statistiques = {
        totalRevendeurs: revendeursData.length,
        articlesEnCours: articlesData.reduce((sum, a) => sum + (a.quantite_restante || 0), 0),
        valeurEnCours: articlesData.reduce((sum, a) => sum + ((a.quantite_restante || 0) * (a.prix_unitaire || 0)), 0),
        totalVentes: historiqueData.filter(h => h.type_action === 'VENTE').length,
        totalRetours: historiqueData.filter(h => h.type_action === 'RETOUR').length,
        montantTotalVentes: historiqueData.filter(h => h.type_action === 'VENTE').reduce((sum, h) => sum + (h.montant || 0), 0)
      };
      setStats(statsData);

    } catch (error) {
      console.error('Erreur chargement:', error);
      setError('Impossible de charger les données');
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de charger les données',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ============================================================
  // FILTRES
  // ============================================================

  useEffect(() => {
    let filtered = [...articlesEnCours];

    if (filterRevendeur) {
      filtered = filtered.filter(a => a.idRevendeurPonctuel === parseInt(filterRevendeur));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      // Recherche élargie : produit, code, référence de l'article, revendeur ET numéro de téléphone
      const termDigits = term.replace(/\D/g, '');
      filtered = filtered.filter(a =>
        a.designation?.toLowerCase().includes(term) ||
        a.code_produit?.toLowerCase().includes(term) ||
        a.reference?.toLowerCase().includes(term) ||
        a.nom_revendeur?.toLowerCase().includes(term) ||
        a.telephone_revendeur?.toLowerCase().includes(term) ||
        (termDigits.length > 0 && (a.telephone_revendeur || '').replace(/\D/g, '').includes(termDigits))
      );
    }

    setFilteredArticles(filtered);
  }, [articlesEnCours, filterRevendeur, searchTerm]);

  useEffect(() => {
    let filtered = [...historique];

    if (filterRevendeur) {
      filtered = filtered.filter(h => h.idRevendeurPonctuel === parseInt(filterRevendeur));
    }

    if (filterType) {
      filtered = filtered.filter(h => h.type_action === filterType);
    }

    if (filterStatut) {
      filtered = filtered.filter(h => h.statut === filterStatut);
    }

    if (filterArticle) {
      filtered = filtered.filter(h => h.idProduit === parseInt(filterArticle));
    }

    if (dateDebut) {
      filtered = filtered.filter(h => h.date >= dateDebut);
    }

    if (dateFin) {
      filtered = filtered.filter(h => h.date <= dateFin + ' 23:59:59');
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h =>
        h.designation?.toLowerCase().includes(term) ||
        h.code_produit?.toLowerCase().includes(term) ||
        h.nom_revendeur?.toLowerCase().includes(term)
      );
    }

    setFilteredHistorique(filtered);
    setCurrentPage(1);
  }, [historique, filterRevendeur, filterType, filterStatut, filterArticle, dateDebut, dateFin, searchTerm]);

  // ============================================================
  // GESTION DES REVENDEURS
  // ============================================================

  const handleAddRevendeur = async () => {
    if (!revendeurForm.nom_complet || !revendeurForm.telephone) {
      notifications.show({
        title: 'Erreur',
        message: 'Le nom et le téléphone sont obligatoires',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const db = await getDb();
      await db.execute(`
        INSERT INTO revendeurs_ponctuels (
          nom_complet, telephone, email, adresse,
          piece_identite, numero_piece, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        revendeurForm.nom_complet,
        revendeurForm.telephone,
        revendeurForm.email || null,
        revendeurForm.adresse || null,
        revendeurForm.piece_identite,
        revendeurForm.numero_piece || null,
        revendeurForm.notes || null
      ]);

      notifications.show({
        title: '✅ Succès',
        message: `Revendeur "${revendeurForm.nom_complet}" ajouté avec succès`,
        color: 'green'
      });

      setModalOpened(false);
      setRevendeurForm({
        nom_complet: '',
        telephone: '',
        email: '',
        adresse: '',
        piece_identite: 'CNI',
        numero_piece: '',
        notes: ''
      });
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'ajout du revendeur',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRevendeur = async () => {
    if (!selectedRevendeur) return;

    setLoading(true);
    try {
      const db = await getDb();
      await db.execute(`
        UPDATE revendeurs_ponctuels 
        SET nom_complet = ?, telephone = ?, email = ?, adresse = ?,
            piece_identite = ?, numero_piece = ?, notes = ?
        WHERE idRevendeurPonctuel = ?
      `, [
        revendeurForm.nom_complet,
        revendeurForm.telephone,
        revendeurForm.email || null,
        revendeurForm.adresse || null,
        revendeurForm.piece_identite,
        revendeurForm.numero_piece || null,
        revendeurForm.notes || null,
        selectedRevendeur.idRevendeurPonctuel
      ]);

      notifications.show({
        title: '✅ Succès',
        message: 'Revendeur modifié avec succès',
        color: 'green'
      });

      setModalOpened(false);
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de la modification',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActif = async (revendeur: RevendeurPonctuel) => {
    const newStatus = revendeur.est_actif === 1 ? 0 : 1;
    setLoading(true);
    try {
      const db = await getDb();
      await db.execute(`
        UPDATE revendeurs_ponctuels SET est_actif = ? WHERE idRevendeurPonctuel = ?
      `, [newStatus, revendeur.idRevendeurPonctuel]);

      notifications.show({
        title: '✅ Succès',
        message: `Revendeur ${newStatus === 1 ? 'activé' : 'désactivé'} avec succès`,
        color: 'green'
      });
      await loadData();
    } catch (error) {
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'opération',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // APPROVISIONNEMENT (STOCK TEMPORAIRE)
  // ============================================================

  const addToCart = () => {
    if (!selectedProduct) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un produit',
        color: 'red'
      });
      return;
    }

    const existing = cart.find(item => item.idProduit === selectedProduct.idProduit);
    if (existing) {
      notifications.show({
        title: 'Information',
        message: 'Produit déjà dans le panier',
        color: 'blue'
      });
      return;
    }

    setCart([...cart, {
      idProduit: selectedProduct.idProduit,
      designation: selectedProduct.designation,
      code_produit: selectedProduct.code_produit,
      reference: selectedProduct.reference,
      quantite: approForm.quantite,
      prix_unitaire: approForm.prix_unitaire || selectedProduct.prix_vente_gros || 0,
      total: approForm.quantite * (approForm.prix_unitaire || selectedProduct.prix_vente_gros || 0)
    }]);

    setSelectedProduct(null);
    setApproForm({ ...approForm, idProduit: 0, quantite: 1 });
    notifications.show({
      title: '✅ Ajouté',
      message: 'Produit ajouté au panier',
      color: 'green'
    });
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleApprovisionnement = async () => {
    if (!selectedRevendeur) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un revendeur',
        color: 'red'
      });
      return;
    }

    if (cart.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Ajoutez au moins un produit',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    let db: Awaited<ReturnType<typeof getDb>> | null = null;
    try {
      db = await getDb();

      // Séquence de base robuste : plus grand numéro MVT existant (évite toute collision de code_mouvement)
      const seqRes = await db.select<any[]>(
        `SELECT COALESCE(MAX(CAST(substr(code_mouvement, 5) AS INTEGER)), 0) as maxseq
         FROM mouvements_revendeurs WHERE code_mouvement LIKE 'MVT-%'`
      );
      const baseSeq = Number(seqRes[0]?.maxseq || 0);

      // idUtilisateur robuste : on ne l'insère que s'il existe RÉELLEMENT dans utilisateurs
      // (sinon NULL) -> évite l'échec « FOREIGN KEY constraint failed »
      let idUtilisateur: number | null = (user as any)?.id ?? null;
      if (idUtilisateur != null) {
        const chkUser = await db.select<any[]>('SELECT id FROM utilisateurs WHERE id = ? LIMIT 1', [idUtilisateur]);
        if (chkUser.length === 0) idUtilisateur = null;
      }

      await db.execute('BEGIN TRANSACTION');

      for (let idx = 0; idx < cart.length; idx++) {
        const item = cart[idx];
        // Vérifier le stock
        const stockCheck = await db.select<any[]>(`
          SELECT qte_stock FROM products WHERE idProduit = ?
        `, [item.idProduit]);

        const stockDisponible = stockCheck[0]?.qte_stock || 0;
        if (item.quantite > stockDisponible) {
          throw new Error(`Stock insuffisant pour ${item.designation}. Disponible: ${stockDisponible}`);
        }

        // Code mouvement unique (basé sur la séquence de base calculée avant la boucle)
        const code = `MVT-${String(baseSeq + idx + 1).padStart(4, '0')}`;

        // Mettre à jour le stock
        const stockAvant = stockDisponible;
        const stockApres = stockDisponible - item.quantite;

        await db.execute(`
          UPDATE products SET qte_stock = ? WHERE idProduit = ?
        `, [stockApres, item.idProduit]);

        // Créer le mouvement
        await db.execute(`
          INSERT INTO mouvements_revendeurs (
            code_mouvement,
            idRevendeurPonctuel,
            idProduit,
            quantite_sortie,
            prix_unitaire,
            montant_total,
            destination,
            stock_avant_sortie,
            stock_apres_sortie,
            notes,
            idUtilisateur,
            statut
          ) VALUES (?, ?, ?, ?, ?, ?, 'PRESENTATION', ?, ?, ?, ?, 'EN_COURS')
        `, [
          code,
          selectedRevendeur.idRevendeurPonctuel,
          item.idProduit,
          item.quantite,
          item.prix_unitaire,
          item.total,
          stockAvant,
          stockApres,
          approForm.notes || null,
          idUtilisateur
        ]);
      }

      await db.execute('COMMIT');

      notifications.show({
        title: '✅ Approvisionnement effectué',
        message: `${cart.length} produit(s) ajouté(s) à ${selectedRevendeur.nom_complet}`,
        color: 'green'
      });

      setCart([]);
      setModalOpened(false);
      await loadData();
    } catch (error: any) {
      if (db) { try { await db.execute('ROLLBACK'); } catch { /* ignore */ } }
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de l\'approvisionnement',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // VENTE
  // ============================================================

  const handleVente = async () => {
    if (!selectedMouvement) {
      notifications.show({
        title: 'Erreur',
        message: 'Aucun mouvement sélectionné',
        color: 'red'
      });
      return;
    }

    const restant = selectedMouvement.quantite_restante || 0;
    if (venteForm.quantite > restant) {
      notifications.show({
        title: 'Erreur',
        message: `Quantité restante: ${restant}`,
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const db = await getDb();

      // Le stock ne change pas (déjà sorti)
      const stockCheck = await db.select<any[]>(`
        SELECT qte_stock FROM products WHERE idProduit = ?
      `, [selectedMouvement.idProduit]);

      const stockActuel = stockCheck[0]?.qte_stock || 0;

      // Enregistrer l'événement de vente
      await db.execute(`
        INSERT INTO mouvement_evenements (
          idMouvement,
          type_evenement,
          quantite,
          prix_unitaire,
          montant,
          stock_avant,
          stock_apres,
          client_nom,
          notes,
          idUtilisateur
        ) VALUES (?, 'VENTE', ?, ?, ?, ?, ?, ?, ?, NULL)
      `, [
        selectedMouvement.idMouvement,
        venteForm.quantite,
        venteForm.prix_vente || selectedMouvement.prix_unitaire,
        (venteForm.quantite * (venteForm.prix_vente || selectedMouvement.prix_unitaire)),
        stockActuel,
        stockActuel,
        venteForm.client_nom || null,
        venteForm.notes || null
      ]);

      // Mettre à jour le statut
      await updateMouvementStatut(selectedMouvement.idMouvement);

      // Enregistrer la vente dans le JOURNAL DE CAISSE (entrée d'argent)
      try {
        await journalCaisseService.ajouterEntree({
          categorie: 'AUTRE_ENTREE',
          designation: `Vente revendeur ponctuel - ${selectedMouvement.designation}${selectedMouvement.nom_revendeur ? ` (${selectedMouvement.nom_revendeur})` : ''}`,
          montant: venteForm.quantite * (venteForm.prix_vente || selectedMouvement.prix_unitaire),
          reference: selectedMouvement.code_mouvement,
          notes: "Vente d'un article détenu par un revendeur ponctuel",
        });
      } catch (e) {
        console.warn('Journal de caisse non mis à jour (vente ponctuelle):', e);
      }

      notifications.show({
        title: '✅ Vente enregistrée',
        message: `${venteForm.quantite} unité(s) vendue(s) - ${(venteForm.quantite * (venteForm.prix_vente || selectedMouvement.prix_unitaire)).toLocaleString()} FCFA`,
        color: 'green'
      });

      setModalOpened(false);
      setVenteForm({ quantite: 1, prix_vente: 0, client_nom: '', notes: '' });
      await loadData();
    } catch (error) {
      console.error('Erreur vente:', error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de la vente',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RETOUR
  // ============================================================

  const handleRetour = async () => {
    if (!selectedMouvement) {
      notifications.show({
        title: 'Erreur',
        message: 'Aucun mouvement sélectionné',
        color: 'red'
      });
      return;
    }

    const restant = selectedMouvement.quantite_restante || 0;
    if (retourForm.quantite > restant) {
      notifications.show({
        title: 'Erreur',
        message: `Quantité restante: ${restant}`,
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      const db = await getDb();

      // Récupérer le stock actuel
      const stockCheck = await db.select<any[]>(`
        SELECT qte_stock FROM products WHERE idProduit = ?
      `, [selectedMouvement.idProduit]);

      const stockActuel = stockCheck[0]?.qte_stock || 0;
      const stockApres = stockActuel + retourForm.quantite;

      // Mettre à jour le stock
      await db.execute(`
        UPDATE products SET qte_stock = ? WHERE idProduit = ?
      `, [stockApres, selectedMouvement.idProduit]);

      // Enregistrer l'événement de retour
      await db.execute(`
        INSERT INTO mouvement_evenements (
          idMouvement,
          type_evenement,
          quantite,
          prix_unitaire,
          montant,
          stock_avant,
          stock_apres,
          etat,
          notes,
          idUtilisateur
        ) VALUES (?, 'RETOUR', ?, ?, ?, ?, ?, ?, ?, NULL)
      `, [
        selectedMouvement.idMouvement,
        retourForm.quantite,
        selectedMouvement.prix_unitaire,
        retourForm.quantite * selectedMouvement.prix_unitaire,
        stockActuel,
        stockApres,
        retourForm.etat,
        retourForm.notes || null
      ]);

      // Mettre à jour le statut
      await updateMouvementStatut(selectedMouvement.idMouvement);

      notifications.show({
        title: '✅ Retour effectué',
        message: `${retourForm.quantite} unité(s) retournée(s) - Stock augmenté de ${retourForm.quantite}`,
        color: 'green'
      });

      setModalOpened(false);
      setRetourForm({ quantite: 1, etat: 'BON', notes: '' });
      await loadData();
    } catch (error) {
      console.error('Erreur retour:', error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors du retour',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // MISE À JOUR STATUT
  // ============================================================

  const updateMouvementStatut = async (idMouvement: number) => {
    const db = await getDb();

    const mouvement = await db.select<any[]>(`
      SELECT quantite_sortie FROM mouvements_revendeurs WHERE idMouvement = ?
    `, [idMouvement]);

    const evenements = await db.select<any[]>(`
      SELECT type_evenement, quantite FROM mouvement_evenements WHERE idMouvement = ?
    `, [idMouvement]);

    const quantite_sortie = mouvement[0]?.quantite_sortie || 0;
    let quantite_retournee = 0;
    let quantite_vendue = 0;

    for (const e of evenements) {
      if (e.type_evenement === 'RETOUR') quantite_retournee += e.quantite;
      if (e.type_evenement === 'VENTE') quantite_vendue += e.quantite;
    }

    const quantite_traitee = quantite_retournee + quantite_vendue;
    const quantite_restante = quantite_sortie - quantite_traitee;

    let nouveauStatut = 'EN_COURS';
    if (quantite_restante <= 0) {
      nouveauStatut = quantite_vendue > 0 ? 'VENDU' : 'RETOURNE';
    } else if (quantite_retournee > 0 && quantite_restante > 0) {
      nouveauStatut = 'PARTIELLEMENT_RETOURNE';
    }

    await db.execute(`
      UPDATE mouvements_revendeurs SET statut = ? WHERE idMouvement = ?
    `, [nouveauStatut, idMouvement]);
  };

  // ============================================================
  // CHARGER LES DÉTAILS D'UN MOUVEMENT
  // ============================================================

  const loadMouvementDetails = async (idMouvement: number) => {
    try {
      const db = await getDb();

      const mouvement = await db.select<any[]>(`
        SELECT 
          m.*,
          r.nom_complet as nom_revendeur,
          r.telephone as telephone_revendeur,
          p.designation,
          p.code_produit,
          p.categorie,
          p.unite_base
        FROM mouvements_revendeurs m
        JOIN revendeurs_ponctuels r ON m.idRevendeurPonctuel = r.idRevendeurPonctuel
        JOIN products p ON m.idProduit = p.idProduit
        WHERE m.idMouvement = ?
      `, [idMouvement]);

      if (mouvement.length === 0) return;

      const ventes = await db.select<any[]>(`
        SELECT * FROM mouvement_evenements 
        WHERE idMouvement = ? AND type_evenement = 'VENTE'
        ORDER BY date_evenement DESC
      `, [idMouvement]);

      const retours = await db.select<any[]>(`
        SELECT * FROM mouvement_evenements 
        WHERE idMouvement = ? AND type_evenement = 'RETOUR'
        ORDER BY date_evenement DESC
      `, [idMouvement]);

      const quantite_vendue = ventes.reduce((sum, v) => sum + v.quantite, 0);
      const quantite_retournee = retours.reduce((sum, r) => sum + r.quantite, 0);
      const quantite_restante = mouvement[0].quantite_sortie - quantite_vendue - quantite_retournee;

      setSelectedMouvement({
        ...mouvement[0],
        quantite_restante,
        quantite_vendue,
        quantite_retournee,
        details_ventes: ventes,
        details_retours: retours
      });
    } catch (error) {
      console.error('Erreur chargement détails:', error);
    }
  };

  // ============================================================
  // EXPORT ET IMPRESSION
  // ============================================================

  // Export CSV
  const handleExportCSV = async () => {
    try {
      let data: any[] = [];
      let headers: string[] = [];
      let rows: any[][] = [];

      if (activeTab === 'articles') {
        data = filteredArticles;
        headers = [
          'Revendeur', 'Téléphone', 'Produit', 'Code', 'Catégorie',
          'Qté Sortie', 'Qté Vendue', 'Qté Retournée', 'Qté En Cours',
          'Prix Unitaire', 'Montant Total', 'Montant Vendu', 'Montant Retourné', 'Montant En Cours',
          'Date', 'Statut'
        ];
        rows = data.map((a: ArticleEnCours) => {
          const quantite_vendue = a.quantite_vendue || 0;
          const quantite_retournee = a.quantite_retournee || 0;
          const quantite_en_cours = a.quantite_restante || 0;
          return [
            a.nom_revendeur || '',
            a.telephone_revendeur || '',
            a.designation || '',
            a.code_produit || '',
            a.categorie || '',
            a.quantite_sortie || 0,
            quantite_vendue,
            quantite_retournee,
            quantite_en_cours,
            a.prix_unitaire || 0,
            a.montant_total || 0,
            quantite_vendue * (a.prix_unitaire || 0),
            quantite_retournee * (a.prix_unitaire || 0),
            quantite_en_cours * (a.prix_unitaire || 0),
            formatDate(a.date_sortie),
            a.statut || ''
          ];
        });
      } else if (activeTab === 'historique') {
        data = filteredHistorique;
        headers = ['Date', 'Type', 'Revendeur', 'Produit', 'Code', 'Quantité', 'Prix', 'Montant', 'Notes'];
        rows = data.map((h: HistoriqueLigne) => [
          formatDateTime(h.date),
          h.type_action || '',
          h.nom_revendeur || '',
          h.designation || '',
          h.code_produit || '',
          h.quantite || 0,
          h.prix_unitaire || 0,
          h.montant || 0,
          h.notes || ''
        ]);
      } else {
        data = revendeurs;
        headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Pièce d\'identité', 'Numéro pièce', 'Statut', 'Notes'];
        rows = data.map((r: RevendeurPonctuel) => [
          r.nom_complet || '',
          r.telephone || '',
          r.email || '',
          r.adresse || '',
          r.piece_identite || '',
          r.numero_piece || '',
          r.est_actif ? 'Actif' : 'Inactif',
          r.notes || ''
        ]);
      }

      if (rows.length === 0) {
        notifications.show({
          title: 'Information',
          message: 'Aucune donnée à exporter',
          color: 'blue'
        });
        return;
      }

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const res = await saveText(csvContent, `revendeurs_ponctuels_${new Date().toISOString().split('T')[0]}.csv`);
      if (res !== 'cancelled') {
        notifications.show({
          title: '✅ Succès',
          message: `Export CSV effectué (${rows.length} lignes) — dossier choisi`,
          color: 'green'
        });
      }
    } catch (error) {
      console.error('Erreur export CSV:', error);
      notifications.show({
        title: '❌ Erreur',
        message: 'Erreur lors de l\'export CSV',
        color: 'red'
      });
    }
  };

// ============================================================
// EXPORT PDF - Version corrigée
// ============================================================

const handleExportPDF = async () => {
  try {
    let headers: string[] = [];
    let rows: any[][] = [];
    let title = '';

    if (activeTab === 'articles') {
      title = 'Articles en cours';
      headers = ['Revendeur','Produit','Code','Categorie','Sortie','Vendu','Retourne','En cours','Prix','Mt Total','Mt Vendu','Mt Retourne','Mt En cours','Date','Statut'];
      rows = filteredArticles.map((a: ArticleEnCours) => {
        const qv = a.quantite_vendue || 0, qr = a.quantite_retournee || 0, qe = a.quantite_restante || 0;
        return [a.nom_revendeur||'', a.designation||'', a.code_produit||'', a.categorie||'', a.quantite_sortie||0, qv, qr, qe,
          formatNumber(a.prix_unitaire||0), formatNumber(a.montant_total||0), formatNumber(qv*(a.prix_unitaire||0)),
          formatNumber(qr*(a.prix_unitaire||0)), formatNumber(qe*(a.prix_unitaire||0)), formatDate(a.date_sortie), a.statut||''];
      });
    } else if (activeTab === 'historique') {
      title = 'Historique des mouvements';
      headers = ['Date','Type','Revendeur','Produit','Code','Qte','Prix','Montant','Notes'];
      rows = filteredHistorique.map((h: HistoriqueLigne) => [formatDateTime(h.date), h.type_action||'', h.nom_revendeur||'',
        h.designation||'', h.code_produit||'', h.quantite||0, formatNumber(h.prix_unitaire||0), formatNumber(h.montant||0), h.notes||'']);
    } else {
      title = 'Liste des revendeurs';
      headers = ['Nom','Telephone','Email','Adresse','Piece','Numero','Statut'];
      rows = revendeurs.map((r: RevendeurPonctuel) => [r.nom_complet||'', r.telephone||'', r.email||'', r.adresse||'',
        r.piece_identite||'', r.numero_piece||'', r.est_actif ? 'Actif' : 'Inactif']);
    }

    if (rows.length === 0) {
      notifications.show({ title: 'Information', message: 'Aucune donnee a exporter', color: 'blue' });
      return;
    }

    // PDF vectoriel (texte), sans capture d'ecran
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(13);
    doc.text('Revendeurs Ponctuels - ' + title, 14, 14);
    doc.setFontSize(8);
    doc.text('Genere le ' + new Date().toLocaleString('fr-FR') + ' - ' + rows.length + ' enregistrement(s)', 14, 20);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 24,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [27, 54, 93], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [247, 249, 252] },
    });

    const res = await saveFile(doc.output('blob') as Blob, `revendeurs_ponctuels_${new Date().toISOString().split('T')[0]}.pdf`);
    if (res !== 'cancelled') {
      notifications.show({ title: 'OK', message: `Export PDF effectue (${rows.length} lignes) - dossier choisi`, color: 'green' });
    }
  } catch (error: any) {
    console.error('Erreur export PDF:', error);
    notifications.show({ title: 'Erreur', message: error.message || "Erreur lors de l'export PDF", color: 'red' });
  }
};

const handlePrint = () => {
  try {
    let data: any[] = [];
    let headers: string[] = [];
    let rows: any[][] = [];
    let title = '';

    if (activeTab === 'articles') {
      data = filteredArticles;
      title = 'Articles en cours - Statistiques détaillées';
      headers = [
        'Revendeur', 'Produit', 'Code', 'Catégorie',
        'Sortie', 'Vendu', 'Retourné', 'En cours',
        'Prix (FCFA)', 'Mt Total (FCFA)', 'Mt Vendu (FCFA)', 'Mt Retourné (FCFA)', 'Mt En cours (FCFA)',
        'Date', 'Statut'
      ];
      rows = data.map((a: ArticleEnCours) => {
        const quantite_vendue = a.quantite_vendue || 0;
        const quantite_retournee = a.quantite_retournee || 0;
        const quantite_en_cours = a.quantite_restante || 0;
        return [
          a.nom_revendeur || '',
          a.designation || '',
          a.code_produit || '',
          a.categorie || '',
          a.quantite_sortie || 0,
          quantite_vendue,
          quantite_retournee,
          quantite_en_cours,
          a.prix_unitaire || 0,
          a.montant_total || 0,
          quantite_vendue * (a.prix_unitaire || 0),
          quantite_retournee * (a.prix_unitaire || 0),
          quantite_en_cours * (a.prix_unitaire || 0),
          formatDate(a.date_sortie),
          a.statut || ''
        ];
      });
    } else if (activeTab === 'historique') {
      data = filteredHistorique;
      title = 'Historique des mouvements';
      headers = ['Date', 'Type', 'Revendeur', 'Produit', 'Code', 'Qté', 'Prix (FCFA)', 'Montant (FCFA)', 'Notes'];
      rows = data.map((h: HistoriqueLigne) => [
        formatDateTime(h.date),
        h.type_action || '',
        h.nom_revendeur || '',
        h.designation || '',
        h.code_produit || '',
        h.quantite || 0,
        h.prix_unitaire || 0,
        h.montant || 0,
        h.notes || ''
      ]);
    } else {
      data = revendeurs;
      title = 'Liste des revendeurs';
      headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Pièce d\'identité', 'Numéro pièce', 'Statut', 'Notes'];
      rows = data.map((r: RevendeurPonctuel) => [
        r.nom_complet || '',
        r.telephone || '',
        r.email || '',
        r.adresse || '',
        r.piece_identite || '',
        r.numero_piece || '',
        r.est_actif ? 'Actif' : 'Inactif',
        r.notes || ''
      ]);
    }

    if (rows.length === 0) {
      notifications.show({
        title: 'Information',
        message: 'Aucune donnée à imprimer',
        color: 'blue'
      });
      return;
    }

    // Calcul du total des montants pour les articles
    let totalGeneral = 0;
    let totalVendu = 0;
    let totalRetourne = 0;
    let totalEnCours = 0;

    if (activeTab === 'articles') {
      data.forEach((a: ArticleEnCours) => {
        const quantite_vendue = a.quantite_vendue || 0;
        const quantite_retournee = a.quantite_retournee || 0;
        const quantite_en_cours = a.quantite_restante || 0;
        totalGeneral += a.montant_total || 0;
        totalVendu += quantite_vendue * (a.prix_unitaire || 0);
        totalRetourne += quantite_retournee * (a.prix_unitaire || 0);
        totalEnCours += quantite_en_cours * (a.prix_unitaire || 0);
      });
    }

    // Construire le HTML pour l'impression
    let tableRows = rows.map(row => `
      <tr>
        ${row.map(cell => {
          const isNum = typeof cell === 'number';
          return `<td style="white-space:nowrap;padding:5px 9px;border:1px solid #e8e8ef;font-size:9px;${isNum ? 'text-align:right;font-variant-numeric:tabular-nums;' : 'text-align:left;'}">${cell}</td>`;
        }).join('')}
      </tr>
    `).join('');

    // Ajouter la ligne des totaux pour les articles
    let totalRow = '';
    if (activeTab === 'articles') {
      totalRow = `
        <tr class="total-row">
          <td colspan="4" style="text-align:right; font-weight:bold;">TOTAUX</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td style="font-weight:bold;">${formatNumber(totalGeneral)} F</td>
          <td style="font-weight:bold; color:#2e7d32;">${formatNumber(totalVendu)} F</td>
          <td style="font-weight:bold; color:#e65100;">${formatNumber(totalRetourne)} F</td>
          <td style="font-weight:bold; color:#1565c0;">${formatNumber(totalEnCours)} F</td>
          <td colspan="2"></td>
        </tr>
      `;
    }

    // Créer un conteneur d'impression temporaire dans la page
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      z-index: 99999;
      padding: 20px;
      overflow: auto;
      display: none;
    `;

    printContainer.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="border-bottom: 3px solid #f4b400; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; color: #1a1a2e;">📦 Revendeurs Ponctuels</h1>
          <div style="font-size: 14px; color: #666; margin-top: 5px;">${title}</div>
          <div style="font-size: 12px; color: #888; margin-top: 3px;">Généré le ${new Date().toLocaleString('fr-FR')} - ${rows.length} enregistrement(s)</div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:15px;table-layout:auto;box-shadow:0 1px 4px rgba(0,0,0,.08);border-radius:6px;overflow:hidden;">
          <thead>
            <tr>
              ${headers.map(h => `<th style="white-space:nowrap;background:linear-gradient(135deg,#0a1628,#1b365d);color:white;padding:8px 9px;text-align:center;font-weight:700;border:1px solid #1b365d;font-size:9.5px;letter-spacing:.3px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${totalRow}
          </tbody>
        </table>

        <div style="margin-top: 20px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px;">
          Document généré automatiquement - ${new Date().toLocaleString('fr-FR')}
        </div>
      </div>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        table td, table th { white-space: nowrap; }
        table tr:nth-child(even) { background: #f7f9fc; }
        table tr:hover { background: #eef4ff; }
        .total-row { font-weight: bold; background: #e3f2fd !important; border-top: 2px solid #1a1a2e; }
        .total-row td { font-weight: bold; font-size: 10px; }
        @media print {
          body * { visibility: hidden; }
          #print-container, #print-container * { visibility: visible; }
          #print-container { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: white;
            padding: 20px;
            display: block !important;
          }
          .total-row { background: #e3f2fd !important; }
          th { background: #1a1a2e !important; color: white !important; }
        }
      </style>
    `;

    // Ajouter le conteneur à la page
    document.body.appendChild(printContainer);

    // Forcer l'affichage pour l'impression
    printContainer.style.display = 'block';

    // Attendre que le contenu soit chargé puis imprimer
    setTimeout(() => {
      window.print();
      
      // Supprimer le conteneur après l'impression
      setTimeout(() => {
        if (document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
      }, 1000);
    }, 300);

    notifications.show({
      title: '✅ Succès',
      message: 'Impression en cours...',
      color: 'green'
    });

  } catch (error) {
    console.error('Erreur impression:', error);
    notifications.show({
      title: '❌ Erreur',
      message: 'Erreur lors de l\'impression',
      color: 'red'
    });
  }
};

// Ajouter un écouteur d'événement pour nettoyer après impression
useEffect(() => {
  const handleAfterPrint = () => {
    const container = document.getElementById('print-container');
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  };

  window.addEventListener('afterprint', handleAfterPrint);
  
  return () => {
    window.removeEventListener('afterprint', handleAfterPrint);
  };
}, []);

  // ============================================================
  // RENDU
  // ============================================================

  // Recherche multicritère des produits dans le formulaire d'approvisionnement
  const produitsApproFiltres = useMemo(() => {
    const t = approSearch.trim().toLowerCase();
    if (!t) return [] as any[];
    const digits = t.replace(/\D/g, '');
    return produitsDisponibles.filter((p) =>
      (p.designation || '').toLowerCase().includes(t) ||
      (p.code_produit || '').toLowerCase().includes(t) ||
      (p.reference || '').toLowerCase().includes(t) ||
      (p.categorie || '').toLowerCase().includes(t) ||
      (digits.length > 0 && String(p.code_produit || '').replace(/\D/g, '').includes(digits))
    ).slice(0, 15);
  }, [approSearch, produitsDisponibles]);

  if (loading && revendeurs.length === 0) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement des données...</Text>
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <LoadingOverlay visible={loading} />

      {/* EN-TÊTE */}
      <Paper className="tk-page-tools"
        p="xl"
        radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="yellow" variant="filled">
              <IconUserPlus size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white" style={{ fontSize: '2rem' }}>Revendeurs Ponctuels</Title>
              <Text c="gray.3" size="sm">Gestion des approvisionnements, ventes et retours</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={loadData}
            >
              Actualiser
            </Button>
            <Button
              variant="light"
              color="yellow"
              leftSection={<IconUserPlus size={18} />}
              onClick={() => {
                setModalType('add_revendeur');
                setModalOpened(true);
              }}
            >
              Nouveau revendeur
            </Button>
          </Group>
        </Flex>

        {/* Statistiques */}
        <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconUser size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Revendeurs</Text>
                <Text c="white" fw={700} size="xl">{stats.totalRevendeurs}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(74,108,247,0.2)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconPackage size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Articles en cours</Text>
                <Text c="white" fw={700} size="xl">{stats.articlesEnCours}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,193,7,0.2)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCash size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Valeur en cours</Text>
                <Text c="white" fw={700} size="xl">{formatNumber(stats.valeurEnCours)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(0,150,136,0.2)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="teal" variant="light" size="lg">
                <IconCash size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Ventes totales</Text>
                <Text c="white" fw={700} size="xl">{formatNumber(stats.montantTotalVentes)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(46,125,50,0.2)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconRotate size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Retours</Text>
                <Text c="white" fw={700} size="xl">{stats.totalRetours}</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(156,39,176,0.2)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="purple" variant="light" size="lg">
                <IconHistory size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Ventes</Text>
                <Text c="white" fw={700} size="xl">{stats.totalVentes}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* TABS */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Tabs value={activeTab} onChange={(value: any) => setActiveTab(value)}>
          <Tabs.List grow>
            <Tabs.Tab value="articles" leftSection={<IconPackage size={16} />}>
              Articles en cours
              <Badge size="xs" color="blue" ml="xs" variant="light">{filteredArticles.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="historique" leftSection={<IconHistory size={16} />}>
              Historique
              <Badge size="xs" color="orange" ml="xs" variant="light">{filteredHistorique.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="revendeurs" leftSection={<IconUser size={16} />}>
              Revendeurs
              <Badge size="xs" color="green" ml="xs" variant="light">{revendeurs.length}</Badge>
            </Tabs.Tab>
          </Tabs.List>

          {/* ============================================================ */}
          {/* TAB: ARTICLES EN COURS */}
          {/* ============================================================ */}
          <Tabs.Panel value="articles" pt="md">
            <TkFilters>
            <Group mb="md" gap="xs">
              <TextInput
                placeholder="Rechercher par produit, code, référence, revendeur ou téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftSection={<IconSearch size={14} />}
                style={{ flex: 1 }}
                size="sm"
              />
              <Select
                placeholder="Revendeur"
                data={revendeurs.map(r => ({ value: r.idRevendeurPonctuel.toString(), label: r.nom_complet }))}
                value={filterRevendeur}
                onChange={setFilterRevendeur}
                searchable
                clearable
                size="sm"
                w={200}
              />
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  setModalType('approvisionnement');
                  setSelectedRevendeur(null);
                  setCart([]);
                  setModalOpened(true);
                }}
                size="sm"
                color="blue"
              >
                Approvisionner
              </Button>
              <Tooltip label="Exporter CSV">
                <ActionIcon onClick={handleExportCSV} variant="outline" size="lg">
                  <IconFileExcel size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter PDF">
                <ActionIcon onClick={handleExportPDF} variant="outline" size="lg">
                  <IconFileTypePdf size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon onClick={handlePrint} variant="outline" size="lg">
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            </TkFilters>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Revendeur</Table.Th>
                  <Table.Th>Produit</Table.Th>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th ta="center">Sortie</Table.Th>
                  <Table.Th ta="center">Vendu</Table.Th>
                  <Table.Th ta="center">Retourné</Table.Th>
                  <Table.Th ta="center">En cours</Table.Th>
                  <Table.Th ta="right">Prix</Table.Th>
                  <Table.Th ta="right">Mt Total</Table.Th>
                  <Table.Th ta="right">Mt Vendu</Table.Th>
                  <Table.Th ta="right">Mt Retourné</Table.Th>
                  <Table.Th ta="right">Mt En cours</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredArticles.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={16} ta="center" py={40}>
                      <Text c="dimmed">Aucun article en cours</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredArticles.map((a) => {
                    const quantite_vendue = a.quantite_vendue || 0;
                    const quantite_retournee = a.quantite_retournee || 0;
                    const quantite_en_cours = a.quantite_restante || 0;
                    const montant_vendu = quantite_vendue * a.prix_unitaire;
                    const montant_retourne = quantite_retournee * a.prix_unitaire;
                    const montant_en_cours = quantite_en_cours * a.prix_unitaire;

                    return (
                      <Table.Tr key={a.idMouvement}>
                        <Table.Td>
                          <Text fw={500} size="sm">{a.nom_revendeur}</Text>
                          <Text size="xs" c="dimmed">{a.telephone_revendeur}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{a.designation}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{a.code_produit}</Text>
                          {a.reference ? (
                            <Text size="xs" c="dimmed">Réf: {a.reference}</Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="xs">{a.categorie || '-'}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color="gray" size="sm">{a.quantite_sortie}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color="teal" size="sm">{quantite_vendue}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color="orange" size="sm">{quantite_retournee}</Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge color={quantite_en_cours > 0 ? 'blue' : 'green'} size="sm">
                            {quantite_en_cours}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{formatNumber(a.prix_unitaire)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} size="sm" c="blue">
                            {formatNumber(a.montant_total)} F
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c="teal">{formatNumber(montant_vendu)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c="orange">{formatNumber(montant_retourne)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} size="sm" c="blue">
                            {formatNumber(montant_en_cours)} F
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{formatDate(a.date_sortie)}</Text>
                        </Table.Td>
                        <Table.Td>{getStatutBadge(a.statut)}</Table.Td>
                        <Table.Td ta="center">
                          <Group gap="xs" justify="center">
                            <Tooltip label="Voir détails">
                              <ActionIcon
                                color="blue"
                                onClick={() => {
                                  loadMouvementDetails(a.idMouvement);
                                  setModalType('details');
                                  setModalOpened(true);
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Vendre">
                              <ActionIcon
                                color="teal"
                                onClick={() => {
                                  setSelectedMouvement(a);
                                  setVenteForm({
                                    quantite: 1,
                                    prix_vente: a.prix_unitaire,
                                    client_nom: '',
                                    notes: ''
                                  });
                                  setModalType('vente');
                                  setModalOpened(true);
                                }}
                                disabled={a.quantite_restante <= 0}
                              >
                                <IconCash size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Retourner">
                              <ActionIcon
                                color="green"
                                onClick={() => {
                                  setSelectedMouvement(a);
                                  setRetourForm({
                                    quantite: 1,
                                    etat: 'BON',
                                    notes: ''
                                  });
                                  setModalType('retour');
                                  setModalOpened(true);
                                }}
                                disabled={a.quantite_restante <= 0}
                              >
                                <IconRotate size={16} />
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
          </Tabs.Panel>

          {/* ============================================================ */}
          {/* TAB: HISTORIQUE */}
          {/* ============================================================ */}
          <Tabs.Panel value="historique" pt="md">
            {/* Filtres */}
            <Paper withBorder p="sm" mb="md" radius="md">
              <Grid align="flex-end">
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Select
                    label="Revendeur"
                    placeholder="Tous"
                    data={[
                      { value: '', label: 'Tous' },
                      ...revendeurs.map(r => ({ value: r.idRevendeurPonctuel.toString(), label: r.nom_complet }))
                    ]}
                    value={filterRevendeur || ''}
                    onChange={(val) => setFilterRevendeur(val || null)}
                    searchable
                    clearable
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Select
                    label="Type"
                    placeholder="Tous"
                    data={[
                      { value: '', label: 'Tous' },
                      { value: 'APPROVISIONNEMENT', label: 'Approvisionnement' },
                      { value: 'VENTE', label: 'Vente' },
                      { value: 'RETOUR', label: 'Retour' }
                    ]}
                    value={filterType || ''}
                    onChange={(val) => setFilterType(val || null)}
                    clearable
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Select
                    label="Statut"
                    placeholder="Tous"
                    data={[
                      { value: '', label: 'Tous' },
                      { value: 'EN_COURS', label: 'En cours' },
                      { value: 'RETOURNE', label: 'Retourné' },
                      { value: 'VENDU', label: 'Vendu' }
                    ]}
                    value={filterStatut || ''}
                    onChange={(val) => setFilterStatut(val || null)}
                    clearable
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Select
                    label="Article"
                    placeholder="Tous"
                    data={[
                      { value: '', label: 'Tous' },
                      ...produitsDisponibles.map(p => ({
                        value: p.idProduit.toString(),
                        label: `${p.designation} (${p.code_produit})`
                      }))
                    ]}
                    value={filterArticle || ''}
                    onChange={(val) => setFilterArticle(val || null)}
                    clearable
                    size="xs"
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <TextInput
                    type="date"
                    label="Début"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Button
                    fullWidth
                    variant="light"
                    onClick={() => {
                      setFilterRevendeur(null);
                      setFilterType(null);
                      setFilterStatut(null);
                      setFilterArticle(null);
                      setDateDebut('');
                      setDateFin('');
                      setSearchTerm('');
                    }}
                    size="xs"
                  >
                    Réinitialiser
                  </Button>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Boutons d'export pour l'historique */}
            <Group mb="md" gap="xs">
              <Text fw={500} size="sm" c="dimmed">
                {filteredHistorique.length} enregistrement(s)
              </Text>
              <div style={{ flex: 1 }} />
              <Tooltip label="Exporter CSV">
                <ActionIcon onClick={handleExportCSV} variant="outline" size="lg">
                  <IconFileExcel size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter PDF">
                <ActionIcon onClick={handleExportPDF} variant="outline" size="lg">
                  <IconFileTypePdf size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon onClick={handlePrint} variant="outline" size="lg">
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea h={500}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Revendeur</Table.Th>
                    <Table.Th>Produit</Table.Th>
                    <Table.Th>Code</Table.Th>
                    <Table.Th ta="center">Qté</Table.Th>
                    <Table.Th ta="right">Prix</Table.Th>
                    <Table.Th ta="right">Montant</Table.Th>
                    <Table.Th>Notes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredHistorique.slice(0, 50).map((h) => {
                    let bgColor = '';
                    switch (h.type_action) {
                      case 'VENTE':
                        bgColor = '#e8f5e9';
                        break;
                      case 'APPROVISIONNEMENT':
                        bgColor = '#e3f2fd';
                        break;
                      case 'RETOUR':
                        bgColor = '#fff3e0';
                        break;
                      default:
                        bgColor = '';
                    }

                    return (
                      <Table.Tr
                        key={h.id}
                        style={{
                          backgroundColor: bgColor,
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <Table.Td>
                          <Text size="xs">{formatDateTime(h.date)}</Text>
                        </Table.Td>
                        <Table.Td>{getTypeActionBadge(h.type_action)}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{h.nom_revendeur}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{h.designation}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{h.code_produit}</Text>
                        </Table.Td>
                        <Table.Td ta="center">{h.quantite}</Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{formatNumber(h.prix_unitaire)} F</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} size="sm" c={h.type_action === 'VENTE' ? 'teal' : 'blue'}>
                            {formatNumber(h.montant)} F
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{h.notes || '-'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Tabs.Panel>

          {/* ============================================================ */}
          {/* TAB: REVENDEURS */}
          {/* ============================================================ */}
          <Tabs.Panel value="revendeurs" pt="md">
            {/* Boutons d'export pour les revendeurs */}
            <Group mb="md" gap="xs">
              <Text fw={500} size="sm" c="dimmed">
                {revendeurs.length} revendeur(s)
              </Text>
              <div style={{ flex: 1 }} />
              <Tooltip label="Exporter CSV">
                <ActionIcon onClick={handleExportCSV} variant="outline" size="lg">
                  <IconFileExcel size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter PDF">
                <ActionIcon onClick={handleExportPDF} variant="outline" size="lg">
                  <IconFileTypePdf size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon onClick={handlePrint} variant="outline" size="lg">
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea h={500}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nom</Table.Th>
                    <Table.Th>Téléphone</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Pièce d'identité</Table.Th>
                    <Table.Th>Statut</Table.Th>
                    <Table.Th ta="center">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {revendeurs.map((r) => (
                    <Table.Tr key={r.idRevendeurPonctuel}>
                      <Table.Td>
                        <Text fw={500}>{r.nom_complet}</Text>
                        {r.notes && <Text size="xs" c="dimmed">{r.notes}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{r.telephone}</Text>
                      </Table.Td>
                      <Table.Td>{r.email || '-'}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue" size="sm">
                          {r.piece_identite} - {r.numero_piece || 'N/A'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={r.est_actif ? 'green' : 'red'}>
                          {r.est_actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap="xs" justify="center">
                          <Tooltip label="Approvisionner">
                            <ActionIcon
                              color="blue"
                              onClick={() => {
                                setSelectedRevendeur(r);
                                setCart([]);
                                setModalType('approvisionnement');
                                setModalOpened(true);
                              }}
                              disabled={!r.est_actif}
                            >
                              <IconPlus size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Modifier">
                            <ActionIcon
                              color="yellow"
                              onClick={() => {
                                setSelectedRevendeur(r);
                                setRevendeurForm({
                                  nom_complet: r.nom_complet,
                                  telephone: r.telephone,
                                  email: r.email || '',
                                  adresse: r.adresse || '',
                                  piece_identite: r.piece_identite || 'CNI',
                                  numero_piece: r.numero_piece || '',
                                  notes: r.notes || ''
                                });
                                setModalType('edit_revendeur');
                                setModalOpened(true);
                              }}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={r.est_actif ? 'Désactiver' : 'Activer'}>
                            <ActionIcon
                              color={r.est_actif ? 'red' : 'green'}
                              onClick={() => handleToggleActif(r)}
                            >
                              {r.est_actif ? <IconX size={16} /> : <IconCheck size={16} />}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Tabs.Panel>

          {/* ============================================================ */}
          {/* TAB: REVENDEURS */}
          {/* ============================================================ */}
          <Tabs.Panel value="revendeurs" pt="md">
            <Group mb="md" gap="xs">
              <Text fw={500} size="sm" c="dimmed">
                {revendeurs.length} revendeur(s)
              </Text>
              <div style={{ flex: 1 }} />
              <Tooltip label="Exporter CSV">
                <ActionIcon onClick={handleExportCSV} variant="outline" size="lg">
                  <IconFileExcel size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Exporter PDF">
                <ActionIcon onClick={handleExportPDF} variant="outline" size="lg">
                  <IconFileTypePdf size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Imprimer">
                <ActionIcon onClick={handlePrint} variant="outline" size="lg">
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nom</Table.Th>
                  <Table.Th>Téléphone</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Pièce d'identité</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {revendeurs.map((r) => (
                  <Table.Tr key={r.idRevendeurPonctuel}>
                    <Table.Td>
                      <Text fw={500}>{r.nom_complet}</Text>
                      {r.notes && <Text size="xs" c="dimmed">{r.notes}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{r.telephone}</Text>
                    </Table.Td>
                    <Table.Td>{r.email || '-'}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue" size="sm">
                        {r.piece_identite} - {r.numero_piece || 'N/A'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={r.est_actif ? 'green' : 'red'}>
                        {r.est_actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap="xs" justify="center">
                        <Tooltip label="Approvisionner">
                          <ActionIcon
                            color="blue"
                            onClick={() => {
                              setSelectedRevendeur(r);
                              setCart([]);
                              setModalType('approvisionnement');
                              setModalOpened(true);
                            }}
                            disabled={!r.est_actif}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Modifier">
                          <ActionIcon
                            color="yellow"
                            onClick={() => {
                              setSelectedRevendeur(r);
                              setRevendeurForm({
                                nom_complet: r.nom_complet,
                                telephone: r.telephone,
                                email: r.email || '',
                                adresse: r.adresse || '',
                                piece_identite: r.piece_identite || 'CNI',
                                numero_piece: r.numero_piece || '',
                                notes: r.notes || ''
                              });
                              setModalType('edit_revendeur');
                              setModalOpened(true);
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={r.est_actif ? 'Désactiver' : 'Activer'}>
                          <ActionIcon
                            color={r.est_actif ? 'red' : 'green'}
                            onClick={() => handleToggleActif(r)}
                          >
                            {r.est_actif ? <IconX size={16} /> : <IconCheck size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* MODAL REVENDEUR */}
      <Modal
        opened={modalOpened && (modalType === 'add_revendeur' || modalType === 'edit_revendeur')}
        onClose={() => setModalOpened(false)}
        title={modalType === 'add_revendeur' ? '➕ Nouveau revendeur ponctuel' : '✏️ Modifier le revendeur'}
        size="md"
        centered
      >
        <Stack>
          <TextInput
            label="Nom complet *"
            placeholder="Nom et prénom"
            value={revendeurForm.nom_complet}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, nom_complet: e.target.value })}
            required
          />
          <TextInput
            label="Téléphone *"
            placeholder="Numéro de téléphone"
            value={revendeurForm.telephone}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, telephone: e.target.value })}
            required
          />
          <TextInput
            label="Email"
            placeholder="Email (optionnel)"
            value={revendeurForm.email}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, email: e.target.value })}
          />
          <TextInput
            label="Adresse"
            placeholder="Adresse (optionnel)"
            value={revendeurForm.adresse}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, adresse: e.target.value })}
          />
          <Select
            label="Pièce d'identité"
            data={[
              { value: 'CNI', label: 'Carte Nationale d\'Identité' },
              { value: 'PASSEPORT', label: 'Passeport' },
              { value: 'PERMIS', label: 'Permis de conduire' },
              { value: 'AUTRE', label: 'Autre' }
            ]}
            value={revendeurForm.piece_identite}
            onChange={(val) => setRevendeurForm({ ...revendeurForm, piece_identite: val || 'CNI' })}
          />
          <TextInput
            label="Numéro de pièce"
            placeholder="Numéro de la pièce"
            value={revendeurForm.numero_piece}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, numero_piece: e.target.value })}
          />
          <Textarea
            label="Notes"
            placeholder="Observations"
            value={revendeurForm.notes}
            onChange={(e) => setRevendeurForm({ ...revendeurForm, notes: e.target.value })}
            rows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpened(false)}>Annuler</Button>
            <Button
              onClick={modalType === 'add_revendeur' ? handleAddRevendeur : handleUpdateRevendeur}
              loading={loading}
            >
              {modalType === 'add_revendeur' ? 'Ajouter' : 'Modifier'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL APPROVISIONNEMENT */}
      <Modal
        opened={modalOpened && modalType === 'approvisionnement'}
        onClose={() => {
          setModalOpened(false);
          setCart([]);
          setApproSearch('');
        }}
        title={`📦 Approvisionnement - ${selectedRevendeur?.nom_complet || 'Sélectionnez un revendeur'}`}
        size="xl"
        centered
      >
        <Stack>
          <Select
            label="Revendeur *"
            placeholder="Sélectionner un revendeur"
            data={revendeurs.filter(r => r.est_actif === 1).map(r => ({
              value: r.idRevendeurPonctuel.toString(),
              label: `${r.nom_complet} (${r.telephone})`
            }))}
            value={selectedRevendeur?.idRevendeurPonctuel?.toString() || null}
            onChange={(val) => {
              const rev = revendeurs.find(r => r.idRevendeurPonctuel.toString() === val);
              setSelectedRevendeur(rev || null);
            }}
            searchable
            required
          />

          <Divider label="Produits à approvisionner" />

          {/* Recherche multicritère : nom, code, référence, catégorie — cliquer un résultat valide le choix */}
          <div>
            <TextInput
              label="Rechercher un produit"
              placeholder="Nom, code, référence ou catégorie…"
              leftSection={<IconSearch size={14} />}
              value={approSearch}
              onChange={(e) => setApproSearch(e.currentTarget.value)}
            />
            {approSearch.trim() !== '' && (
              <Paper withBorder mt={4} radius="md">
                <ScrollArea.Autosize mah={220}>
                  {produitsApproFiltres.length === 0 ? (
                    <Text size="xs" c="dimmed" p="sm">Aucun produit correspondant</Text>
                  ) : produitsApproFiltres.map((p) => (
                    <Group
                      key={p.idProduit}
                      justify="space-between"
                      wrap="nowrap"
                      p="xs"
                      style={{ cursor: 'pointer', borderBottom: '1px solid #f1f3f5' }}
                      onClick={() => {
                        setSelectedProduct(p);
                        setApproForm({ ...approForm, idProduit: p.idProduit, prix_unitaire: p.prix_vente_gros || 0 });
                        setApproSearch('');
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{p.designation}</Text>
                        <Text size="xs" c="dimmed" truncate>
                          {p.code_produit}{p.reference ? ` · Réf: ${p.reference}` : ''}{p.categorie ? ` · ${p.categorie}` : ''}
                        </Text>
                      </div>
                      <Badge size="sm" color={p.qte_stock > 0 ? 'green' : 'red'} variant="light" style={{ flexShrink: 0 }}>
                        Stock: {p.qte_stock}
                      </Badge>
                    </Group>
                  ))}
                </ScrollArea.Autosize>
              </Paper>
            )}
            {selectedProduct && (
              <Text size="xs" c="teal" mt={4}>
                ✓ Produit sélectionné : <b>{selectedProduct.designation}</b> ({selectedProduct.code_produit})
              </Text>
            )}
          </div>

          <Group align="flex-end" wrap="nowrap" gap="md">
            <Select
              label="Produit"
              placeholder="Sélectionner un produit"
              data={produitsDisponibles.map(p => ({
                value: p.idProduit.toString(),
                label: `${p.designation} (${p.code_produit})${p.reference ? ` - Réf: ${p.reference}` : ''} - Stock: ${p.qte_stock}`
              }))}
              value={selectedProduct?.idProduit?.toString() || null}
              onChange={(val) => {
                const product = produitsDisponibles.find(p => p.idProduit.toString() === val);
                setSelectedProduct(product || null);
                if (product) {
                  setApproForm({
                    ...approForm,
                    idProduit: product.idProduit,
                    prix_unitaire: product.prix_vente_gros || 0
                  });
                }
              }}
              searchable
              style={{ flex: 3, minWidth: 0 }}
            />
            <NumberInput
              label="Quantité"
              value={approForm.quantite}
              onChange={(val) => setApproForm({ ...approForm, quantite: Number(val) || 1 })}
              min={1}
              max={selectedProduct?.qte_stock || 1}
              style={{ flex: 0.7, minWidth: 0 }}
            />
            <NumberInput
              label="Prix unitaire (gros)"
              value={approForm.prix_unitaire}
              onChange={(val) => setApproForm({ ...approForm, prix_unitaire: Number(val) || 0 })}
              min={0}
              step={100}
              leftSection="FCFA"
              style={{ flex: 1, minWidth: 0 }}
            />
            <Button
              onClick={addToCart}
              disabled={!selectedProduct}
              leftSection={<IconPlus size={14} />}
              style={{ flex: 0.1, minWidth: 0, alignSelf: 'flex-end' }}
            >
              Ajouter
            </Button>
          </Group>

          {cart.length > 0 && (
            <>
              <ScrollArea h={200}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produit</Table.Th>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Référence</Table.Th>
                      <Table.Th>Qté</Table.Th>
                      <Table.Th>Prix</Table.Th>
                      <Table.Th>Total</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cart.map((item, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{item.designation}</Table.Td>
                        <Table.Td>{item.code_produit}</Table.Td>
                        <Table.Td>{item.reference || '-'}</Table.Td>
                        <Table.Td>{item.quantite}</Table.Td>
                        <Table.Td>{formatNumber(item.prix_unitaire)} F</Table.Td>
                        <Table.Td>{formatNumber(item.total)} F</Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" onClick={() => removeFromCart(idx)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Card withBorder p="sm" bg="blue.0">
                <Group justify="space-between">
                  <Text fw={600}>Total approvisionnement</Text>
                  <Text fw={700} size="lg" c="blue">
                    {formatNumber(cart.reduce((sum, item) => sum + item.total, 0))} FCFA
                  </Text>
                </Group>
              </Card>
            </>
          )}

          <Textarea
            label="Notes"
            placeholder="Observations sur l'approvisionnement"
            value={approForm.notes}
            onChange={(e) => setApproForm({ ...approForm, notes: e.target.value })}
            rows={2}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setModalOpened(false)}>Annuler</Button>
            <Button
              onClick={handleApprovisionnement}
              loading={loading}
              disabled={cart.length === 0 || !selectedRevendeur}
              color="blue"
            >
              Valider l'approvisionnement
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DÉTAILS ARTICLE */}
      <Modal
        opened={modalOpened && modalType === 'details'}
        onClose={() => setModalOpened(false)}
        title={`📊 Détails - ${selectedMouvement?.code_mouvement || ''}`}
        size="xl"
        centered
      >
        {selectedMouvement && (
          <Stack>
            {/* Informations générales */}
            <Card withBorder p="md" bg="blue.0">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Produit</Text>
                  <Text fw={600}>{selectedMouvement.designation}</Text>
                  <Text size="xs" c="dimmed">Code: {selectedMouvement.code_produit}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Revendeur</Text>
                  <Text fw={600}>{selectedMouvement.nom_revendeur}</Text>
                  <Text size="xs" c="dimmed">{selectedMouvement.telephone_revendeur}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Date d'approvisionnement</Text>
                  <Text>{formatDate(selectedMouvement.date_sortie)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Statut</Text>
                  {getStatutBadge(selectedMouvement.statut)}
                </Grid.Col>
              </Grid>
            </Card>

            {/* Statistiques */}
            <Card withBorder p="md">
              <Title order={5} mb="md">Statistiques</Title>
              <SimpleGrid cols={4}>
                <Card withBorder p="sm" bg="gray.0">
                  <Text size="xs" c="dimmed">Quantité sortie</Text>
                  <Text fw={700} size="xl">{selectedMouvement.quantite_sortie}</Text>
                </Card>
                <Card withBorder p="sm" bg="teal.0">
                  <Text size="xs" c="dimmed">Quantité vendue</Text>
                  <Text fw={700} size="xl" c="teal">{selectedMouvement.quantite_vendue || 0}</Text>
                  <Text size="xs" c="dimmed">{formatNumber((selectedMouvement.quantite_vendue || 0) * selectedMouvement.prix_unitaire)} F</Text>
                </Card>
                <Card withBorder p="sm" bg="orange.0">
                  <Text size="xs" c="dimmed">Quantité retournée</Text>
                  <Text fw={700} size="xl" c="orange">{selectedMouvement.quantite_retournee || 0}</Text>
                  <Text size="xs" c="dimmed">{formatNumber((selectedMouvement.quantite_retournee || 0) * selectedMouvement.prix_unitaire)} F</Text>
                </Card>
                <Card withBorder p="sm" bg="blue.0">
                  <Text size="xs" c="dimmed">Quantité en cours</Text>
                  <Text fw={700} size="xl" c="blue">{selectedMouvement.quantite_restante || 0}</Text>
                  <Text size="xs" c="dimmed">{formatNumber((selectedMouvement.quantite_restante || 0) * selectedMouvement.prix_unitaire)} F</Text>
                </Card>
              </SimpleGrid>
            </Card>

            {/* Détails des ventes */}
            {selectedMouvement.details_ventes && selectedMouvement.details_ventes.length > 0 && (
              <Card withBorder p="md">
                <Title order={5} mb="md">💰 Ventes</Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Client</Table.Th>
                      <Table.Th ta="center">Qté</Table.Th>
                      <Table.Th ta="right">Prix</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedMouvement.details_ventes.map((v, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{formatDateTime(v.date_evenement)}</Table.Td>
                        <Table.Td>{v.client_nom || '-'}</Table.Td>
                        <Table.Td ta="center">{v.quantite}</Table.Td>
                        <Table.Td ta="right">{formatNumber(v.prix_unitaire)} F</Table.Td>
                        <Table.Td ta="right">{formatNumber(v.montant)} F</Table.Td>
                        <Table.Td>{v.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}

            {/* Détails des retours */}
            {selectedMouvement.details_retours && selectedMouvement.details_retours.length > 0 && (
              <Card withBorder p="md">
                <Title order={5} mb="md">🔄 Retours</Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="center">Qté</Table.Th>
                      <Table.Th>État</Table.Th>
                      <Table.Th ta="right">Prix</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedMouvement.details_retours.map((r, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{formatDateTime(r.date_evenement)}</Table.Td>
                        <Table.Td ta="center">{r.quantite}</Table.Td>
                        <Table.Td>
                          <Badge color={r.etat === 'BON' ? 'green' : r.etat === 'ABIME' ? 'orange' : 'red'}>
                            {r.etat}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">{formatNumber(r.prix_unitaire)} F</Table.Td>
                        <Table.Td ta="right">{formatNumber(r.montant)} F</Table.Td>
                        <Table.Td>{r.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setModalOpened(false)}>Fermer</Button>
              {(selectedMouvement.quantite_restante || 0) > 0 && (
                <Button color="teal" onClick={() => {
                  setModalType('vente');
                  setVenteForm({
                    quantite: 1,
                    prix_vente: selectedMouvement.prix_unitaire,
                    client_nom: '',
                    notes: ''
                  });
                }}>
                  Vendre
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* MODAL VENTE */}
      <Modal
        opened={modalOpened && modalType === 'vente'}
        onClose={() => setModalOpened(false)}
        title={`💰 Vente - ${selectedMouvement?.code_mouvement || ''}`}
        size="md"
        centered
      >
        {selectedMouvement && (
          <Stack>
            <Alert color="teal" variant="light">
              <Text size="sm">Produit: <strong>{selectedMouvement.designation}</strong></Text>
              <Text size="sm">Revendeur: {selectedMouvement.nom_revendeur}</Text>
              <Text size="sm">Quantité restante: <strong>{selectedMouvement.quantite_restante || 0}</strong></Text>
            </Alert>

            <NumberInput
              label="Quantité à vendre *"
              value={venteForm.quantite}
              onChange={(val) => setVenteForm({ ...venteForm, quantite: Number(val) || 1 })}
              min={1}
              max={selectedMouvement.quantite_restante || 0}
              required
            />

            <NumberInput
              label="Prix de vente *"
              value={venteForm.prix_vente}
              onChange={(val) => setVenteForm({ ...venteForm, prix_vente: Number(val) || 0 })}
              min={0}
              step={100}
              leftSection="FCFA"
              required
            />

            <TextInput
              label="Client"
              placeholder="Nom du client (optionnel)"
              value={venteForm.client_nom}
              onChange={(e) => setVenteForm({ ...venteForm, client_nom: e.target.value })}
            />

            <Textarea
              label="Notes"
              placeholder="Observations sur la vente"
              value={venteForm.notes}
              onChange={(e) => setVenteForm({ ...venteForm, notes: e.target.value })}
              rows={2}
            />

            <Card withBorder p="sm" bg="teal.0">
              <Group justify="space-between">
                <Text fw={600}>Total vente</Text>
                <Text fw={700} size="lg" c="teal">
                  {formatNumber(venteForm.quantite * venteForm.prix_vente)} FCFA
                </Text>
              </Group>
            </Card>

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setModalOpened(false)}>Annuler</Button>
              <Button onClick={handleVente} loading={loading} color="teal">
                Confirmer la vente
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* MODAL RETOUR */}
      <Modal
        opened={modalOpened && modalType === 'retour'}
        onClose={() => setModalOpened(false)}
        title={`🔄 Retour - ${selectedMouvement?.code_mouvement || ''}`}
        size="md"
        centered
      >
        {selectedMouvement && (
          <Stack>
            <Alert color="green" variant="light">
              <Text size="sm">Produit: <strong>{selectedMouvement.designation}</strong></Text>
              <Text size="sm">Revendeur: {selectedMouvement.nom_revendeur}</Text>
              <Text size="sm">Quantité restante: <strong>{selectedMouvement.quantite_restante || 0}</strong></Text>
            </Alert>

            <NumberInput
              label="Quantité à retourner *"
              value={retourForm.quantite}
              onChange={(val) => setRetourForm({ ...retourForm, quantite: Number(val) || 1 })}
              min={1}
              max={selectedMouvement.quantite_restante || 0}
              required
            />

            <Select
              label="État"
              data={[
                { value: 'BON', label: 'Bon' },
                { value: 'ABIME', label: 'Abîmé' },
                { value: 'PERDU', label: 'Perdu' }
              ]}
              value={retourForm.etat}
              onChange={(val) => setRetourForm({ ...retourForm, etat: (val as 'BON' | 'ABIME' | 'PERDU') || 'BON' })}
            />

            <Textarea
              label="Notes"
              placeholder="Observations sur le retour"
              value={retourForm.notes}
              onChange={(e) => setRetourForm({ ...retourForm, notes: e.target.value })}
              rows={2}
            />

            <Card withBorder p="sm" bg="green.0">
              <Group justify="space-between">
                <Text fw={600}>Stock après retour</Text>
                <Text fw={700} size="lg" c="green">
                  {(selectedMouvement.stock_apres_sortie || 0) + retourForm.quantite} unités
                </Text>
              </Group>
            </Card>

            <Group justify="flex-end">
              <Button variant="light" onClick={() => setModalOpened(false)}>Annuler</Button>
              <Button onClick={handleRetour} loading={loading} color="green">
                Confirmer le retour
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default GestionRevendeursPonctuels;