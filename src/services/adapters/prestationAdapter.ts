import type { CancellationResult, CreateTransaction, DeletionResult, TraitementFinancier,
  TransactionContext, TransactionFilters, TransactionLinePrestation, TransactionModifications,
  TransactionPage, TransactionPagination, TransactionRef, TransactionServiceContract,
  TransactionView, TransactionAction, TransactionPaymentState, TransactionClient, TransactionPaymentInput } from '../transactionContracts.ts';
import { PERMISSIONS } from '../../types/permissions.ts';
import { prestationNativeDatabase } from './prestationNativeDatabase.ts';
import { PrestationAdapterError, type PrestationConnection, type PrestationDatabase,
  type PrestationOperation, type PrestationSqlValue } from './prestationPersistence.ts';
export { PrestationAdapterError } from './prestationPersistence.ts';

export const PRESTATION_TABLES = { ventes: 'ventes_prestations', reglements: 'reglements_prestations',
  journal: 'journal_caisse', operations: 'transaction_operations' } as const;
export interface PrestationAdapterAdapter extends TransactionServiceContract {}
export interface PrestationFilters extends TransactionFilters { inclureSupprimees?: boolean; exclureAnnulees?: boolean; }

interface Header {
  idVentePrestation: number; code_facture: string; idClient: number | null;
  client_nom: string | null; client_contact: string | null; date_vente: string;
  montant_total: number; montant_paye: number; mode_paiement: string | null;
  mode_paiement_detail: string | null; statut_paiement: string; observations: string | null;
  est_annule: number; version: number; updated_at: string | null; date_annulation: string | null;
  deleted_at: string | null; linked_nom: string | null; linked_contact: string | null;
}
interface Detail { idDetailPrestation: number; idVentePrestation: number; idPrestation: number | null;
  designation: string; unite_facturation: string; quantite: number; prix_unitaire: number; observations: string | null; }
interface Payment { idVentePrestation: number; montant: number; statut: string; idJournal: number | null; }
interface Cash { idJournal: number; origin_id: number; type_mouvement: string; montant: number;
  idJournalContrepasse: number | null; mode_paiement: string | null; mode_paiement_detail: string | null;
  date_journal: string; idSession: number | null; }
interface Operation { origin: string; origin_id: number; action: string; idUtilisateur: number;
  motif: string | null; after_json: string | null; }
interface Bundle { row: Header; lines: Detail[]; payments: Payment[]; cash: Cash[]; decomptee: boolean; }
type PrestationView = Extract<TransactionView, { origin: 'prestation' }>;

function fail(code: PrestationAdapterError['code'], message: string): never { throw new PrestationAdapterError(code, message); }
function positiveId(id: number): boolean { return Number.isSafeInteger(id) && id > 0; }
function close(a: number, b: number): boolean { return Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 16; }
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + Number(value), 0); }
function cancelled(row: Header): boolean { return Boolean(row.est_annule) || row.statut_paiement === 'ANNULEE'; }
function requireRef(ref: TransactionRef): void {
  if (ref.origin !== 'prestation' || !positiveId(ref.id)) fail('INVALID_INPUT', 'Référence de prestation invalide.');
}
function requireText(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_INPUT', `${label} obligatoire.`);
  return value.trim();
}
function roleAllows(ctx: TransactionContext, action: PrestationOperation): boolean {
  const permission = action === 'read' ? 'ventes.view' : ['cancel', 'delete'].includes(action) ? 'ventes.delete' : 'ventes.create';
  return PERMISSIONS.find(item => item.id === permission)?.defaultRoles.includes(ctx.role) === true;
}
function checkContext(ctx: TransactionContext, action: PrestationOperation): void {
  if (!positiveId(ctx.utilisateurId) || !roleAllows(ctx, action)) fail('FORBIDDEN', 'Droits insuffisants pour cette opération.');
  if (ctx.espaceId !== null) fail('FORBIDDEN', 'Cet espace ne peut pas être résolu par le schéma local actuel.');
}

