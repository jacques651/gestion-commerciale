import { test, assert, fixture, admin, manager, input, cash } from './helpers/prestationFixture.ts';
import { createTransactionService } from '../src/services/transactionFacade.ts';
import { venteAdapter } from '../src/services/adapters/venteAdapter.ts';
import { buildPrestationRefund, validatePrestationConfirmation } from '../src/components/ventes/prestationActionModel.ts';
import { PrestationSubmission } from '../src/components/ventes/prestationFormModel.ts';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence.ts';

test('modale annulation : motif et confirmation requis, remboursement lié, clé idempotente', async ctx => {
  const f = await fixture(ctx); const service = createTransactionService({ vente: venteAdapter, prestation: f.adapter });
  const created = await service.create(input(100), admin); const view = await service.getView(created.ref, admin);
  if (view.origin !== 'prestation') throw new Error('Origine inattendue');
  const before = f.snapshot();
  for (const work of [() => validatePrestationConfirmation('', true), () => validatePrestationConfirmation('Motif', false),
    () => buildPrestationRefund(view, 50, cash), () => buildPrestationRefund(view, 100, null)]) {
    await assert.rejects(async () => work(), error => error instanceof PrestationAdapterError);
  }
  assert.deepEqual(f.snapshot(), before);
  const motif = validatePrestationConfirmation('  Erreur de saisie  ', true);
  const refund = buildPrestationRefund(view, 100, cash);
  const result = await service.cancel(view.ref, motif, refund, 'modal-cancel-idempotent', admin);
  const after = f.snapshot();
  assert.deepEqual(await service.cancel(view.ref, motif, refund, 'modal-cancel-idempotent', admin), result);
  assert.deepEqual(f.snapshot(), after);
  const entry = f.db.prepare("SELECT idJournal FROM journal_caisse WHERE type_mouvement='ENTREE'").get();
  const inverse = f.db.prepare("SELECT montant,categorie,idJournalContrepasse FROM journal_caisse WHERE type_mouvement='SORTIE'").get();
  assert.equal(inverse?.idJournalContrepasse, entry?.idJournal); assert.equal(inverse?.montant, 100); assert.equal(inverse?.categorie, 'AUTRE_SORTIE');
  assert.equal(f.db.prepare('SELECT statut FROM reglements_prestations').get()?.statut, 'ANNULE');
  const refreshed = await service.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin);
  assert.equal(refreshed.items[0].etatCommercial, 'ANNULEE'); assert.equal(refreshed.items[0].actionsAutorisees.annuler.disponible, false);
});

test('modale annulation partielle ou impayée : seul le montant encaissé est remboursé', async ctx => {
  const f = await fixture(ctx);
  for (const paid of [40, 0]) {
    const row = await f.adapter.create(input(paid), admin);
    if (row.origin !== 'prestation') throw new Error('Origine inattendue');
    const result = await f.adapter.cancel(row.ref, validatePrestationConfirmation('Test', true),
      buildPrestationRefund(row, paid, paid ? cash : null), `modal-cancel-${paid}`, admin);
    assert.equal(result.montantRembourse, paid); assert.equal(result.ecrituresContrepasseIds.length, paid ? 1 : 0);
  }
  assert.equal(f.count('journal_caisse'), 2);
});

test('modale suppression : soft delete admin, refus avec règlement et hors admin', async ctx => {
  const f = await fixture(ctx); const unpaid = await f.adapter.create(input(), admin); const paid = await f.adapter.create(input(100), admin);
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.delete(paid.ref, 'Test', 'soft', admin), error => error instanceof PrestationAdapterError && error.code === 'PAYMENT_EXISTS');
  await assert.rejects(() => f.adapter.delete(unpaid.ref, 'Test', 'soft', manager), error => error instanceof PrestationAdapterError && error.code === 'FORBIDDEN');
  await assert.rejects(() => f.adapter.cancel(paid.ref, 'Test', { type: 'remboursement', montantRembourse: 100, moyenPaiement: cash }, 'forbidden-cancel', manager),
    error => error instanceof PrestationAdapterError && error.code === 'FORBIDDEN');
  assert.deepEqual(f.snapshot(), before);
  const result = await f.adapter.delete(unpaid.ref, validatePrestationConfirmation('Doublon', true), 'soft', admin);
  assert.equal(result.mode, 'soft'); assert.equal(f.count('ventes_prestations'), 2);
  assert.equal((await f.adapter.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin)).total, 1);
  assert.equal((await f.adapter.listView({ origin: 'prestation', afficherSupprimees: true }, { page: 1, pageSize: 5 }, admin)).total, 2);
});

test('double confirmation : verrou synchrone pour annulation et suppression', async ctx => {
  const f = await fixture(ctx);
  for (const mode of ['cancel', 'delete'] as const) {
    const row = await f.adapter.create(input(mode === 'cancel' ? 100 : 0), admin);
    if (row.origin !== 'prestation') throw new Error('Origine inattendue');
    const gate = new PrestationSubmission(); let calls = 0; let release = () => {};
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const work = async () => { calls++; await barrier; return mode === 'cancel'
      ? f.adapter.cancel(row.ref, 'Test', buildPrestationRefund(row, 100, cash), 'double-modal', admin)
      : f.adapter.delete(row.ref, 'Test', 'soft', admin); };
    const first = gate.run(work); const second = gate.run(work); release(); await first;
    assert.equal(await second, undefined); assert.equal(calls, 1);
  }
});
