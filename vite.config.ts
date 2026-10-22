import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { serviceWorker } from './build/serviceWorkerPlugin';

// GitHub Pages serves the site from /<repo>/.
export const BASE_PATH = '/gudauri-2027/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [preact(), serviceWorker()],
});
