import { test, assert, fixture, input, admin, cash } from './helpers/prestationFixture.ts';
import { loadPrestationReceipt, prestationReceiptCss, prestationReceiptHtml, validatePrestationReceipt,
  type ReceiptCommerce } from '../src/components/ventes/prestationReceiptModel.ts';
import type { TransactionServiceContract } from '../src/services/transactionContracts.ts';

const commerce: ReceiptCommerce = { nom_atelier: 'Commerce test', telephone: '01020304', adresse: 'Adresse test',
  email: 'commerce@example.test', ifu: 'IFU-TEST', rccm: 'RCCM-TEST', message_facture: 'Merci de votre confiance', logo_base64: '' };

test('reçu payé : projection complète, numéro stable et lecture sans écriture', async ctx => {
  const f = await fixture(ctx); const created = await f.adapter.create(input(100), admin); const before = f.snapshot();
  const view = await loadPrestationReceipt(f.adapter, created.ref, admin);
  const html = prestationReceiptHtml(view, commerce);
  assert.equal(view.montantEncaisse, view.montantFacture); assert.equal(view.restantDu, 0);
  for (const value of [created.code, 'REÇU DE PRESTATION', 'Montant facturé', 'Montant encaissé', 'Restant dû', 'Payée', 'IFU-TEST', 'RCCM-TEST', 'Gestion Pro v1.0']) assert.ok(html.includes(value));
  assert.deepEqual(f.snapshot(), before);
});
test('reçu partiel : encaissé et restant dû issus de getView', async ctx => {
  const f = await fixture(ctx); const created = await f.adapter.create(input(40), admin);
  const view = await loadPrestationReceipt(f.adapter, created.ref, admin);
  assert.equal(view.montantEncaisse, 40); assert.equal(view.restantDu, 60);
  const html = prestationReceiptHtml(view, commerce); assert.ok(html.includes('40 FCFA')); assert.ok(html.includes('60 FCFA')); assert.ok(html.includes('Partiellement payée'));
});
test('reçu impayé : aucun encaissement inventé', async ctx => {
  const f = await fixture(ctx); const created = await f.adapter.create(input(0), admin);
  const view = await loadPrestationReceipt(f.adapter, created.ref, admin);
  assert.equal(view.montantEncaisse, 0); assert.equal(view.restantDu, view.montantFacture);
  assert.ok(prestationReceiptHtml(view, commerce).includes('Impayée'));
});
test('reçu annulé : ANNULÉE, brut et remboursement distincts, aucune nouvelle écriture', async ctx => {
  const f = await fixture(ctx); const created = await f.adapter.create(input(100), admin);
  await f.adapter.cancel(created.ref, 'Prestation annulée', { type: 'remboursement', montantRembourse: 100, moyenPaiement: cash }, 'receipt-cancel', admin);
  const before = f.snapshot(); const view = await loadPrestationReceipt(f.adapter, created.ref, admin);
  assert.equal(view.montantEncaisse, 100); assert.equal(view.montantRembourse, 100); assert.equal(view.restantDu, 0);
  const html = prestationReceiptHtml(view, commerce); assert.ok(html.includes('ANNULÉE')); assert.ok(html.includes('Montant remboursé')); assert.ok(html.includes('Encaissé net : 0 FCFA'));
  assert.deepEqual(f.snapshot(), before);
});
test('reçu anonyme : aucune identité fictive ajoutée', async ctx => {
  const f = await fixture(ctx); const request = input(0); request.client = { idClient: null, nom: null, contact: null };
  const created = await f.adapter.create(request, admin);
  const view = await loadPrestationReceipt(f.adapter, created.ref, admin); assert.ok(prestationReceiptHtml(view, commerce).includes('Client anonyme'));
});
test('reçu plusieurs lignes : unités, quantités et total exacts', async ctx => {
  const f = await fixture(ctx); const request = input(100, 30, 2);
  request.lines.push({ origin: 'prestation', designation: 'Autre service', quantite: 4, prixUnitaire: 10, unite: 'heure' });
  const created = await f.adapter.create(request, admin); const view = await loadPrestationReceipt(f.adapter, created.ref, admin);
  assert.equal(view.montantFacture, 100); assert.equal(view.restantDu, 0);
  const html = prestationReceiptHtml(view, commerce); assert.ok(html.includes('heure')); assert.ok(html.includes('60 FCFA')); assert.ok(html.includes('40 FCFA'));
  assert.equal(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g)?.length, 2);
});
test('reçu incomplet : lignes, référence, date et montants invalides bloqués', async ctx => {
  const f = await fixture(ctx); const view = await f.adapter.create(input(0), admin);
  assert.ok(view.origin === 'prestation');
  for (const patch of [{ lines: [] }, { code: '' }, { dates: { ...view.dates, creation: 'invalide' } },
    { montantFacture: 101 }, { montantEncaisse: Number.NaN }, { restantDu: 0 },
    { documents: {} }, { ref: { origin: 'prestation' as const, id: view.ref.id + 1 } }]) {
    await assert.rejects(async () => validatePrestationReceipt({ ...view, ...patch }, view.ref), /Reçu indisponible/);
  }
  await assert.rejects(async () => prestationReceiptHtml(view, { ...commerce, nom_atelier: '' }), /nom du commerce absent/);
});
test('reçu : erreur getView propagée, session requise, aucune lecture de vente', async () => {
  let calls = 0;
  const reader: Pick<TransactionServiceContract, 'getView'> = { async getView() { calls++; throw new Error('Accès refusé par la source'); } };
  await assert.rejects(() => loadPrestationReceipt(reader, { origin: 'prestation', id: 1 }, admin), /Accès refusé/);
  await assert.rejects(() => loadPrestationReceipt(reader, { origin: 'prestation', id: 1 }, null), /Connectez-vous/);
  await assert.rejects(() => loadPrestationReceipt(reader, { origin: 'vente', id: 1 }, admin), /référence/);
  assert.equal(calls, 1);
});
test('HTML autonome : contenu échappé, sans styles applicatifs ni moyen de paiement inventé', async ctx => {
  const f = await fixture(ctx); const request = input(0); request.lines[0].designation = '<script>alert(1)</script>';
  const view = await f.adapter.create(request, admin);
  const html = prestationReceiptHtml(view, { ...commerce, nom_atelier: '<Commerce>', logo_base64: 'javascript:alert(1)' });
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;Commerce&gt;')); assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('javascript:')); assert.ok(!html.includes('Moyen de paiement'));
  assert.ok(!/(?:var\(--tk-|class="tk-|mantine-)/.test(html + prestationReceiptCss));
  assert.ok(prestationReceiptCss.includes('background:#fff')); assert.ok(prestationReceiptCss.includes('#1a1a2e'));
});
