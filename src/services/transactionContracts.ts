/** Contrat metier de la sous-etape 3.2 : aucun acces a la base ou a la session. */
import type { Role } from '../types/auth';
import type { MoyenPaiement } from './journalCaisseService';
import type { StatutPaiementPrestation } from './prestationService';

export type TransactionOrigin = 'vente' | 'prestation';
export interface TransactionRef { origin: TransactionOrigin; id: number; }

export interface TransactionLineVente {
  origin: 'vente';
  idLigne?: number;
  idProduit: number;
  designation: string;
  quantite: number;
  prixUnitaireHt: number;
  prixUnitaireTtc: number;
  remisePourcentage: number;
  tauxTva: number;
  totalHt: number;
  totalTtc: number;
}

export interface TransactionLinePrestation {
  origin: 'prestation';
  idLigne?: number;
  idPrestation?: number | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  unite: string;
  observations?: string;
}

export type TransactionLine = TransactionLineVente | TransactionLinePrestation;
export type TransactionPaymentState = StatutPaiementPrestation;
/** Le masquage est une date distincte ; il ne remplace pas une annulation. */
export type TransactionCommercialState = 'ACTIVE' | 'ANNULEE';

export interface TransactionClient {
  idClient: number | null;
  nom: string | null;
  contact: string | null;
}

export interface TransactionDates {
  creation: string;
  modification: string | null;
  annulation: string | null;
  suppression: string | null;
}

export interface TransactionDocuments {
  recuPrestation?: { idVentePrestation: number; code: string };
  facture?: { idFacture: number; code: string };
  commande?: { idCommande: number; code: string };
}

export interface TransactionAction {
  /** Droit connu de l'adaptateur, sans choix de role dans l'interface. */
  autorisee: boolean;
  disponible: boolean;
  raisonBlocage: string | null;
}

interface TransactionViewCommon {
  code: string;
  version: number;
  client: TransactionClient;
  dates: TransactionDates;
  montantFacture: number;
  /** Encaissements bruts historiques, remboursements exposes separement. */
  montantEncaisse: number;
  montantRembourse: number;
  restantDu: number;
  etatCommercial: TransactionCommercialState;
  etatPaiement: TransactionPaymentState;
  observations: string | null;
  documents: TransactionDocuments;
  actionsAutorisees: {
    modifier: TransactionAction;
    annuler: TransactionAction;
    supprimer: TransactionAction;
  };
}

export type TransactionView = TransactionViewCommon & (
  | { origin: 'vente'; ref: { origin: 'vente'; id: number }; lines: TransactionLineVente[] }
  | { origin: 'prestation'; ref: { origin: 'prestation'; id: number }; lines: TransactionLinePrestation[] }
);

export interface TransactionPaymentInput {
  montantPaye: number;
  moyenPaiement: MoyenPaiement | null;
}

interface CreateTransactionCommon {
  /** La migration initialise a 1 ; la version attendue concerne les modifications. */
  versionInitiale: 1;
  cleOperation: string;
  client: TransactionClient;
  paiement: TransactionPaymentInput;
  observations?: string;
}

export interface CreateVente extends CreateTransactionCommon {
  origin: 'vente';
  typeVente: string;
  lines: TransactionLineVente[];
}

export interface CreatePrestation extends CreateTransactionCommon {
  origin: 'prestation';
  lines: TransactionLinePrestation[];
}

export type CreateTransaction = CreateVente | CreatePrestation;

interface ModificationCommon {
  cleOperation: string;
  client?: TransactionClient;
  paiement?: TransactionPaymentInput;
  observations?: string;
}

export interface ModificationVente extends ModificationCommon {
  origin: 'vente';
  lines?: TransactionLineVente[];
}

export interface ModificationPrestation extends ModificationCommon {
  origin: 'prestation';
  lines?: TransactionLinePrestation[];
}

export type TransactionModifications = ModificationVente | ModificationPrestation;
export type UpdateTransaction =
  | { ref: { origin: 'vente'; id: number }; modifications: ModificationVente; versionAttendue: number }
  | { ref: { origin: 'prestation'; id: number }; modifications: ModificationPrestation; versionAttendue: number };

export interface TransactionContext {
  utilisateurId: number;
  /** Aucun espace n'existe dans la session actuelle : ne pas en fabriquer un. */
  espaceId: string | null;
  /** Type existant reutilise, sans extension de roles ni lecture de localStorage. */
  role: Role;
}

export type TraitementFinancier =
  | { type: 'sans_remboursement'; montantRembourse: 0; moyenPaiement: null }
  | { type: 'remboursement'; montantRembourse: number; moyenPaiement: MoyenPaiement };

export interface CancellationResult {
  success: boolean;
  ref: TransactionRef;
  montantRembourse: number;
  /** Compatibilite du resultat simple ; null si aucune ou plusieurs ecritures. */
  ecritureContrepasseId: number | null;
  /** Une annulation peut contrepasser plusieurs encaissements d'origine. */
  ecrituresContrepasseIds: number[];
  motif: string;
}

export interface DeletionResult { success: boolean; ref: TransactionRef; mode: 'soft'; }
export interface TransactionPagination { page: number; pageSize: number; }
export interface TransactionPage extends TransactionPagination { items: TransactionView[]; total: number; }

export interface TransactionFilters {
  /** Routage explicite vers un adaptateur ; pas de pagination consolidee fictive. */
  origin: TransactionOrigin;
  recherche?: string;
  clientId?: number;
  dateDebut?: string;
  dateFin?: string;
  etatCommercial?: TransactionCommercialState;
  etatPaiement?: TransactionPaymentState;
  afficherSupprimees?: boolean;
}

/** Meme contrat pour la facade et ses adaptateurs, sans traitement metier a ce stade. */
export interface TransactionServiceContract {
  create(input: CreateTransaction, ctx: TransactionContext): Promise<TransactionView>;
  update(ref: TransactionRef, modifications: TransactionModifications, versionAttendue: number, ctx: TransactionContext): Promise<TransactionView>;
  cancel(ref: TransactionRef, motif: string, traitementFinancier: TraitementFinancier, cleOperation: string, ctx: TransactionContext): Promise<CancellationResult>;
  delete(ref: TransactionRef, motif: string, mode: 'soft', ctx: TransactionContext): Promise<DeletionResult>;
  getView(ref: TransactionRef, ctx: TransactionContext): Promise<TransactionView>;
  listView(filtres: TransactionFilters, pagination: TransactionPagination, ctx: TransactionContext): Promise<TransactionPage>;
}

export type TransactionErrorCode = 'NOT_IMPLEMENTED' | 'UNSUPPORTED_ORIGIN';

export class TransactionError extends Error {
  readonly code: TransactionErrorCode;
  readonly origin: TransactionOrigin | null;

  constructor(message: string, code: TransactionErrorCode, origin: TransactionOrigin | null = null) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
    this.origin = origin;
  }
}

export class TransactionNotImplementedError extends TransactionError {
  constructor(origin: TransactionOrigin) {
    super('Non implémenté — 3.3', 'NOT_IMPLEMENTED', origin);
    this.name = 'TransactionNotImplementedError';
  }
}
