import { test, assert, fixture, input, admin, manager, cash } from './helpers/prestationFixture.ts';
import { PrestationAdapterError } from '../src/services/adapters/prestationAdapter.ts';
import type { PrestationErrorCode } from '../src/services/adapters/prestationPersistence.ts';
import type { TraitementFinancier, TransactionLinePrestation } from '../src/services/transactionContracts.ts';

function error(code: PrestationErrorCode) { return (value: unknown) => value instanceof PrestationAdapterError && value.code === code; }
const refund = (amount: number): TraitementFinancier => ({ type: 'remboursement', montantRembourse: amount, moyenPaiement: cash });
const noRefund: TraitementFinancier = { type: 'sans_remboursement', montantRembourse: 0, moyenPaiement: null };

for (const [label, paid, remaining, state] of [['payée', 100, 0, 'PAYEE'], ['partielle', 40, 60, 'PARTIELLE'], ['impayée', 0, 100, 'IMPAYEE']] as const) {
  test(`création ${label} : vue, caisse et absence de stock`, async ctx => {
    const f = await fixture(ctx); const stock = f.db.prepare('SELECT * FROM products').all();
    const result = await f.adapter.create(input(paid), admin);
    assert.equal(result.origin, 'prestation'); assert.equal(result.montantFacture, 100);
    assert.equal(result.montantEncaisse, paid); assert.equal(result.restantDu, remaining); assert.equal(result.etatPaiement, state);
    assert.equal(result.version, 1); assert.ok(result.code.startsWith('PRE-'));
    assert.equal(f.count('journal_caisse'), paid ? 1 : 0); assert.equal(f.count('reglements_prestations'), paid ? 1 : 0);
    assert.equal(f.count('transaction_operations'), 1); assert.equal(f.count('reglements'), 0);
    assert.deepEqual(f.db.prepare('SELECT * FROM products').all(), stock);
    assert.equal(f.db.prepare('SELECT montant_ttc FROM ventes').get()?.montant_ttc, 1234);
    assert.equal('idPrestation' in result.lines[0], false); assert.equal('idVente' in result, false);
    f.evidence(`creation-${state}`, result);
  });
}

test('update impayée : recalcul, version et conflit périmé sans modification', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(), admin);
  const result = await f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'update-1',
    lines: [{ origin: 'prestation', designation: 'Service modifié', quantite: 2, prixUnitaire: 75, unite: 'heure' }] }, 1, admin);
  assert.equal(result.montantFacture, 150); assert.equal(result.restantDu, 150); assert.equal(result.version, 2);
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'update-2', observations: 'Note' }, 1, admin), error('VERSION_CONFLICT'));
  assert.deepEqual(f.snapshot(), before);
});

test('update financière après paiement refusée, description autorisée sans nouvel encaissement', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin); const before = f.snapshot();
  const lines = original.lines as TransactionLinePrestation[];
  await assert.rejects(() => f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'financial',
    lines: [{ ...lines[0], prixUnitaire: 200 }] }, 1, admin), error('FINANCIAL_CHANGE_AFTER_PAYMENT'));
  assert.deepEqual(f.snapshot(), before);
  const result = await f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'description',
    lines: [{ ...lines[0], designation: 'Description corrigée' }], observations: 'Note corrigée' }, 1, admin);
  assert.equal(result.version, 2); assert.equal(result.lines[0].designation, 'Description corrigée');
  assert.equal(result.montantEncaisse, 100); assert.equal(f.count('journal_caisse'), 1);
});

test('cancel payée : SORTIE positive liée, règlements annulés et aucune seconde contrepassation', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin);
  const entry = f.db.prepare("SELECT idJournal FROM journal_caisse WHERE type_mouvement='ENTREE'").get()?.idJournal;
  const result = await f.adapter.cancel(original.ref, 'Erreur de saisie', refund(100), 'cancel-unique', admin);
  assert.equal(result.montantRembourse, 100); assert.equal(result.ecrituresContrepasseIds.length, 1);
  const inverse = f.db.prepare("SELECT * FROM journal_caisse WHERE type_mouvement='SORTIE'").get();
  assert.equal(inverse?.montant, 100); assert.equal(inverse?.categorie, 'AUTRE_SORTIE');
  assert.equal(inverse?.idJournalContrepasse, entry); assert.equal(inverse?.origin, 'prestation'); assert.equal(inverse?.solde_apres, 0);
  assert.equal(f.db.prepare('SELECT statut FROM reglements_prestations').get()?.statut, 'ANNULE');
  const snapshot = f.snapshot();
  assert.deepEqual(await f.adapter.cancel(original.ref, 'Erreur de saisie', refund(100), 'cancel-unique', admin), result);
  assert.deepEqual(f.snapshot(), snapshot);
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Autre demande', refund(100), 'cancel-autre', admin), error('ALREADY_CANCELLED'));
  const view = await f.adapter.getView(original.ref, admin);
  assert.equal(view.etatCommercial, 'ANNULEE'); assert.equal(view.etatPaiement, 'ANNULEE'); assert.equal(view.restantDu, 0);
  assert.equal(view.montantEncaisse, 100); assert.equal(view.montantRembourse, 100);
  for (const action of Object.values(view.actionsAutorisees)) assert.equal(action.disponible, false);
  f.evidence('annulation-remboursee', { result, view, journal: f.db.prepare('SELECT * FROM journal_caisse').all() });
});

