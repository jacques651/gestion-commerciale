import { test, assert, fixture, input, admin, manager } from './helpers/prestationFixture.ts';
import { initialPrestationFilters, loadPrestationPage, prestationActionHint, prestationListError,
  prestationState } from '../src/components/ventes/prestationListModel.ts';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence.ts';
import type { TransactionView } from '../src/services/transactionContracts.ts';

test('liste vide et propagation des erreurs typées', async ctx => {
  const f = await fixture(ctx);
  const page = await loadPrestationPage(f.adapter, initialPrestationFilters, { page: 1, pageSize: 10 }, admin);
  assert.equal(page.total, 0); assert.deepEqual(page.items, []);
  assert.ok(prestationListError(new PrestationAdapterError('MIGRATION_REQUIRED', 'Migration')).includes('manuellement'));
  assert.ok(prestationListError(new PrestationAdapterError('FORBIDDEN', 'Droits')).includes('session'));
});

test('statuts, recherche, période et supprimées passent par listView SQLite', async ctx => {
  const f = await fixture(ctx);
  const paid = await f.adapter.create(input(100), admin);
  await f.adapter.create(input(40), admin);
  const unpaid = await f.adapter.create(input(), admin);
  const cancelled = await f.adapter.create(input(), admin);
  const deleted = await f.adapter.create(input(), admin);
  await f.adapter.cancel(cancelled.ref, 'Test liste', { type: 'sans_remboursement', montantRembourse: 0, moyenPaiement: null }, 'list-cancel', admin);
  await f.adapter.delete(deleted.ref, 'Test liste', 'soft', admin);
  f.db.exec("UPDATE ventes_prestations SET date_vente='2026-11-17 10:00:00'");
  f.db.prepare("UPDATE ventes_prestations SET date_vente='2026-10-01 10:00:00' WHERE idVentePrestation=?").run(unpaid.ref.id);
  const all = await loadPrestationPage(f.adapter, initialPrestationFilters, { page: 1, pageSize: 10 }, admin);
  assert.equal(all.total, 4);
  assert.deepEqual([...new Set(all.items.map(prestationState))].sort(), ['ANNULEE', 'IMPAYEE', 'PARTIELLE', 'PAYEE']);
  const filtered = await loadPrestationPage(f.adapter, { ...initialPrestationFilters,
    statuts: ['PAYEE', 'PARTIELLE'], recherche: 'Réparation', dateDebut: '2026-11-01', dateFin: '2026-11-30' }, { page: 1, pageSize: 1 }, admin);
  assert.equal(filtered.total, 2); assert.equal(filtered.items.length, 1);
  const next = await loadPrestationPage(f.adapter, { ...initialPrestationFilters,
    statuts: ['PAYEE', 'PARTIELLE'] }, { page: 2, pageSize: 1 }, admin);
  assert.equal(next.items[0].ref.id, paid.ref.id);
  const visibleDeleted = await loadPrestationPage(f.adapter, { ...initialPrestationFilters, afficherSupprimees: true }, { page: 1, pageSize: 10 }, admin);
  assert.equal(visibleDeleted.total, 5);
  const masked = visibleDeleted.items.find(row => row.ref.id === deleted.ref.id)!;
  assert.equal(masked.actionsAutorisees.supprimer.disponible, false);
  await assert.rejects(() => loadPrestationPage(f.adapter, { ...initialPrestationFilters, afficherSupprimees: true }, { page: 1, pageSize: 10 }, manager),
    error => error instanceof PrestationAdapterError && error.code === 'FORBIDDEN');
  const cancelledView = all.items.find(row => row.ref.id === cancelled.ref.id)!;
  assert.equal(cancelledView.actionsAutorisees.modifier.disponible, false);
  assert.equal(cancelledView.actionsAutorisees.annuler.disponible, false);
  const managerView = await f.adapter.getView(paid.ref, manager);
  assert.ok(prestationActionHint(managerView.actionsAutorisees.supprimer, '3.6').includes('Droits'));
});

test('fusion multi-statut au-delà de 100 lignes : pagination globale, tri et transmission des filtres', async ctx => {
  const f = await fixture(ctx); const seed = await f.adapter.create(input(), admin);
  if (seed.origin !== 'prestation') throw new Error('Origine de test inattendue');
  const rows: TransactionView[] = Array.from({ length: 450 }, (_, index) => ({ ...seed,
    ref: { origin: 'prestation', id: index + 1 }, etatPaiement: index % 2 ? 'PAYEE' : 'PARTIELLE' }));
  let calls = 0;
  const page = await loadPrestationPage({ async listView(filters, pagination, context) {
    calls++; assert.equal(filters.origin, 'prestation'); assert.equal(filters.recherche, 'code');
    assert.equal(filters.dateDebut, '2026-01-01'); assert.equal(filters.afficherSupprimees, true);
    assert.equal(context, admin); assert.ok(pagination.pageSize <= 100);
    const matches = rows.filter(row => row.etatPaiement === filters.etatPaiement).sort((a, b) => b.ref.id - a.ref.id);
    return { ...pagination, total: matches.length,
      items: matches.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize) };
  } }, { ...initialPrestationFilters, recherche: 'code', dateDebut: '2026-01-01',
    afficherSupprimees: true, statuts: ['PAYEE', 'PARTIELLE', 'PAYEE'] }, { page: 21, pageSize: 10 }, admin);
  assert.equal(page.total, 450); assert.equal(page.items.length, 10); assert.equal(calls, 6);
  assert.deepEqual(page.items.map(row => row.ref.id), [250,249,248,247,246,245,244,243,242,241]);
});

test('période inversée refusée et tooltips des actions à venir', async () => {
  let called = false;
  await assert.rejects(() => loadPrestationPage({ async listView() { called = true; throw new Error('Ne doit pas être appelée'); } },
    { ...initialPrestationFilters, dateDebut: '2026-11-20', dateFin: '2026-11-01' }, { page: 1, pageSize: 10 }, admin),
    error => error instanceof PrestationAdapterError && error.code === 'INVALID_INPUT');
  assert.equal(called, false);
  assert.equal(prestationActionHint({ autorisee: true, disponible: true, raisonBlocage: null }, '3.5'), 'À venir (3.5)');
  assert.equal(prestationActionHint({ autorisee: true, disponible: false, raisonBlocage: 'Prestation déjà annulée.' }, '3.6'), 'Prestation déjà annulée.');
});

test('annulation historique : filtre commercial prioritaire, sans doublon avec les payées', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin);
  f.db.exec('UPDATE ventes_prestations SET est_annule=1');
  const cancelled = await loadPrestationPage(f.adapter, { ...initialPrestationFilters, statuts: ['ANNULEE'] }, { page: 1, pageSize: 5 }, admin);
  assert.equal(cancelled.total, 1); assert.equal(prestationState(cancelled.items[0]), 'ANNULEE');
  const paid = await loadPrestationPage(f.adapter, { ...initialPrestationFilters, statuts: ['PAYEE'] }, { page: 1, pageSize: 5 }, admin);
  assert.equal(paid.total, 0);
  const combined = await loadPrestationPage(f.adapter, { ...initialPrestationFilters, statuts: ['PAYEE', 'ANNULEE'] }, { page: 1, pageSize: 5 }, admin);
  assert.equal(combined.total, 1); assert.equal(combined.items[0].ref.id, original.ref.id);
});
