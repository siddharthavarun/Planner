import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// One stamp per build: shown in the sidebar and written into sw.js, so phones notice a new version.
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ');

function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD__', BUILD));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(BUILD) },
});