function amounts(bundle: Bundle) {
  const incoming = bundle.cash.filter(row => row.type_mouvement === 'ENTREE');
  const originals = new Set(incoming.map(row => row.idJournal));
  const outgoing = bundle.cash.filter(row => row.type_mouvement === 'SORTIE');
  const grossCash = sum(incoming.map(row => row.montant));
  const grossPayments = sum(bundle.payments.map(row => row.montant));
  const gross = Math.max(Number(bundle.row.montant_paye), grossCash, grossPayments);
  const refunded = sum(outgoing.filter(row => row.idJournalContrepasse !== null && originals.has(row.idJournalContrepasse)).map(row => row.montant));
  const resolved = close(grossCash, Number(bundle.row.montant_paye))
    && (!bundle.payments.length || close(grossPayments, grossCash))
    && outgoing.every(row => row.idJournalContrepasse !== null && originals.has(row.idJournalContrepasse)
      && incoming.some(original => original.idJournal === row.idJournalContrepasse && close(original.montant, row.montant)))
    && bundle.payments.every(payment => payment.idJournal !== null
      && incoming.some(original => original.idJournal === payment.idJournal && close(original.montant, payment.montant)))
    && (refunded < gross || close(refunded, gross));
  return { incoming, outgoing, gross, refunded, resolved };
}

export function calculerEtatPaiement(total: number, encaisse: number, rembourse: number): TransactionPaymentState {
  const net = encaisse - rembourse;
  return net > total || close(net, total) ? 'PAYEE' : net > 0 ? 'PARTIELLE' : 'IMPAYEE';
}

function actions(bundle: Bundle, ctx: TransactionContext) {
  const a = amounts(bundle);
  const common = bundle.row.deleted_at ? 'Prestation masquée.' : cancelled(bundle.row) ? 'Prestation déjà annulée.'
    : bundle.decomptee ? 'Prestation liée à un décompte.' : !a.resolved ? 'Historique financier à rapprocher.' : null;
  const action = (operation: PrestationOperation, reason: string | null): TransactionAction => {
    const autorisee = roleAllows(ctx, operation);
    return { autorisee, disponible: autorisee && reason === null,
      raisonBlocage: !autorisee ? 'Droits insuffisants.' : reason };
  };
  return { modifier: action('update', common), annuler: action('cancel', common),
    supprimer: action('delete', common ?? (bundle.payments.length || a.gross > 0 ? 'Un règlement existe.' : null)) };
}

function view(bundle: Bundle, ctx: TransactionContext): PrestationView {
  const { row } = bundle;
  const a = amounts(bundle);
  return {
    ref: { origin: 'prestation', id: row.idVentePrestation }, origin: 'prestation', code: row.code_facture,
    version: row.version, client: { idClient: row.idClient, nom: row.linked_nom ?? row.client_nom,
      contact: row.linked_contact ?? row.client_contact },
    dates: { creation: row.date_vente, modification: row.updated_at, annulation: row.date_annulation, suppression: row.deleted_at },
    lines: bundle.lines.map(line => ({ origin: 'prestation', idLigne: line.idDetailPrestation,
      designation: line.designation, quantite: line.quantite, prixUnitaire: line.prix_unitaire,
      unite: line.unite_facturation, ...(line.observations ? { observations: line.observations } : {}) })),
    montantFacture: Number(row.montant_total), montantEncaisse: a.gross, montantRembourse: a.refunded,
    restantDu: cancelled(row) ? 0 : Math.max(0, Number(row.montant_total) - a.gross + a.refunded),
    etatCommercial: cancelled(row) ? 'ANNULEE' : 'ACTIVE',
    etatPaiement: cancelled(row) ? 'ANNULEE' : calculerEtatPaiement(Number(row.montant_total), a.gross, a.refunded),
    observations: row.observations, documents: { recuPrestation: { idVentePrestation: row.idVentePrestation, code: row.code_facture } },
    actionsAutorisees: actions(bundle, ctx),
  };
}

export class PrestationAdapter implements PrestationAdapterAdapter {
  private readonly database: PrestationDatabase;
  constructor(database: PrestationDatabase = prestationNativeDatabase) { this.database = database; }

