// src/components/decomptes/NouveauDecompte.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Paper,
  ThemeIcon,
  Group,
  Button,
  Loader,
  Center,
  Alert,
  Select,
  TextInput,
  NumberInput,
  Table,
  ActionIcon,
  Badge,
  ScrollArea,
  Divider,
  Grid,
  Tooltip,
  Pagination,
  Modal,
  Checkbox,
} from '@mantine/core';
import {
  IconReceipt,
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconUser,
  IconPackage,
  IconArrowLeft,
  IconShoppingCart,
  IconRefresh,
  IconSearch,
  IconBuildingStore,
  IconTruck,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDb } from '../../database/db';
import { clientRepository } from '../../database/repositories/clientRepository';
import { journalCaisseService } from '../../services/journalCaisseService';


interface NouveauDecompteProps {
  decompteId?: number;
  clientId?: number;
  produitsPreSelectionnes?: any[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Produit {
  idProduit: number;
  idStockRevendeur: number;
  designation: string;
  code_produit: string;
  categorie: string;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  qte_stock: number;
  unite_base?: string;
}

interface DecompteDetail {
  idProduit: number;
  idStockRevendeur: number;
  designation: string;
  code_produit: string;
  categorie: string;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
  qte_stock: number;
  qte_decompte: number;
  total: number;
  unite_base?: string;
}

interface ReapproItem {
  idProduit: number;
  designation: string;
  qte_decompte: number;
  qte_reappro: number;
  stock_principal: number;
  checked: boolean;
  prix_achat: number;
  prix_vente: number;
  commission_pourcentage: number;
}

export default function NouveauDecompte({
  decompteId,
  clientId: clientIdProp,
  produitsPreSelectionnes: produitsPreSelectionnesProp,
  onSuccess,
  onCancel
}: NouveauDecompteProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const locationState = location.state as any;
  const produitsPreSelectionnes = locationState?.produitsPreSelectionnes || produitsPreSelectionnesProp || [];
  const clientIdFromState = locationState?.clientId || clientIdProp || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<number | null>(clientIdFromState || clientIdProp || null);
  const [revendeurs, setRevendeurs] = useState<{ value: string; label: string }[]>([]);
  const [observation, setObservation] = useState('');

  const [produitsDisponibles, setProduitsDisponibles] = useState<Produit[]>([]);
  const [quantites, setQuantites] = useState<Record<number, number>>({});
  const [details, setDetails] = useState<DecompteDetail[]>([]);
  // Modal réapprovisionnement
  const [reapproModalOpened, setReapproModalOpened] = useState(false);
  const [reapproItems, setReapproItems] = useState<ReapproItem[]>([]);
  const [savedDecompteId, setSavedDecompteId] = useState<number | null>(null);
  const [savedCodeRecu, setSavedCodeRecu] = useState('');
  const [processingReappro, setProcessingReappro] = useState(false);

  const [loadingDecompte, setLoadingDecompte] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const getQuantite = (idProduit: number): number => {
    return quantites[idProduit] || 1;
  };

  const updateQuantite = (idProduit: number, value: number) => {
    setQuantites(prev => ({
      ...prev,
      [idProduit]: value > 0 ? value : 1
    }));
  };

  const loadProduitsForClient = useCallback(async (clientIdValue: number) => {
    try {
      const db = await getDb();

      const revendeurCheck = await db.select<any[]>(
        `SELECT idClient, NomComplet FROM clients WHERE idClient = ? AND TypeClient = 'revendeur'`,
        [clientIdValue]
      );

      if (revendeurCheck.length === 0) {
        setProduitsDisponibles([]);
        return [];
      }

      const produits = await db.select<any[]>(
        `SELECT
          sr.idStockRevendeur,
          sr.idProduit,
          p.designation,
          p.code_produit,
          p.categorie,
          sr.prix_achat,
          sr.prix_vente,
          sr.commission_pourcentage,
          p.unite_base,
          sr.qte_stock
        FROM stock_revendeur sr
        INNER JOIN products p ON p.idProduit = sr.idProduit
        WHERE sr.idRevendeur = ?
          AND sr.qte_stock > 0
        ORDER BY p.designation`,
        [clientIdValue]
      );

      const produitsFormatted = produits.map((p: any) => ({
        idStockRevendeur: p.idStockRevendeur,
        idProduit: p.idProduit,
        designation: p.designation || 'Produit',
        code_produit: p.code_produit || '',
        categorie: p.categorie || 'Non categorise',
        prix_achat: p.prix_achat || 0,
        prix_vente: p.prix_vente || 0,
        commission_pourcentage: p.commission_pourcentage || 0,
        qte_stock: p.qte_stock || 0,
        unite_base: p.unite_base || 'piece'
      }));

      setProduitsDisponibles(produitsFormatted);
      return produitsFormatted;

    } catch (err) {
      console.error('Erreur chargement produits:', err);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les produits du revendeur', color: 'red' });
      setProduitsDisponibles([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (produitsPreSelectionnes && produitsPreSelectionnes.length > 0) {
      notifications.show({
        title: 'Stock disponible',
        message: `${produitsPreSelectionnes.length} produit(s) disponibles en stock.`,
        color: 'blue'
      });

      setProduitsDisponibles(produitsPreSelectionnes.map((p: any) => ({
        idProduit: p.idProduit,
        idStockRevendeur: p.idStockRevendeur || 0,
        designation: p.designation || 'Produit',
        code_produit: p.code_produit || '',
        categorie: p.categorie || 'Non categorise',
        prix_achat: p.prix_achat || 0,
        prix_vente: p.prix_vente || 0,
        commission_pourcentage: p.commission_pourcentage || 60,
        qte_stock: p.qte_stock || 0,
        unite_base: p.unite_base || 'piece'
      })));

      const clientIdAUtiliser = clientIdFromState || clientIdProp;
      if (clientIdAUtiliser) {
        setSelectedClientId(clientIdAUtiliser);
      }
    }
  }, [produitsPreSelectionnes, clientIdFromState, clientIdProp]);

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        await loadRevendeurs();

        const clientIdAUtiliser = clientIdFromState || clientIdProp;

        if (clientIdAUtiliser) {
          setSelectedClientId(clientIdAUtiliser);
          await loadProduitsForClient(clientIdAUtiliser);
        } else if (decompteId) {
          await loadDecompteToEdit(decompteId);
        }
      } catch (err) {
        console.error('Erreur initialize:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [decompteId, clientIdProp, clientIdFromState]);

  useEffect(() => {
    const clientIdAUtiliser = clientIdFromState || clientIdProp;
    if (clientIdAUtiliser && revendeurs.length > 0 && !selectedClientId) {
      const clientExiste = revendeurs.some((r: any) => parseInt(r.value) === clientIdAUtiliser);
      if (clientExiste) {
        setSelectedClientId(clientIdAUtiliser);
      }
    }
  }, [clientIdFromState, clientIdProp, revendeurs, selectedClientId]);

  const loadRevendeurs = async () => {
    try {
      const data = await clientRepository.getByType("revendeur");
      const revendeursList = data.map((c: any) => ({
        value: c.idClient.toString(),
        label: c.NomComplet || c.Societe || 'Revendeur sans nom'
      }));
      setRevendeurs(revendeursList);
    } catch (err) {
      console.error('Erreur chargement revendeurs:', err);
      notifications.show({ title: 'Erreur', message: 'Impossible de charger les revendeurs', color: 'red' });
    }
  };

  const loadDecompteToEdit = async (id: number) => {
    try {
      setLoadingDecompte(true);
      setIsEditMode(true);

      const db = await getDb();

      const decompteData = await db.select<any[]>(
        `SELECT d.*, c.NomComplet
         FROM decomptes d
         INNER JOIN clients c ON c.idClient = d.idClient
         WHERE d.idDecompte = ?`,
        [id]
      );

      if (decompteData.length === 0) {
        setError('Decompte non trouve');
        setLoading(false);
        return;
      }

      const decompte = decompteData[0];
      setSelectedClientId(decompte.idClient);
      setObservation(decompte.observation || '');

      await loadProduitsForClient(decompte.idClient);

      const detailsData = await db.select<any[]>(
        `SELECT
          dd.*,
          p.designation,
          p.code_produit,
          p.categorie,
          p.unite_base,
          sr.commission_pourcentage,
          sr.qte_stock
        FROM decompte_details dd
        INNER JOIN products p ON p.idProduit = dd.idProduit
        LEFT JOIN stock_revendeur sr ON sr.idProduit = dd.idProduit AND sr.idRevendeur = dd.idRevendeur
        WHERE dd.idDecompte = ?`,
        [id]
      );

      const detailsFormatted = detailsData.map((d: any) => ({
        idProduit: d.idProduit,
        idStockRevendeur: d.idStockRevendeur || 0,
        designation: d.designation || 'Produit',
        code_produit: d.code_produit || '',
        categorie: d.categorie || 'Non categorise',
        prix_achat: d.prix_achat || 0,
        prix_vente: d.prix_vente || 0,
        commission_pourcentage: d.commission_pourcentage || 0,
        qte_stock: d.qte_stock || 0,
        qte_decompte: d.qte_decompte || 0,
        total: (d.prix_vente || 0) * (d.qte_decompte || 0),
        unite_base: d.unite_base || 'piece'
      }));

      setDetails(detailsFormatted);
      setLoading(false);

    } catch (err) {
      console.error('Erreur chargement decompte:', err);
      setError('Impossible de charger le decompte a modifier');
      setLoading(false);
    } finally {
      setLoadingDecompte(false);
    }
  };

  const handleClientChange = async (value: string | null) => {
    if (clientIdFromState || clientIdProp) return;

    if (!value) {
      setSelectedClientId(null);
      setProduitsDisponibles([]);
      setDetails([]);
      return;
    }

    const clientIdValue = parseInt(value);
    setSelectedClientId(clientIdValue);
    await loadProduitsForClient(clientIdValue);

    if (!isEditMode) {
      setDetails([]);
    }
  };

  const ajouterProduitAuPanier = (produit: Produit, quantite: number) => {
    if (quantite <= 0) {
      notifications.show({ title: 'Erreur', message: 'La quantite doit etre superieure a 0', color: 'red' });
      return;
    }
    if (quantite > produit.qte_stock) {
      notifications.show({ title: 'Stock insuffisant', message: `Stock disponible: ${produit.qte_stock}`, color: 'red' });
      return;
    }

    const existing = details.find((d: DecompteDetail) => d.idProduit === produit.idProduit);
    if (existing) {
      const nouvelleQuantite = existing.qte_decompte + quantite;
      if (nouvelleQuantite > existing.qte_stock) {
        notifications.show({ title: 'Stock insuffisant', message: `Stock disponible: ${existing.qte_stock}`, color: 'red' });
        return;
      }
      setDetails(details.map((d: DecompteDetail) =>
        d.idProduit === produit.idProduit
          ? { ...d, qte_decompte: nouvelleQuantite, total: d.prix_vente * nouvelleQuantite }
          : d
      ));
    } else {
      setDetails([...details, { ...produit, qte_decompte: quantite, total: produit.prix_vente * quantite }]);
    }

    setQuantites(prev => ({ ...prev, [produit.idProduit]: 1 }));
    notifications.show({ title: 'Ajoute', message: `${quantite} x ${produit.designation} ajoute au panier`, color: 'green' });
  };

  const removeProduit = (idProduit: number) => {
    setDetails(details.filter((d: DecompteDetail) => d.idProduit !== idProduit));
  };

  const updateQteDecompte = (idProduit: number, qte: number) => {
    if (qte <= 0) { removeProduit(idProduit); return; }

    const produit = details.find((d: DecompteDetail) => d.idProduit === idProduit);
    if (!produit) return;

    if (qte > produit.qte_stock) {
      notifications.show({ title: 'Stock insuffisant', message: `Stock disponible: ${produit.qte_stock}`, color: 'red' });
      return;
    }

    setDetails(details.map((d: DecompteDetail) =>
      d.idProduit === idProduit
        ? { ...d, qte_decompte: qte, total: d.prix_vente * qte }
        : d
    ));
  };

  const totalVente = details.reduce((sum: number, d: DecompteDetail) => sum + d.total, 0);
  const totalAchat = details.reduce((sum: number, d: DecompteDetail) => sum + (d.prix_achat * d.qte_decompte), 0);
  const totalBenefice = totalVente - totalAchat;
  const totalCommission = details.reduce((sum: number, d: DecompteDetail) => sum + ((d.prix_vente - d.prix_achat) * d.qte_decompte * (d.commission_pourcentage / 100)), 0);
  const montantNet = totalVente - totalCommission;

  const filteredProduits = produitsDisponibles.filter((p: Produit) => {
    const matchSearch = p.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code_produit.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory ? p.categorie === selectedCategory : true;
    return matchSearch && matchCategory;
  });

  const totalPages = Math.ceil(filteredProduits.length / itemsPerPage);
  const paginatedProduits = filteredProduits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categories = [...new Set(produitsDisponibles.map((p: Produit) => p.categorie).filter(Boolean))];

  // ─── Phase 1 : enregistrer le décompte + déstocker revendeur ─────────────────
  const handleSubmit = async () => {
    if (!selectedClientId) {
      notifications.show({ title: 'Erreur', message: 'Selectionnez un revendeur', color: 'red' });
      return;
    }
    if (details.length === 0) {
      notifications.show({ title: 'Erreur', message: 'Ajoutez au moins un produit', color: 'red' });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const db = await getDb();
      const codeRecu = `DCP-${Date.now()}`;

      const result = await db.execute(`
        INSERT INTO decomptes (
          idClient, date_decompte, code_decompte,
          montant_vente, montant_net, statut, observation
        ) VALUES (?, datetime('now'), ?, ?, ?, 'EN_ATTENTE', ?)
      `, [selectedClientId, codeRecu, totalVente, montantNet, observation || null]);

      const idDecompte = Number(result.lastInsertId);

      const items: ReapproItem[] = [];

      for (const detail of details) {
        // Stock principal disponible
        const stockRows = await db.select<any[]>(
          `SELECT qte_stock FROM products WHERE idProduit = ?`, [detail.idProduit]
        );
        const stockPrincipal = stockRows.length > 0 ? (stockRows[0].qte_stock || 0) : 0;

        // Insérer détail (qte_reappro = 0, sera rempli lors de l'appro)
        await db.execute(`
          INSERT INTO decompte_details (
            idDecompte, idProduit, qte_decompte, qte_avant_decompte,
            prix_achat, prix_vente, commission_pourcentage,
            designation, total, qte_reappro
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          idDecompte, detail.idProduit, detail.qte_decompte,
          detail.qte_stock, detail.prix_achat, detail.prix_vente,
          detail.commission_pourcentage || 60,
          detail.designation, detail.total,
        ]);

        // Déstocker le revendeur (les produits ont été vendus)
        await db.execute(`
          UPDATE stock_revendeur
          SET qte_stock = qte_stock - ?
          WHERE idProduit = ? AND idRevendeur = ?
        `, [detail.qte_decompte, detail.idProduit, selectedClientId]);

        // Mouvement revendeur
        await db.execute(`
          INSERT INTO mouvements_revendeur (
            idProduit, idRevendeur, idDecompte,
            type_mouvement, qte_mouvement
          ) VALUES (?, ?, ?, 'DECOMPTE', ?)
        `, [detail.idProduit, selectedClientId, idDecompte, detail.qte_decompte]);

        items.push({
          idProduit: detail.idProduit,
          designation: detail.designation,
          qte_decompte: detail.qte_decompte,
          qte_reappro: Math.min(detail.qte_decompte, stockPrincipal),
          stock_principal: stockPrincipal,
          checked: stockPrincipal > 0,
          prix_achat: detail.prix_achat,
          prix_vente: detail.prix_vente,
          commission_pourcentage: detail.commission_pourcentage || 60,
        });
      }

      // Journal de caisse
      if (!isEditMode && montantNet > 0) {
        try {
          const revendeurNom = revendeurs.find((r: any) => parseInt(r.value) === selectedClientId)?.label;
          await journalCaisseService.ajouterDecompteRevendeur({
            montant: montantNet,
            idDecompte,
            codeDecompte: codeRecu,
            revendeurNom,
          });
        } catch (journalErr) {
          console.warn('Journal caisse:', journalErr);
        }
      }

      notifications.show({
        title: 'Décompte enregistré',
        message: `Code : ${codeRecu} — Choisissez maintenant les produits à réapprovisionner`,
        color: 'green',
      });

      setSavedDecompteId(idDecompte);
      setSavedCodeRecu(codeRecu);
      setReapproItems(items);
      setReapproModalOpened(true);

    } catch (err: any) {
      console.error('Erreur création décompte:', err);
      setError(err?.message || 'Erreur lors de la création du décompte');
      notifications.show({ title: 'Erreur', message: err?.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const updateReapproItem = (idProduit: number, field: 'checked' | 'qte_reappro', value: boolean | number) => {
    setReapproItems(prev => prev.map(i =>
      i.idProduit === idProduit ? { ...i, [field]: value } : i
    ));
  };

  // ─── Phase 2a : approvisionner les produits cochés ────────────────────────
  const handleReapprovisionner = async () => {
    const aApprovisionner = reapproItems.filter(i => i.checked && i.qte_reappro > 0);
    if (aApprovisionner.length === 0) {
      await handlePasserSansReappro();
      return;
    }

    setProcessingReappro(true);
    try {
      const db = await getDb();
      const codeCommande = `CMD-REV-${savedCodeRecu}`;
      const year = new Date().getFullYear();

      // Commande revendeur
      const commandeResult = await db.execute(`
        INSERT INTO commandes (
          code_commande, idClient, type_commande, montant_ht, montant_ttc, statut
        ) VALUES (?, ?, 'REVENDEUR', ?, ?, 'LIVREE')
      `, [codeCommande, selectedClientId, totalAchat, totalVente]);
      const idCommande = Number(commandeResult.lastInsertId);

      for (const detail of reapproItems) {
        await db.execute(`
          INSERT INTO commande_details (idCommande, idProduit, qte_commande, prix_unitaire_vente, remise)
          VALUES (?, ?, ?, ?, 0)
        `, [idCommande, detail.idProduit, detail.qte_decompte, detail.prix_vente]);
      }

      // Réapprovisionner les produits sélectionnés
      let montantHT = 0;
      for (const item of aApprovisionner) {
        const stockAvant = item.stock_principal;

        // Remettre en stock revendeur
        await db.execute(`
          UPDATE stock_revendeur SET qte_stock = qte_stock + ?
          WHERE idProduit = ? AND idRevendeur = ?
        `, [item.qte_reappro, item.idProduit, selectedClientId]);

        // Déduire du stock principal
        await db.execute(
          `UPDATE products SET qte_stock = qte_stock - ? WHERE idProduit = ?`,
          [item.qte_reappro, item.idProduit]
        );

        // Mouvement stock principal
        await db.execute(`
          INSERT INTO mouvements_stock (
            idProduit, type_mouvement, quantite, stock_avant, stock_apres, reference, notes
          ) VALUES (?, 'SORTIE_REAPPRO', ?, ?, ?, ?, ?)
        `, [
          item.idProduit, item.qte_reappro,
          stockAvant, stockAvant - item.qte_reappro,
          `REAPPRO-${savedCodeRecu}`,
          `Réapprovisionnement revendeur #${selectedClientId}`,
        ]);

        // Mettre à jour qte_reappro dans decompte_details
        await db.execute(`
          UPDATE decompte_details SET qte_reappro = ?
          WHERE idDecompte = ? AND idProduit = ?
        `, [item.qte_reappro, savedDecompteId, item.idProduit]);

        montantHT += item.prix_achat * item.qte_reappro;
      }

      // Facture d'approvisionnement
      const montantTTC = montantHT * 1.18;
      const lastFacture = await db.select<any[]>(`
        SELECT code_facture FROM factures_approvisionnement
        WHERE code_facture LIKE 'APP-${year}-%'
        ORDER BY idFactureAppro DESC LIMIT 1
      `);
      let nextNum = 1;
      if (lastFacture.length > 0) {
        const m = lastFacture[0].code_facture.match(/APP-\d+-(\d+)/);
        if (m) nextNum = parseInt(m[1]) + 1;
      }
      const codeFactureAppro = `APP-${year}-${nextNum.toString().padStart(6, '0')}`;

      const factureResult = await db.execute(`
        INSERT INTO factures_approvisionnement (
          code_facture, idRevendeur, idDecompte, date_facture,
          montant_ht, montant_ttc, statut, reference_decompte
        ) VALUES (?, ?, ?, datetime('now'), ?, ?, 'EN_ATTENTE', ?)
      `, [codeFactureAppro, selectedClientId, savedDecompteId, montantHT, montantTTC, savedCodeRecu]);
      const idFactureAppro = Number(factureResult.lastInsertId);

      for (const item of aApprovisionner) {
        await db.execute(`
          INSERT INTO factures_approvisionnement_details (
            idFactureAppro, idProduit, quantite, prix_achat, prix_vente, total_ht, total_ttc
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          idFactureAppro, item.idProduit, item.qte_reappro,
          item.prix_achat, item.prix_vente,
          item.prix_achat * item.qte_reappro,
          item.prix_achat * item.qte_reappro * 1.18,
        ]);
      }

      await db.execute(
        `UPDATE decomptes SET id_facture_approvisionnement = ? WHERE idDecompte = ?`,
        [idFactureAppro, savedDecompteId]
      );

      // Facture revendeur
      const codeFactureRev = `FACT-REV-${savedCodeRecu}`;
      await db.execute(`
        INSERT INTO factures_revendeur (
          idCommande, idRevendeur, code_facture, montant_ht, montant_ttc, commission, statut
        ) VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE')
      `, [idCommande, selectedClientId, codeFactureRev, montantHT, montantTTC, totalCommission]);

      notifications.show({
        title: 'Réapprovisionnement effectué',
        message: `${aApprovisionner.length} produit(s) réapprovisionné(s) — Facture ${codeFactureAppro}`,
        color: 'green',
      });

      setReapproModalOpened(false);
      if (onSuccess) onSuccess(); else navigate('/decomptes');

    } catch (err: any) {
      notifications.show({ title: 'Erreur réappro', message: err?.message, color: 'red' });
    } finally {
      setProcessingReappro(false);
    }
  };

  // ─── Phase 2b : passer sans réapprovisionnement ───────────────────────────
  const handlePasserSansReappro = async () => {
    try {
      const db = await getDb();
      const codeCommande = `CMD-REV-${savedCodeRecu}`;

      const commandeResult = await db.execute(`
        INSERT INTO commandes (
          code_commande, idClient, type_commande, montant_ht, montant_ttc, statut
        ) VALUES (?, ?, 'REVENDEUR', ?, ?, 'EN_ATTENTE')
      `, [codeCommande, selectedClientId, totalAchat, totalVente]);
      const idCommande = Number(commandeResult.lastInsertId);

      for (const detail of reapproItems) {
        await db.execute(`
          INSERT INTO commande_details (idCommande, idProduit, qte_commande, prix_unitaire_vente, remise)
          VALUES (?, ?, ?, ?, 0)
        `, [idCommande, detail.idProduit, detail.qte_decompte, detail.prix_vente]);
      }

      notifications.show({
        title: 'Décompte sans réapprovisionnement',
        message: `Commande ${codeCommande} créée en attente`,
        color: 'blue',
      });

      setReapproModalOpened(false);
      if (onSuccess) onSuccess(); else navigate('/decomptes');

    } catch (err: any) {
      notifications.show({ title: 'Erreur', message: err?.message, color: 'red' });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/decomptes');
    }
  };

  if (loading || loadingDecompte) {
    return (
      <Center py={100}>
        <Loader size="xl" />
        <Text ml="md" c="dimmed">Chargement...</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md" p="md">
      <Paper p="lg" radius="lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <Group justify="space-between">
          <Group gap="md">
            <ThemeIcon size={40} radius="md" color="red" variant="filled">
              <IconReceipt size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} c="white">
                {isEditMode ? 'Modifier le decompte' : 'Nouveau decompte'}
              </Title>
              <Text c="gray.3" size="sm">
                {isEditMode
                  ? 'Modifier un decompte existant'
                  : clientIdFromState || clientIdProp
                    ? `Creer un decompte pour ${revendeurs.find((r: any) => parseInt(r.value) === (clientIdFromState || clientIdProp))?.label || 'le revendeur selectionne'}`
                    : 'Creer un nouveau decompte pour un revendeur'}
              </Text>
            </div>
          </Group>
          <Button variant="light" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={handleCancel}>
            Retour
          </Button>
        </Group>
      </Paper>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Erreur" color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}


      <Card withBorder radius="lg" shadow="sm" p="lg">
        <Grid>
          <Grid.Col span={4}>
            <Select
              label="Revendeur"
              placeholder="Choisir un revendeur"
              searchable
              data={revendeurs}
              value={selectedClientId?.toString() || null}
              onChange={handleClientChange}
              disabled={!!(clientIdFromState || clientIdProp) || isEditMode}
              leftSection={<IconUser size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={8}>
            {selectedClientId && (
              <Paper p="xs" withBorder radius="md" bg="gray.0" mt="auto">
                <Group gap="xs">
                  <IconBuildingStore size={14} color="#4a6cf7" />
                  <Text size="sm" fw={500}>
                    {revendeurs.find((r: any) => parseInt(r.value) === selectedClientId)?.label}
                  </Text>
                  <Badge color="green" variant="light" size="xs">
                    {(clientIdFromState || clientIdProp) ? 'Pre-selectionne' : 'Selectionne'}
                  </Badge>
                  {produitsPreSelectionnes && produitsPreSelectionnes.length > 0 && (
                    <Badge color="blue" variant="light" size="xs">
                      {produitsPreSelectionnes.length} produits pre-selectionnes
                    </Badge>
                  )}
                </Group>
              </Paper>
            )}
          </Grid.Col>
        </Grid>
      </Card>

      {selectedClientId && (
        <Card withBorder radius="lg" shadow="sm" p="lg">
          <Group gap="xs" mb="md" justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="grape" variant="light" radius="md" size="sm">
                <IconPackage size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm" c="blue.4">Produits disponibles</Text>
              <Badge color="green" variant="light" size="xs">{produitsDisponibles.length} en stock</Badge>
            </Group>
            <Tooltip label="Actualiser">
              <ActionIcon onClick={() => selectedClientId && loadProduitsForClient(selectedClientId)} size="sm" variant="subtle">
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Grid>
            <Grid.Col span={5}>
              <TextInput
                placeholder="Rechercher par code, designation..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                leftSection={<IconSearch size={14} />}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                placeholder="Categorie"
                data={categories.map((c: string) => ({ value: c, label: c }))}
                value={selectedCategory}
                onChange={(value) => { setSelectedCategory(value); setCurrentPage(1); }}
                clearable
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Text size="xs" c="dimmed" ta="right" mt={4}>
                Page {currentPage}/{totalPages || 1}
              </Text>
            </Grid.Col>
          </Grid>

          <ScrollArea h={300} mt="xs">
            {filteredProduits.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="xs">
                  <IconPackage size={32} color="#adb5bd" />
                  <Text c="dimmed" size="sm">Aucun produit disponible en stock</Text>
                </Stack>
              </Center>
            ) : (
              <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                    <Table.Th c="white" style={{ width: '10%' }}>Code</Table.Th>
                    <Table.Th c="white" style={{ width: '25%' }}>Designation</Table.Th>
                    <Table.Th c="white" style={{ width: '12%' }}>Categorie</Table.Th>
                    <Table.Th c="white" style={{ width: '8%' }} ta="center">Unite</Table.Th>
                    <Table.Th c="white" style={{ width: '8%' }} ta="center">Stock</Table.Th>
                    <Table.Th c="white" style={{ width: '12%' }} ta="right">Prix</Table.Th>
                    <Table.Th c="white" style={{ width: '10%' }} ta="center">Qte</Table.Th>
                    <Table.Th c="white" style={{ width: '8%' }} ta="center">Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedProduits.map((product: Produit) => {
                    const isRupture = (product.qte_stock || 0) <= 0;
                    const quantite = getQuantite(product.idProduit);
                    return (
                      <Table.Tr key={product.idProduit} style={isRupture ? { backgroundColor: '#fff5f5' } : {}}>
                        <Table.Td><Text fw={500} size="xs" lineClamp={1}>{product.code_produit}</Text></Table.Td>
                        <Table.Td><Text fw={500} size="xs" lineClamp={2}>{product.designation}</Text></Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="xs" fullWidth>{product.categorie || '-'}</Badge>
                        </Table.Td>
                        <Table.Td ta="center"><Text size="xs">{product.unite_base || 'pc'}</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge
                            color={isRupture ? 'red' : (product.qte_stock || 0) < 5 ? 'orange' : 'green'}
                            variant={isRupture ? 'filled' : 'light'}
                            size="xs"
                          >
                            {product.qte_stock || 0}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600} c="blue" size="xs">{product.prix_vente.toLocaleString()} F</Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          {isRupture ? (
                            <Text size="xs" c="dimmed">Rupture</Text>
                          ) : (
                            <NumberInput
                              size="xs"
                              min={1}
                              max={product.qte_stock || 0}
                              value={quantite}
                              onChange={(val) => updateQuantite(product.idProduit, Number(val) || 1)}
                              style={{ width: 60 }}
                              hideControls
                            />
                          )}
                        </Table.Td>
                        <Table.Td ta="center">
                          {!isRupture && (
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="green"
                              onClick={() => {
                                const qte = quantites[product.idProduit] || 1;
                                if (qte > 0) {
                                  ajouterProduitAuPanier(product, qte);
                                } else {
                                  notifications.show({ title: 'Erreur', message: 'Veuillez saisir une quantite valide', color: 'red' });
                                }
                              }}
                            >
                              <IconPlus size={16} />
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>

          {totalPages > 1 && (
            <Group justify="center" mt="xs">
              <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="xs" />
            </Group>
          )}
        </Card>
      )}

      {details.length > 0 ? (
        <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#fafafa' }}>
          <Group gap="xs" mb="xs" justify="space-between">
            <Group gap="xs">
              <ThemeIcon color="orange" variant="light" radius="md" size="sm">
                <IconShoppingCart size={14} />
              </ThemeIcon>
              <Text fw={600} size="sm" c="blue.4">Panier</Text>
              <Badge color="orange" variant="light" size="xs">{details.length} produits</Badge>
            </Group>
            <Text size="xs" c="dimmed">Total: {totalVente.toLocaleString()} FCFA</Text>
          </Group>

          <ScrollArea h={200}>
            <Table striped highlightOnHover verticalSpacing="xs" horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                  <Table.Th c="white" style={{ width: '10%' }}>Code</Table.Th>
                  <Table.Th c="white" style={{ width: '20%' }}>Designation</Table.Th>
                  <Table.Th c="white" style={{ width: '10%' }}>Categorie</Table.Th>
                  <Table.Th c="white" style={{ width: '8%' }} ta="center">Unite</Table.Th>
                  <Table.Th c="white" style={{ width: '10%' }} ta="center">Qte</Table.Th>
                  <Table.Th c="white" style={{ width: '12%' }} ta="right">PA</Table.Th>
                  <Table.Th c="white" style={{ width: '12%' }} ta="right">PV</Table.Th>
                  <Table.Th c="white" style={{ width: '13%' }} ta="right">Total</Table.Th>
                  <Table.Th c="white" style={{ width: '5%' }} ta="center">Sup</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {details.map((detail: DecompteDetail) => (
                  <Table.Tr key={detail.idProduit}>
                    <Table.Td><Text fw={500} size="xs">{detail.code_produit}</Text></Table.Td>
                    <Table.Td><Text fw={500} size="xs" lineClamp={1}>{detail.designation}</Text></Table.Td>
                    <Table.Td><Badge variant="light" size="xs" fullWidth>{detail.categorie || '-'}</Badge></Table.Td>
                    <Table.Td ta="center"><Text size="xs">{detail.unite_base || 'pc'}</Text></Table.Td>
                    <Table.Td ta="center">
                      <NumberInput
                        value={detail.qte_decompte}
                        onChange={(val) => updateQteDecompte(detail.idProduit, Number(val) || 0)}
                        min={1}
                        max={detail.qte_stock}
                        size="xs"
                        w={55}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td ta="right"><Text size="xs" c="dimmed">{detail.prix_achat.toLocaleString()} F</Text></Table.Td>
                    <Table.Td ta="right"><Text fw={600} c="blue" size="xs">{detail.prix_vente.toLocaleString()} F</Text></Table.Td>
                    <Table.Td ta="right"><Text fw={700} c="green" size="xs">{detail.total.toLocaleString()} F</Text></Table.Td>
                    <Table.Td ta="center">
                      <ActionIcon color="red" onClick={() => removeProduit(detail.idProduit)} size="sm" variant="subtle">
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Divider my="xs" />

          <Group justify="space-between" gap="xs">
            <Group gap="xs">
              <Badge size="sm" variant="light" color="blue">Total Vente: {totalVente.toLocaleString()} F</Badge>
              <Badge size="sm" variant="light" color="green">Benefice: {totalBenefice.toLocaleString()} F</Badge>
              <Badge size="sm" variant="light" color="orange">Commission: {totalCommission.toLocaleString()} F</Badge>
              <Badge size="sm" variant="filled" color="green">Net: {montantNet.toLocaleString()} F</Badge>
            </Group>
          </Group>
        </Card>
      ) : (
        <Card withBorder radius="lg" shadow="sm" p="lg" style={{ backgroundColor: '#fafafa' }}>
          <Group gap="xs" mb="xs">
            <ThemeIcon color="orange" variant="light" radius="md" size="sm">
              <IconShoppingCart size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm" c="blue.4">Panier</Text>
            <Badge color="orange" variant="light" size="xs">0 produits</Badge>
          </Group>

          <Center py={40}>
            <Stack align="center" gap="xs">
              <IconShoppingCart size={48} color="#adb5bd" stroke={1.5} />
              <Text c="dimmed" size="sm">Votre panier est vide</Text>
              <Text c="dimmed" size="xs">Ajoutez des produits depuis la liste ci-dessus</Text>
              {produitsPreSelectionnes && produitsPreSelectionnes.length > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  color="blue"
                  leftSection={<IconPackage size={14} />}
                  onClick={() => {
                    const produitsAvecStock = (produitsPreSelectionnes as any[]).filter((p: any) => p.qte_stock > 0);
                    if (produitsAvecStock.length === 0) {
                      notifications.show({ title: 'Attention', message: 'Aucun produit en stock disponible', color: 'orange' });
                      return;
                    }
                    const produitsAAjouter: DecompteDetail[] = produitsAvecStock.map((p: any) => ({
                      idProduit: p.idProduit,
                      idStockRevendeur: p.idStockRevendeur || 0,
                      designation: p.designation || 'Produit',
                      code_produit: p.code_produit || '',
                      categorie: p.categorie || 'Non categorise',
                      prix_achat: p.prix_achat || 0,
                      prix_vente: p.prix_vente || 0,
                      commission_pourcentage: p.commission_pourcentage || 60,
                      qte_stock: p.qte_stock || 0,
                      qte_decompte: 1,
                      total: (p.prix_vente || 0) * 1,
                      unite_base: p.unite_base || 'piece'
                    }));
                    setDetails(produitsAAjouter);
                    notifications.show({ title: 'Succes', message: `${produitsAAjouter.length} produit(s) ajoutes au panier`, color: 'green' });
                  }}
                >
                  Ajouter {(produitsPreSelectionnes as any[]).filter((p: any) => p.qte_stock > 0).length} produits en stock
                </Button>
              )}
            </Stack>
          </Center>
        </Card>
      )}


      <Card withBorder radius="lg" shadow="sm" p="lg">
        <TextInput
          label="Observation"
          placeholder="Ajouter une remarque (optionnel)"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          size="sm"
        />
      </Card>

      {/* Boutons d'action */}
      <Group justify="flex-end" mt="md">
        <Button variant="outline" onClick={handleCancel} size="sm">
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          loading={saving}
          color="blue"
          size="sm"
          disabled={details.length === 0}
        >
          {decompteId ? 'Modifier le décompte' : 'Créer le décompte'}
        </Button>
      </Group>

      {/* ── Modal réapprovisionnement ─────────────────────────────────────── */}
      <Modal
        opened={reapproModalOpened}
        onClose={() => {}}
        title={
          <Group gap="sm">
            <ThemeIcon color="blue" variant="light" radius="md">
              <IconTruck size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Réapprovisionnement</Text>
              <Text size="xs" c="dimmed">Décompte {savedCodeRecu}</Text>
            </div>
          </Group>
        }
        size="xl"
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="md">
          <Alert color="blue" variant="light" icon={<IconTruck size={16} />}>
            Le décompte a été enregistré. Cochez les produits à réapprovisionner
            et ajustez les quantités selon la disponibilité.
          </Alert>

          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#1a1a2e' }}>
                  <Table.Th c="white" w={40}></Table.Th>
                  <Table.Th c="white">Produit</Table.Th>
                  <Table.Th c="white" ta="center">Qté décomptée</Table.Th>
                  <Table.Th c="white" ta="center">Stock principal</Table.Th>
                  <Table.Th c="white" ta="center">Qté à approvisionner</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reapproItems.map((item) => (
                  <Table.Tr
                    key={item.idProduit}
                    style={!item.checked ? { opacity: 0.5 } : {}}
                  >
                    <Table.Td>
                      <Checkbox
                        checked={item.checked}
                        onChange={(e) => updateReapproItem(item.idProduit, 'checked', e.currentTarget.checked)}
                        disabled={item.stock_principal === 0}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{item.designation}</Text>
                      {item.stock_principal === 0 && (
                        <Badge color="red" size="xs" variant="light">Stock principal épuisé</Badge>
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge color="orange" variant="light">{item.qte_decompte}</Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        color={item.stock_principal > 0 ? 'green' : 'red'}
                        variant={item.stock_principal === 0 ? 'filled' : 'light'}
                      >
                        {item.stock_principal}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <NumberInput
                        value={item.qte_reappro}
                        onChange={(val) => updateReapproItem(item.idProduit, 'qte_reappro', Number(val) || 0)}
                        min={0}
                        max={item.stock_principal}
                        disabled={!item.checked || item.stock_principal === 0}
                        size="xs"
                        w={80}
                        hideControls
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Divider />

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {reapproItems.filter(i => i.checked && i.qte_reappro > 0).length} produit(s) sélectionné(s)
            </Text>
            <Group gap="sm">
              <Button
                variant="outline"
                color="gray"
                leftSection={<IconPlayerSkipForward size={16} />}
                onClick={handlePasserSansReappro}
                loading={processingReappro}
              >
                Passer sans approvisionnement
              </Button>
              <Button
                color="blue"
                leftSection={<IconTruck size={16} />}
                onClick={handleReapprovisionner}
                loading={processingReappro}
                disabled={!reapproItems.some(i => i.checked && i.qte_reappro > 0)}
              >
                Approvisionner les sélectionnés
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
