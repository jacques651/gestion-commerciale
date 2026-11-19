// src/components/caisse/JournalCaisse.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack, Card, Title, Text, Group, Button, Table, 
  Pagination, Modal, Divider, ThemeIcon,
  SimpleGrid, Select, TextInput, Badge, Flex, Paper,
  Loader, Center, NumberInput, ScrollArea, Tabs, 
  Alert, Grid, Textarea, ActionIcon, Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCash, IconSearch, IconRefresh, IconPrinter,
  IconPlus, IconCalendar, IconMoneybag,
  IconArrowUpRight, IconArrowDownRight, IconMinus,
  IconFileText, IconAlertCircle, IconDownload,
  IconUser, IconClock, IconChartBar, IconFilter,
  IconEye, IconEyeOff, IconX, IconReportMoney
} from '@tabler/icons-react';
import {
  journalCaisseService,
  libelleModePaiement,
  MODES_PAIEMENT,
  ModePaiement,
  MoyenPaiement,
} from '../../services/journalCaisseService';
import SelecteurModePaiement from '../common/SelecteurModePaiement';
import {
  construireCssImpression,
  formatImpressionService,
  FormatPapier,
  optionsFormatPapier,
} from '../../utils/printFormats';
import { sessionCaisseService } from '../../services/sessionCaisseService';
import { GestionSession } from './GestionSession';
import { RapportsVente } from './RapportsVente';
import { rapportVenteService, RapportVente } from '../../services/rapportVenteService';
import { getDb } from '../../database/db';
import { saveText } from '../../utils/fileExport';
import TkFilters from '../TkFilters';
import { transactionService } from '../../services/transactionFacade';
import type { TransactionJournalView } from '../../services/transactionReadSource';
import { useTransactionContext } from '../../hooks/useTransactionSnapshot';
import { JournalOriginCell } from '../ventes/TransactionReadDetails';
import { originLabel } from '../ventes/TransactionsSummary';

interface JournalEntry {
  idJournal: number;
  code_journal: string;
  date_journal: string;  // ✅ Cette colonne existe dans journal_caisse
  type_mouvement: 'ENTREE' | 'SORTIE';
  categorie: string;
  designation: string;
  montant: number;
  solde_apres: number;
  reference: string;
  idReference: number;
  notes: string;
  created_at: string;
  idSession?: number;
  idUtilisateur?: number;
  nom_utilisateur?: string;
  /** Mode de paiement · null = « Non précisé » (opérations historiques) */
  mode_paiement?: string | null;
  /** Libellé précis du moyen (Orange Money, Wave, mode « Autre »…) */
  mode_paiement_detail?: string | null;
  /** Fond de caisse de la session rattachée */
  report?: number;
}

interface ChargeFonctionnement {
  idCharge: number;
  code_charge: string;
  date_charge: string;
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: string;
  reference_paiement: string;
  idJournal: number;
  notes: string;
  created_at: string;
}

interface RecapJournalier {
  date_recap: string;
  solde_initial: number;
  total_entrees: number;
  total_sorties: number;
  solde_final: number;
  total_ventes_comptoir: number;
  total_reglements_factures: number;
  total_decomptes_revendeurs: number;
  total_charges: number;
}

interface SessionCaisse {
  idSession: number;
  idUtilisateur: number;
  code_session: string;
  nom_operateur: string;
  date_ouverture: string;
  date_fermeture?: string;
  solde_initial: number;
  solde_ouverture: number;
  solde_calcule?: number;
  solde_declare?: number;
  ecart: number;
  total_entrees: number;
  total_sorties: number;
  total_ventes: number;
  total_reglements: number;
  total_decomptes: number;
  total_charges: number;
  statut: 'OUVERTE' | 'FERMEE' | 'BLOQUEE';
  notes_ouverture?: string;
  notes_fermeture?: string;
  nom_utilisateur?: string;
  created_at: string;
}

const categoriesCharges = [
  { value: 'EAU', label: 'Eau' },
  { value: 'ELECTRICITE', label: 'Électricité' },
  { value: 'LOYER', label: 'Loyer' },
  { value: 'SALAIRE', label: 'Salaire' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'AUTRE', label: 'Autres charges' }
];

const categorieLabels: Record<string, string> = {
  'VENTE_COMPTOIR': 'Vente comptoir',
  'REGLEMENT_FACTURE': 'Règlement facture',
  'DECOMPTE_REVENDEUR': 'Décompte revendeur',
  'CHARGE_FONCTIONNEMENT': 'Charge fonctionnement',
  'AUTRE_ENTREE': 'Autre entrée',
  'AUTRE_SORTIE': 'Autre sortie'
};

const categorieColors: Record<string, string> = {
  'VENTE_COMPTOIR': 'teal',
  'REGLEMENT_FACTURE': 'green',
  'DECOMPTE_REVENDEUR': 'orange',
  'CHARGE_FONCTIONNEMENT': 'red',
  'AUTRE_ENTREE': 'blue',
  'AUTRE_SORTIE': 'gray'
};

