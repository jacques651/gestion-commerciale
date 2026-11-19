import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [{
  name: 'isolated-auth-only', enforce: 'pre', resolveId(id) {
    if (/(?:^|\/)contexts\/AuthContext(?:\.tsx)?$/.test(id)) return decodeURIComponent(new URL('./transactionIntegration.previewAuth.tsx',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
  },
}, react()], server: { host: '127.0.0.1', port: 18192, strictPort: true,
  proxy: { '/api': { target: 'http://127.0.0.1:18191', changeOrigin: true } },
}, clearScreen: false });
