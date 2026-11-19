import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, NumberInput, Select, SimpleGrid, Skeleton, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { transactionService, type CancellationResult, type DeletionResult, type TransactionContext, type TransactionRef } from '../../services/transactionFacade.ts';
import type { MoyenPaiement } from '../../services/journalCaisseService.ts';
import { PrestationSubmission, prestationFormError, type PrestationView } from './prestationFormModel.ts';
import { buildPrestationRefund, refundDue, validatePrestationConfirmation, type PrestationActionService } from './prestationActionModel.ts';
const loadMethods = async () => (await import('../../services/journalCaisseService')).journalCaisseService.getMoyensPaiement();
export interface ModalePrestationProps {
  transactionRef: TransactionRef; ctx: TransactionContext | null;
  onClose: () => void; onSuccess: (result: CancellationResult | DeletionResult) => void;
  service?: PrestationActionService; loadPaymentMethods?: () => Promise<MoyenPaiement[]>;
}
function ModaleActionPrestation({ intent, transactionRef, ctx, onClose, onSuccess,
  service = transactionService, loadPaymentMethods = loadMethods }: ModalePrestationProps & { intent: 'cancel' | 'delete' }) {
  const [view, setView] = useState<PrestationView | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [motif, setMotif] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [amount, setAmount] = useState<number | string>(''); const [method, setMethod] = useState<string | null>(null);
  const [methods, setMethods] = useState<MoyenPaiement[]>([]); const [reload, setReload] = useState(0);
  const gate = useRef(new PrestationSubmission()); const key = useRef<string | null>(null);
  const utilisateurId = ctx?.utilisateurId; const role = ctx?.role; const espaceId = ctx?.espaceId;
  useEffect(() => {
    let current = true; setLoading(true); setLoadError(null); setError(null); setView(null);
    setMotif(''); setConfirmed(false); setAmount(''); setMethod(null); setMethods([]);
    if (!ctx) { setLoadError('Connectez-vous avant cette opération.'); setLoading(false); return; }
    (async () => {
      const loaded = await service.getView(transactionRef, ctx);
      if (!loaded || loaded.origin !== 'prestation') throw new Error('Prestation introuvable ou inaccessible.');
      const available = intent === 'cancel' && refundDue(loaded) > 0 ? await loadPaymentMethods() : [];
      if (current) { setView(loaded); setMethods(available); gate.current = new PrestationSubmission(); key.current = null; }
    })().catch((reason: unknown) => { if (current) setLoadError(prestationFormError(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [intent, transactionRef.id, transactionRef.origin, utilisateurId, role, espaceId, service, loadPaymentMethods, reload]);
  const permission = view?.actionsAutorisees[intent === 'cancel' ? 'annuler' : 'supprimer'];
  const blocked = !permission?.autorisee || !permission.disponible;
  const due = view ? refundDue(view) : 0;
  const close = () => { if (!busy && !gate.current.busy) onClose(); };
  const submit = async () => {
    if (!ctx || !view || loading || blocked || gate.current.busy || gate.current.completed) return;
    setBusy(true); setError(null);
    let result: CancellationResult | DeletionResult | undefined;
    try {
      result = await gate.current.run(async () => {
        const reason = validatePrestationConfirmation(motif, confirmed);
        if (intent === 'delete') return service.delete(view.ref, reason, 'soft', ctx);
        const treatment = buildPrestationRefund(view, amount, methods.find(item => item.code === method) ?? null);
        const operationKey = key.current ??= `prestation:cancel:${crypto.randomUUID()}`;
        return service.cancel(view.ref, reason, treatment, operationKey, ctx);
      });
    } catch (reason: unknown) { setError(prestationFormError(reason)); }
    finally { setBusy(false); }
    if (result) {
      notifications.show({ title: intent === 'cancel' ? 'Prestation annulée' : 'Prestation masquée',
        message: `${view.code} : opération enregistrée.`, color: 'green' }); onSuccess(result);
    }
  };
  return <Modal opened onClose={close} centered size="lg" title={intent === 'cancel' ? 'Annuler la prestation' : 'Supprimer la prestation'}
    closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} overlayProps={{ blur: 0 }}>
    {loading ? <Stack gap="sm" aria-label="Chargement de la confirmation" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height="2em" />)}
    </Stack> : loadError ? <Stack gap="sm"><Text className="tk-empty">·</Text><Alert title="Opération indisponible" color="red" role="alert">{loadError}</Alert>
      <Group justify="flex-end"><Button variant="default" onClick={close}>Fermer</Button><Button onClick={() => setReload(value => value + 1)}>Recharger</Button></Group>
    </Stack> : view && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <Stack gap="sm">
        <Text fw={700}>{view.code} · {view.client.nom || 'Client comptoir'}</Text>
        <Text size="sm">{intent === 'delete' ? 'La prestation sera masquée et conservée dans l’historique.'
          : `Montant encaissé : ${view.montantEncaisse.toLocaleString('fr-FR')} FCFA. Remboursement à confirmer : ${due.toLocaleString('fr-FR')} FCFA.`}</Text>
        {blocked && <Alert color="orange" role="alert">{permission?.raisonBlocage || 'Action interdite pour cette prestation.'}</Alert>}
        {error && <Alert title="Opération refusée" color="red" role="alert">{error}</Alert>}
        <Textarea label="Motif" required value={motif} disabled={busy || blocked} minRows={2} maxRows={2}
          onChange={event => setMotif(event.currentTarget.value)} />
        {intent === 'cancel' && due > 0 && <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput label="Montant remboursé (FCFA)" className="tk-num" value={amount} min={0} required disabled={busy || blocked}
            thousandSeparator=" " onChange={setAmount} />
          <Select label="Moyen de remboursement" required placeholder="Choisissez un moyen" value={method} disabled={busy || blocked}
            data={methods.map(item => ({ value: item.code, label: item.libelle }))} onChange={setMethod} />
        </SimpleGrid>}
        <Checkbox label={intent === 'delete' ? 'Je confirme le masquage de cette prestation.'
          : due > 0 ? 'Je confirme le montant et le moyen du remboursement.' : 'Je confirme l’annulation de cette prestation.'}
          checked={confirmed} disabled={busy || blocked} onChange={event => setConfirmed(event.currentTarget.checked)} />
        <Group justify="flex-end"><Button type="button" variant="default" disabled={busy} onClick={close}>Fermer</Button>
          <Button type="submit" color="red" loading={busy} disabled={busy || blocked || !motif.trim() || !confirmed || gate.current.completed}>
            {intent === 'cancel' ? 'Confirmer l’annulation' : 'Masquer la prestation'}
          </Button>
        </Group>
      </Stack>
    </form>}
  </Modal>;
}
export function ModaleAnnulationPrestation(props: ModalePrestationProps) { return <ModaleActionPrestation {...props} intent="cancel" />; }
export function ModaleSuppressionPrestation(props: ModalePrestationProps) { return <ModaleActionPrestation {...props} intent="delete" />; }
