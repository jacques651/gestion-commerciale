// src/services/journalCaisseService.ts

import { getDb } from "../database/db";

/**
 * Modes de paiement suivis en caisse.
 * NON_PRECISE couvre les opérations enregistrées avant l'introduction de la
 * colonne mode_paiement : elles ne doivent pas être comptées en espèces.
 */
export type ModePaiement =
  | 'ESPECES'
  | 'MOBILE_MONEY'
  | 'VIREMENT'
  | 'CHEQUE'
  | 'AUTRE';

export const MODES_PAIEMENT: { value: ModePaiement; label: string }[] = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'AUTRE', label: 'Autre' },
];

export const libelleModePaiement = (mode?: string | null): string => {
  if (!mode) return 'Non précisé';
  return MODES_PAIEMENT.find(m => m.value === mode)?.label || mode;
};

/**
 * Moyen de paiement concret (référentiel `moyens_paiement`).
 * `categorie` = famille qui pilote la ventilation espèces/transferts de la caisse.
 * `libelle`   = nom précis affiché (Orange Money, Wave, un mode « Autre » saisi…).
 */
export interface MoyenPaiement {
  id?: number;
  code: string;
  libelle: string;
  categorie: ModePaiement;
  est_systeme?: boolean;
  est_actif?: boolean;
  ordre?: number;
}

/** Liste de secours si le référentiel n'est pas encore disponible en base. */
export const MOYENS_PAIEMENT_DEFAUT: MoyenPaiement[] = [
  { code: 'ESPECES', libelle: 'Espèces', categorie: 'ESPECES', ordre: 1 },
  { code: 'ORANGE_MONEY', libelle: 'Orange Money', categorie: 'MOBILE_MONEY', ordre: 10 },
  { code: 'MOOV_MONEY', libelle: 'Moov Money', categorie: 'MOBILE_MONEY', ordre: 11 },
  { code: 'TELECEL_MONEY', libelle: 'Telecel Money', categorie: 'MOBILE_MONEY', ordre: 12 },
  { code: 'WAVE', libelle: 'Wave', categorie: 'MOBILE_MONEY', ordre: 13 },
  { code: 'SANK_MONEY', libelle: 'Sank Money', categorie: 'MOBILE_MONEY', ordre: 14 },
  { code: 'VIREMENT', libelle: 'Virement bancaire', categorie: 'VIREMENT', ordre: 20 },
  { code: 'CHEQUE', libelle: 'Chèque', categorie: 'CHEQUE', ordre: 30 },
  { code: 'AUTRE', libelle: 'Autre', categorie: 'AUTRE', ordre: 40 },
];