  private async verifierDroits(db: PrestationConnection, ctx: TransactionContext, action: PrestationOperation): Promise<void> {
    checkContext(ctx, action);
    const [actor] = await db.select<{ role: string; est_actif: number }>('SELECT role, est_actif FROM utilisateurs WHERE id = ?', [ctx.utilisateurId]);
    if (!actor || actor.est_actif !== 1 || actor.role.toLowerCase() !== ctx.role) fail('FORBIDDEN', 'Acteur absent, inactif ou rôle incohérent avec la base.');
    const [marker] = await db.select<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'prestation_migrations'");
    if (!marker?.n) fail('MIGRATION_REQUIRED', 'La migration prestations 3.1 doit être appliquée explicitement.');
    const [version] = await db.select<{ migration_id: string }>('SELECT migration_id FROM prestation_migrations WHERE version = 1');
    if (version?.migration_id !== 'prestations_v1') fail('MIGRATION_REQUIRED', 'Migration prestations absente ou incompatible.');
  }

  private async executerDansTransaction<T>(ctx: TransactionContext, action: PrestationOperation,
    work: (db: PrestationConnection) => Promise<T>): Promise<T> {
    checkContext(ctx, action);
    return this.database.transaction(ctx, action, async db => { await this.verifierDroits(db, ctx, action); return work(db); });
  }

  private async bundles(db: PrestationConnection, where: string, parameters: readonly PrestationSqlValue[], tail = ''): Promise<Bundle[]> {
    const headers = await db.select<Header>(`SELECT vp.*, c.NomComplet AS linked_nom, c.Tel AS linked_contact
      FROM ventes_prestations vp LEFT JOIN clients c ON c.idClient = vp.idClient WHERE ${where} ${tail}`, parameters);
    if (!headers.length) return [];
    const ids = headers.map(row => row.idVentePrestation);
    const placeholders = ids.map(() => '?').join(',');
    const lines = await db.select<Detail>(`SELECT * FROM vente_prestation_details WHERE idVentePrestation IN (${placeholders}) ORDER BY idDetailPrestation`, ids);
    const payments = await db.select<Payment>(`SELECT idVentePrestation, montant, statut, idJournal FROM reglements_prestations WHERE idVentePrestation IN (${placeholders})`, ids);
    const cash = await db.select<Cash>(`SELECT idJournal, origin_id, type_mouvement, montant, idJournalContrepasse,
      mode_paiement, mode_paiement_detail, date_journal, idSession FROM journal_caisse
      WHERE origin = 'prestation' AND origin_id IN (${placeholders}) ORDER BY idJournal`, ids);
    const links = await db.select<{ idVentePrestation: number }>(`SELECT DISTINCT idVentePrestation FROM prestation_decompte_commission WHERE idVentePrestation IN (${placeholders})`, ids);
    const decomptees = new Set(links.map(link => link.idVentePrestation));
    return headers.map(row => ({ row, lines: lines.filter(line => line.idVentePrestation === row.idVentePrestation),
      payments: payments.filter(payment => payment.idVentePrestation === row.idVentePrestation),
      cash: cash.filter(entry => entry.origin_id === row.idVentePrestation), decomptee: decomptees.has(row.idVentePrestation) }));
  }

  private async bundle(db: PrestationConnection, ref: TransactionRef): Promise<Bundle> {
    requireRef(ref);
    const [bundle] = await this.bundles(db, 'vp.idVentePrestation = ?', [ref.id]);
    if (!bundle) fail('NOT_FOUND', 'Prestation introuvable.');
    return bundle;
  }

  private active(bundle: Bundle): void {
    if (bundle.row.deleted_at) fail('DELETED', 'Prestation masquée.');
    if (cancelled(bundle.row)) fail('ALREADY_CANCELLED', 'Prestation déjà annulée.');
    if (bundle.decomptee) fail('DECOMPTE_LINKED', 'Prestation liée à un décompte : opération bloquée.');
    if (!amounts(bundle).resolved) fail('HISTORY_UNRESOLVED', 'Historique financier non rapproché : aucune écriture automatique autorisée.');
  }

  private async client(db: PrestationConnection, client: TransactionClient): Promise<void> {
    if (!client || (client.idClient !== null && !positiveId(client.idClient))) fail('INVALID_INPUT', 'Client invalide.');
    if (client.idClient !== null) {
      const [row] = await db.select<{ est_actif?: number; est_annule?: number }>('SELECT * FROM clients WHERE idClient = ?', [client.idClient]);
      if (!row || row.est_actif === 0 || row.est_annule === 1) fail('FORBIDDEN', 'Client absent ou inaccessible.');
    }
  }

