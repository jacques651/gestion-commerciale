import { test, assert } from './helpers/prestationFixture.ts';
import { WebDatabase } from '../src/database/webAdapter.ts';

test('API absente : message clair sur échec réseau et réponses 404/502/503', async () => {
  const previous = globalThis.fetch;
  try {
    const db = await WebDatabase.load('sqlite:test-isole');
    for (const status of [404, 502, 503]) {
      globalThis.fetch = async () => new Response('', { status });
      await assert.rejects(() => db.select('SELECT 1'), /Serveur local non démarré \(npm run server\)/);
    }
    globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
    await assert.rejects(() => db.execute('SELECT 1'), /Serveur local non démarré/);
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Erreur métier conservée' }), { status: 500 });
    await assert.rejects(() => db.select('SELECT 1'), /Erreur métier conservée/);
    globalThis.fetch = async () => new Response(JSON.stringify({ rows: [{ valeur: 1 }] }), { status: 200 });
    assert.deepEqual(await db.select('SELECT 1'), [{ valeur: 1 }]);
  } finally { globalThis.fetch = previous; }
});
