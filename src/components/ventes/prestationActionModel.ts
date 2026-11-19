import type { MoyenPaiement } from '../../services/journalCaisseService.ts';
import type { TraitementFinancier, TransactionServiceContract } from '../../services/transactionContracts.ts';
import { PrestationAdapterError } from '../../services/adapters/prestationPersistence.ts';
import type { PrestationView } from './prestationFormModel.ts';
export type PrestationActionService = Pick<TransactionServiceContract, 'getView' | 'cancel' | 'delete'>;
export const refundDue = (view: PrestationView) => Math.max(0, view.montantEncaisse - view.montantRembourse);
export function validatePrestationConfirmation(motif: string, confirmed: boolean): string {
  if (!motif.trim()) throw new PrestationAdapterError('INVALID_INPUT', 'Le motif est obligatoire.');
  if (!confirmed) throw new PrestationAdapterError('INVALID_INPUT', 'Confirmez explicitement cette opération.');
  return motif.trim();
}
export function buildPrestationRefund(view: PrestationView, amount: number | string, method: MoyenPaiement | null): TraitementFinancier {
  const due = refundDue(view);
  if (!due) return { type: 'sans_remboursement', montantRembourse: 0, moyenPaiement: null };
  if (typeof amount !== 'number' || !Number.isFinite(amount)
    || Math.abs(amount - due) > Number.EPSILON * Math.max(1, due) * 16) {
    throw new PrestationAdapterError('REFUND_MISMATCH', 'Saisissez exactement le montant encaissé restant à rembourser.');
  }
  if (!method) throw new PrestationAdapterError('REFUND_REQUIRED', 'Choisissez le moyen de remboursement.');
  return { type: 'remboursement', montantRembourse: amount, moyenPaiement: method };
}
