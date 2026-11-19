import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Group, Loader, Modal, Stack } from '@mantine/core';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useAtelierConfig } from '../../hooks/useAtelierConfig';
import { transactionService, type TransactionContext, type TransactionRef, type TransactionServiceContract } from '../../services/transactionFacade';
import SelecteurFormatImpression, { useFormatImpression } from '../common/SelecteurFormatImpression';
import { construireCssImpression } from '../../utils/printFormats';
import { loadPrestationReceipt, prestationReceiptCss, prestationReceiptHtml, type PrestationReceiptView } from './prestationReceiptModel';

interface Props {
  transactionRef: TransactionRef;
  ctx: TransactionContext | null;
  onClose: () => void;
  /** Lecture injectable pour le banc isolé ; aucune écriture depuis ce composant. */
  service?: Pick<TransactionServiceContract, 'getView'>;
}

export default function RecuPrestation({ transactionRef, ctx, onClose, service = transactionService }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { config, loading: configLoading } = useAtelierConfig();
  const { format, setFormat, pret } = useFormatImpression();
  const [loaded, setLoaded] = useState<{ key: string; view: PrestationReceiptView } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([transactionRef.origin, transactionRef.id, ctx?.utilisateurId, ctx?.role, ctx?.espaceId, revision]);
  useEffect(() => {
    let current = true;
    setLoaded(null); setFailure(null); setPrintError(null);
    loadPrestationReceipt(service, transactionRef, ctx).then(view => { if (current) setLoaded({ key, view }); })
      .catch((reason: unknown) => { if (current) setFailure({ key, message: reason instanceof Error ? reason.message : 'Impossible de charger le reçu de prestation.' }); });
    return () => { current = false; };
  }, [key, service]);
  const view = loaded?.key === key ? loaded.view : null;
  let error = failure?.key === key ? failure.message : null;
  let html = '';
  if (view && !configLoading) {
    try {
      if (!config) throw new Error('Paramètres du commerce indisponibles.');
      html = prestationReceiptHtml(view, config);
    } catch (reason: unknown) { error = reason instanceof Error ? reason.message : 'Impossible de générer le reçu.'; }
  }
  const ready = Boolean(html) && !error && pret && !configLoading;
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Recu_Prestation_${view?.code || transactionRef.id}`,
    ignoreGlobalStyles: true,
    pageStyle: `${prestationReceiptCss}\n${construireCssImpression({ format, racine: '.recu-prestation-body' })}`,
    onBeforePrint: async () => { if (!ready) throw new Error('Le reçu complet doit être chargé avant l’impression.'); },
    onPrintError: (_location, reason) => setPrintError(`Impression impossible : ${reason.message}`),
  });
  return <Modal opened onClose={onClose} title="Reçu de prestation" size="lg" centered>
    <Stack gap="sm">
      {error ? <Alert color="red" title="Reçu indisponible" role="alert">{error}
        <Button variant="subtle" size="xs" onClick={() => setRevision(value => value + 1)}>Réessayer</Button>
      </Alert> : !ready ? <Loader aria-label="Chargement du reçu" /> : null}
      {printError && <Alert color="red" title="Impression impossible" role="alert">{printError}</Alert>}
      {html && !error && <div ref={printRef}>
        <style>{prestationReceiptCss}</style>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>}
      <Group justify="space-between" align="flex-end" gap="xs" wrap="wrap">
        <SelecteurFormatImpression format={format} onFormatChange={setFormat} avecOrientation={false} size="xs" label="Format" />
        <Group gap="xs"><Button variant="subtle" size="compact-xs" onClick={onClose}>Fermer</Button>
          <Button size="compact-xs" leftSection={<Printer size={14} />} disabled={!ready} onClick={() => { setPrintError(null); handlePrint(); }}>Imprimer</Button></Group>
      </Group>
    </Stack>
  </Modal>;
}