  private async lines(db: PrestationConnection, lines: readonly TransactionLinePrestation[]): Promise<TransactionLinePrestation[]> {
    if (!Array.isArray(lines) || !lines.length) fail('INVALID_INPUT', 'Au moins une prestation est requise.');
    for (const line of lines) {
      if (line.origin !== 'prestation' || !line.designation?.trim() || !Number.isFinite(line.quantite) || line.quantite <= 0
        || !Number.isFinite(line.prixUnitaire) || line.prixUnitaire < 0 || !line.unite?.trim()) fail('INVALID_INPUT', 'Ligne de prestation invalide.');
      if (line.idPrestation != null) {
        const [catalogue] = await db.select<{ idPrestation: number }>("SELECT idPrestation FROM prestations WHERE idPrestation = ? AND statut = 'ACTIVE'", [line.idPrestation]);
        if (!catalogue) fail('INVALID_INPUT', 'Prestation de catalogue absente ou inactive.');
      }
    }
    const total = sum(lines.map(line => line.quantite * line.prixUnitaire));
    if (!Number.isFinite(total)) fail('INVALID_INPUT', 'Montant total invalide.');
    return lines.map(line => ({ ...line, designation: line.designation.trim(), unite: line.unite.trim() }));
  }

  private payment(input: TransactionPaymentInput, total: number): void {
    if (!input || !Number.isFinite(input.montantPaye) || input.montantPaye < 0 || (input.montantPaye > total && !close(input.montantPaye, total))) fail('INVALID_INPUT', 'Montant encaissé incohérent.');
    if (input.montantPaye > 0) this.moyen(input.moyenPaiement);
  }
  private moyen(moyen: TransactionPaymentInput['moyenPaiement']): void {
    if (!moyen || !['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE', 'AUTRE'].includes(moyen.categorie)
      || !moyen.code?.trim() || !moyen.libelle?.trim()) fail('INVALID_INPUT', 'Moyen de paiement explicite requis.');
  }