// Formatage de date personnalisée
const formatDateCustom = (dateStr: string): string => {
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

const formatDateSimple = (dateStr: string): string => {
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

type JournalFilters = {
  selectedSession: number | null;
  filterOperateur: string | null;
  filterType: string | null;
  filterCategorie: string | null;
  filterMode: string | null;
  modePeriode: 'JOUR' | 'PERIODE' | 'TOUT';
  selectedDate: string;
  dateDebut: string;
  dateFin: string;
  showFilters: boolean;
};

const JOURNAL_FILTERS_STORAGE_KEY = 'gc_journal_filters';
const todayIso = () => new Date().toISOString().split('T')[0];
const defaultJournalFilters = (): JournalFilters => ({
  selectedSession: null,
  filterOperateur: null,
  filterType: null,
  filterCategorie: null,
  filterMode: null,
  modePeriode: 'JOUR',
  selectedDate: todayIso(),
  dateDebut: todayIso(),
  dateFin: todayIso(),
  showFilters: true,
});

const readJournalFilters = (): JournalFilters => {
  try {
    const saved = JSON.parse(localStorage.getItem(JOURNAL_FILTERS_STORAGE_KEY) || '{}');
    return { ...defaultJournalFilters(), ...saved };
  } catch {
    return defaultJournalFilters();
  }
};

export const JournalCaisse: React.FC = () => {
  const navigate = useNavigate();
  const savedFilters = readJournalFilters();
  const [loading, setLoading] = useState(true);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const txContext = useTransactionContext();
  const [originFilter, setOriginFilter] = useState<string | null>(null);
  const [journalLinks, setJournalLinks] = useState<Record<number, TransactionJournalView>>({});
  const [originError, setOriginError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setJournalLinks({}); setOriginError(null);
    if (!txContext || !journalEntries.length) return;
    transactionService.readJournal(journalEntries.map(entry => entry.idJournal), txContext).then(rows => {
      if (current) setJournalLinks(Object.fromEntries(rows.map(row => [row.idJournal, row])));
    }).catch((reason: unknown) => { if (current) setOriginError(reason instanceof Error ? reason.message : 'Origines indisponibles.'); });
    return () => { current = false; };
  }, [journalEntries, txContext]);
  const [charges, setCharges] = useState<ChargeFonctionnement[]>([]);
  const [recap, setRecap] = useState<RecapJournalier | null>(null);
  const [soldeActuel, setSoldeActuel] = useState(0);
  // Nombre total d'écritures dans le journal, toutes dates confondues.
  // Sert à détecter le cas « vue du jour vide alors que l'historique existe »
  // (typiquement juste après une mise à jour de l'application).
  const [totalHistorique, setTotalHistorique] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(savedFilters.selectedDate);
  // Mode de consultation : le journal ne se limite plus au jour courant.
  // JOUR = une journée · PERIODE = intervalle libre · TOUT = tout l'historique
  const [modePeriode, setModePeriode] = useState<'JOUR' | 'PERIODE' | 'TOUT'>(savedFilters.modePeriode);
  const [dateDebut, setDateDebut] = useState<string>(savedFilters.dateDebut);
  const [dateFin, setDateFin] = useState<string>(savedFilters.dateFin);
  const [filterMode, setFilterMode] = useState<string | null>(savedFilters.filterMode);
  // Report (fond de caisse) applicable à la période/session consultée.
  const [reportPeriode, setReportPeriode] = useState(0);
  const [activeTab, setActiveTab] = useState<string | null>('journal');
  const [currentPage, setCurrentPage] = useState(1);
  const [chargeModalOpened, setChargeModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<SessionCaisse[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(savedFilters.selectedSession);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [filterOperateur, setFilterOperateur] = useState<string | null>(savedFilters.filterOperateur);
  const [filterType, setFilterType] = useState<string | null>(savedFilters.filterType);
  const [filterCategorie, setFilterCategorie] = useState<string | null>(savedFilters.filterCategorie);
  const [showFilters, setShowFilters] = useState(savedFilters.showFilters);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [nouveauType, setNouveauType] = useState<'ENTREE' | 'SORTIE' | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [releveTerminee, setReleveTerminee] = useState(false);
  
  const [chargeForm, setChargeForm] = useState({
    designation: '',
    montant: 0,
    beneficiaire: '',
    categorie_charge: 'AUTRE',
    reference_paiement: '',
    mode_paiement: 'ESPECES' as ModePaiement,
    notes: ''
  });
  // Moyen de paiement de la charge (référentiel extensible).
  const [chargeMoyen, setChargeMoyen] = useState<MoyenPaiement | null>(null);
  // Référentiel des moyens de paiement (pour le filtre du journal).
  const [moyensListe, setMoyensListe] = useState<MoyenPaiement[]>([]);

  // Format d'impression : initialisé avec le format défini dans les Paramètres,
  // modifiable au coup par coup avant chaque impression.
  const [formatImpression, setFormatImpression] = useState<FormatPapier>('A4');

  useEffect(() => {
    formatImpressionService.getFormatDefaut()
      .then(setFormatImpression)
      .catch(() => setFormatImpression('A4'));
  }, []);

  const itemsPerPage = 15;

  const getSessionOperateurLabel = (session: SessionCaisse) =>
    session.nom_operateur || session.nom_utilisateur || 'Inconnu';

  // Charger les sessions
  const loadSessions = async (preferActive = false) => {
    try {
      const db = await getDb();
      const sessionsData = await db.select<any[]>(`
        SELECT
          s.*,
          u.nom as nom_utilisateur
        FROM sessions_caisse s
        LEFT JOIN utilisateurs u ON s.idUtilisateur = u.id
        ORDER BY s.date_ouverture DESC
        LIMIT 50
      `);
      setSessions(sessionsData);

      const active = sessionsData.find((s: any) => s.statut === 'OUVERTE');
      const selectedExists = selectedSession != null
        && sessionsData.some((s: any) => s.idSession === selectedSession);

      // Par défaut, on se cale sur le poste actuellement ouvert. Cela garantit
      // qu'après une relève, le journal s'ouvre directement sur la nouvelle
      // gestion et apparaît donc vide tant qu'aucun mouvement n'a été saisi.
      if (active && (preferActive || selectedSession === null || !selectedExists)) {
        setSelectedSession(active.idSession);
      } else if (!selectedExists && selectedSession !== null) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
    }
  };

  const chargerDonnees = async () => {
  setLoading(true);
  try {
    const db = await getDb();
    
    const tableExists = await db.select<any[]>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='journal_caisse'
    `);
    
    if (tableExists.length === 0) {
      console.warn('⚠️ Table journal_caisse non trouvée');
      setJournalEntries([]);
      setCharges([]);
      setSoldeActuel(0);
      setLoading(false);
      return;
    }
    
    // Construire la requête avec filtres
    let whereClause = '';
    const params: any[] = [];
    
    if (selectedSession) {
      whereClause = ' WHERE j.idSession = ?';
      params.push(selectedSession);
    } else if (modePeriode === 'TOUT') {
      // Tout l'historique : aucune restriction de date. Les opérations des
      // installations précédentes (base conservée) redeviennent visibles.
      whereClause = ' WHERE 1=1';
    } else if (modePeriode === 'PERIODE') {
      whereClause = ' WHERE j.date_journal >= ? AND j.date_journal <= ?';
      params.push(dateDebut + ' 00:00:00', dateFin + ' 23:59:59');
    } else {
      const startDate = selectedDate + ' 00:00:00';
      const endDate = selectedDate + ' 23:59:59';
      whereClause = ' WHERE j.date_journal >= ? AND j.date_journal <= ?';
      params.push(startDate, endDate);
    }

    if (filterMode && filterMode !== 'TOUS') {
      // NON_PRECISE cible les opérations antérieures à l'ajout du mode de paiement
      if (filterMode === 'NON_PRECISE') {
        whereClause += ' AND (j.mode_paiement IS NULL OR j.mode_paiement = \'\')';
      } else {
        const moyen = moyensListe.find(m => m.code === filterMode);
        if (moyen) {
          // Moyen précis : on retient les écritures portant ce libellé, ainsi que
          // les écritures anciennes (sans détail) de la même famille.
          whereClause += ' AND (j.mode_paiement_detail = ? OR (j.mode_paiement_detail IS NULL AND j.mode_paiement = ?))';
          params.push(moyen.libelle, moyen.categorie);
        } else {
          // Compat : valeur = catégorie (ESPECES, MOBILE_MONEY…)
          whereClause += ' AND j.mode_paiement = ?';
          params.push(filterMode);
        }
      }
    }

    if (filterOperateur && filterOperateur !== 'TOUS') {
      whereClause += params.length > 0 ? ' AND j.idUtilisateur = ?' : ' WHERE j.idUtilisateur = ?';
      params.push(parseInt(filterOperateur));
    }
    
    if (filterType && filterType !== 'TOUS') {
      whereClause += params.length > 0 ? ' AND j.type_mouvement = ?' : ' WHERE j.type_mouvement = ?';
      params.push(filterType);
    }
    
    if (filterCategorie && filterCategorie !== 'TOUS') {
      whereClause += params.length > 0 ? ' AND j.categorie = ?' : ' WHERE j.categorie = ?';
      params.push(filterCategorie);
    }
    
    // ✅ REQUÊTE CORRIGÉE - Colonnes explicitement listées
    let query = `
      SELECT 
        j.idJournal,
        j.code_journal,
        j.date_journal,
        j.type_mouvement,
        j.categorie,
        j.designation,
        j.montant,
        j.solde_apres,
        j.reference,
        j.idReference,
        j.idUtilisateur,
        j.idSession,
        j.notes,
        j.mode_paiement,
        j.mode_paiement_detail,
        j.created_at,
        u.nom as nom_utilisateur,
        s.solde_initial as report
      FROM journal_caisse j
      LEFT JOIN utilisateurs u ON j.idUtilisateur = u.id
      LEFT JOIN sessions_caisse s ON j.idSession = s.idSession
      ${whereClause}
      ORDER BY j.date_journal ASC
    `;
    
    const entries = await db.select<any[]>(query, params);

    console.log(`📊 ${entries.length} mouvements trouvés`);
    setJournalEntries(entries);

    // --- Report (fond de caisse) applicable à la vue courante --------------
    // Sans lui, le total général du journal était calculé à tort comme
    // « entrées − sorties » seulement.
    let report = 0;
    if (selectedSession) {
      const s = await db.select<any[]>(
        `SELECT solde_initial FROM sessions_caisse WHERE idSession = ?`,
        [selectedSession]
      );
      report = s[0]?.solde_initial || 0;
    } else if (modePeriode !== 'TOUT') {
      const debut = modePeriode === 'PERIODE' ? dateDebut : selectedDate;
      const anterieur = await db.select<any[]>(
        `SELECT solde_apres FROM journal_caisse
         WHERE date_journal < ?
         ORDER BY idJournal DESC LIMIT 1`,
        [debut + ' 00:00:00']
      );
      report = anterieur[0]?.solde_apres || 0;
    }
    setReportPeriode(report);

    // --- Charges de la même période / session -----------------------------
    let chargesQuery = `
      SELECT
        c.*,
        COALESCE(c.idSession, j.idSession) as idSession
      FROM charges_fonctionnement c
      LEFT JOIN journal_caisse j ON j.idJournal = c.idJournal
      WHERE 1=1
    `;
    const chargesParams: any[] = [];
    if (selectedSession) {
      chargesQuery += ` AND COALESCE(c.idSession, j.idSession) = ?`;
      chargesParams.push(selectedSession);
    } else if (modePeriode === 'PERIODE') {
      chargesQuery += ` AND date(c.date_charge) >= ? AND date(c.date_charge) <= ?`;
      chargesParams.push(dateDebut, dateFin);
    } else if (modePeriode === 'JOUR') {
      chargesQuery += ` AND date(c.date_charge) = ?`;
      chargesParams.push(selectedDate);
    }
    chargesQuery += ` ORDER BY c.date_charge DESC`;
    try {
      const chargesData = await db.select<any[]>(chargesQuery, chargesParams);
      setCharges(chargesData as ChargeFonctionnement[]);
    } catch (e) {
      console.error('Erreur chargement charges:', e);
      setCharges([]);
    }

    // --- Solde global de la caisse ----------------------------------------
    try {
      setSoldeActuel(await journalCaisseService.getSoldeActuel());
    } catch (e) {
      console.error('Erreur calcul solde:', e);
    }

    // --- Nombre total d'écritures (tout l'historique) ---------------------
    try {
      const cnt = await db.select<any[]>(`SELECT COUNT(*) as n FROM journal_caisse`);
      setTotalHistorique(Number(cnt[0]?.n || 0));
    } catch (e) {
      console.error('Erreur comptage historique:', e);
    }

    // --- Récapitulatif journalier (uniquement en mode « jour ») -----------
    if (modePeriode === 'JOUR' && !selectedSession) {
      try {
        setRecap(await journalCaisseService.getRecapJournalier(selectedDate));
      } catch (e) {
        console.error('Erreur récapitulatif:', e);
        setRecap(null);
      }
    } else {
      setRecap(null);
    }

  } catch (error) {
    console.error('❌ Erreur chargement:', error);
    notifications.show({
      title: 'Erreur',
      message: 'Impossible de charger les données',
      color: 'red'
    });
  } finally {
    setLoading(false);
  }
};

  // Charger les sessions dès l'ouverture de l'écran : sans cela, le filtre
  // Session reste vide et le poste courant ne peut pas être présélectionné.
  useEffect(() => {
    let active = true;
    (async () => {
      await loadSessions();
      if (active) setSessionsReady(true);
    })();
    return () => { active = false; };
  }, []);


  // Les filtres restent en place entre deux ouvertures de l'écran. La session
  // est toutefois remplacée par le nouveau poste lorsqu'une relève est terminée.
  useEffect(() => {
    if (!sessionsReady) return;
    const preferences: JournalFilters = {
      selectedSession, filterOperateur, filterType, filterCategorie, filterMode,
      modePeriode, selectedDate, dateDebut, dateFin, showFilters,
    };
    try { localStorage.setItem(JOURNAL_FILTERS_STORAGE_KEY, JSON.stringify(preferences)); } catch {}
  }, [sessionsReady, selectedSession, filterOperateur, filterType, filterCategorie,
      filterMode, modePeriode, selectedDate, dateDebut, dateFin, showFilters]);

  const resetFilters = () => {
    const defaults = defaultJournalFilters();
    setSelectedSession(null);
    setFilterOperateur(null);
    setFilterType(null);
    setFilterCategorie(null);
    setFilterMode(null);
    setModePeriode(defaults.modePeriode);
    setSelectedDate(defaults.selectedDate);
    setDateDebut(defaults.dateDebut);
    setDateFin(defaults.dateFin);
    setSearchTerm('');
    setCurrentPage(1);
    try { localStorage.removeItem(JOURNAL_FILTERS_STORAGE_KEY); } catch {}
  };
  // Chargement du référentiel des moyens de paiement (pour le filtre).
  useEffect(() => {
    journalCaisseService.getMoyensPaiement().then(setMoyensListe).catch(() => setMoyensListe([]));
  }, []);

  useEffect(() => {
    if (!sessionsReady) return;
    chargerDonnees();
  }, [selectedDate, selectedSession, filterOperateur, filterType, filterCategorie,
      modePeriode, dateDebut, dateFin, filterMode, moyensListe, sessionsReady]);

  const handleAjouterCharge = async () => {
    if (!chargeForm.designation || chargeForm.montant <= 0 || !chargeForm.beneficiaire) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez remplir tous les champs obligatoires',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    
    try {
      await journalCaisseService.ajouterCharge({
        designation: chargeForm.designation,
        montant: chargeForm.montant,
        beneficiaire: chargeForm.beneficiaire,
        categorie_charge: chargeForm.categorie_charge,
        reference_paiement: chargeForm.reference_paiement,
        mode_paiement: (chargeMoyen?.categorie || 'ESPECES'),
        mode_paiement_detail: chargeMoyen?.libelle,
        notes: chargeForm.notes
      });

      notifications.show({
        title: '✅ Succès',
        message: `Charge "${chargeForm.designation}" ajoutée avec succès`,
        color: 'green'
      });

      setChargeModalOpened(false);
      setChargeForm({
        designation: '',
        montant: 0,
        beneficiaire: '',
        categorie_charge: 'AUTRE',
        reference_paiement: '',
        mode_paiement: 'ESPECES' as ModePaiement,
        notes: ''
      });
      chargerDonnees();
      
    } catch (error: any) {
      notifications.show({
        title: '❌ Erreur',
        message: error.message || 'Erreur lors de l\'ajout',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  // Impression
  const handleChangerType = async () => {
    if (!selectedEntry || !nouveauType) return;
    if (nouveauType === selectedEntry.type_mouvement) return;
    setSavingType(true);
    try {
      await journalCaisseService.modifierTypeMouvement(selectedEntry.idJournal, nouveauType);
      notifications.show({
        title: 'Opération modifiée',
        message: `Désormais comptée comme ${nouveauType === 'ENTREE' ? "entrée" : "sortie"} d'argent.`,
        color: 'green',
      });
      await chargerDonnees();
      setDetailModalOpened(false);
      setSelectedEntry(null);
      setNouveauType(null);
    } catch (e: any) {
      notifications.show({
        title: 'Erreur',
        message: e?.message || 'Modification impossible',
        color: 'red',
      });
    } finally {
      setSavingType(false);
    }
  };

  const handleRattrapage = async () => {
    const ok = window.confirm(
      "Rattrapage des encaissements\n\nRecréer en caisse les encaissements de règlements " +
      "qui n'ont pas d'écriture (perdus par l'ancien bug de clé étrangère) ? " +
      "L'opération est sûre et peut être relancée sans créer de doublon."
    );
    if (!ok) return;
    try {
      const { ajoutes } = await journalCaisseService.rattraperReglementsSansCaisse();
      notifications.show({
        title: 'Rattrapage terminé',
        message: ajoutes > 0
          ? `${ajoutes} encaissement(s) réinjecté(s) en caisse.`
          : 'Aucun encaissement manquant : tout est déjà à jour.',
        color: ajoutes > 0 ? 'teal' : 'blue',
      });
      await chargerDonnees();
    } catch (e: any) {
      notifications.show({ title: 'Erreur', message: e?.message || 'Rattrapage impossible', color: 'red' });
    }
  };

  const handlePrint = () => {
    try {
      const dateObj = new Date(selectedDate);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      
      const title = activeTab === 'journal' ? 'JOURNAL DE CAISSE' : 'CHARGES DE FONCTIONNEMENT';
      
      // Ventilation automatique par mode de paiement (espèces / transferts).
      const v = journalCaisseService.ventiler(
        activeTab === 'journal' ? journalEntries : []
      );
      const totalEntrees = v.totalEntrees;
      const totalSorties = v.totalSorties;

      // Report : fond de caisse de la session sélectionnée, sinon solde
      // antérieur à la période. Il était auparavant ignoré, ce qui faussait
      // le total général du journal.
      const report = reportPeriode;
      const mouvementNet = totalEntrees - totalSorties;
      const soldeFinal = report + mouvementNet;

      // Espèces réellement attendues dans le tiroir : le report est en espèces.
      const especesEnCaisse = report + v.especes;
      const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0);
      
      let tableRows = '';
      
      if (activeTab === 'journal') {
        journalEntries.forEach((entry: JournalEntry, idx: number) => {
          const isEntree = entry.type_mouvement === 'ENTREE';
          tableRows += `
            <tr>
              <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${idx + 1}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a; font-size: 11px;">${formatDateCustom(entry.date_journal)}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1;">
                <div style="font-weight: 500; color: #1a1a2e;">${entry.designation || '-'}</div>
                ${entry.reference ? `<div style="font-size: 10px; color: #8a8aa0; margin-top: 2px;">Réf: ${entry.reference}</div>` : ''}
                ${entry.nom_utilisateur ? `<div style="font-size: 10px; color: #8a8aa0;">Opérateur: ${entry.nom_utilisateur}</div>` : ''}
              </td>
              <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e8ecf1;">
                <span style="display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 10px; font-weight: 600; background: ${isEntree ? '#e6f7e6' : '#fde8e8'}; color: ${isEntree ? '#1a8a1a' : '#c0392b'};">
                  ${isEntree ? 'ENTRÉE' : 'SORTIE'}
                </span>
              </td>
              <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e8ecf1; font-size: 10px; color: ${entry.mode_paiement ? '#1a1a2e' : '#8a8aa0'};">
                ${entry.mode_paiement_detail || libelleModePaiement(entry.mode_paiement)}
              </td>
              <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 600; color: ${isEntree ? '#1a8a1a' : '#c0392b'};">
                ${isEntree ? '+' : '−'} ${formatMontant(entry.montant)}
              </td>
              <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 700; color: #1b365d; font-size: 12px;">
                ${formatMontant(entry.solde_apres)}
              </td>
            </tr>
          `;
        });
      } else {
        charges.forEach((charge: ChargeFonctionnement, idx: number) => {
          const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
          tableRows += `
            <tr>
              <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${idx + 1}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a; font-size: 11px;">${formatDateCustom(charge.date_charge)}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1; font-weight: 500; color: #1a1a2e;">${charge.designation || '-'}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1; color: #4a4a6a;">${charge.beneficiaire || '-'}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e8ecf1;">
                <span style="display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; background: #f0ecf9; color: #6c5ce7;">${catInfo?.label || charge.categorie_charge || '-'}</span>
              </td>
              <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #e8ecf1; font-weight: 600; color: #c0392b;">
                − ${formatMontant(charge.montant)}
              </td>
            </tr>
          `;
        });
      }

      const totalGeneral = activeTab === 'journal' ? soldeFinal : totalCharges;
      const totalEnLettres = convertirEnLettres(totalGeneral);

      const now = new Date();
      const nowDay = String(now.getDate()).padStart(2, '0');
      const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
      const nowYear = now.getFullYear();
      const nowHours = String(now.getHours()).padStart(2, '0');
      const nowMinutes = String(now.getMinutes()).padStart(2, '0');
      const dateImpression = `${nowDay}/${nowMonth}/${nowYear} à ${nowHours}:${nowMinutes}`;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - ${dateStr}</title>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
                padding: 30px 35px;
                background: #ffffff;
                color: #1a1a2e;
                font-size: 11px;
                line-height: 1.5;
              }
              .header {
                text-align: center;
                padding-bottom: 15px;
                margin-bottom: 20px;
                border-bottom: 2px solid #1b365d;
              }
              .header .brand {
                font-size: 24px;
                font-weight: 700;
                color: #1b365d;
                letter-spacing: 3px;
              }
              .header .brand span { color: #d4af37; }
              .header .title {
                font-size: 16px;
                font-weight: 700;
                color: #0d1b3e;
                margin-top: 8px;
                letter-spacing: 1px;
                text-transform: uppercase;
              }
              .header .period {
                font-size: 11px;
                color: #6c6c8a;
                margin-top: 3px;
              }
              .meta {
                display: flex;
                justify-content: space-between;
                background: #f7f8fc;
                padding: 8px 14px;
                border-radius: 6px;
                margin-bottom: 15px;
                border-left: 3px solid #1b365d;
                flex-wrap: wrap;
                gap: 5px;
              }
              .meta .item {
                font-size: 10px;
                color: #4a4a6a;
              }
              .meta .item strong {
                color: #1b365d;
                font-weight: 600;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
              }
              table thead th {
                background: #1b365d;
                color: #ffffff;
                padding: 8px 10px;
                text-align: left;
                font-weight: 600;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              table tbody tr:hover { background: #f7f8fc; }
              table tbody td { padding: 7px 10px; border-bottom: 1px solid #eef0f4; }
              .totals {
                margin-top: 14px;
                padding: 12px 18px;
                background: #f7f8fc;
                border-radius: 6px;
                border: 1px solid #e8ecf1;
              }
              .totals .line {
                display: flex;
                justify-content: flex-end;
                padding: 3px 0;
              }
              .totals .line .label {
                font-weight: 500;
                width: 180px;
                text-align: right;
                padding-right: 25px;
                color: #4a4a6a;
                font-size: 10px;
              }
              .totals .line .value {
                font-weight: 600;
                width: 130px;
                text-align: right;
                font-size: 11px;
              }
              .totals .grand {
                border-top: 2px solid #1b365d;
                padding-top: 8px;
                margin-top: 4px;
              }
              .totals .grand .label {
                font-weight: 700;
                font-size: 12px;
                color: #1b365d;
                width: 180px;
                text-align: right;
                padding-right: 25px;
              }
              .totals .grand .value {
                font-weight: 700;
                font-size: 13px;
                color: #1b365d;
                width: 130px;
                text-align: right;
              }
              .words {
                margin-top: 15px;
                padding: 12px 18px;
                background: #f0f4fa;
                border-radius: 6px;
                border-left: 4px solid #d4af37;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-wrap: wrap;
                gap: 6px;
              }
              .words .label {
                font-size: 10px;
                color: #4a4a6a;
                font-weight: 600;
                letter-spacing: 0.3px;
              }
              .words .value {
                font-size: 12px;
                font-weight: 700;
                color: #1b365d;
              }
              .signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 30px;
                padding-top: 18px;
                border-top: 1px solid #e8ecf1;
              }
              .signatures .block {
                text-align: center;
                width: 40%;
              }
              .signatures .block .label {
                font-size: 9px;
                color: #6c6c8a;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 25px;
              }
              .signatures .block .line {
                border-top: 1px solid #1a1a2e;
                width: 70%;
                margin: 0 auto;
              }
              .signatures .block .sub {
                font-size: 8px;
                color: #a0a0c0;
                margin-top: 5px;
              }
              .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 8px;
                color: #a0a0c0;
                border-top: 1px solid #eef0f4;
                padding-top: 10px;
                letter-spacing: 0.3px;
              }
              @media print {
                table thead th { background: #1b365d !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              /* Géométrie de page et adaptation du corps au format choisi
                 par l'utilisateur (A4, A5, A6, B5, B6...). */
              ${construireCssImpression({ format: formatImpression, racine: 'body' })}
            </style>
          </head>
          <body>
            <div class="header">
              <div class="brand">GESTION <span>PRO</span></div>
              <div class="title">${title}</div>
              <div class="period">Période du ${dateStr}</div>
            </div>

            <div class="meta">
              <span class="item"><strong>📄 Document</strong> ${activeTab === 'journal' ? 'Journal de Caisse' : 'Charges de fonctionnement'}</span>
              <span class="item"><strong>📅 Date</strong> ${dateStr}</span>
              <span class="item"><strong>📊 Lignes</strong> ${activeTab === 'journal' ? journalEntries.length : charges.length}</span>
              <span class="item"><strong>💰 Solde</strong> ${formatMontant(soldeActuel)} FCFA</span>
            </div>

            <table>
              <thead>
                <tr>
                  ${activeTab === 'journal' ? `
                    <th style="width: 4%; text-align: center;">N°</th>
                    <th style="width: 13%;">Date</th>
                    <th style="width: 27%;">Désignation</th>
                    <th style="width: 10%; text-align: center;">Type</th>
                    <th style="width: 13%; text-align: center;">Mode</th>
                    <th style="width: 16%; text-align: right;">Montant</th>
                    <th style="width: 17%; text-align: right;">Solde</th>
                  ` : `
                    <th style="width: 5%; text-align: center;">N°</th>
                    <th style="width: 15%;">Date</th>
                    <th style="width: 25%;">Désignation</th>
                    <th style="width: 20%;">Bénéficiaire</th>
                    <th style="width: 17%;">Catégorie</th>
                    <th style="width: 18%; text-align: right;">Montant</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${tableRows || `
                  <tr>
                    <td colspan="${activeTab === 'journal' ? 7 : 6}" style="text-align: center; padding: 35px 20px; color: #a0a0c0;">
                      <div style="font-size: 13px;">📭</div>
                      <div style="margin-top: 6px;">Aucune donnée disponible pour cette période</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>

            ${((activeTab === 'journal' && journalEntries.length > 0) || (activeTab === 'charges' && charges.length > 0)) ? `
            <div class="totals">
              ${activeTab === 'journal' ? `
                <div class="line">
                  <span class="label">REPORT (fond de caisse)</span>
                  <span class="value">${formatMontant(report)}</span>
                </div>
                <div class="line">
                  <span class="label">SOUS-TOTAL ENTREES</span>
                  <span class="value" style="color: #1a8a1a;">+ ${formatMontant(totalEntrees)}</span>
                </div>
                <div class="line">
                  <span class="label">SOUS-TOTAL SORTIES</span>
                  <span class="value" style="color: #c0392b;">− ${formatMontant(totalSorties)}</span>
                </div>
                <div class="line grand">
                  <span class="label">TOTAL GÉNÉRAL (report + mouvements)</span>
                  <span class="value">${formatMontant(soldeFinal)} FCFA</span>
                </div>

                <!-- Point de caisse : ventilation automatique par mode de paiement -->
                <div style="margin-top: 12px; padding-top: 10px; border-top: 2px solid #1b365d;">
                  <div style="font-weight: 700; color: #1b365d; margin-bottom: 6px; font-size: 12px;">
                    ❖ POINT DE CAISSE
                  </div>
                  <div class="line">
                    <span class="label">Montant total des opérations</span>
                    <span class="value">${formatMontant(mouvementNet)} FCFA</span>
                  </div>
                  <div class="line">
                    <span class="label">Dont transferts (Mobile Money)</span>
                    <span class="value" style="color: #6c5ce7;">${formatMontant(v.mobileMoney)} FCFA</span>
                  </div>
                  ${[
                    ['Orange Money', v.orangeMoney],
                    ['Moov Money', v.moovMoney],
                    ['Telecel Money', v.telecelMoney],
                    ['Sank Money', v.sankMoney],
                    ['Wave', v.wave],
                    ['Autre mobile', v.autreMobile],
                  ].filter(([, m]) => (m as number) !== 0).map(([label, m]) => `
                  <div class="line" style="padding-left:16px;">
                    <span class="label">• ${label}</span>
                    <span class="value" style="color: #6c5ce7;">${formatMontant(m as number)} FCFA</span>
                  </div>`).join('')}
                  ${v.virements !== 0 ? `
                  <div class="line">
                    <span class="label">Dont virements</span>
                    <span class="value" style="color: #6c5ce7;">${formatMontant(v.virements)} FCFA</span>
                  </div>` : ''}
                  ${v.cheques !== 0 ? `
                  <div class="line">
                    <span class="label">Dont chèques</span>
                    <span class="value" style="color: #6c5ce7;">${formatMontant(v.cheques)} FCFA</span>
                  </div>` : ''}
                  ${v.autres !== 0 ? `
                  <div class="line">
                    <span class="label">Dont autres modes</span>
                    <span class="value">${formatMontant(v.autres)} FCFA</span>
                  </div>` : ''}
                  ${v.nbNonPrecise > 0 ? `
                  <div class="line">
                    <span class="label">Mode non précisé (${v.nbNonPrecise} opération(s))</span>
                    <span class="value" style="color: #b8860b;">${formatMontant(v.nonPrecise)} FCFA</span>
                  </div>` : ''}
                  <div class="line grand">
                    <span class="label">ESPÈCES EN CAISSE (comptage attendu)</span>
                    <span class="value" style="color: #1a8a1a;">${formatMontant(especesEnCaisse)} FCFA</span>
                  </div>
                  ${v.nbNonPrecise > 0 ? `
                  <div style="margin-top: 6px; font-size: 10px; color: #b8860b; font-style: italic;">
                    ⚠ ${v.nbNonPrecise} opération(s) sans mode de paiement renseigné
                    (enregistrées avant l'activation du suivi). Elles ne sont
                    comptées ni en espèces ni en transferts.
                  </div>` : ''}
                </div>
              ` : `
                <div class="line grand">
                  <span class="label">TOTAL GÉNÉRAL CHARGES</span>
                  <span class="value" style="color: #c0392b;">${formatMontant(totalCharges)} FCFA</span>
                </div>
              `}
            </div>

            <div class="words">
              <span class="label">❖ ARRÊTÉ LE PRÉSENT COMPTE À LA SOMME DE</span>
              <span class="value">${totalEnLettres} (${formatMontant(totalGeneral)}) Francs CFA</span>
            </div>
            ` : ''}

            <div class="signatures">
              <div class="block">
                <div class="label">Le Gérant(e)</div>
                <div class="line"></div>
                <div class="sub">Nom, prénom et signature</div>
              </div>
              <div class="block">
                <div class="label">Le Responsable</div>
                <div class="line"></div>
                <div class="sub">Nom, prénom et signature</div>
              </div>
            </div>

            <div class="footer">
              Document généré le ${dateImpression} — © ${new Date().getFullYear()} Gestion Pro
            </div>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();
        
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
            if (win) {
              win.document.write(html);
              win.document.close();
              win.focus();
              win.print();
            }
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 2000);
        }, 500);
      }
      
    } catch (error) {
      console.error('Erreur impression:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'impression',
        color: 'red'
      });
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const data = activeTab === 'journal' ? filteredEntries : charges;
      
      if (data.length === 0) {
        notifications.show({
          title: 'Information',
          message: 'Aucune donnée à exporter',
          color: 'blue'
        });
        return;
      }
      
      let csvContent = '';
      
      if (activeTab === 'journal') {
        csvContent = 'Origine;N°;Date;Désignation;Type;Catégorie;Montant;Solde;Référence;Opérateur\n';
        filteredEntries.forEach((entry: JournalEntry, idx: number) => {
          csvContent += `${originLabel(journalLinks[entry.idJournal]?.origin)};${idx + 1};${formatDateCustom(entry.date_journal)};${entry.designation || ''};${entry.type_mouvement || ''};${categorieLabels[entry.categorie] || entry.categorie || ''};${entry.montant || 0};${entry.solde_apres || 0};${entry.reference || ''};${entry.nom_utilisateur || ''}\n`;
        });
      } else {
        csvContent = 'N°;Date;Désignation;Bénéficiaire;Catégorie;Montant;Référence\n';
        charges.forEach((charge: ChargeFonctionnement, idx: number) => {
          const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
          csvContent += `${idx + 1};${formatDateCustom(charge.date_charge)};${charge.designation || ''};${charge.beneficiaire || ''};${catInfo?.label || charge.categorie_charge || ''};${charge.montant || 0};${charge.reference_paiement || ''}\n`;
        });
      }
      
      const dateObj = new Date(selectedDate);
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const fileName = `${activeTab === 'journal' ? 'journal_caisse' : 'charges'}_${dateStr}.csv`;
      const res = await saveText(csvContent, fileName);
      if (res !== 'cancelled') {
        notifications.show({
          title: '✅ Succès',
          message: `Export CSV effectué (${data.length} lignes) — dossier choisi`,
          color: 'green'
        });
      }
      
    } catch (error) {
      console.error('Erreur export:', error);
      notifications.show({
        title: 'Erreur',
        message: 'Erreur lors de l\'export CSV',
        color: 'red'
      });
    }
  };

  // Fonctions utilitaires
  const formatMontant = (value: number): string => {
    return (value || 0).toLocaleString('fr-FR');
  };

  const convertirEnLettres = (montant: number): string => {
    if (montant === 0) return 'ZÉRO';
    const nombre = Math.round(Math.abs(montant));
    const unite = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
    const dizaine = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];
    
    if (nombre < 100) {
      if (nombre < 10) return unite[nombre];
      if (nombre < 20) {
        const specials = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
        return specials[nombre - 10];
      }
      const d = Math.floor(nombre / 10);
      const u = nombre % 10;
      if (u === 0) return dizaine[d];
      if (d === 7 || d === 9) return dizaine[d] + '-' + unite[u];
      return dizaine[d] + '-' + unite[u];
    }
    
    if (nombre < 1000) {
      const c = Math.floor(nombre / 100);
      const r = nombre % 100;
      let result = c === 1 ? 'CENT' : unite[c] + ' CENT';
      if (r > 0) result += ' ' + convertirEnLettres(r);
      return result;
    }
    
    if (nombre < 1000000) {
      const m = Math.floor(nombre / 1000);
      const r = nombre % 1000;
      let result = m === 1 ? 'MILLE' : convertirEnLettres(m) + ' MILLE';
      if (r > 0) result += ' ' + convertirEnLettres(r);
      return result;
    }
    
    return String(nombre);
  };

  const getTypeLabel = (type: string) => {
    return type === 'ENTREE' ? 
      <Badge color="green" size="sm">ENTRÉE</Badge> : 
      <Badge color="red" size="sm">SORTIE</Badge>;
  };

  const estRetraitPatron = (e: any) =>
    (e?.designation || '').toLowerCase().startsWith('retrait patron') ||
    (e?.notes || '').startsWith('RETRAIT PATRON');

  const getCategorieBadge = (categorie: string, entry?: any) => {
    if (entry && estRetraitPatron(entry)) {
      return <Badge color="grape" variant="filled" size="sm">Retrait patron</Badge>;
    }
    if (!categorie) return <Badge size="xs">Non défini</Badge>;
    return (
      <Badge color={categorieColors[categorie] || 'gray'} variant="light" size="sm">
        {categorieLabels[categorie] || categorie}
      </Badge>
    );
  };

  const getStatutBadge = (statut: string) => {
    const colors: Record<string, string> = {
      'OUVERTE': 'green',
      'FERMEE': 'red',
      'BLOQUEE': 'orange'
    };
    const labels: Record<string, string> = {
      'OUVERTE': 'Ouverte',
      'FERMEE': 'Fermée',
      'BLOQUEE': 'Bloquée'
    };
    return <Badge color={colors[statut] || 'gray'}>{labels[statut] || statut}</Badge>;
  };

  // Filtrer les entrées
  const filteredEntries = journalEntries.filter((entry: JournalEntry) => {
    if (!entry) return false;
    if (originFilter && (originFilter === 'inconnue' ? journalLinks[entry.idJournal]?.origin != null : journalLinks[entry.idJournal]?.origin !== originFilter)) return false;
    const search = searchTerm.toLowerCase();
    return (
      (entry.designation || '').toLowerCase().includes(search) ||
      (entry.reference || '').toLowerCase().includes(search) ||
      (entry.nom_utilisateur || '').toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Point de caisse de la vue courante : calculé automatiquement à partir
  // des opérations affichées, quel que soit le mode de consultation.
  const ventilation = journalCaisseService.ventiler(filteredEntries);
  // Le fond de caisse est détenu en espèces : il s'ajoute au comptage attendu.
  const especesAttendues = reportPeriode + ventilation.especes;
  const totalGeneralVue = reportPeriode + ventilation.total;

  const filteredCharges = charges.filter((charge: ChargeFonctionnement) => {
    if (!charge) return false;
    const search = searchTerm.toLowerCase();
    return (
      (charge.designation || '').toLowerCase().includes(search) ||
      (charge.beneficiaire || '').toLowerCase().includes(search)
    );
  });

  // Liste des opérateurs uniques (id -> nom) : le filtre s'applique sur idUtilisateur.
  const operateursMap = new Map<string, string>();
  journalEntries.forEach(e => {
    if (e.idUtilisateur != null && e.nom_utilisateur) {
      operateursMap.set(String(e.idUtilisateur), e.nom_utilisateur);
    }
  });
  const operateurs = Array.from(operateursMap.entries()).map(([value, label]) => ({ value, label }));
  const categoriesUniques = Array.from(new Set(journalEntries.map(e => e.categorie).filter(Boolean)));

  if (loading) {
    return (
      <Center py={100}>
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {/* GESTION DES SESSIONS */}
      <GestionSession onSessionChange={() => {
  const releve = localStorage.getItem('gc_releve_completed') === '1';
  if (releve) {
    localStorage.removeItem('gc_releve_completed');
    setReleveTerminee(true);
  }
  loadSessions(releve);
  chargerDonnees();
}} />

      {releveTerminee && (
        <Alert color="teal" variant="light" icon={<IconRefresh size={18} />} withCloseButton onClose={() => setReleveTerminee(false)}>
          <Text fw={600} size="sm">Nouvelle session ouverte après relève</Text>
          <Text size="xs">Le journal affiche maintenant uniquement le nouveau poste. Il restera vide jusqu'au premier mouvement.</Text>
        </Alert>
      )}

      {/* EN-TÊTE */}
      <Paper className="tk-page-tools" p="xl" radius="lg">
        <Flex justify="space-between" align="center" wrap="wrap">
          <Group gap="md">
            <ThemeIcon size={45} radius="md" color="yellow" variant="filled">
              <IconCash size={30} />
            </ThemeIcon>
            <div>
              <Title order={1} c="white">Journal de Caisse</Title>
              <Text c="gray.3" size="sm">Suivi des entrées et sorties d'argent</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={18} />}
              onClick={chargerDonnees}
            >
              Actualiser
            </Button>
          </Group>
        </Flex>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="white" variant="light" size="lg">
                <IconMoneybag size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Solde actuel</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(soldeActuel)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(46,125,50,0.3)' }}>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconArrowUpRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Entrées</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(ventilation.totalEntrees)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm" style={{ backgroundColor: 'rgba(211,47,47,0.3)' }}>
            <Group>
              <ThemeIcon color="red" variant="light" size="lg">
                <IconArrowDownRight size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Sorties</Text>
                <Text c="white" fw={700} size="xl">{formatMontant(ventilation.totalSorties)} F</Text>
              </div>
            </Group>
          </Card>
          <Card bg="rgba(255,255,255,0.1)" radius="md" p="sm">
            <Group>
              <ThemeIcon color="yellow" variant="light" size="lg">
                <IconCalendar size={20} />
              </ThemeIcon>
              <div>
                <Text c="white" size="xs">Période</Text>
                <Text c="white" fw={700} size="lg">
                  {selectedSession
                    ? 'Session'
                    : modePeriode === 'TOUT'
                      ? 'Tout l\'historique'
                      : modePeriode === 'PERIODE'
                        ? `${formatDateSimple(dateDebut)} → ${formatDateSimple(dateFin)}`
                        : formatDateSimple(selectedDate)}
                </Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* POINT DE CAISSE — ventilation automatique par mode de paiement */}
      <Card withBorder radius="lg" shadow="sm" p="sm" mt="md">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <IconMoneybag size={18} />
            <Text fw={600} size="sm">Point de caisse</Text>
          </Group>
          <Text size="xs" c="dimmed">
            {ventilation.nbOperations} opération(s) sur la période consultée
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Card withBorder p="xs" bg="blue.0">
            <Text size="xs" c="dimmed">Montant total des opérations</Text>
            <Text fw={700} size="lg" c="blue.8">{formatMontant(ventilation.total)} F</Text>
          </Card>
          <Card withBorder p="xs" bg="violet.0">
            <Text size="xs" c="dimmed">Transferts (Mobile Money)</Text>
            <Text fw={700} size="lg" c="violet.8">{formatMontant(ventilation.mobileMoney)} F</Text>
            {[
              ['Orange Money', ventilation.orangeMoney],
              ['Moov Money', ventilation.moovMoney],
              ['Telecel Money', ventilation.telecelMoney],
              ['Sank Money', ventilation.sankMoney],
              ['Wave', ventilation.wave],
              ['Autre mobile', ventilation.autreMobile],
            ].filter(([, m]) => (m as number) !== 0).map(([label, m]) => (
              <Text key={label as string} size="xs" c="dimmed">• {label} : {formatMontant(m as number)} F</Text>
            ))}
            {ventilation.virements !== 0 && (
              <Text size="xs" c="dimmed">+ {formatMontant(ventilation.virements)} F de virements</Text>
            )}
          </Card>
          <Card withBorder p="xs" bg="green.0">
            <Text size="xs" c="dimmed">Espèces en caisse</Text>
            <Text fw={700} size="lg" c="green.8">{formatMontant(especesAttendues)} F</Text>
            <Text size="xs" c="dimmed">report inclus : {formatMontant(reportPeriode)} F</Text>
          </Card>
          <Card withBorder p="xs" bg={ventilation.nbNonPrecise > 0 ? 'yellow.0' : 'gray.0'}>
            <Text size="xs" c="dimmed">Total général (report inclus)</Text>
            <Text fw={700} size="lg">{formatMontant(totalGeneralVue)} F</Text>
            {ventilation.nbNonPrecise > 0 && (
              <Text size="xs" c="orange.8">
                {ventilation.nbNonPrecise} opération(s) sans mode précisé
              </Text>
            )}
          </Card>
        </SimpleGrid>
      </Card>

      {/* SESSIONS ET FILTRES */}
      <Card withBorder radius="lg" shadow="sm" p="sm">
        <Stack gap="sm">
          <Group justify="space-between">
            <Group>
              <IconFilter size={18} />
              <Text fw={500} size="sm">Filtres</Text>
            </Group>
            <Group gap="xs">
              <Button variant="subtle" size="xs" onClick={resetFilters} leftSection={<IconX size={14} />}>
                Réinitialiser
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setShowFilters(!showFilters)}
                rightSection={showFilters ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              >
                {showFilters ? 'Masquer' : 'Afficher'} les filtres
              </Button>
            </Group>
          </Group>

          {showFilters && (
            <Grid>
              <Grid.Col span={3}>
                <Select
                  label="Session"
                  placeholder="Toutes les sessions"
                  data={sessions.map(s => ({
                    value: s.idSession.toString(),
                    label: `${s.code_session} — ${getSessionOperateurLabel(s)} (${s.statut === 'OUVERTE' ? 'Ouverte' : 'Fermée'})`
                  }))}
                  value={selectedSession?.toString() || null}
                  onChange={(val) => setSelectedSession(val ? parseInt(val) : null)}
                  clearable
                  searchable
                  size="xs"
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Select
                  label="Opérateur"
                  placeholder="Tous les opérateurs"
                  data={[
                    { value: 'TOUS', label: 'Tous les opérateurs' },
                    ...operateurs
                  ]}
                  value={filterOperateur}
                  onChange={setFilterOperateur}
                  clearable
                  searchable
                  size="xs"
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Select
                  label="Type"
                  placeholder="Tous les types"
                  data={[
                    { value: 'TOUS', label: 'Tous' },
                    { value: 'ENTREE', label: 'Entrée' },
                    { value: 'SORTIE', label: 'Sortie' }
                  ]}
                  value={filterType}
                  onChange={setFilterType}
                  clearable
                  searchable
                  size="xs"
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Select
                  label="Catégorie"
                  placeholder="Toutes les catégories"
                  data={[
                    { value: 'TOUS', label: 'Toutes' },
                    ...categoriesUniques.map(cat => ({
                      value: cat,
                      label: categorieLabels[cat] || cat
                    }))
                  ]}
                  value={filterCategorie}
                  onChange={setFilterCategorie}
                  clearable
                  searchable
                  size="xs"
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Select
                  label="Mode de paiement"
                  placeholder="Tous les modes"
                  data={[
                    { value: 'TOUS', label: 'Tous' },
                    ...moyensListe.map(m => ({ value: m.code, label: m.libelle })),
                    { value: 'NON_PRECISE', label: 'Non précisé' },
                  ]}
                  value={filterMode}
                  onChange={setFilterMode}
                  clearable
                  searchable
                  size="xs"
                />
              </Grid.Col>

              {/* Étendue de consultation : le journal n'est plus limité au jour courant */}
              <Grid.Col span={3}>
                <Select
                  label="Période consultée"
                  data={[
                    { value: 'JOUR', label: 'Une journée' },
                    { value: 'PERIODE', label: 'Intervalle de dates' },
                    { value: 'TOUT', label: 'Tout l\'historique' },
                  ]}
                  value={modePeriode}
                  onChange={(v) => v && setModePeriode(v as 'JOUR' | 'PERIODE' | 'TOUT')}
                  allowDeselect={false}
                  size="xs"
                  disabled={!!selectedSession}
                />
              </Grid.Col>

              {modePeriode === 'JOUR' && (
                <Grid.Col span={2}>
                  <TextInput
                    label="Date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    size="xs"
                    disabled={!!selectedSession}
                  />
                </Grid.Col>
              )}

              {modePeriode === 'PERIODE' && (
                <>
                  <Grid.Col span={2}>
                    <TextInput
                      label="Du"
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      size="xs"
                      disabled={!!selectedSession}
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <TextInput
                      label="Au"
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      size="xs"
                      disabled={!!selectedSession}
                    />
                  </Grid.Col>
                </>
              )}

              {/* Format d'impression, pré-rempli depuis les Paramètres */}
              <Grid.Col span={3}>
                <Select
                  label="Format d'impression"
                  data={optionsFormatPapier}
                  value={formatImpression}
                  onChange={(v) => v && setFormatImpression(v as FormatPapier)}
                  allowDeselect={false}
                  size="xs"
                />
              </Grid.Col>
            </Grid>
          )}

          <Divider />

          <TkFilters>
          <Grid align="flex-end">
            <Grid.Col span={4}>
              <Select label="Origine" placeholder="Toutes" clearable size="xs" value={originFilter}
                data={[{value:'vente',label:'Vente'},{value:'prestation',label:'Prestation'},{value:'inconnue',label:'· — Inconnue'}]}
                onChange={value=>{setOriginFilter(value);setCurrentPage(1);}} />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                placeholder="Rechercher..."
                leftSection={<IconSearch size={14} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={8}>
              <Group justify="flex-end" gap="xs">
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconRefresh size={14} />}
                  onClick={chargerDonnees}
                  size="xs"
                >
                  Charger
                </Button>
                <Button
                  variant="filled"
                  color="red"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setChargeModalOpened(true)}
                  disabled={!sessions.some(s => s.statut === 'OUVERTE')}
                  size="xs"
                >
                  Charge
                </Button>
                <Button
                  variant="light"
                  color="teal"
                  leftSection={<IconPrinter size={14} />}
                  onClick={handlePrint}
                  size="xs"
                >
                  Imprimer
                </Button>
                <Button
                  variant="light"
                  color="grape"
                  leftSection={<IconDownload size={14} />}
                  onClick={handleExportCSV}
                  size="xs"
                >
                  CSV
                </Button>
                <Tooltip label="Réinjecter en caisse les encaissements de règlements manquants (ancien bug)">
                  <Button
                    variant="subtle"
                    color="orange"
                    leftSection={<IconRefresh size={14} />}
                    onClick={handleRattrapage}
                    size="xs"
                  >
                    Rattrapage
                  </Button>
                </Tooltip>
              </Group>
            </Grid.Col>
          </Grid>
          </TkFilters>
        </Stack>
      </Card>

      {/* TABLEAUX */}
      <Card withBorder radius="lg" shadow="sm" p="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="journal" leftSection={<IconFileText size={16} />}>
              Journal de caisse
              <Badge size="xs" color="blue" ml="xs" variant="light">{journalEntries.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="charges" leftSection={<IconMoneybag size={16} />}>
              Charges fonctionnement
              <Badge size="xs" color="red" ml="xs" variant="light">{charges.length}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="sessions" leftSection={<IconUser size={16} />}>
              Sessions
              <Badge size="xs" color="green" ml="xs" variant="light">{sessions.filter(s => s.statut === 'OUVERTE').length} ouvertes</Badge>
            </Tabs.Tab>
            {/* Rapports consultables à tout moment, sans attendre la clôture */}
            <Tabs.Tab value="rapports" leftSection={<IconReportMoney size={16} />}>
              Rapports de vente
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="journal" pt="md">
            {originError && <Alert color="red" title="Origines indisponibles" mb="sm">{originError}</Alert>}
            {/* Après une mise à jour de l'application, la vue s'ouvre sur « aujourd'hui ».
                Si la journée est vide alors que l'historique existe, on le signale
                clairement et on propose d'afficher tout l'historique en un clic. */}
            {modePeriode === 'JOUR' && !selectedSession && journalEntries.length === 0 && totalHistorique > 0 && (
              <Alert
                mb="md"
                color="blue"
                variant="light"
                icon={<IconAlertCircle size={18} />}
                title="Vos anciennes données sont bien là"
              >
                <Text size="sm">
                  Aucun mouvement pour <b>{formatDateCustom(selectedDate)}</b>, mais le journal
                  contient <b>{totalHistorique}</b> écriture(s) au total. La vue est simplement
                  filtrée sur la journée du jour.
                </Text>
                <Button
                  mt="xs"
                  size="xs"
                  variant="filled"
                  leftSection={<IconFileText size={14} />}
                  onClick={() => { setSelectedSession(null); setModePeriode('TOUT'); }}
                >
                  Afficher tout l'historique
                </Button>
              </Alert>
            )}
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing={4} horizontalSpacing="xs" fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>N°</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th ta="center">Type</Table.Th>
                      <Table.Th>Origine / opération liée</Table.Th>
                      <Table.Th ta="center">Catégorie</Table.Th>
                      <Table.Th ta="center">Mode</Table.Th>
                      <Table.Th ta="right">Montant</Table.Th>
                      <Table.Th ta="right">Solde</Table.Th>
                      <Table.Th ta="center">Opérateur</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedEntries.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={10} align="center">
                          <Text c="dimmed" py={40}>
                            Aucun mouvement pour la période sélectionnée
                          </Text>
                          <Text c="dimmed" size="sm">Les ventes et règlements apparaîtront ici automatiquement.</Text>
                          <Group justify="center" mt="sm">
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconArrowUpRight size={14} />}
                              disabled={!sessions.some(s => s.statut === 'OUVERTE')}
                              onClick={() => navigate('/ventes/nouvelle')}
                            >
                              Enregistrer un encaissement
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              leftSection={<IconArrowDownRight size={14} />}
                              disabled={!sessions.some(s => s.statut === 'OUVERTE')}
                              onClick={() => setChargeModalOpened(true)}
                            >
                              Enregistrer un décaissement
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      paginatedEntries.map((entry, idx) => {
                        const num = (currentPage - 1) * itemsPerPage + idx + 1;
                        return (
                          <Table.Tr 
                            key={entry.idJournal}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedEntry(entry);
                              setDetailModalOpened(true);
                            }}
                          >
                            <Table.Td fw={600}>{num}</Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatDateCustom(entry.date_journal)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{entry.designation || '-'}</Text>
                              {entry.reference && (
                                <Text size="xs" c="dimmed">Réf: {entry.reference}</Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="center">
                              {getTypeLabel(entry.type_mouvement)}
                            </Table.Td>
                            <Table.Td><JournalOriginCell row={journalLinks[entry.idJournal]} ctx={txContext} /></Table.Td>
                            <Table.Td ta="center">
                              {getCategorieBadge(entry.categorie, entry)}
                            </Table.Td>
                            <Table.Td ta="center">
                              <Badge
                                size="xs"
                                variant="light"
                                color={
                                  entry.mode_paiement === 'ESPECES' ? 'green'
                                  : entry.mode_paiement === 'MOBILE_MONEY' ? 'violet'
                                  : entry.mode_paiement ? 'blue'
                                  : 'gray'
                                }
                              >
                                {entry.mode_paiement_detail || libelleModePaiement(entry.mode_paiement)}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={600} c={entry.type_mouvement === 'ENTREE' ? 'green' : 'red'}>
                                {entry.type_mouvement === 'ENTREE' ? '+' : '-'}
                                {formatMontant(entry.montant)} F
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={700}>{formatMontant(entry.solde_apres)} F</Text>
                            </Table.Td>
                            <Table.Td ta="center">
                              {entry.nom_utilisateur ? (
                                <Badge variant="light" size="xs" color="blue">
                                  {entry.nom_utilisateur}
                                </Badge>
                              ) : '-'}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* Solde de la gestion, en bas à droite, pour un suivi visuel */}
              <Group
                justify="space-between"
                px="md" py={8}
                style={{ borderTop: '2px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-gray-0)' }}
              >
                <Text size="xs" c="dimmed">
                  {filteredEntries.length} opération(s) · report : {formatMontant(reportPeriode)} F
                </Text>
                <Group gap={6} align="baseline">
                  <Text size="sm" fw={600} c="dimmed">Solde de la gestion :</Text>
                  <Text fw={800} size="lg" c={totalGeneralVue >= 0 ? 'teal.8' : 'red.8'}>
                    {formatMontant(totalGeneralVue)} F
                  </Text>
                </Group>
              </Group>

              {totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" />
                </Group>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="charges" pt="md">
            <Card withBorder radius="lg" shadow="sm" p={0}>
              <ScrollArea h={450}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={50}>N°</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Désignation</Table.Th>
                      <Table.Th>Bénéficiaire</Table.Th>
                      <Table.Th>Catégorie</Table.Th>
                      <Table.Th ta="right">Montant</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredCharges.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6} align="center">
                          <Text c="dimmed" py={40}>Aucune charge pour cette période</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredCharges.map((charge, idx) => {
                        const catInfo = categoriesCharges.find(c => c.value === charge.categorie_charge);
                        return (
                          <Table.Tr key={charge.idCharge}>
                            <Table.Td fw={600}>{idx + 1}</Table.Td>
                            <Table.Td>{formatDateCustom(charge.date_charge)}</Table.Td>
                            <Table.Td>
                              <Text fw={500} size="sm">{charge.designation || '-'}</Text>
                              {charge.reference_paiement && (
                                <Text size="xs" c="dimmed">Réf: {charge.reference_paiement}</Text>
                              )}
                            </Table.Td>
                            <Table.Td>{charge.beneficiaire || '-'}</Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {catInfo?.label || charge.categorie_charge || '-'}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fw={600} c="red">{formatMontant(charge.montant)} F</Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="sessions" pt="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>N° Session</Table.Th>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Opérateur</Table.Th>
                  <Table.Th>Ouverture</Table.Th>
                  <Table.Th>Fermeture</Table.Th>
                  <Table.Th>Solde initial</Table.Th>
                  <Table.Th>Entrées</Table.Th>
                  <Table.Th>Sorties</Table.Th>
                  <Table.Th>Statut</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((session) => (
                  <Table.Tr key={session.idSession}>
                    <Table.Td>
                      <Text fw={500}>#{session.idSession}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600}>{session.code_session}</Text>
                    </Table.Td>
                    <Table.Td>{session.nom_utilisateur || session.nom_operateur || 'Inconnu'}</Table.Td>
                    <Table.Td>{formatDateCustom(session.date_ouverture)}</Table.Td>
                    <Table.Td>{session.date_fermeture ? formatDateCustom(session.date_fermeture) : '-'}</Table.Td>
                    <Table.Td>
                      <Text fw={600}>{formatMontant(session.solde_initial)} F</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="green" fw={600}>{formatMontant(session.total_entrees)} F</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="red" fw={600}>{formatMontant(session.total_sorties)} F</Text>
                    </Table.Td>
                    <Table.Td>{getStatutBadge(session.statut)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Rapports de vente : accessibles en permanence, filtrables,
              imprimables et téléchargeables sans clôturer le poste. */}
          <Tabs.Panel value="rapports" pt="md">
            <RapportsVente />
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* MODAL AJOUT CHARGE */}
      <Modal
        opened={chargeModalOpened}
        onClose={() => setChargeModalOpened(false)}
        title="Ajouter une charge de fonctionnement"
        size="md"
        centered
        styles={{
          header: { backgroundColor: '#1a1a2e', padding: '16px 20px', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
          title: { color: 'white', fontWeight: 600 },
          body: { padding: '20px' }
        }}
      >
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />}>
            Solde actuel: <strong>{formatMontant(soldeActuel)} FCFA</strong>
          </Alert>

          <TextInput
            label="Désignation *"
            placeholder="Ex: Achat fournitures bureau"
            value={chargeForm.designation}
            onChange={(e) => setChargeForm({ ...chargeForm, designation: e.target.value })}
            required
            size="xs"
          />

          <NumberInput
            label="Montant *"
            placeholder="0"
            value={chargeForm.montant}
            onChange={(val) => setChargeForm({ ...chargeForm, montant: typeof val === 'number' ? val : 0 })}
            min={0}
            step={100}
            required
            leftSection="FCFA"
            size="xs"
          />

          <TextInput
            label="Bénéficiaire *"
            placeholder="Nom du bénéficiaire"
            value={chargeForm.beneficiaire}
            onChange={(e) => setChargeForm({ ...chargeForm, beneficiaire: e.target.value })}
            required
            size="xs"
          />

          <Select
            label="Catégorie"
            placeholder="Sélectionner une catégorie"
            data={categoriesCharges}
            value={chargeForm.categorie_charge}
            onChange={(value) => setChargeForm({ ...chargeForm, categorie_charge: value || 'AUTRE' })}
            size="xs"
          />

          {/* Mode de paiement : indispensable pour ventiler automatiquement
              espèces et transferts lors du point de caisse. */}
          <SelecteurModePaiement
            value={chargeMoyen?.code}
            onChange={setChargeMoyen}
            size="xs"
            withAsterisk
          />

          <TextInput
            label="Référence de paiement"
            placeholder="N° de chèque, virement, etc."
            value={chargeForm.reference_paiement}
            onChange={(e) => setChargeForm({ ...chargeForm, reference_paiement: e.target.value })}
            size="xs"
          />

          <Textarea
            label="Notes"
            placeholder="Informations complémentaires"
            value={chargeForm.notes}
            onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })}
            rows={2}
            size="xs"
          />

          <Divider />

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setChargeModalOpened(false)} size="xs">
              Annuler
            </Button>
            <Button
              onClick={handleAjouterCharge}
              loading={saving}
              color="red"
              leftSection={<IconMinus size={16} />}
              size="xs"
            >
              Enregistrer la charge
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL DÉTAILS ENTRÉE */}
      <Modal
        opened={detailModalOpened}
        onClose={() => {
          setDetailModalOpened(false);
          setSelectedEntry(null);
          setNouveauType(null);
        }}
        title="Détails du mouvement"
        size="md"
        centered
      >
        {selectedEntry && (
          <Stack>
            <Card withBorder p="md">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Code</Text>
                  <Text fw={600}>{selectedEntry.code_journal}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Date</Text>
                  <Text fw={600}>{formatDateCustom(selectedEntry.date_journal)}</Text>
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text size="xs" c="dimmed">Désignation</Text>
                  <Text fw={500}>{selectedEntry.designation}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Type</Text>
                  {getTypeLabel(selectedEntry.type_mouvement)}
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Catégorie</Text>
                  {getCategorieBadge(selectedEntry.categorie, selectedEntry)}
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Montant</Text>
                  <Text fw={700} c={selectedEntry.type_mouvement === 'ENTREE' ? 'green' : 'red'}>
                    {selectedEntry.type_mouvement === 'ENTREE' ? '+' : '-'}
                    {formatMontant(selectedEntry.montant)} F
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Solde après</Text>
                  <Text fw={700}>{formatMontant(selectedEntry.solde_apres)} F</Text>
                </Grid.Col>
                {selectedEntry.reference && (
                  <Grid.Col span={12}>
                    <Text size="xs" c="dimmed">Référence</Text>
                    <Text>{selectedEntry.reference}</Text>
                  </Grid.Col>
                )}
                {selectedEntry.nom_utilisateur && (
                  <Grid.Col span={12}>
                    <Text size="xs" c="dimmed">Opérateur</Text>
                    <Text>{selectedEntry.nom_utilisateur}</Text>
                  </Grid.Col>
                )}
                {selectedEntry.notes && (
                  <Grid.Col span={12}>
                    <Text size="xs" c="dimmed">Notes</Text>
                    <Text>{selectedEntry.notes}</Text>
                  </Grid.Col>
                )}
              </Grid>
            </Card>

            <Divider label="Modifier le sens de l'opération" labelPosition="center" />
            <Text size="xs" c="dimmed">
              Change si cette opération compte comme une entrée ou une sortie d'argent.
              Le solde est recalculé automatiquement.
            </Text>
            <Group align="flex-end" gap="xs" wrap="nowrap">
              <Select
                label="Compter comme"
                data={[
                  { value: 'ENTREE', label: "Entrée d'argent" },
                  { value: 'SORTIE', label: "Sortie d'argent" },
                ]}
                value={nouveauType ?? selectedEntry.type_mouvement}
                onChange={(v) => v && setNouveauType(v as 'ENTREE' | 'SORTIE')}
                allowDeselect={false}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleChangerType}
                loading={savingType}
                disabled={(nouveauType ?? selectedEntry.type_mouvement) === selectedEntry.type_mouvement}
              >
                Enregistrer
              </Button>
            </Group>

            <Button variant="light" onClick={() => setDetailModalOpened(false)}>Fermer</Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default JournalCaisse;
