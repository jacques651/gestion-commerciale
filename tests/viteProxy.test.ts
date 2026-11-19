import { test, assert } from './helpers/prestationFixture.ts';
import { createServer as createViteServer } from 'vite';
import config from '../vite.config.ts';

interface HttpStub {
  listen(port: number, host: string, done: () => void): void;
  address(): { port: number } | string | null;
  close(done: () => void): void;
}
test('proxy /api : relais HTTP et message explicite quand le serveur est arrêté', async () => {
  const moduleName = 'node:http';
  const http = await import(moduleName) as { createServer(handler: (request: { url?: string }, response: {
    writeHead(status: number, headers: Record<string, string>): void; end(body: string): void;
  }) => void): HttpStub };
  let received: string | undefined;
  const stub = http.createServer((request, response) => {
    received = request.url; response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ rows: [{ test: 'API isolée, aucune base' }] }));
  });
  await new Promise<void>(resolve => stub.listen(0, '127.0.0.1', resolve));
  const endpoint = stub.address(); if (!endpoint || typeof endpoint === 'string') throw new Error('Port de test absent');
  const rule = config.server?.proxy?.['/api'];
  if (!rule || typeof rule === 'string') throw new Error('Proxy /api absent');
  assert.equal(rule.target, 'http://127.0.0.1:8090');
  const vite = await createViteServer({ ...config, configFile: false,
    server: { ...config.server, host: '127.0.0.1', port: 0, strictPort: false,
      proxy: { '/api': { ...rule, target: `http://127.0.0.1:${endpoint.port}` } } } });
  let closed = false;
  try {
    await vite.listen(); const address = vite.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Port Vite absent');
    const url = `http://127.0.0.1:${address.port}/api/select`;
    const response = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(response.status, 200); assert.equal(received, '/api/select');
    assert.deepEqual(await response.json(), { rows: [{ test: 'API isolée, aucune base' }] });
    await new Promise<void>(resolve => stub.close(resolve)); closed = true;
    const unavailable = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(unavailable.status, 503);
    assert.ok((await unavailable.text()).includes('npm run server'));
  } finally { await vite.close(); if (!closed) await new Promise<void>(resolve => stub.close(resolve)); }
});
