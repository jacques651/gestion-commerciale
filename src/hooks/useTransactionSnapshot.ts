import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionService, type TransactionContext, type TransactionView } from '../services/transactionFacade';
import type { ConsolidatedFilters } from '../services/transactionConsolidation';
export function useTransactionContext(): TransactionContext | null {
  const { user } = useAuth();
  return useMemo(() => user ? { utilisateurId: user.id, role: user.role, espaceId: null } : null, [user?.id, user?.role]);
}
export function useTransactionSnapshot(ctx: TransactionContext | null, filters: ConsolidatedFilters = {}, revision = 0,
  reader: Pick<typeof transactionService, 'listAll'> = transactionService) {
  const [rows, setRows] = useState<TransactionView[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const filterKey = JSON.stringify(filters);
  useEffect(() => {
    let current = true; setLoading(true); setError(null); setRows([]);
    if (!ctx) { setError('Connectez-vous pour consulter les transactions.'); setLoading(false); return; }
    reader.listAll(filters, ctx).then(result => { if (current) setRows(result); })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Consultation impossible.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [ctx, filterKey, revision, reader]);
  return { rows, loading, error };
}
