import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'server/prestations.ts', outDir: 'server/runtime', emptyOutDir: true, target: 'node22', minify: false,
    rollupOptions: { output: { entryFileNames: 'prestations.mjs', inlineDynamicImports: true } },
  },
});