/** Transforme un libellé libre en code technique (slug majuscule, sans accents). */
export const slugMoyenPaiement = (libelle: string): string => {
  const sansAccents = (libelle || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // supprime les diacritiques
  const code = sansAccents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return code || 'AUTRE';
};

/**
 * Ventilation d'un ensemble d'opérations de caisse.
 * `especes` = ce qui doit physiquement se trouver dans le tiroir-caisse.
 * `transferts` = mobile money + virements (encaissé mais pas en caisse).
 */
export interface VentilationCaisse {
  /** Montant total de toutes les opérations (entrées − sorties) */
  total: number;
  totalEntrees: number;
  totalSorties: number;
  /** Espèces effectivement présentes en caisse (entrées − sorties espèces) */
  especes: number;
  especesEntrees: number;
  especesSorties: number;
  /** Transferts : mobile money + virements */
  transferts: number;
  mobileMoney: number;
  /** Détail du mobile money par opérateur */
  orangeMoney: number;
  moovMoney: number;
  telecelMoney: number;
  sankMoney: number;
  wave: number;
  autreMobile: number;
  virements: number;
  cheques: number;
  autres: number;
  /** Opérations sans mode de paiement renseigné (historique à régulariser) */
  nonPrecise: number;
  nbOperations: number;
  nbNonPrecise: number;
}

interface ChargeData {
  designation: string;
  montant: number;
  beneficiaire: string;
  categorie_charge: string;
  reference_paiement?: string;
  mode_paiement?: ModePaiement;
  mode_paiement_detail?: string;
  notes?: string;
}

class JournalCaisseService {

  private async getNextCodeJournal(db: any): Promise<string> {
    const count = await db.select(`
      SELECT COUNT(*) as count FROM journal_caisse
    `);
    const countValue = (count as any[])[0]?.count || 0;
    return `JRN-${String(countValue + 1).padStart(4, '0')}`;
  }

  private async calculerSolde(db: any): Promise<number> {
    try {
      const result = await db.select(`
        SELECT 
          COALESCE(SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE 0 END), 0) as total_entrees,
          COALESCE(SUM(CASE WHEN type_mouvement = 'SORTIE' THEN montant ELSE 0 END), 0) as total_sorties
        FROM journal_caisse
      `);
      return (result[0]?.total_entrees || 0) - (result[0]?.total_sorties || 0);
    } catch (error) {
      console.error('Erreur calcul solde:', error);
      return 0;
    }
  }

  /** Retourne l'idSession du poste de caisse actuellement ouvert (ou null). */
  async getSessionActiveId(db: any): Promise<number | null> {
    try {
      const rows = await db.select(
        `SELECT idSession FROM sessions_caisse WHERE statut = 'OUVERTE' ORDER BY date_ouverture DESC LIMIT 1`
      );
      return rows.length > 0 ? rows[0].idSession : null;
    } catch {
      return null;
    }
  }

  /**
   * Identifiant de l'utilisateur actuellement connecté.
   * L'utilisateur est mémorisé dans localStorage ('user') par AuthContext.
   * Sert à tracer l'opérateur de chaque opération de caisse (filtre par opérateur).
   */
  private getCurrentUserId(): number | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const id = Number(u?.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  /** Utilisateur connecté complet (mémorisé par AuthContext dans localStorage). */
  private getCurrentUser(): any | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Renvoie un id utilisateur VALIDE pour la clé étrangère de journal_caisse
   * (cible : table `utilisateurs`). Le login de l'app utilise la table `users`,
   * dont l'id peut ne pas exister dans `utilisateurs` → « FOREIGN KEY constraint
   * failed ». On recopie donc l'utilisateur connecté dans `utilisateurs` si
   * besoin (ce qui satisfait la FK ET trace l'opérateur dans les rapports).
   * En dernier recours (conflit, etc.) : null (autorisé par le schéma).
   */
  private async validUtilisateurId(db: any): Promise<number | null> {
    const u = this.getCurrentUser();
    const id = Number(u?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const rows = await db.select(`SELECT 1 AS ok FROM utilisateurs WHERE id = ? LIMIT 1`, [id]);
      if (rows && rows.length) return id;
      // Recopie de l'utilisateur du login vers `utilisateurs`.
      const nom = String(u?.nom || u?.login || 'Opérateur');
      const login = String(u?.login || u?.email || `user_${id}`);
      const role = String(u?.role || 'COMMERCIAL');
      await db.execute(
        `INSERT INTO utilisateurs (id, nom, login, mot_de_passe_hash, email, role)
         VALUES (?, ?, ?, '-', ?, ?)`,
        [id, nom, login, u?.email || null, role]
      );
      return id;
    } catch {
      return null;
    }
  }

  /**
   * Liste des moyens de paiement actifs (référentiel `moyens_paiement`),
   * triés par ordre puis libellé. Repli sur la liste par défaut si la table
   * n'existe pas encore (ancienne base non migrée).
   */
  async getMoyensPaiement(inclureInactifs = false): Promise<MoyenPaiement[]> {
    try {
      const db = await getDb();
      const rows = await db.select<any[]>(`
        SELECT id, code, libelle, categorie, est_systeme, est_actif, ordre
        FROM moyens_paiement
        ${inclureInactifs ? '' : 'WHERE est_actif = 1'}
        ORDER BY ordre ASC, libelle ASC
      `);
      if (!rows || rows.length === 0) return [...MOYENS_PAIEMENT_DEFAUT];
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        libelle: r.libelle,
        categorie: r.categorie as ModePaiement,
        est_systeme: !!r.est_systeme,
        est_actif: !!r.est_actif,
        ordre: r.ordre,
      }));
    } catch {
      return [...MOYENS_PAIEMENT_DEFAUT];
    }
  }

  /**
   * Ajoute (ou réactive) un moyen de paiement dans le référentiel.
   * Utilisé quand l'opérateur choisit « Autre » et saisit un nouveau moyen :
   * il est mémorisé et réapparaît ensuite dans la liste.
   */
  async ajouterMoyenPaiement(libelle: string, categorie: ModePaiement = 'AUTRE'): Promise<MoyenPaiement> {
    const db = await getDb();
    const nom = (libelle || '').trim();
    if (!nom) throw new Error('Le libellé du moyen de paiement est requis.');
    const code = slugMoyenPaiement(nom);

    // Déjà présent ? -> on le réactive et on renvoie l'existant.
    const existant = await db.select<any[]>(
      `SELECT id, code, libelle, categorie FROM moyens_paiement WHERE code = ?`, [code]
    );
    if (existant && existant.length > 0) {
      await db.execute(`UPDATE moyens_paiement SET est_actif = 1 WHERE code = ?`, [code]);
      return {
        id: existant[0].id, code: existant[0].code,
        libelle: existant[0].libelle, categorie: existant[0].categorie as ModePaiement,
      };
    }

    // Ordre : placé après les autres modes « AUTRE ».
    const maxOrdre = await db.select<any[]>(
      `SELECT COALESCE(MAX(ordre), 40) as m FROM moyens_paiement`
    );
    const ordre = Number(maxOrdre[0]?.m || 40) + 1;

    const res = await db.execute(
      `INSERT INTO moyens_paiement (code, libelle, categorie, est_systeme, est_actif, ordre)
       VALUES (?, ?, ?, 0, 1, ?)`,
      [code, nom, categorie, ordre]
    );
    return { id: Number(res.lastInsertId), code, libelle: nom, categorie };
  }

  async ajouterEntree(data: {
    categorie: 'VENTE_COMPTOIR' | 'REGLEMENT_FACTURE' | 'DECOMPTE_REVENDEUR' | 'AUTRE_ENTREE';
    designation: string;
    montant: number;
    reference?: string;
    idReference?: number;
    modePaiement?: ModePaiement;
    /** Libellé précis du moyen (Orange Money, Wave, mode « Autre »…). */
    modePaiementDetail?: string;
    notes?: string;
  }): Promise<number> {
    const db = await getDb();
    const soldeActuel = await this.calculerSolde(db);
    const nouveauSolde = soldeActuel + data.montant;
    const codeJournal = await this.getNextCodeJournal(db);
    const idSession = await this.getSessionActiveId(db);
    const idUtilisateur = await this.validUtilisateurId(db);

    const result = await db.execute(`
      INSERT INTO journal_caisse (
        code_journal, date_journal, type_mouvement, categorie,
        designation, montant, solde_apres, reference, idReference, notes, idSession, mode_paiement, idUtilisateur, mode_paiement_detail
      ) VALUES (?, datetime('now'), 'ENTREE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeJournal,
      data.categorie,
      data.designation,
      data.montant,
      nouveauSolde,
      data.reference || null,
      data.idReference || null,
      data.notes || null,
      idSession,
      data.modePaiement || null,
      idUtilisateur,
      data.modePaiementDetail || null
    ]);

    return Number(result.lastInsertId);
  }

  async ajouterSortie(data: {
    categorie: 'CHARGE_FONCTIONNEMENT' | 'AUTRE_SORTIE';
    designation: string;
    montant: number;
    reference?: string;
    idReference?: number;
    modePaiement?: ModePaiement;
    /** Libellé précis du moyen (Orange Money, Wave, mode « Autre »…). */
    modePaiementDetail?: string;
    notes?: string;
    force?: boolean; // enregistre la sortie même si le solde est insuffisant (ex. achat d'occasion réel)
  }): Promise<number> {
    const db = await getDb();
    const soldeActuel = await this.calculerSolde(db);

    if (!data.force && data.montant > soldeActuel) {
      throw new Error(`Solde insuffisant. Solde actuel: ${soldeActuel.toLocaleString()} FCFA`);
    }

    const nouveauSolde = soldeActuel - data.montant;
    const codeJournal = await this.getNextCodeJournal(db);
    const idSession = await this.getSessionActiveId(db);
    const idUtilisateur = await this.validUtilisateurId(db);

    const result = await db.execute(`
      INSERT INTO journal_caisse (
        code_journal, date_journal, type_mouvement, categorie,
        designation, montant, solde_apres, reference, idReference, notes, idSession, mode_paiement, idUtilisateur, mode_paiement_detail
      ) VALUES (?, datetime('now'), 'SORTIE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeJournal,
      data.categorie,
      data.designation,
      data.montant,
      nouveauSolde,
      data.reference || null,
      data.idReference || null,
      data.notes || null,
      idSession,
      data.modePaiement || null,
      idUtilisateur,
      data.modePaiementDetail || null
    ]);

    return Number(result.lastInsertId);
  }

  /**
   * Change le sens d'une opération (Entrée ⇄ Sortie) et répercute la variation
   * sur le solde cumulé de cette opération et de toutes les suivantes.
   * `solde_apres` est un cumul global (entrées − sorties) dans l'ordre d'insertion,
   * il suffit donc d'ajouter le delta à partir de l'opération modifiée.
   */
  async modifierTypeMouvement(
    idJournal: number,
    nouveauType: 'ENTREE' | 'SORTIE'
  ): Promise<void> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT type_mouvement, montant FROM journal_caisse WHERE idJournal = ?`,
      [idJournal]
    );
    const op = rows[0];
    if (!op) throw new Error('Opération introuvable.');
    if (op.type_mouvement === nouveauType) return; // rien à changer

    const montant = Number(op.montant) || 0;
    // Vers ENTREE : +2×montant ; vers SORTIE : −2×montant.
    const delta = (nouveauType === 'ENTREE' ? 1 : -1) * 2 * montant;

    await db.execute(
      `UPDATE journal_caisse SET type_mouvement = ? WHERE idJournal = ?`,
      [nouveauType, idJournal]
    );
    await db.execute(
      `UPDATE journal_caisse SET solde_apres = solde_apres + ? WHERE idJournal >= ?`,
      [delta, idJournal]
    );
  }

  async ajouterVenteComptoir(data: {
    montant: number;
    idVente: number;
    codeVente: string;
    clientNom?: string;
    modePaiement?: ModePaiement;
    modePaiementDetail?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'VENTE_COMPTOIR',
      designation: `Vente comptoir ${data.codeVente}${data.clientNom ? ` - ${data.clientNom}` : ''}`,
      montant: data.montant,
      reference: data.codeVente,
      idReference: data.idVente,
      modePaiement: data.modePaiement || 'ESPECES',
      modePaiementDetail: data.modePaiementDetail,
      notes: `Vente au comptoir enregistrée le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  /** Encaissement d'une prestation de service. Le mouvement reste une entrée
   * de vente pour les totaux de caisse, sans aucun mouvement de stock. */
  async ajouterPrestation(data: {
    montant: number;
    idVentePrestation: number;
    codeFacture: string;
    clientNom?: string;
    modePaiement?: ModePaiement;
    modePaiementDetail?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'VENTE_COMPTOIR',
      designation: `Prestation ${data.codeFacture}${data.clientNom ? ` - ${data.clientNom}` : ''}`,
      montant: data.montant,
      reference: data.codeFacture,
      idReference: data.idVentePrestation,
      modePaiement: data.modePaiement || 'ESPECES',
      modePaiementDetail: data.modePaiementDetail,
      notes: `Encaissement de prestation enregistré le ${new Date().toLocaleDateString('fr-FR')}`,
    });
  }

  /**
   * Contrepasse en caisse une vente au comptoir annulée.
   *
   * Retrouve l'écriture d'ENTREE (catégorie VENTE_COMPTOIR) créée lors de la
   * vente et poste une SORTIE de contrepassation du même montant et du même
   * mode de paiement. Le montant de la vente annulée est ainsi automatiquement
   * retiré du solde de caisse ET du rapport de vente (tous deux calculés à
   * partir du journal), tout en gardant une trace auditable.
   *
   * - Idempotent : si une contrepassation existe déjà pour cette vente, ne fait rien.
   * - Sans effet si aucune écriture de caisse n'existe (ex. vente à crédit non encaissée).
   *
   * @returns idJournal de la contrepassation créée, ou null si rien à faire.
   */
  async annulerVenteComptoir(data: {
    idVente: number;
    codeVente: string;
    motif?: string;
    annulePar?: string;
  }): Promise<number | null> {
    const db = await getDb();

    // Écriture(s) d'origine de cette vente au comptoir.
    const originaux = await db.select<any[]>(`
      SELECT idJournal, montant, mode_paiement, mode_paiement_detail
      FROM journal_caisse
      WHERE type_mouvement = 'ENTREE'
        AND categorie = 'VENTE_COMPTOIR'
        AND idReference = ?
    `, [data.idVente]);

    if (!originaux || originaux.length === 0) {
      // Aucune entrée de caisse liée à cette vente : rien à contrepasser.
      return null;
    }

    // Déjà contrepassée ? (SORTIE de contrepassation reliée à la même vente)
    const dejaAnnule = await db.select<any[]>(`
      SELECT COUNT(*) as n
      FROM journal_caisse
      WHERE type_mouvement = 'SORTIE'
        AND idReference = ?
        AND notes LIKE 'CONTREPASSATION%'
    `, [data.idVente]);

    if ((dejaAnnule[0]?.n || 0) > 0) {
      return null;
    }

    // Montant total et mode de paiement de la vente (on suppose un mode homogène).
    const montantTotal = originaux.reduce((s, o) => s + (Number(o.montant) || 0), 0);
    const mode = (originaux[0]?.mode_paiement as ModePaiement) || undefined;
    const modeDetail = originaux[0]?.mode_paiement_detail || undefined;

    const idJournal = await this.ajouterSortie({
      categorie: 'AUTRE_SORTIE',
      designation: `Annulation vente ${data.codeVente}`,
      montant: montantTotal,
      reference: data.codeVente,
      idReference: data.idVente,
      modePaiement: mode,
      modePaiementDetail: modeDetail,
      notes: `CONTREPASSATION vente ${data.codeVente}${data.motif ? ' — ' + data.motif : ''}${data.annulePar ? ' (par ' + data.annulePar + ')' : ''}`,
      force: true, // la contrepassation doit toujours être enregistrée
    });

    return idJournal;
  }

  async ajouterReglementFacture(data: {
    montant: number;
    idFacture: number;
    codeFacture: string;
    clientNom?: string;
    modePaiement?: ModePaiement;
    modePaiementDetail?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'REGLEMENT_FACTURE',
      designation: `Règlement facture ${data.codeFacture}${data.clientNom ? ` - ${data.clientNom}` : ''}`,
      montant: data.montant,
      reference: data.codeFacture,
      idReference: data.idFacture,
      modePaiement: data.modePaiement || 'ESPECES',
      modePaiementDetail: data.modePaiementDetail,
      notes: `Règlement de facture enregistré le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  async ajouterDecompteRevendeur(data: {
    montant: number;
    idDecompte: number;
    codeDecompte: string;
    revendeurNom?: string;
    modePaiement?: ModePaiement;
    modePaiementDetail?: string;
  }): Promise<number> {
    return this.ajouterEntree({
      categorie: 'DECOMPTE_REVENDEUR',
      designation: `Décompte revendeur ${data.codeDecompte}${data.revendeurNom ? ` - ${data.revendeurNom}` : ''}`,
      montant: data.montant,
      reference: data.codeDecompte,
      idReference: data.idDecompte,
      modePaiement: data.modePaiement || 'ESPECES',
      modePaiementDetail: data.modePaiementDetail,
      notes: `Décompte revendeur enregistré le ${new Date().toLocaleDateString('fr-FR')}`
    });
  }

  async ajouterCharge(data: ChargeData): Promise<{ idJournal: number; idCharge: number }> {
    const db = await getDb();
    const idSession = await this.getSessionActiveId(db);

    const idJournal = await this.ajouterSortie({
      categorie: 'CHARGE_FONCTIONNEMENT',
      designation: data.designation,
      montant: data.montant,
      reference: data.reference_paiement,
      modePaiement: data.mode_paiement || 'ESPECES',
      modePaiementDetail: data.mode_paiement_detail,
      notes: data.notes,
      // Une charge de fonctionnement est une dépense réelle : elle doit
      // toujours pouvoir être enregistrée, même si le solde de caisse est
      // bas ou nul (le solde reflètera simplement la sortie).
      force: true,
    });

    const chargeCount = await db.select(`
      SELECT COUNT(*) as count FROM charges_fonctionnement
    `);
    const countValue = (chargeCount as any[])[0]?.count || 0;
    const codeCharge = `CHG-${String(countValue + 1).padStart(4, '0')}`;

    const result = await db.execute(`
      INSERT INTO charges_fonctionnement (
        code_charge, date_charge, designation, montant,
        beneficiaire, categorie_charge, reference_paiement,
        idJournal, idSession, notes
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codeCharge,
      data.designation,
      data.montant,
      data.beneficiaire,
      data.categorie_charge,
      data.reference_paiement || null,
      idJournal,
      idSession,
      data.notes || null
    ]);

    return { idJournal, idCharge: Number(result.lastInsertId) };
  }

  /**
   * Retrait / prélèvement du patron : sortie d'argent de la caisse (tout ou
   * partie), typiquement après la clôture d'une gestion. Impacte directement
   * le solde. Enregistré comme SORTIE identifiable ('Retrait patron'), en
   * force (le retrait doit toujours aboutir même si le suivi de solde est bas).
   */
  async retraitPatron(data: {
    montant: number;
    motif?: string;
    modePaiement?: ModePaiement;
    modePaiementDetail?: string;
    notes?: string;
  }): Promise<number> {
    return this.ajouterSortie({
      categorie: 'AUTRE_SORTIE',
      designation: `Retrait patron${data.motif ? ' — ' + data.motif : ''}`,
      montant: data.montant,
      modePaiement: data.modePaiement || 'ESPECES',
      modePaiementDetail: data.modePaiementDetail,
      notes: `RETRAIT PATRON${data.motif ? ' — ' + data.motif : ''}${data.notes ? ' | ' + data.notes : ''}`,
      force: true,
    });
  }

  /** Recalcule solde_apres de tout le journal, chronologiquement (cumul global). */
  async recomputeSoldeApres(): Promise<void> {
    const db = await getDb();
    const rows = await db.select<any[]>(
      `SELECT idJournal, type_mouvement, montant FROM journal_caisse
       ORDER BY date_journal ASC, idJournal ASC`
    );
    let running = 0;
    for (const r of rows) {
      running += (r.type_mouvement === 'SORTIE') ? -(Number(r.montant) || 0) : (Number(r.montant) || 0);
      await db.execute(`UPDATE journal_caisse SET solde_apres = ? WHERE idJournal = ?`, [running, r.idJournal]);
    }
  }

  /**
   * Rattrapage : recrée en caisse les encaissements des règlements VALIDES qui
   * n'ont pas d'écriture de caisse (perdus à cause du bug de clé étrangère).
   * Idempotent : n'ajoute rien si une entrée équivalente existe déjà
   * (même facture, même montant, même jour).
   */
  async rattraperReglementsSansCaisse(): Promise<{ ajoutes: number }> {
    const db = await getDb();
    const idUtilisateur = await this.validUtilisateurId(db);
    const regs = await db.select<any[]>(
      `SELECT r.idReglement, r.code_reglement, r.montant, r.mode_reglement, r.date_reglement,
              r.idFacture, f.code_facture, c.NomComplet AS client_nom
       FROM reglements r
       LEFT JOIN factures f ON f.idFacture = r.idFacture
       LEFT JOIN clients c ON c.idClient = r.idClient
       WHERE COALESCE(r.statut, 'VALIDE') <> 'ANNULE' AND r.idFacture IS NOT NULL`
    );
    let ajoutes = 0;
    for (const r of regs) {
      const existe = await db.select<any[]>(
        `SELECT 1 FROM journal_caisse
         WHERE categorie = 'REGLEMENT_FACTURE' AND idReference = ? AND montant = ?
           AND date(date_journal) = date(?) LIMIT 1`,
        [r.idFacture, r.montant, r.date_reglement]
      );
      if (existe.length) continue;
      const code = await this.getNextCodeJournal(db);
      await db.execute(
        `INSERT INTO journal_caisse
           (code_journal, date_journal, type_mouvement, categorie, designation, montant,
            solde_apres, reference, idReference, notes, idSession, mode_paiement, idUtilisateur, mode_paiement_detail)
         VALUES (?, ?, 'ENTREE', 'REGLEMENT_FACTURE', ?, ?, 0, ?, ?, ?, NULL, ?, ?, NULL)`,
        [
          code, r.date_reglement,
          `Règlement facture ${r.code_facture || ''}${r.client_nom ? ' - ' + r.client_nom : ''}`.trim(),
          r.montant, r.code_facture || null, r.idFacture,
          `RATTRAPAGE CAISSE — règlement ${r.code_reglement || r.idReglement}`,
          r.mode_reglement || null, idUtilisateur,
        ]
      );
      ajoutes++;
    }
    if (ajoutes > 0) await this.recomputeSoldeApres();
    return { ajoutes };
  }

  /**
   * Ventile une liste d'opérations du journal par mode de paiement.
   * C'est le cœur du « point de caisse » : il distingue automatiquement
   * le montant total des opérations, les transferts (mobile money, virements)
   * et les espèces réellement présentes dans le tiroir.
   *
   * Fonction pure : réutilisable pour le journal, le rapport de fin de poste
   * et le rapport de vente sans requête supplémentaire.
   */
  ventiler(mouvements: any[]): VentilationCaisse {
    const v: VentilationCaisse = {
      total: 0,
      totalEntrees: 0,
      totalSorties: 0,
      especes: 0,
      especesEntrees: 0,
      especesSorties: 0,
      transferts: 0,
      mobileMoney: 0,
      orangeMoney: 0,
      moovMoney: 0,
      telecelMoney: 0,
      sankMoney: 0,
      wave: 0,
      autreMobile: 0,
      virements: 0,
      cheques: 0,
      autres: 0,
      nonPrecise: 0,
      nbOperations: 0,
      nbNonPrecise: 0,
    };

    for (const m of mouvements || []) {
      const montant = Number(m.montant) || 0;
      // Seules les vraies SORTIE sont des sorties ; les « neutres » comptent comme entrée.
      const estEntree = m.type_mouvement !== 'SORTIE';
      const signe = estEntree ? 1 : -1;
      const mode = m.mode_paiement || null;

      v.nbOperations++;
      if (estEntree) v.totalEntrees += montant;
      else v.totalSorties += montant;

      switch (mode) {
        case 'ESPECES':
          v.especes += signe * montant;
          if (estEntree) v.especesEntrees += montant;
          else v.especesSorties += montant;
          break;
        case 'MOBILE_MONEY': {
          v.mobileMoney += signe * montant;
          // Éclatement par opérateur (d'après le libellé précis).
          const d = (m.mode_paiement_detail || '').toLowerCase();
          if (d.includes('orange')) v.orangeMoney += signe * montant;
          else if (d.includes('moov')) v.moovMoney += signe * montant;
          else if (d.includes('telecel') || d.includes('télétel') || d.includes('teletel')) v.telecelMoney += signe * montant;
          else if (d.includes('sank')) v.sankMoney += signe * montant;
          else if (d.includes('wave')) v.wave += signe * montant;
          else v.autreMobile += signe * montant;
          break;
        }
        case 'VIREMENT':
          v.virements += signe * montant;
          break;
        case 'CHEQUE':
          v.cheques += signe * montant;
          break;
        case 'AUTRE':
          v.autres += signe * montant;
          break;
        default:
          // Opération antérieure à la migration : mode inconnu.
          v.nonPrecise += signe * montant;
          v.nbNonPrecise++;
          break;
      }
    }

    v.transferts = v.mobileMoney + v.virements;
    v.total = v.totalEntrees - v.totalSorties;
    return v;
  }

  /**
   * Point de caisse complet sur une période et/ou une session donnée.
   * Renvoie la ventilation automatique demandée pour le point :
   * montant total, transferts (mobile money), espèces en caisse.
   */
  async getPointCaisse(filtre?: {
    dateDebut?: string;
    dateFin?: string;
    idSession?: number;
  }): Promise<VentilationCaisse & { report: number; soldeTheorique: number }> {
    const db = await getDb();

    let query = `SELECT * FROM journal_caisse WHERE 1=1`;
    const params: any[] = [];

    if (filtre?.idSession) {
      query += ` AND idSession = ?`;
      params.push(filtre.idSession);
    }
    if (filtre?.dateDebut) {
      query += ` AND date(date_journal) >= ?`;
      params.push(filtre.dateDebut);
    }
    if (filtre?.dateFin) {
      query += ` AND date(date_journal) <= ?`;
      params.push(filtre.dateFin);
    }
    query += ` ORDER BY idJournal ASC`;

    const mouvements = await db.select<any[]>(query, params);
    const ventilation = this.ventiler(mouvements);

    // Report : fond de caisse de la session, sinon solde antérieur à la période.
    let report = 0;
    if (filtre?.idSession) {
      const s = await db.select<any[]>(
        `SELECT solde_initial FROM sessions_caisse WHERE idSession = ?`,
        [filtre.idSession]
      );
      report = s[0]?.solde_initial || 0;
    } else if (filtre?.dateDebut) {
      const anterieur = await db.select<any[]>(
        `SELECT solde_apres FROM journal_caisse
         WHERE date(date_journal) < ?
         ORDER BY idJournal DESC LIMIT 1`,
        [filtre.dateDebut]
      );
      report = anterieur[0]?.solde_apres || 0;
    }

    return {
      ...ventilation,
      report,
      // Le solde théorique inclut le report : c'est la correction du
      // « total général » qui était calculé sans le fond de caisse.
      soldeTheorique: report + ventilation.total,
    };
  }

  async getSoldeActuel(): Promise<number> {
    try {
      const db = await getDb();
      return await this.calculerSolde(db);
    } catch (error) {
      console.error('Erreur getSoldeActuel:', error);
      return 0;
    }
  }

  async getMouvementsDuJour(date: string): Promise<any[]> {
    try {
      const db = await getDb();
      const startDate = date + ' 00:00:00';
      const endDate = date + ' 23:59:59';
      
      const result = await db.select(`
        SELECT 
          j.*,
          u.nom as nom_utilisateur
        FROM journal_caisse j
        LEFT JOIN utilisateurs u ON j.idUtilisateur = u.id
        WHERE j.date_journal >= ? AND j.date_journal <= ?
        ORDER BY j.idJournal ASC
      `, [startDate, endDate]);
      return result as any[];
    } catch (error) {
      console.error('Erreur getMouvementsDuJour:', error);
      return [];
    }
  }

  async getChargesDuJour(date: string): Promise<any[]> {
    try {
      const db = await getDb();
      const startDate = date + ' 00:00:00';
      const endDate = date + ' 23:59:59';
      
      const result = await db.select(`
        SELECT * FROM charges_fonctionnement 
        WHERE date_charge >= ? AND date_charge <= ?
        ORDER BY date_charge DESC
      `, [startDate, endDate]);
      return result as any[];
    } catch (error) {
      console.error('Erreur getChargesDuJour:', error);
      return [];
    }
  }

  async getRecapJournalier(date: string): Promise<any> {
    try {
      const db = await getDb();
      const startDate = date + ' 00:00:00';
      const endDate = date + ' 23:59:59';
      
      const recapResult = await db.select(`
        SELECT * FROM recapitulatif_journalier 
        WHERE date_recap = ?
      `, [date]);
      
      if ((recapResult as any[]).length > 0) {
        return (recapResult as any[])[0];
      }
      
      const initial = await db.select(`
        SELECT solde_apres as solde 
        FROM journal_caisse 
        WHERE date_journal < ?
        ORDER BY idJournal DESC 
        LIMIT 1
      `, [startDate]);
      
      const initSolde = (initial as any[])[0]?.solde || 0;
      
      const mouvements = await db.select(`
        SELECT type_mouvement, categorie, SUM(montant) as total
        FROM journal_caisse
        WHERE date_journal >= ? AND date_journal <= ?
        GROUP BY type_mouvement, categorie
      `, [startDate, endDate]);
      
      let totalEntrees = 0, totalSorties = 0;
      let totalVentesComptoir = 0, totalReglementsFactures = 0;
      let totalDecomptesRevendeurs = 0, totalCharges = 0;
      
      for (const m of (mouvements as any[])) {
        if (m.type_mouvement === 'ENTREE') {
          totalEntrees += m.total;
          if (m.categorie === 'VENTE_COMPTOIR') totalVentesComptoir += m.total;
          if (m.categorie === 'REGLEMENT_FACTURE') totalReglementsFactures += m.total;
          if (m.categorie === 'DECOMPTE_REVENDEUR') totalDecomptesRevendeurs += m.total;
        } else if (m.type_mouvement === 'SORTIE') {
          totalSorties += m.total;
          if (m.categorie === 'CHARGE_FONCTIONNEMENT') totalCharges += m.total;
        }
      }
      
      const soldeFinal = initSolde + totalEntrees - totalSorties;
      
      const newRecap = {
        date_recap: date,
        solde_initial: initSolde,
        total_entrees: totalEntrees,
        total_sorties: totalSorties,
        solde_final: soldeFinal,
        total_ventes_comptoir: totalVentesComptoir,
        total_reglements_factures: totalReglementsFactures,
        total_decomptes_revendeurs: totalDecomptesRevendeurs,
        total_charges: totalCharges
      };
      
      await db.execute(`
        INSERT OR REPLACE INTO recapitulatif_journalier (
          date_recap, solde_initial, total_entrees, total_sorties, solde_final,
          total_ventes_comptoir, total_reglements_factures, total_decomptes_revendeurs, total_charges
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        date, initSolde, totalEntrees, totalSorties, soldeFinal,
        totalVentesComptoir, totalReglementsFactures, totalDecomptesRevendeurs, totalCharges
      ]);
      
      return newRecap;
    } catch (error) {
      console.error('Erreur getRecapJournalier:', error);
      return null;
    }
  }

  // ✅ MÉTHODE CORRIGÉE - Utilise les bons noms de colonnes
  async getRapportAvecReport(
    idSession: number,
    filtre?: { dateDebut?: string; dateFin?: string; operateur?: string }
  ): Promise<{
    report: number;
    mouvements: any[];
    totalEntrees: number;
    totalSorties: number;
    soldeFinal: number;
    operateurNom: string;
    dateOuverture: string;
  }> {
    const db = await getDb();

    // Récupérer la session avec les bonnes colonnes
    const sessionResult = await db.select<any[]>(`
      SELECT 
        s.*,
        u.nom as nom_utilisateur
      FROM sessions_caisse s
      LEFT JOIN utilisateurs u ON s.idUtilisateur = u.id
      WHERE s.idSession = ?
    `, [idSession]);

    if (!sessionResult.length) {
      throw new Error('Session introuvable');
    }

    const session = sessionResult[0];
    
    // ✅ CORRECTION: Utiliser solde_initial au lieu de fond_de_caisse_initial
    const report = session.solde_initial || 0;

    let query = `
      SELECT 
        j.*,
        u.nom as nom_utilisateur
      FROM journal_caisse j
      LEFT JOIN utilisateurs u ON j.idUtilisateur = u.id
      WHERE j.idSession = ?
    `;
    const params: any[] = [idSession];

    if (filtre?.dateDebut) {
      query += ' AND date(j.date_journal) >= ?';
      params.push(filtre.dateDebut);
    }

    if (filtre?.dateFin) {
      query += ' AND date(j.date_journal) <= ?';
      params.push(filtre.dateFin);
    }

    if (filtre?.operateur) {
      query += ' AND u.nom LIKE ?';
      params.push(`%${filtre.operateur}%`);
    }

    query += ' ORDER BY j.date_journal ASC';

    const mouvements = await db.select<any[]>(query, params);

    let totalEntrees = 0;
    let totalSorties = 0;

    for (const m of mouvements) {
      if (m.type_mouvement === 'ENTREE') {
        totalEntrees += m.montant;
      } else {
        totalSorties += m.montant;
      }
    }

    const soldeFinal = report + totalEntrees - totalSorties;

    return {
      report,
      mouvements,
      totalEntrees,
      totalSorties,
      soldeFinal,
      operateurNom: session.nom_utilisateur || 'Inconnu',
      dateOuverture: session.date_ouverture
    };
  }

  // ✅ MÉTHODE CORRIGÉE
  async getRapportsParOperateur(
    dateDebut?: string,
    dateFin?: string
  ): Promise<any[]> {
    try {
      const db = await getDb();
      
      let query = `
        SELECT 
          s.idSession,
          s.code_session,
          s.nom_operateur,
          s.date_ouverture,
          s.date_fermeture,
          s.solde_initial as report,
          s.solde_calcule,
          s.solde_declare,
          s.ecart,
          s.total_entrees,
          s.total_sorties,
          s.statut,
          s.created_at,
          u.nom as nom_utilisateur,
          (SELECT COUNT(*) FROM journal_caisse j WHERE j.idSession = s.idSession) as nb_mouvements
        FROM sessions_caisse s
        LEFT JOIN utilisateurs u ON s.idUtilisateur = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (dateDebut) {
        query += ' AND date(s.date_ouverture) >= ?';
        params.push(dateDebut);
      }

      if (dateFin) {
        query += ' AND date(s.date_ouverture) <= ?';
        params.push(dateFin);
      }

      query += ' ORDER BY s.date_ouverture DESC';

      return await db.select<any[]>(query, params);
    } catch (error) {
      console.error('Erreur getRapportsParOperateur:', error);
      return [];
    }
  }
}

export const journalCaisseService = new JournalCaisseService();
