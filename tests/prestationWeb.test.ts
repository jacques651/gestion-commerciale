import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import path from 'node:path';
import { test, assert, fixture, input, admin, manager, cash, type TestContext } from './helpers/prestationFixture.ts';
import { createPrestationWebAdapter, createPrestationHttpTransport } from '../src/services/adapters/prestationWebAdapter.ts';
import { PrestationAdapterError } from '../src/services/adapters/prestationPersistence.ts';

async function serverFixture(ctx: TestContext) {
  const f = await fixture(ctx);
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const address = probe.address(); if (!address || typeof address === 'string') throw new Error('Port absent');
  const port = address.port; await new Promise<void>(resolve => probe.close(() => resolve()));
  const token = 'gc-test-isole';
  const server = spawn(process.execPath, ['--experimental-sqlite', 'server/index.mjs'], {
    cwd: process.cwd(), env: { ...process.env, GC_DB: path.join(f.directory, 'test.db'), GC_DATA: f.directory,
      GC_HOST: '127.0.0.1', GC_PORT: String(port), GC_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; server.stderr.on('data', chunk => { logs += String(chunk); });
  server.stdout.on('data', chunk => { logs += String(chunk); });
  ctx.after(async () => { if (server.exitCode === null) { const closed = once(server, 'exit'); server.kill(); await closed; } });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(base + '/api/health', { headers: { 'x-gc-token': token } });
      const health = await response.json() as { prestationApi?: number };
      if (health.prestationApi === 1) { ready = true; break; }
    } catch { /* laisser le processus initialiser son écoute */ }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (!ready) throw new Error('Serveur de test indisponible : ' + logs);
  const service = createPrestationWebAdapter(createPrestationHttpTransport(base, token));
  const post = async (endpoint: string, body: unknown) => fetch(base + endpoint, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'x-gc-token': token,
  }, body: JSON.stringify(body) });
  return { ...f, service, post, base };
}

test('web HTTP : création, lecture, modification, conflit, annulation et reçu conservent la base historique', async ctx => {
  const f = await serverFixture(ctx);
  const oldSale = f.db.prepare('SELECT * FROM ventes').all();
  const created = await f.service.create(input(40), admin);
  assert.equal(created.montantEncaisse, 40); assert.equal(created.restantDu, 60);
  const updated = await f.service.update(created.ref, { origin: 'prestation', cleOperation: 'web-update', observations: 'Modification web' }, 1, admin);
  assert.equal(updated.version, 2); assert.equal(updated.observations, 'Modification web');
  await assert.rejects(() => f.service.update(created.ref, { origin: 'prestation', cleOperation: 'web-stale', observations: 'Ancienne version' }, 1, admin), error => error instanceof PrestationAdapterError && error.code === 'VERSION_CONFLICT');
  const list = await f.service.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin);
  assert.equal(list.total, 1); assert.equal(list.items[0].code, created.code);
  const result = await f.service.cancel(created.ref, 'Annulation web', { type: 'remboursement', montantRembourse: 40, moyenPaiement: cash }, 'web-cancel', admin);
  assert.equal(result.ecrituresContrepasseIds.length, 1);
  const receipt = await f.service.getView(created.ref, admin);
  assert.equal(receipt.etatCommercial, 'ANNULEE'); assert.equal(receipt.montantRembourse, 40); assert.equal(receipt.restantDu, 0);
  assert.equal(receipt.documents.recuPrestation?.code, created.code);
  assert.deepEqual(f.db.prepare('SELECT * FROM ventes').all(), oldSale);
});

test('web HTTP : suppression uniquement soft et droits vérifiés côté serveur', async ctx => {
  const f = await serverFixture(ctx); const created = await f.service.create(input(0), admin);
  await assert.rejects(() => f.service.delete(created.ref, 'Refus attendu', 'soft', manager), error => error instanceof PrestationAdapterError && error.code === 'FORBIDDEN');
  await assert.rejects(() => f.service.getView(created.ref, { ...admin, role: 'gestionnaire' }), error => error instanceof PrestationAdapterError && error.code === 'FORBIDDEN');
  await f.service.delete(created.ref, 'Doublon web', 'soft', admin);
  assert.equal(f.count('ventes_prestations'), 1);
  assert.equal((await f.service.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin)).total, 0);
  assert.equal((await f.service.listView({ origin: 'prestation', afficherSupprimees: true }, { page: 1, pageSize: 5 }, admin)).total, 1);
});

test('web HTTP : panne tardive annule prestation, règlement, caisse et audit ensemble', async ctx => {
  const f = await serverFixture(ctx);
  f.db.exec("CREATE TRIGGER test_failure BEFORE INSERT ON transaction_operations BEGIN SELECT RAISE(ABORT,'Echec audit simule'); END");
  const before = f.snapshot();
  await assert.rejects(() => f.service.create(input(100), admin), /Echec audit simule/);
  assert.deepEqual(f.snapshot(), before);
});

test('web HTTP : appels concurrents et SQL historique sans mélange de transactions, doublon refusé', async ctx => {
  const f = await serverFixture(ctx); const request = input(40);
  const [a, b, old] = await Promise.allSettled([
    f.service.create(request, admin), f.service.create(request, admin),
    f.post('/api/execute', { sql: 'UPDATE ventes SET observation=? WHERE idVente=?', params: ['Ancienne vente conservee', 1] }),
  ]);
  assert.ok(old.status === 'fulfilled'); assert.equal(old.value.status, 200);
  assert.equal([a,b].filter(result => result.status === 'fulfilled').length, 1);
  const rejected = [a,b].find(result => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof PrestationAdapterError && rejected.reason.code === 'OPERATION_CONFLICT');
  assert.equal(f.count('ventes_prestations'), 1);
  assert.equal(f.count('reglements_prestations'), 1); assert.equal(f.count('journal_caisse'), 1);
  const requests = Array.from({ length: 6 }, () => input(10));
  const results = await Promise.all(requests.map(item => f.service.create(item, admin)));
  assert.equal(new Set(results.map(row => row.code)).size, 6);
  assert.equal(f.count('ventes_prestations'), 7);
  assert.equal(f.db.prepare("SELECT SUM(montant) AS n FROM journal_caisse WHERE type_mouvement='ENTREE'").get()?.n, 100);
  assert.equal(f.db.prepare('SELECT observation FROM ventes WHERE idVente=1').get()?.observation, 'Ancienne vente conservee');
});

test('web HTTP : jeton, origine et migration contrôlés, aucune migration au démarrage', async ctx => {
  const f = await serverFixture(ctx);
  const denied = await fetch(f.base + '/api/prestations', { method: 'POST', body: '{}' }); assert.equal(denied.status, 401);
  const invalid = await f.post('/api/prestations', { operation: 'getView', args: { ref: { origin: 'vente', id: 1 } }, ctx: admin });
  assert.equal(invalid.status, 400);
  f.db.exec('DELETE FROM prestation_migrations');
  const before = f.snapshot();
  await assert.rejects(() => f.service.listView({ origin: 'prestation' }, { page: 1, pageSize: 5 }, admin), error => error instanceof PrestationAdapterError && error.code === 'MIGRATION_REQUIRED');
  assert.deepEqual(f.snapshot(), before); assert.equal(f.count('prestation_migrations'), 0);
});
