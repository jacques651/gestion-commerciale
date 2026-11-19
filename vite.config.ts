import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'

// Mot de passe développeur : seule son empreinte salée (config/developpeur.json) est embarquée.
const configDev = existsSync('config/developpeur.json')
  ? JSON.parse(readFileSync('config/developpeur.json', 'utf8')) as { sel?: string; empreinte?: string }
  : {}
if (!configDev.sel || !/^[a-f0-9]{64}$/.test(configDev.empreinte ?? '')) {
  throw new Error('config/developpeur.json absent ou invalide : lancez Changer-mot-de-passe-developpeur.bat.')
}

export default defineConfig({
  plugins: [react()],
  define: {
    __GC_DEV_SEL__: JSON.stringify(configDev.sel),
    __GC_DEV_EMPREINTE__: JSON.stringify(configDev.empreinte),
  },
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090', changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
              response.end(JSON.stringify({ error: 'Serveur local non démarré (npm run server).' }));
            }
          });
        },
      },
    },
  },
  clearScreen: false,
})