test('cancel partielle : remboursement du seul encaissé ; impayée : aucune sortie', async ctx => {
  const f = await fixture(ctx); const partial = await f.adapter.create(input(40), admin);
  await f.adapter.cancel(partial.ref, 'Annulation partielle encaissée', refund(40), 'cancel-partial', admin);
  assert.equal((await f.adapter.getView(partial.ref, admin)).montantRembourse, 40);
  const unpaid = await f.adapter.create(input(), admin);
  const result = await f.adapter.cancel(unpaid.ref, 'Annulation sans paiement', noRefund, 'cancel-unpaid', admin);
  assert.equal(result.montantRembourse, 0); assert.equal(result.ecrituresContrepasseIds.length, 0);
  assert.equal(f.count('journal_caisse'), 2);
});

test('cancel : confirmation absente ou montant incorrect refusés intégralement', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin); const before = f.snapshot();
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Motif', undefined as unknown as TraitementFinancier, 'missing', admin), error('REFUND_REQUIRED'));
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Motif', refund(50), 'wrong-amount', admin), error('REFUND_MISMATCH'));
  assert.deepEqual(f.snapshot(), before);
});

test('soft delete : conservation, filtre admin et interdiction hors admin', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(), admin);
  await assert.rejects(() => f.adapter.delete(original.ref, 'Motif', 'soft', manager), error('FORBIDDEN'));
  await f.adapter.delete(original.ref, 'Doublon sans paiement', 'soft', admin);
  assert.equal(f.count('ventes_prestations'), 1); assert.ok(f.db.prepare('SELECT deleted_at FROM ventes_prestations').get()?.deleted_at);
  assert.equal((await f.adapter.listView({ origin: 'prestation' }, { page: 1, pageSize: 20 }, admin)).total, 0);
  assert.equal((await f.adapter.listView({ origin: 'prestation', afficherSupprimees: true }, { page: 1, pageSize: 20 }, admin)).total, 1);
  assert.equal((await f.adapter.listView({ origin: 'prestation', inclureSupprimees: true }, { page: 1, pageSize: 20 }, admin)).total, 1);
  await assert.rejects(() => f.adapter.listView({ origin: 'prestation', afficherSupprimees: true }, { page: 1, pageSize: 20 }, manager), error('FORBIDDEN'));
  await assert.rejects(() => f.adapter.getView(original.ref, manager), error('NOT_FOUND'));
});

test('delete : refus si un règlement existe, même annulé, ou si la prestation est annulée', async ctx => {
  const f = await fixture(ctx); const paid = await f.adapter.create(input(100), admin);
  await assert.rejects(() => f.adapter.delete(paid.ref, 'Masquer', 'soft', admin), error('PAYMENT_EXISTS'));
  await f.adapter.cancel(paid.ref, 'Annuler', refund(100), 'refund-delete', admin);
  await assert.rejects(() => f.adapter.delete(paid.ref, 'Masquer', 'soft', admin), error('ALREADY_CANCELLED'));
});

test('listView : inclut annulées, filtre et pagination, lecture groupée sans écriture', async ctx => {
  const f = await fixture(ctx);
  for (let i = 0; i < 6; i++) await f.adapter.create(input(), admin);
  const first = await f.adapter.listView({ origin: 'prestation' }, { page: 1, pageSize: 2 }, admin);
  await f.adapter.cancel(first.items[0].ref, 'Test', noRefund, 'cancel-list', admin);
  f.trace.selects.length = 0; const writes = f.trace.writes.length;
  const listed = await f.adapter.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin);
  assert.equal(listed.total, 6); assert.equal(listed.items.length, 5); assert.ok(f.trace.selects.length <= 10);
  assert.equal(f.trace.writes.length, writes); assert.equal(listed.items[0].etatCommercial, 'ANNULEE');
  const active = await f.adapter.listView({ origin: 'prestation', exclureAnnulees: true }, { page: 1, pageSize: 20 }, admin);
  assert.equal(active.total, 5);
  const search = await f.adapter.listView({ origin: 'prestation', recherche: 'Réparation' }, { page: 2, pageSize: 2 }, admin);
  assert.equal(search.total, 6); assert.equal(search.items.length, 2);
});