  private async operation(db: PrestationConnection, key: string): Promise<Operation | undefined> {
    requireText(key, 'Clé d’opération');
    return (await db.select<Operation>('SELECT origin, origin_id, action, idUtilisateur, motif, after_json FROM transaction_operations WHERE operation_key = ?', [key]))[0];
  }
  private async record(db: PrestationConnection, key: string, id: number, action: PrestationOperation,
    ctx: TransactionContext, motif: string | null, before: TransactionView | null): Promise<void> {
    if (await this.operation(db, key)) fail('OPERATION_CONFLICT', 'Clé d’opération déjà utilisée.');
    await db.execute(`INSERT INTO transaction_operations (operation_key, origin, origin_id, action, idUtilisateur, motif, description, before_json)
      VALUES (?, 'prestation', ?, ?, ?, ?, ?, ?)`, [key, id, action, ctx.utilisateurId, motif,
      `${({ create: 'Création', update: 'Modification', cancel: 'Annulation', delete: 'Masquage', read: 'Consultation' })[action]} de la prestation ${before?.code ?? `#${id}`}${motif ? ` : ${motif}` : ''}`, before ? JSON.stringify(before) : null]);
  }
  private async result(db: PrestationConnection, key: string, result: unknown): Promise<void> {
    await db.execute('UPDATE transaction_operations SET after_json = ? WHERE operation_key = ?', [JSON.stringify(result), key]);
  }
  private async replaceLines(db: PrestationConnection, id: number, lines: readonly TransactionLinePrestation[], replace = true): Promise<void> {
    if (replace) await db.execute('DELETE FROM vente_prestation_details WHERE idVentePrestation = ?', [id]);
    for (const line of lines) await db.execute(`INSERT INTO vente_prestation_details
      (idVentePrestation, idPrestation, designation, unite_facturation, quantite, prix_unitaire, total, observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, line.idPrestation ?? null, line.designation, line.unite,
      line.quantite, line.prixUnitaire, line.quantite * line.prixUnitaire, line.observations ?? null]);
  }
  private async cash(db: PrestationConnection, id: number, code: string, montant: number,
    paiement: NonNullable<TransactionPaymentInput['moyenPaiement']>, ctx: TransactionContext, inverseOf: number | null, motif: string): Promise<{ id: number; session: number | null }> {
    const [session] = await db.select<{ idSession: number }>("SELECT idSession FROM sessions_caisse WHERE statut = 'OUVERTE' AND idUtilisateur = ? ORDER BY idSession DESC LIMIT 1", [ctx.utilisateurId]);
    const [balance] = await db.select<{ solde: number }>("SELECT COALESCE(SUM(CASE WHEN type_mouvement = 'ENTREE' THEN montant ELSE -montant END), 0) AS solde FROM journal_caisse");
    const [sequence] = await db.select<{ n: number }>('SELECT COALESCE(MAX(idJournal), 0) + 1 AS n FROM journal_caisse');
    const result = await db.execute(`INSERT INTO journal_caisse
      (code_journal, type_mouvement, categorie, designation, montant, solde_apres, reference, idReference,
       origin, origin_id, idJournalContrepasse, idUtilisateur, idSession, mode_paiement, mode_paiement_detail, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prestation', ?, ?, ?, ?, ?, ?, ?)`,
    [`JRN-${sequence.n}`, inverseOf === null ? 'ENTREE' : 'SORTIE', inverseOf === null ? 'VENTE_COMPTOIR' : 'AUTRE_SORTIE',
      `${inverseOf === null ? 'Prestation' : 'Annulation prestation'} ${code}`, montant,
      Number(balance.solde) + (inverseOf === null ? montant : -montant), code, id, id, inverseOf,
      ctx.utilisateurId, session?.idSession ?? null, paiement.categorie, paiement.libelle, motif]);
    return { id: result.lastInsertId, session: session?.idSession ?? null };
  }
  private async receive(db: PrestationConnection, id: number, code: string, payment: TransactionPaymentInput, ctx: TransactionContext, key: string): Promise<void> {
    if (payment.montantPaye <= 0 || !payment.moyenPaiement) return;
    const entry = await this.cash(db, id, code, payment.montantPaye, payment.moyenPaiement, ctx, null, 'Encaissement de prestation');
    await db.execute(`INSERT INTO reglements_prestations (code_reglement, idVentePrestation, montant, mode_paiement,
      mode_paiement_detail, idUtilisateur, idSession, idJournal, operation_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`RP-${entry.id}`, id, payment.montantPaye, payment.moyenPaiement.categorie, payment.moyenPaiement.libelle,
      ctx.utilisateurId, entry.session, entry.id, key]);
  }

  async create(input: CreateTransaction, ctx: TransactionContext): Promise<TransactionView> {
    if (input.origin !== 'prestation' || input.versionInitiale !== 1) fail('INVALID_INPUT', 'Création de prestation invalide.');
    return this.executerDansTransaction(ctx, 'create', async db => {
      if (await this.operation(db, input.cleOperation)) fail('OPERATION_CONFLICT', 'Clé d’opération déjà utilisée.');
      await this.client(db, input.client);
      const lines = await this.lines(db, input.lines);
      const total = sum(lines.map(line => line.quantite * line.prixUnitaire));
      this.payment(input.paiement, total);
      const [session] = await db.select<{ idSession: number }>("SELECT idSession FROM sessions_caisse WHERE statut = 'OUVERTE' AND idUtilisateur = ? ORDER BY idSession DESC LIMIT 1", [ctx.utilisateurId]);
      const [sequence] = await db.select<{ n: number }>('SELECT COALESCE(MAX(idVentePrestation), 0) + 1 AS n FROM ventes_prestations');
      const code = `PRE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(sequence.n).padStart(4, '0')}`;
      const inserted = await db.execute(`INSERT INTO ventes_prestations
        (code_facture, idClient, client_nom, client_contact, montant_total, montant_paye, mode_paiement,
         mode_paiement_detail, statut_paiement, idUtilisateur, idSession, observations, version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [code, input.client.idClient, input.client.nom, input.client.contact, total, input.paiement.montantPaye,
        input.paiement.moyenPaiement?.categorie ?? null, input.paiement.moyenPaiement?.libelle ?? null,
        calculerEtatPaiement(total, input.paiement.montantPaye, 0), ctx.utilisateurId, session?.idSession ?? null, input.observations ?? null]);
      const ref: TransactionRef = { origin: 'prestation', id: inserted.lastInsertId };
      await this.replaceLines(db, ref.id, lines, false);
      await this.record(db, input.cleOperation, ref.id, 'create', ctx, null, null);
      await this.receive(db, ref.id, code, input.paiement, ctx, input.cleOperation);
      const result = view(await this.bundle(db, ref), ctx);
      await this.result(db, input.cleOperation, result);
      return result;
    });
  }

  async update(ref: TransactionRef, modifications: TransactionModifications, versionAttendue: number, ctx: TransactionContext): Promise<TransactionView> {
    requireRef(ref);
    if (modifications.origin !== 'prestation' || !positiveId(versionAttendue)) fail('INVALID_INPUT', 'Modification de prestation invalide.');
    return this.executerDansTransaction(ctx, 'update', async db => {
      const before = await this.bundle(db, ref);
      this.active(before);
      if (before.row.version !== versionAttendue) fail('VERSION_CONFLICT', 'La prestation a été modifiée depuis son ouverture.');
      const current = view(before, ctx);
      const client = modifications.client ?? current.client;
      await this.client(db, client);
      const proposedLines = modifications.lines?.map((line, index) => ({ ...line,
        idPrestation: line.idPrestation === undefined ? before.lines[index]?.idPrestation ?? null : line.idPrestation,
      })) ?? before.lines.map(line => ({ origin: 'prestation' as const,
        idPrestation: line.idPrestation, designation: line.designation, unite: line.unite_facturation,
        quantite: line.quantite, prixUnitaire: line.prix_unitaire, observations: line.observations ?? undefined }));
      const lines = await this.lines(db, proposedLines);
      const total = sum(lines.map(line => line.quantite * line.prixUnitaire));
      const financialLines = lines.length !== before.lines.length || lines.some((line, index) => {
        const old = before.lines[index];
        return !old || !close(line.quantite, old.quantite) || !close(line.prixUnitaire, old.prix_unitaire)
          || line.unite !== old.unite_facturation || (line.idPrestation ?? null) !== old.idPrestation;
      });
      const payment = modifications.paiement ?? { montantPaye: before.row.montant_paye, moyenPaiement: null };
      const changedPayment = modifications.paiement !== undefined && (!close(payment.montantPaye, before.row.montant_paye)
        || payment.moyenPaiement?.categorie !== before.row.mode_paiement || payment.moyenPaiement?.libelle !== before.row.mode_paiement_detail);
      if (amounts(before).gross > 0 && (financialLines || changedPayment || modifications.client !== undefined)) {
        fail('FINANCIAL_CHANGE_AFTER_PAYMENT', 'Après paiement, seules la désignation et les observations sont modifiables.');
      }
      if (modifications.paiement) this.payment(payment, total);
      const updated = await db.execute(`UPDATE ventes_prestations SET idClient = ?, client_nom = ?, client_contact = ?,
        montant_total = ?, montant_paye = ?, mode_paiement = ?, mode_paiement_detail = ?, statut_paiement = ?,
        observations = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE idVentePrestation = ? AND version = ?`,
      [client.idClient, client.nom, client.contact, total, payment.montantPaye,
        modifications.paiement ? payment.moyenPaiement?.categorie ?? null : before.row.mode_paiement,
        modifications.paiement ? payment.moyenPaiement?.libelle ?? null : before.row.mode_paiement_detail,
        calculerEtatPaiement(total, payment.montantPaye, 0), modifications.observations ?? before.row.observations, ref.id, versionAttendue]);
      if (updated.rowsAffected !== 1) fail('VERSION_CONFLICT', 'Conflit de version.');
      await this.replaceLines(db, ref.id, lines);
      await this.record(db, modifications.cleOperation, ref.id, 'update', ctx, null, current);
      if (amounts(before).gross === 0) await this.receive(db, ref.id, before.row.code_facture, payment, ctx, modifications.cleOperation);
      const result = view(await this.bundle(db, ref), ctx);
      await this.result(db, modifications.cleOperation, result);
      return result;
    });
  }

  async cancel(ref: TransactionRef, motif: string, traitement: TraitementFinancier, cleOperation: string, ctx: TransactionContext): Promise<CancellationResult> {
    requireRef(ref); motif = requireText(motif, 'Motif');
    return this.executerDansTransaction(ctx, 'cancel', async db => {
      const before = await this.bundle(db, ref);
      const previous = await this.operation(db, cleOperation);
      if (previous) {
        if (previous.origin !== 'prestation' || previous.origin_id !== ref.id || previous.action !== 'cancel'
          || previous.idUtilisateur !== ctx.utilisateurId || previous.motif !== motif || !previous.after_json) fail('OPERATION_CONFLICT', 'Clé d’opération utilisée pour une autre demande.');
        const result = JSON.parse(previous.after_json) as CancellationResult;
        const refundEntries = amounts(before).outgoing;
        if (!traitement || !close(traitement.montantRembourse, result.montantRembourse)
          || (result.montantRembourse > 0 && (traitement.type !== 'remboursement' || refundEntries.some(row =>
            row.mode_paiement !== traitement.moyenPaiement.categorie || row.mode_paiement_detail !== traitement.moyenPaiement.libelle)))) fail('OPERATION_CONFLICT', 'Le remboursement confirmé diffère de la demande déjà exécutée.');
        return result;
      }
      this.active(before);
      const a = amounts(before);
      if (a.gross > 0 && (!traitement || traitement.type !== 'remboursement')) fail('REFUND_REQUIRED', 'Confirmer le montant et le moyen de remboursement.');
      const refund = a.gross - a.refunded;
      if (!traitement || !Number.isFinite(traitement.montantRembourse) || !close(traitement.montantRembourse, refund)) fail('REFUND_MISMATCH', 'Le remboursement doit couvrir exactement le montant encaissé restant.');
      if (refund > 0) this.moyen(traitement.moyenPaiement);
      await this.record(db, cleOperation, ref.id, 'cancel', ctx, motif, view(before, ctx));
      const ecritures: number[] = [];
      for (const original of a.incoming) {
        if (a.outgoing.some(row => row.idJournalContrepasse === original.idJournal)) continue;
        if (traitement.type !== 'remboursement') fail('REFUND_REQUIRED', 'Moyen de remboursement requis.');
        const inverse = await this.cash(db, ref.id, before.row.code_facture, original.montant, traitement.moyenPaiement, ctx, original.idJournal, motif);
        ecritures.push(inverse.id);
        // Reprise d'un encaissement historique certain : aucune nouvelle ENTREE.
        if (!before.payments.some(payment => payment.idJournal === original.idJournal)) {
          await db.execute(`INSERT INTO reglements_prestations (code_reglement, idVentePrestation, montant,
            date_reglement, mode_paiement, mode_paiement_detail, statut, idUtilisateur, idSession, idJournal, operation_key)
            VALUES (?, ?, ?, ?, ?, ?, 'ANNULE', ?, ?, ?, ?)`,
          [`RP-HIST-${original.idJournal}`, ref.id, original.montant, original.date_journal,
            original.mode_paiement ?? 'AUTRE', original.mode_paiement_detail, ctx.utilisateurId,
            original.idSession, original.idJournal, cleOperation]);
        }
      }
      await db.execute(`UPDATE reglements_prestations SET statut = 'ANNULE', date_annulation = CURRENT_TIMESTAMP,
        annule_par = ?, motif_annulation = ? WHERE idVentePrestation = ?`, [String(ctx.utilisateurId), motif, ref.id]);
      await db.execute(`UPDATE ventes_prestations SET est_annule = 1, statut_paiement = 'ANNULEE',
        date_annulation = CURRENT_TIMESTAMP, annule_par = ?, motif_annulation = ?,
        version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE idVentePrestation = ?`, [String(ctx.utilisateurId), motif, ref.id]);
      const result: CancellationResult = { success: true, ref, montantRembourse: refund,
        ecritureContrepasseId: ecritures.length === 1 ? ecritures[0] : null, ecrituresContrepasseIds: ecritures, motif };
      await this.result(db, cleOperation, result);
      return result;
    });
  }

  async delete(ref: TransactionRef, motif: string, mode: 'soft', ctx: TransactionContext): Promise<DeletionResult> {
    requireRef(ref); motif = requireText(motif, 'Motif');
    if (mode !== 'soft' || ctx.role !== 'admin') fail('FORBIDDEN', 'Masquage réservé aux administrateurs ; suppression physique interdite.');
    return this.executerDansTransaction(ctx, 'delete', async db => {
      const before = await this.bundle(db, ref); this.active(before);
      if (before.payments.length || amounts(before).gross > 0) fail('PAYMENT_EXISTS', 'Un règlement existe : utiliser l’annulation avec remboursement.');
      const key = `soft-delete:prestation:${ref.id}:v${before.row.version}`;
      await this.record(db, key, ref.id, 'delete', ctx, motif, view(before, ctx));
      await db.execute(`UPDATE ventes_prestations SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ?,
        version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE idVentePrestation = ?`, [ctx.utilisateurId, ref.id]);
      const result: DeletionResult = { success: true, ref, mode: 'soft' };
      await this.result(db, key, result); return result;
    });
  }

  async getView(ref: TransactionRef, ctx: TransactionContext): Promise<TransactionView> {
    requireRef(ref); checkContext(ctx, 'read');
    return this.database.read(ctx, async db => {
      await this.verifierDroits(db, ctx, 'read');
      const bundle = await this.bundle(db, ref);
      if (bundle.row.deleted_at && ctx.role !== 'admin') fail('NOT_FOUND', 'Prestation introuvable.');
      return view(bundle, ctx);
    });
  }

  async listView(filtres: PrestationFilters, pagination: TransactionPagination, ctx: TransactionContext): Promise<TransactionPage> {
    if (filtres.origin !== 'prestation') fail('INVALID_INPUT', 'Origine de liste invalide.');
    checkContext(ctx, 'read');
    if (!positiveId(pagination.page) || !positiveId(pagination.pageSize) || pagination.pageSize > 100) fail('INVALID_INPUT', 'Pagination invalide : 1 à 100 lignes par page.');
    const showDeleted = filtres.afficherSupprimees || filtres.inclureSupprimees;
    if (showDeleted && ctx.role !== 'admin') fail('FORBIDDEN', 'La consultation des prestations masquées est réservée aux administrateurs.');
    return this.database.read(ctx, async db => {
      await this.verifierDroits(db, ctx, 'read');
      const clauses = ['1 = 1']; const parameters: PrestationSqlValue[] = [];
      if (!showDeleted) clauses.push('vp.deleted_at IS NULL');
      if (filtres.exclureAnnulees || filtres.etatCommercial === 'ACTIVE') clauses.push("COALESCE(vp.est_annule, 0) = 0 AND vp.statut_paiement <> 'ANNULEE'");
      if (filtres.etatCommercial === 'ANNULEE') clauses.push("(vp.est_annule = 1 OR vp.statut_paiement = 'ANNULEE')");
      if (filtres.clientId !== undefined) { clauses.push('vp.idClient = ?'); parameters.push(filtres.clientId); }
      if (filtres.etatPaiement) { clauses.push('vp.statut_paiement = ?'); parameters.push(filtres.etatPaiement); }
      if (filtres.dateDebut) { clauses.push('date(vp.date_vente) >= date(?)'); parameters.push(filtres.dateDebut); }
      if (filtres.dateFin) { clauses.push('date(vp.date_vente) <= date(?)'); parameters.push(filtres.dateFin); }
      if (filtres.recherche?.trim()) {
        clauses.push(`(vp.code_facture LIKE ? OR COALESCE(c.NomComplet, vp.client_nom, '') LIKE ?
          OR COALESCE(c.Tel, vp.client_contact, '') LIKE ? OR EXISTS (SELECT 1 FROM vente_prestation_details d
          WHERE d.idVentePrestation = vp.idVentePrestation AND d.designation LIKE ?))`);
        parameters.push(...Array<PrestationSqlValue>(4).fill(`%${filtres.recherche.trim()}%`));
      }
      const where = clauses.join(' AND ');
      const [count] = await db.select<{ total: number }>(`SELECT COUNT(*) AS total FROM ventes_prestations vp LEFT JOIN clients c ON c.idClient = vp.idClient WHERE ${where}`, parameters);
      const bundles = await this.bundles(db, where, [...parameters, pagination.pageSize, (pagination.page - 1) * pagination.pageSize],
        'ORDER BY vp.date_vente DESC, vp.idVentePrestation DESC LIMIT ? OFFSET ?');
      return { items: bundles.map(bundle => view(bundle, ctx)), total: Number(count.total), ...pagination };
    });
  }
}

export const prestationAdapter: PrestationAdapterAdapter = new PrestationAdapter();
