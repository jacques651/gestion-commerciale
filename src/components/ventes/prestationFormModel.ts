import type { CreatePrestation, ModificationPrestation, TransactionClient, TransactionLinePrestation,
  TransactionServiceContract, TransactionView } from '../../services/transactionContracts.ts';
import type { MoyenPaiement } from '../../services/journalCaisseService.ts';
import { PrestationAdapterError } from '../../services/adapters/prestationPersistence.ts';

export type PrestationView = Extract<TransactionView, { origin: 'prestation' }>;
export type PrestationFormService = Pick<TransactionServiceContract, 'create' | 'update' | 'getView'>;
export type PaymentChoice = 'integral' | 'partiel' | 'impaye';
export type DraftLine = Omit<TransactionLinePrestation, 'quantite' | 'prixUnitaire'> & {
  quantite: number | string; prixUnitaire: number | string;
};
export interface PrestationDraft {
  client: TransactionClient; lines: DraftLine[]; observations: string;
  paiement: PaymentChoice; montantPartiel: number | string; moyenPaiement: MoyenPaiement | null;
}
export const emptyPrestationLine = (): DraftLine => ({ origin: 'prestation', designation: '', quantite: 1,
  prixUnitaire: 0, unite: 'prestation' });
export const emptyPrestationDraft = (): PrestationDraft => ({ client: { idClient: null, nom: '', contact: '' },
  lines: [emptyPrestationLine()], observations: '', paiement: 'integral', montantPartiel: 0, moyenPaiement: null });
export function draftFromPrestation(view: PrestationView): PrestationDraft {
  return { client: { ...view.client }, lines: view.lines.map(line => ({ ...line })), observations: view.observations ?? '',
    paiement: view.montantEncaisse <= 0 ? 'impaye' : view.montantEncaisse < view.montantFacture ? 'partiel' : 'integral',
    montantPartiel: view.montantEncaisse, moyenPaiement: null };
}
function invalid(message: string): never { throw new PrestationAdapterError('INVALID_INPUT', message); }
function validLines(draft: PrestationDraft): TransactionLinePrestation[] {
  if (!draft.lines.length) invalid('Ajoutez au moins une ligne de prestation.');
  return draft.lines.map((line, index) => {
    if (!line.designation.trim()) invalid(`Ligne ${index + 1} : désignation obligatoire.`);
    if (typeof line.quantite !== 'number' || !Number.isFinite(line.quantite) || line.quantite <= 0) invalid(`Ligne ${index + 1} : quantité strictement positive requise.`);
    if (typeof line.prixUnitaire !== 'number' || !Number.isFinite(line.prixUnitaire) || line.prixUnitaire < 0) invalid(`Ligne ${index + 1} : prix supérieur ou égal à zéro requis.`);
    if (!line.unite.trim()) invalid(`Ligne ${index + 1} : unité obligatoire.`);
    return { ...line, quantite: line.quantite, prixUnitaire: line.prixUnitaire,
      designation: line.designation.trim(), unite: line.unite.trim() };
  });
}
export function draftTotal(draft: PrestationDraft): number {
  return draft.lines.reduce((total, line) => total + (typeof line.quantite === 'number' && typeof line.prixUnitaire === 'number'
    ? line.quantite * line.prixUnitaire : 0), 0);
}
function payment(draft: PrestationDraft, total: number) {
  const amount = draft.paiement === 'integral' ? total : draft.paiement === 'impaye' ? 0 : draft.montantPartiel;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > total
    || (draft.paiement === 'partiel' && (amount <= 0 || amount >= total))) invalid('Le paiement partiel doit être strictement compris entre zéro et le total facturé.');
  if (amount > 0 && !draft.moyenPaiement) invalid('Choisissez un moyen de paiement pour cet encaissement.');
  return { montantPaye: amount, moyenPaiement: amount > 0 ? draft.moyenPaiement : null };
}
function contents(draft: PrestationDraft) {
  const lines = validLines(draft);
  const total = draftTotal(draft);
  if (!Number.isFinite(total)) invalid('Montant total invalide.');
  return { lines, total, client: { ...draft.client, nom: draft.client.nom?.trim() || null,
    contact: draft.client.contact?.trim() || null }, observations: draft.observations.trim() };
}
export function buildPrestationCreate(draft: PrestationDraft, key: string): CreatePrestation {
  const { total, ...data } = contents(draft);
  return { origin: 'prestation', versionInitiale: 1, cleOperation: key, ...data, paiement: payment(draft, total) };
}
export function buildPrestationUpdate(draft: PrestationDraft, original: PrestationView, key: string): ModificationPrestation {
  const data = contents(draft);
  return { origin: 'prestation', cleOperation: key, lines: data.lines, observations: data.observations,
    ...(original.montantEncaisse > 0 ? {} : { client: data.client, paiement: payment(draft, data.total) }) };
}
export function prestationFormError(error: unknown): string {
  if (error instanceof PrestationAdapterError && error.code === 'VERSION_CONFLICT') {
    return 'La prestation a été modifiée par une autre opération. Rechargez ses données avant de recommencer ; votre saisie reste affichée.';
  }
  return error instanceof Error ? error.message : 'Enregistrement impossible. Vérifiez votre connexion et réessayez.';
}

/** Verrou synchrone, indépendant du rendu React : bloque double clic et nouvelle soumission après succès. */
export class PrestationSubmission {
  busy = false;
  completed = false;
  async run<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (this.busy || this.completed) return undefined;
    this.busy = true;
    try { const result = await work(); this.completed = true; return result; }
    finally { this.busy = false; }
  }
}