for (const action of ['create', 'update', 'cancel', 'delete'] as const) {
  test(`rollback intégral : erreur au milieu de ${action}`, async ctx => {
    const f = await fixture(ctx);
    const existing = action === 'create' ? null : await f.adapter.create(input(action === 'cancel' ? 100 : 0), admin);
    const before = f.snapshot();
    f.failOn(action === 'create' ? /INSERT INTO reglements_prestations/
      : action === 'update' ? /INSERT INTO transaction_operations/ : /UPDATE ventes_prestations/);
    await assert.rejects(async () => {
      if (action === 'create') await f.adapter.create(input(100), admin);
      else if (existing && action === 'update') await f.adapter.update(existing.ref, { origin: 'prestation', cleOperation: 'failed-update', observations: 'Note' }, 1, admin);
      else if (existing && action === 'cancel') await f.adapter.cancel(existing.ref, 'Motif', refund(100), 'failed-cancel', admin);
      else if (existing) await f.adapter.delete(existing.ref, 'Motif', 'soft', admin);
    }, /Erreur simulée/);
    assert.deepEqual(f.snapshot(), before); assert.ok(f.trace.rollbacks > 0);
  });
}

test('droits au point d’écriture : rôle usurpé, acteur absent et espace inconnu refusés', async ctx => {
  const f = await fixture(ctx);
  await assert.rejects(() => f.adapter.create(input(), { ...manager, role: 'admin' }), error('FORBIDDEN'));
  await assert.rejects(() => f.adapter.create(input(), { ...admin, utilisateurId: 999 }), error('FORBIDDEN'));
  await assert.rejects(() => f.adapter.create(input(), { ...admin, espaceId: 'autre' }), error('FORBIDDEN'));
  assert.equal(f.count('ventes_prestations'), 0);
});

test('validation : client, lignes, paiement, origine et clé unique', async ctx => {
  const f = await fixture(ctx);
  await assert.rejects(() => f.adapter.create({ ...input(), lines: [] }, admin), error('INVALID_INPUT'));
  await assert.rejects(() => f.adapter.create({ ...input(), client: { idClient: 999, nom: null, contact: null } }, admin), error('FORBIDDEN'));
  const wrong = input(100); wrong.paiement.moyenPaiement = null;
  await assert.rejects(() => f.adapter.create(wrong, admin), error('INVALID_INPUT'));
  const request = input(); await f.adapter.create(request, admin);
  await assert.rejects(() => f.adapter.create(request, admin), error('OPERATION_CONFLICT'));
  await assert.rejects(() => f.adapter.getView({ origin: 'vente', id: 1 }, admin), error('INVALID_INPUT'));
});

test('historique financier non rapproché : bloquer sans remboursement aveugle', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin);
  f.db.exec("UPDATE journal_caisse SET origin = NULL, origin_id = NULL");
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Motif', refund(100), 'history', admin), error('HISTORY_UNRESOLVED'));
  assert.deepEqual(f.snapshot(), before);
});

test('décompte lié : garde-fou sans brancher le calcul de commission', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(), admin);
  // Association fabriquee uniquement dans la base de test pour exercer le garde-fou.
  f.db.exec(`INSERT INTO clients(idClient, NomComplet, TypeClient) VALUES(10,'Revendeur test','revendeur');
    INSERT INTO decomptes(idDecompte,idClient,code_decompte) VALUES(10,10,'DCP-TEST');`);
  f.db.prepare(`INSERT INTO prestation_decompte_commission(idVentePrestation,idDecompte,montant_base,taux_commission,montant_commission)
    VALUES (?,10,100,0,0)`).run(original.ref.id);
  await assert.rejects(() => f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'linked', observations: 'Note' }, 1, admin), error('DECOMPTE_LINKED'));
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Motif', noRefund, 'linked-cancel', admin), error('DECOMPTE_LINKED'));
});

test('encaissement pendant update : une seule entrée et une seule session cohérente', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(), admin);
  const result = await f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'first-payment',
    paiement: { montantPaye: 40, moyenPaiement: cash } }, 1, admin);
  assert.equal(result.montantEncaisse, 40); assert.equal(result.restantDu, 60);
  assert.equal(f.count('journal_caisse'), 1); assert.equal(f.count('reglements_prestations'), 1);
  const header = f.db.prepare('SELECT idSession FROM ventes_prestations').get();
  assert.equal(header?.idSession, f.db.prepare('SELECT idSession FROM journal_caisse').get()?.idSession);
});

