import { construireRapportCsv } from './rapportVenteCsv';
// src/services/rapportVenteService.ts
// ============================================================================
// RAPPORTS DE VENTE / DE POSTE
// ----------------------------------------------------------------------------
// Auparavant le rapport de fin de poste n'existait qu'au moment de la clôture :
// il était généré à la volée dans GestionSession puis perdu.
//
// Ce service calcule le rapport à la demande, à tout moment :
//   - pour une session fermée (données figées),
//   - pour la session en cours (totaux recalculés en direct),
//   - pour une période libre, tous opérateurs confondus.
// Il fournit également la ventilation par mode de paiement (espèces /
// transferts) exigée pour le point de caisse.
// ============================================================================

import { getDb } from '../database/db';
import {
  journalCaisseService,
  VentilationCaisse,
} from './journalCaisseService';

export interface FiltreRapport {
  /** Origine déclarée uniquement : aucune déduction à partir d'un identifiant historique. */
  origin?: 'vente' | 'prestation';
  /** Session précise (prioritaire sur les dates) */
  idSession?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  /** Filtre sur le nom de l'opérateur */
  operateur?: string | null;
  /** Filtre sur la catégorie d'opération (ex. VENTE_COMPTOIR) ; null = toutes */
  categorie?: string | null;
}

export interface RapportVente {
  /** Intitulé de la période couverte */
  libellePeriode: string;
  operateurNom: string;
  codeSession: string | null;
  statutSession: string | null;
  dateOuverture: string | null;
  dateFermeture: string | null;

  /** Fond de caisse reçu en début de poste */
  report: number;
  mouvements: any[];

  totalEntrees: number;
  totalSorties: number;
  /** Report + entrées − sorties */
  soldeCalcule: number;
  /** Comptage physique déclaré à la clôture (null si poste ouvert) */
  soldeDeclare: number | null;
  ecart: number | null;

  /** Ventilation par catégorie */
  totalVentesComptoir: number;
  totalReglements: number;
  totalDecomptes: number;
  totalCharges: number;

  /** Ventilation par mode de paiement */
  ventilation: VentilationCaisse;
  /** Espèces attendues dans le tiroir (report + espèces nettes) */
  especesAttendues: number;

  /** true si le poste est encore ouvert : rapport provisoire */
  provisoire: boolean;
}

