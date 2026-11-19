// src/services/sessionCaisseService.ts
import { getDb } from '../database/db';

export interface SessionCaisse {
  idSession: number;
  idUtilisateur?: number | null;
  code_session: string;
  nom_operateur: string;
  date_ouverture: string;
  solde_initial: number;
  date_fermeture: string | null;
  solde_calcule: number | null;
  solde_declare: number | null;
  ecart: number;
  total_entrees: number;
  total_sorties: number;
  total_ventes: number;
  total_reglements: number;
  total_decomptes: number;
  total_charges: number;
  statut: 'OUVERTE' | 'FERMEE';
  notes_ouverture: string | null;
  notes_fermeture: string | null;
}

class SessionCaisseService {
  // ─── Session active (stockée en mémoire pour la session app) ──────────────
  private sessionActive: SessionCaisse | null = null;

  /** Recharge la session active depuis la DB (au démarrage ou après fermeture) */
  async chargerSessionActive(): Promise<SessionCaisse | null> {
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(
        `SELECT * FROM sessions_caisse WHERE statut = 'OUVERTE' ORDER BY date_ouverture DESC LIMIT 1`
      );
      this.sessionActive = rows.length > 0 ? rows[0] : null;
      return this.sessionActive;
    } catch (err) {
      console.error('Erreur chargerSessionActive:', err);
      return null;
    }
  }

  getSessionActive(): SessionCaisse | null {
    return this.sessionActive;
  }

  /**
   * Les comptes de connexion vivent dans `users`, tandis que les sessions de
   * caisse référencent `utilisateurs`. On crée le miroir minimal au besoin.
   */
  private async assurerUtilisateurSession(
    db: any,
    idUtilisateur: number | null | undefined,
    nomOperateur: string
  ): Promise<number | null> {
    const id = Number(idUtilisateur);
    if (!Number.isFinite(id) || id <= 0) return null;

    const existant = await db.select(`SELECT id FROM utilisateurs WHERE id = ? LIMIT 1`, [id]);
    if (existant.length > 0) return id;

    const source = await db.select(
      `SELECT nom, email, role FROM users WHERE id = ? LIMIT 1`, [id]
    );
    const compte = source[0];
    if (!compte) return null;

    const login = String(compte.email || `user_${id}`);
    await db.execute(
      `INSERT INTO utilisateurs (id, nom, login, mot_de_passe_hash, email, role)
       VALUES (?, ?, ?, '-', ?, ?)`,
      [id, compte.nom || nomOperateur.trim(), login, compte.email || null, compte.role || 'COMMERCIAL']
    );
    return id;
  }
  /** Ouvre un nouveau poste de travail */
  async ouvrirSession(
    nomOperateur: string,
    soldeInitial: number,
    notes?: string,
    idUtilisateur?: number | null
  ): Promise<SessionCaisse> {
    const db = await getDb();

    // Vérifier qu'aucune session n'est déjà ouverte
    const existing = await db.select<any[]>(
      `SELECT idSession FROM sessions_caisse WHERE statut = 'OUVERTE' LIMIT 1`
    );
    if (existing.length > 0) {
      throw new Error('Une session est déjà ouverte. Fermez-la avant d\'en ouvrir une nouvelle.');
    }

    // Générer le code session
    const count = await db.select<any[]>(`SELECT COUNT(*) as c FROM sessions_caisse`);
    const n = (count[0]?.c || 0) + 1;
    const now = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    const code = `SES-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${String(n).padStart(3, '0')}`;

    const utilisateurSession = await this.assurerUtilisateurSession(db, idUtilisateur, nomOperateur);
    const result = await db.execute(
      `INSERT INTO sessions_caisse (code_session, nom_operateur, solde_initial, statut, notes_ouverture, idUtilisateur)
       VALUES (?, ?, ?, 'OUVERTE', ?, ?)`,
      [code, nomOperateur.trim(), soldeInitial, notes || null, utilisateurSession]
    );

    const session = await db.select<any[]>(
      `SELECT * FROM sessions_caisse WHERE idSession = ?`,
      [Number(result.lastInsertId)]
    );
    this.sessionActive = session[0];
    return this.sessionActive!;
  }

  /**
   * Corrige une ouverture automatique attribuée au mauvais compte avant tout
   * mouvement. Une session manuelle ou déjà alimentée n'est jamais modifiée.
   */
  async reattribuerOuvertureAutomatique(
    idSession: number,
    nomOperateur: string,
    idUtilisateur: number | null
  ): Promise<SessionCaisse | null> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM sessions_caisse WHERE idSession = ? AND statut = 'OUVERTE' LIMIT 1`,
      [idSession]
    );
    const session = rows[0];
    if (!session || session.notes_ouverture !== 'Ouverture automatique après relève') return null;

    const mouvements = await db.select<any[]>(
      `SELECT COUNT(*) AS total FROM journal_caisse WHERE idSession = ?`,
      [idSession]
    );
    if (Number(mouvements[0]?.total || 0) > 0) return null;

    const utilisateurSession = await this.assurerUtilisateurSession(db, idUtilisateur, nomOperateur);
    await db.execute(
      `UPDATE sessions_caisse SET nom_operateur = ?, idUtilisateur = ? WHERE idSession = ?`,
      [nomOperateur.trim(), utilisateurSession, idSession]
    );
    const updated = await db.select<any[]>(`SELECT * FROM sessions_caisse WHERE idSession = ?`, [idSession]);
    this.sessionActive = updated[0] || null;
    return this.sessionActive;
  }
  /** Ferme le poste courant et calcule le bilan */
  async fermerSession(soldeDeclare: number, notes?: string): Promise<SessionCaisse> {
    const db = await getDb();

    if (!this.sessionActive) {
      await this.chargerSessionActive();
    }
    if (!this.sessionActive) {
      throw new Error('Aucune session ouverte à fermer.');
    }

    const idSession = this.sessionActive.idSession;

    // Calculer les totaux de la session depuis journal_caisse
    const totaux = await db.select<any[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN type_mouvement='ENTREE' THEN montant ELSE 0 END), 0) as total_entrees,
        COALESCE(SUM(CASE WHEN type_mouvement='SORTIE' THEN montant ELSE 0 END), 0) as total_sorties,
        COALESCE(SUM(CASE WHEN categorie='VENTE_COMPTOIR' THEN montant ELSE 0 END), 0) as total_ventes,
        COALESCE(SUM(CASE WHEN categorie='REGLEMENT_FACTURE' THEN montant ELSE 0 END), 0) as total_reglements,
        COALESCE(SUM(CASE WHEN categorie='DECOMPTE_REVENDEUR' THEN montant ELSE 0 END), 0) as total_decomptes,
        COALESCE(SUM(CASE WHEN categorie='CHARGE_FONCTIONNEMENT' THEN montant ELSE 0 END), 0) as total_charges
      FROM journal_caisse
      WHERE idSession = ?
    `, [idSession]);

    const t = totaux[0] || {};
    const soldeCalcule = (this.sessionActive.solde_initial || 0) + (t.total_entrees || 0) - (t.total_sorties || 0);
    const ecart = soldeDeclare - soldeCalcule;

    await db.execute(`
      UPDATE sessions_caisse SET
        date_fermeture = datetime('now'),
        solde_calcule = ?,
        solde_declare = ?,
        ecart = ?,
        total_entrees = ?,
        total_sorties = ?,
        total_ventes = ?,
        total_reglements = ?,
        total_decomptes = ?,
        total_charges = ?,
        statut = 'FERMEE',
        notes_fermeture = ?
      WHERE idSession = ?
    `, [
      soldeCalcule, soldeDeclare, ecart,
      t.total_entrees || 0, t.total_sorties || 0,
      t.total_ventes || 0, t.total_reglements || 0,
      t.total_decomptes || 0, t.total_charges || 0,
      notes || null,
      idSession
    ]);

    const updated = await db.select<any[]>(
      `SELECT * FROM sessions_caisse WHERE idSession = ?`, [idSession]
    );
    this.sessionActive = null;
    return updated[0];
  }

  /**
   * Relève / passation de caisse.
   * Fait le point du poste sortant (clôture) puis ouvre immédiatement le poste
   * de l'entrant, en reportant le solde compté du sortant comme fond de caisse.
   * Garantit ainsi la continuité et la cohérence des soldes entre gestions.
   */
  async releve(params: {
    soldeDeclareSortant: number;
    nomOperateurEntrant: string;
    notesSortant?: string;
    notesEntrant?: string;
  }): Promise<{ sortante: SessionCaisse; entrante: SessionCaisse }> {
    const sortante = await this.fermerSession(params.soldeDeclareSortant, params.notesSortant);
    const report = (sortante.solde_declare != null
      ? sortante.solde_declare
      : (sortante as any).solde_calcule) || 0;
    const entrante = await this.ouvrirSession(
      params.nomOperateurEntrant,
      Number(report) || 0,
      params.notesEntrant
    );
    return { sortante, entrante };
  }

  /** Récupère les écritures d'une session */
  async getEntreesSession(idSession: number): Promise<any[]> {
    const db = await getDb();
    return db.select<any[]>(
      `SELECT * FROM journal_caisse WHERE idSession = ? ORDER BY idJournal ASC`,
      [idSession]
    );
  }

  /** Historique de toutes les sessions fermées */
  async getHistoriqueSessiones(limit = 30): Promise<SessionCaisse[]> {
    const db = await getDb();
    return db.select<any[]>(
      `SELECT * FROM sessions_caisse ORDER BY date_ouverture DESC LIMIT ?`,
      [limit]
    );
  }

  async getSessionById(idSession: number): Promise<SessionCaisse | null> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT * FROM sessions_caisse WHERE idSession = ?`, [idSession]
    );
    return rows[0] || null;
  }

  /**
   * Report suggéré = solde de clôture du dernier poste fermé, MOINS les
   * retraits du patron effectués depuis cette clôture (le patron a pu retirer
   * tout ou partie de la caisse entre deux gestions).
   */
  async getReportSuggere(): Promise<number> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT solde_declare, solde_calcule, date_fermeture FROM sessions_caisse
       WHERE statut = 'FERMEE' ORDER BY date_fermeture DESC LIMIT 1`
    );
    if (rows.length === 0) return 0;
    const r = rows[0];
    // Si le comptage déclaré est nul/absent, on retombe sur le solde calculé
    // (théorique) : le report reflète alors le solde réel de la caisse.
    const declare = Number(r.solde_declare);
    const base = (Number.isFinite(declare) && declare > 0)
      ? declare
      : (Number(r.solde_calcule) || 0);

    // Retraits du patron enregistrés APRÈS la clôture (à déduire du fond à reporter).
    let retraits = 0;
    if (r.date_fermeture) {
      const w = await db.select<any[]>(
        `SELECT COALESCE(SUM(montant), 0) AS total FROM journal_caisse
         WHERE type_mouvement = 'SORTIE'
           AND notes LIKE 'RETRAIT PATRON%'
           AND date_journal > ?`,
        [r.date_fermeture]
      );
      retraits = Number(w[0]?.total || 0);
    }
    return Math.max(0, base - retraits);
  }
}

export const sessionCaisseService = new SessionCaisseService();