test('historique certain : plusieurs encaissements contrepassés une fois chacun, ventes isolées', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(40), admin);
  // Seule la base temporaire simule un second encaissement historique.
  f.db.prepare(`INSERT INTO journal_caisse (code_journal,type_mouvement,categorie,designation,montant,solde_apres,
    origin,origin_id,mode_paiement,mode_paiement_detail,idUtilisateur) VALUES('HIST-2','ENTREE','VENTE_COMPTOIR','Historique',60,100,'prestation',?,'ESPECES','Espèces',1)`)
    .run(original.ref.id);
  f.db.exec('UPDATE ventes_prestations SET montant_paye=100');
  // Aucun règlement historique n'existait : reconstruire uniquement les liens certains.
  f.db.exec('DELETE FROM reglements_prestations');
  f.db.prepare(`INSERT INTO journal_caisse (code_journal,type_mouvement,categorie,designation,montant,solde_apres,
    origin,origin_id,idUtilisateur) VALUES('VENTE-MEME-ID','ENTREE','VENTE_COMPTOIR','Vente indépendante',900,1000,'vente',?,1)`)
    .run(original.ref.id);
  const result = await f.adapter.cancel(original.ref, 'Historique certain', refund(100), 'historical-cancel', admin);
  assert.equal(result.ecrituresContrepasseIds.length, 2); assert.equal(result.ecritureContrepasseId, null);
  assert.equal(f.count('reglements_prestations'), 2);
  const view = await f.adapter.getView(original.ref, admin);
  assert.equal(view.montantEncaisse, 100); assert.equal(view.montantRembourse, 100);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM journal_caisse WHERE origin='vente'").get()?.n, 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM journal_caisse WHERE type_mouvement='ENTREE'").get()?.n, 3);
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Historique certain', refund(60), 'historical-cancel', admin), error('OPERATION_CONFLICT'));
  assert.deepEqual(f.snapshot(), before);
});

test('contrepassation historique partielle : refus sans double remboursement', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(100), admin);
  const entry = f.db.prepare('SELECT idJournal FROM journal_caisse').get()?.idJournal;
  f.db.prepare(`INSERT INTO journal_caisse (code_journal,type_mouvement,categorie,designation,montant,solde_apres,
    origin,origin_id,idJournalContrepasse,idUtilisateur) VALUES('PARTIAL-REFUND','SORTIE','AUTRE_SORTIE','Historique partiel',40,60,'prestation',?,?,1)`)
    .run(original.ref.id, entry);
  const before = f.snapshot();
  await assert.rejects(() => f.adapter.cancel(original.ref, 'Motif', refund(60), 'partial-history', admin), error('HISTORY_UNRESOLVED'));
  assert.deepEqual(f.snapshot(), before);
});

test('description payée issue de getView : préservation du lien catalogue', async ctx => {
  const f = await fixture(ctx);
  f.db.exec("INSERT INTO prestations(idPrestation,code_prestation,designation) VALUES(10,'CAT-TEST','Réparation')");
  const request = input(100); request.lines[0].idPrestation = 10;
  const original = await f.adapter.create(request, admin);
  const result = await f.adapter.update(original.ref, { origin: 'prestation', cleOperation: 'catalog-description',
    lines: [{ ...(original.lines[0] as TransactionLinePrestation), designation: 'Description précisée' }] }, 1, admin);
  assert.equal(result.lines[0].designation, 'Description précisée');
  assert.equal(f.db.prepare('SELECT idPrestation FROM vente_prestation_details').get()?.idPrestation, 10);
  assert.equal(f.count('journal_caisse'), 1);
});

test('statut historique ANNULEE : vue et filtres cohérents sans écriture', async ctx => {
  const f = await fixture(ctx); const original = await f.adapter.create(input(), admin);
  f.db.exec("UPDATE ventes_prestations SET statut_paiement='ANNULEE',est_annule=0");
  const before = f.snapshot(); const writes = f.trace.writes.length;
  const view = await f.adapter.getView(original.ref, admin);
  assert.equal(view.etatCommercial, 'ANNULEE');
  for (const action of Object.values(view.actionsAutorisees)) assert.equal(action.disponible, false);
  assert.equal((await f.adapter.listView({ origin: 'prestation', etatCommercial: 'ANNULEE' }, { page: 1, pageSize: 10 }, admin)).total, 1);
  assert.equal((await f.adapter.listView({ origin: 'prestation', exclureAnnulees: true }, { page: 1, pageSize: 10 }, admin)).total, 0);
  assert.equal(f.trace.writes.length, writes); assert.deepEqual(f.snapshot(), before);
});
