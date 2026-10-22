/**
 * Builds src/sw/sw.ts as an unhashed, self-contained /sw.js and injects the
 * precache list (every built file plus public assets) and a content version,
 * so each deploy with changes installs a fresh cache.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

const SW_ENTRY = 'src/sw/sw.ts';
const SW_FILE = 'sw.js';
const SHELL = 'index.html';
/** Not needed offline: the GitHub Pages 404 page, the link-preview image and the font licence. */
const PUBLIC_EXCLUDE = new Set(['404.html', 'og-image.png', 'fonts/Fredoka-OFL.txt']);
const VERSION_LENGTH = 12;

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'gudauri-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: SW_ENTRY, fileName: SW_FILE });
    },
    generateBundle(_options, bundle) {
      const sw = bundle[SW_FILE];
      if (!sw || sw.type !== 'chunk') return this.error('Service worker chunk missing');
      if (sw.imports.length)
        return this.error('The service worker must not share chunks with the app');

      const built = Object.values(bundle).filter(
        (f) => f.fileName !== SW_FILE && !f.fileName.endsWith('.map'),
      );
      const publicFiles = publicDir
        ? listFiles(publicDir).filter((f) => !PUBLIC_EXCLUDE.has(f))
        : [];
      const manifest = [
        ...new Set([SHELL, ...built.map((f) => f.fileName), ...publicFiles]),
      ].sort();

      const hash = createHash('sha256');
      for (const f of built) hash.update(f.fileName).update(f.type === 'chunk' ? f.code : f.source);
      for (const f of publicFiles) hash.update(f).update(readFileSync(join(publicDir, f)));
      const version = hash.digest('hex').slice(0, VERSION_LENGTH);

      const code = sw.code
        .replace(/(["'`])__PRECACHE_MANIFEST__\1/, JSON.stringify(JSON.stringify(manifest)))
        .replaceAll('__SW_VERSION__', version);
      if (code.includes('__PRECACHE_MANIFEST__') || code.includes('__SW_VERSION__')) {
        return this.error('Service worker placeholders were not replaced');
      }
      sw.code = code;
    },
  };
}
