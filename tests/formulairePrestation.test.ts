import { test, assert, fixture, admin, cash } from './helpers/prestationFixture.ts';
import { buildPrestationCreate, buildPrestationUpdate, draftFromPrestation, emptyPrestationDraft,
  prestationFormError, PrestationSubmission } from '../src/components/ventes/prestationFormModel.ts';
import { createTransactionService } from '../src/services/transactionFacade.ts';
import { venteAdapter } from '../src/services/adapters/venteAdapter.ts';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence.ts';

for (const [choice, paid, remaining] of [['integral',100,0], ['partiel',40,60], ['impaye',0,100]] as const) {
  test(`formulaire create ${choice} : vue, client anonyme et caisse`, async ctx => {
    const f = await fixture(ctx); const service = createTransactionService({ vente: venteAdapter, prestation: f.adapter });
    const draft = emptyPrestationDraft(); draft.lines[0].designation = 'Réparation'; draft.lines[0].prixUnitaire = 100;
    draft.paiement = choice; draft.montantPartiel = 40; draft.moyenPaiement = choice === 'impaye' ? null : cash;
    const result = await service.create(buildPrestationCreate(draft, `form-create-${choice}`), admin);
    assert.equal(result.montantEncaisse, paid); assert.equal(result.restantDu, remaining);
    assert.deepEqual(result.client, { idClient: null, nom: null, contact: null });
    assert.equal(f.count('journal_caisse'), paid ? 1 : 0);
    const page = await service.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin);
    assert.equal(page.total, 1); assert.equal(page.items[0].ref.id, result.ref.id);
  });
}

test('formulaire : client existant, prix zéro accepté et validations sans écriture', async ctx => {
  const f = await fixture(ctx);
  f.db.exec("INSERT INTO clients(idClient,NomComplet,Tel,TypeClient) VALUES(10,'Client existant','123','client')");
  const draft = emptyPrestationDraft(); draft.lines[0].designation = 'Diagnostic offert';
  draft.client = { idClient: 10, nom: 'Client existant', contact: '123' };
  const result = await f.adapter.create(buildPrestationCreate(draft, 'free-service'), admin);
  assert.equal(result.client.idClient, 10); assert.equal(result.montantFacture, 0); assert.equal(f.count('journal_caisse'), 0);
  const before = f.snapshot();
  for (const bad of [
    { ...draft, lines: [] },
    { ...draft, lines: [{ ...draft.lines[0], designation: ' ' }] },
    { ...draft, lines: [{ ...draft.lines[0], quantite: 0 }] },
    { ...draft, lines: [{ ...draft.lines[0], prixUnitaire: -1 }] },
    { ...draft, lines: [{ ...draft.lines[0], prixUnitaire: '' }] },
    { ...draft, lines: [{ ...draft.lines[0], unite: '' }] },
    { ...draft, paiement: 'partiel' as const, montantPartiel: 0 },
    { ...draft, lines: [{ ...draft.lines[0], prixUnitaire: 100 }], moyenPaiement: null },
  ]) await assert.rejects(async () => buildPrestationCreate(bad, 'invalid'), error => error instanceof PrestationAdapterError && error.code === 'INVALID_INPUT');
  assert.deepEqual(f.snapshot(), before);
});

test('formulaire update payée : préremplissage, description seule, version et verrou financier serveur', async ctx => {
  const f = await fixture(ctx); const draft = emptyPrestationDraft();
  draft.lines[0].designation = 'Réparation'; draft.lines[0].prixUnitaire = 100; draft.moyenPaiement = cash;
  const created = await f.adapter.create(buildPrestationCreate(draft, 'paid-before-edit'), admin);
  const loaded = await f.adapter.getView(created.ref, admin);
  if (loaded.origin !== 'prestation') throw new Error('Origine inattendue');
  const editable = draftFromPrestation(loaded); editable.lines[0].designation = 'Réparation précisée'; editable.observations = 'Note';
  const modifications = buildPrestationUpdate(editable, loaded, 'description-edit');
  assert.equal('client' in modifications, false); assert.equal('paiement' in modifications, false);
  const updated = await f.adapter.update(loaded.ref, modifications, loaded.version, admin);
  assert.equal(updated.version, 2); assert.equal(updated.lines[0].designation, 'Réparation précisée'); assert.equal(f.count('journal_caisse'), 1);
  if (updated.origin !== 'prestation') throw new Error('Origine inattendue');
  const forbidden = draftFromPrestation(updated); forbidden.lines[0].quantite = 2;
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.update(updated.ref, buildPrestationUpdate(forbidden, updated, 'financial-edit'), updated.version, admin),
    error => error instanceof PrestationAdapterError && error.code === 'FINANCIAL_CHANGE_AFTER_PAYMENT');
  assert.deepEqual(f.snapshot(), before);
});

test('formulaire update : conflit de version explicite sans écriture', async ctx => {
  const f = await fixture(ctx); const draft = emptyPrestationDraft(); draft.lines[0].designation = 'Diagnostic'; draft.paiement = 'impaye';
  const original = await f.adapter.create(buildPrestationCreate(draft, 'version-create'), admin);
  if (original.origin !== 'prestation') throw new Error('Origine inattendue');
  const edited = draftFromPrestation(original); edited.observations = 'Modification concurrente';
  await f.adapter.update(original.ref, buildPrestationUpdate(edited, original, 'version-first'), 1, admin);
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.update(original.ref, buildPrestationUpdate(edited, original, 'version-stale'), 1, admin), error => {
    assert.ok(prestationFormError(error).includes('Rechargez'));
    return error instanceof PrestationAdapterError && error.code === 'VERSION_CONFLICT';
  });
  assert.deepEqual(f.snapshot(), before);
});

for (const mode of ['create', 'update'] as const) {
  test(`double-clic ${mode} : un seul appel, un seul enregistrement`, async ctx => {
    const f = await fixture(ctx); const gate = new PrestationSubmission();
    const draft = emptyPrestationDraft(); draft.lines[0].designation = 'Intervention'; draft.paiement = 'impaye';
    const original = mode === 'update' ? await f.adapter.create(buildPrestationCreate(draft, 'double-seed'), admin) : null;
    let release = () => {}; let calls = 0;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const work = async () => {
      calls++; await barrier;
      if (original?.origin === 'prestation') return f.adapter.update(original.ref, buildPrestationUpdate(draft, original, 'double-update'), original.version, admin);
      return f.adapter.create(buildPrestationCreate(draft, 'double-create'), admin);
    };
    const first = gate.run(work); const duplicate = gate.run(work);
    assert.equal(gate.busy, true); release();
    assert.ok(await first); assert.equal(await duplicate, undefined); assert.equal(await gate.run(work), undefined);
    assert.equal(calls, 1); assert.equal(f.count('ventes_prestations'), 1);
    assert.equal(f.db.prepare('SELECT version FROM ventes_prestations').get()?.version, mode === 'create' ? 1 : 2);
  });
}
