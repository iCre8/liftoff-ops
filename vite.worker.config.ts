import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, './src/lib'),
    },
  },
  build: {
    ssr: 'src/worker.ts',
    outDir: 'worker-build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'worker.js',
      },
    },
  },
});