const fmtDateFr = (d?: string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('fr-FR') + ' ' +
    dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export const rapportVenteService = {
  /**
   * Construit le rapport correspondant au filtre demandé.
   * Aucune contrainte de clôture : consultable à tout moment.
   */
  async construire(filtre: FiltreRapport): Promise<RapportVente> {
    const db = await getDb();

    let session: any = null;
    if (filtre.idSession) {
      const rows = await db.select<any[]>(
        `SELECT s.*, u.nom AS nom_utilisateur
         FROM sessions_caisse s
         LEFT JOIN utilisateurs u ON s.idUtilisateur = u.id
         WHERE s.idSession = ?`,
        [filtre.idSession]
      );
      session = rows[0] || null;
      if (!session) throw new Error('Session introuvable.');
    }

    // --- Sélection des mouvements ----------------------------------------
    let query = `
      SELECT j.*, u.nom AS nom_utilisateur
      FROM journal_caisse j
      LEFT JOIN utilisateurs u ON j.idUtilisateur = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filtre.idSession) {
      query += ` AND j.idSession = ?`;
      params.push(filtre.idSession);
    } else {
      if (filtre.dateDebut) {
        query += ` AND date(j.date_journal) >= ?`;
        params.push(filtre.dateDebut);
      }
      if (filtre.dateFin) {
        query += ` AND date(j.date_journal) <= ?`;
        params.push(filtre.dateFin);
      }
    }

    if (filtre.operateur) {
      query += ` AND (u.nom LIKE ? OR EXISTS (
                    SELECT 1 FROM sessions_caisse ss
                    WHERE ss.idSession = j.idSession AND ss.nom_operateur LIKE ?
                 ))`;
      params.push(`%${filtre.operateur}%`, `%${filtre.operateur}%`);
    }

    if (filtre.categorie) {
      query += ` AND j.categorie = ?`;
      params.push(filtre.categorie);
    }
    if (filtre.origin) { query += ' AND j.origin = ?'; params.push(filtre.origin); }

    query += ` ORDER BY j.date_journal ASC, j.idJournal ASC`;

    const mouvements = await db.select<any[]>(query, params);

    // --- Totaux ------------------------------------------------------------
    let totalEntrees = 0;
    let totalSorties = 0;
    let totalVentesComptoir = 0;
    let totalReglements = 0;
    let totalDecomptes = 0;
    let totalCharges = 0;

    for (const m of mouvements) {
      const montant = Number(m.montant) || 0;
      // Règle métier : seules les vraies SORTIE diminuent le solde.
      // Tout le reste (ENTREE et opérations « neutres ») est considéré
      // comme une entrée d'argent et s'intègre au solde.
      if (m.type_mouvement === 'SORTIE') {
        totalSorties += montant;
        if (m.categorie === 'CHARGE_FONCTIONNEMENT') totalCharges += montant;
      } else {
        totalEntrees += montant;
        if (m.categorie === 'VENTE_COMPTOIR') totalVentesComptoir += montant;
        if (m.categorie === 'REGLEMENT_FACTURE') totalReglements += montant;
        if (m.categorie === 'DECOMPTE_REVENDEUR') totalDecomptes += montant;
      }
    }

    // --- Report ------------------------------------------------------------
    let report = 0;
    if (session) {
      report = session.solde_initial || 0;
    } else if (filtre.dateDebut) {
      const anterieur = await db.select<any[]>(
        `SELECT solde_apres FROM journal_caisse
         WHERE date(date_journal) < ?
         ORDER BY idJournal DESC LIMIT 1`,
        [filtre.dateDebut]
      );
      report = anterieur[0]?.solde_apres || 0;
    }

    const ventilation = journalCaisseService.ventiler(mouvements);
    const soldeCalcule = report + totalEntrees - totalSorties;
    const provisoire = session ? session.statut !== 'FERMEE' : true;

    // --- Libellé de la période --------------------------------------------
    let libellePeriode: string;
    if (session) {
      libellePeriode = `${fmtDateFr(session.date_ouverture)} → ${
        session.date_fermeture ? fmtDateFr(session.date_fermeture) : 'en cours'
      }`;
    } else if (filtre.dateDebut && filtre.dateFin) {
      libellePeriode = filtre.dateDebut === filtre.dateFin
        ? new Date(filtre.dateDebut).toLocaleDateString('fr-FR')
        : `${new Date(filtre.dateDebut).toLocaleDateString('fr-FR')} → ${new Date(filtre.dateFin).toLocaleDateString('fr-FR')}`;
    } else {
      libellePeriode = 'Tout l\'historique';
    }

    return {
      libellePeriode,
      operateurNom: session?.nom_operateur || session?.nom_utilisateur || filtre.operateur || 'Tous les opérateurs',
      codeSession: session?.code_session || null,
      statutSession: session?.statut || null,
      dateOuverture: session?.date_ouverture || null,
      dateFermeture: session?.date_fermeture || null,
      report,
      mouvements,
      totalEntrees,
      totalSorties,
      soldeCalcule,
      soldeDeclare: session?.solde_declare ?? null,
      ecart: session?.statut === 'FERMEE' ? (session?.ecart ?? null) : null,
      totalVentesComptoir,
      totalReglements,
      totalDecomptes,
      totalCharges,
      ventilation,
      especesAttendues: report + ventilation.especes,
      provisoire,
    };
  },

  /** Liste des sessions disponibles pour le sélecteur de rapport. */
  async listerSessions(limite = 100): Promise<any[]> {
    const db = await getDb();
    return db.select<any[]>(
      `SELECT s.*, u.nom AS nom_utilisateur,
              (SELECT COUNT(*) FROM journal_caisse j WHERE j.idSession = s.idSession) AS nb_mouvements
       FROM sessions_caisse s
       LEFT JOIN utilisateurs u ON s.idUtilisateur = u.id
       ORDER BY s.date_ouverture DESC
       LIMIT ?`,
      [limite]
    );
  },

  /** Liste des opérateurs distincts, pour le filtre. */
  async listerOperateurs(): Promise<string[]> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT DISTINCT nom_operateur FROM sessions_caisse
       WHERE nom_operateur IS NOT NULL AND nom_operateur <> ''
       ORDER BY nom_operateur`
    );
    return rows.map(r => r.nom_operateur);
  },

  /** Export CSV du rapport, pour téléchargement. */
  construireCsv: construireRapportCsv,
};

export default rapportVenteService;
