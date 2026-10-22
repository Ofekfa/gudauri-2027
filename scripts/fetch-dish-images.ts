/**
 * Build-prep: downloads one freely licensed Wikimedia Commons photo per dish,
 * crops it to 4:3 and writes AVIF + WebP at two widths to public/food/, plus
 * the credits in src/data/dishImages.json (typed by dishImages.ts). Run rarely, then review every
 * image by eye before committing (Commons categories contain mislabeled photos).
 *
 *   node scripts/fetch-dish-images.ts            # all dishes in the manifest
 *   node scripts/fetch-dish-images.ts khinkali   # just one (merges credits)
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DISH_IMAGE_SOURCES } from './dish-image-sources.ts';

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'gudauri-2027 build (https://github.com/Ofekfa/gudauri-2027)';
/** Commons asks for gentle clients; it answers 429 to bursts. */
const DELAY_MS = 2_000;
const DOWNLOAD_WIDTH = 1600;
/** Must match DISH_IMAGE_WIDTHS in src/data/dishImages.ts. */
const WIDTHS = [320, 640] as const;
const ASPECT = 4 / 3;
/** Per-file budget (also enforced by src/data/dishImages.test.ts). */
const MAX_BYTES = 60 * 1024;
const QUALITY_STEPS = { avif: [55, 48, 42, 36, 30], webp: [78, 70, 62, 54, 46, 40, 34] } as const;
/** Licences that allow reuse on a public site with attribution. */
const ALLOWED = /^(CC0|Public domain|PD.*|CC BY(-SA)? \d\.\d)$/i;

const OUT_DIR = fileURLToPath(new URL('../public/food/', import.meta.url));
const CREDITS = fileURLToPath(new URL('../src/data/dishImages.json', import.meta.url));

interface Credit {
  id: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  modified: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function imageInfo(file: string) {
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(DOWNLOAD_WIDTH),
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist',
    format: 'json',
    formatversion: '2',
  });
  const data = (await fetchJson(`${API}?${params}`)) as {
    query?: { pages?: { missing?: boolean; imageinfo?: Record<string, unknown>[] }[] };
  };
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`No Commons file "${file}"`);
  const meta = info.extmetadata as Record<string, { value: string } | undefined>;
  return {
    thumbUrl: String(info.thumburl ?? info.url),
    pageUrl: String(info.descriptionurl),
    license: meta.LicenseShortName?.value ?? '',
    licenseUrl: meta.LicenseUrl?.value ?? null,
    author: stripHtml(meta.Artist?.value ?? 'Unknown'),
  };
}

/** Encodes at the highest quality that fits the budget. */
async function encode(input: Buffer, width: number, format: 'avif' | 'webp', path: string) {
  const height = Math.round(width / ASPECT);
  for (const quality of QUALITY_STEPS[format]) {
    const pipeline = sharp(input).resize(width, height, { fit: 'cover', position: 'attention' });
    const out = await (
      format === 'avif' ? pipeline.avif({ quality, effort: 6 }) : pipeline.webp({ quality })
    ).toBuffer();
    if (out.length <= MAX_BYTES) {
      await writeFile(path, out);
      return out.length;
    }
  }
  throw new Error(`${path} can't fit ${MAX_BYTES} bytes`);
}

async function existingCredits(): Promise<Credit[]> {
  try {
    return JSON.parse(await readFile(CREDITS, 'utf8')) as Credit[];
  } catch {
    return [];
  }
}

const only = process.argv.slice(2);
const sources = DISH_IMAGE_SOURCES.filter((s) => only.length === 0 || only.includes(s.id));
const credits = new Map((await existingCredits()).map((c) => [c.id, c]));
await mkdir(OUT_DIR, { recursive: true });

for (const source of sources) {
  try {
    const info = await imageInfo(source.file);
    if (!ALLOWED.test(info.license)) throw new Error(`licence "${info.license}" not allowed`);
    await sleep(DELAY_MS);
    const res = await fetch(info.thumbUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const sizes: string[] = [];
    for (const width of WIDTHS) {
      for (const format of ['avif', 'webp'] as const) {
        const bytes = await encode(
          input,
          width,
          format,
          `${OUT_DIR}${source.id}-${width}.${format}`,
        );
        sizes.push(`${width}.${format} ${(bytes / 1024).toFixed(0)}k`);
      }
    }
    credits.set(source.id, {
      id: source.id,
      width: WIDTHS[1],
      height: Math.round(WIDTHS[1] / ASPECT),
      alt: source.alt,
      author: info.author,
      license: info.license,
      licenseUrl: info.licenseUrl,
      sourceUrl: info.pageUrl,
      modified: 'Cropped and resized',
    });
    console.log(`✓ ${source.id}: ${info.license}, ${info.author} — ${sizes.join(', ')}`);
  } catch (err) {
    console.warn(`✗ ${source.id}: ${String(err)}`);
  }
  await sleep(DELAY_MS);
}

const sorted = [...credits.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(CREDITS, `${JSON.stringify(sorted, null, 2)}\n`);
const total = (
  await Promise.all(sorted.map((c) => stat(`${OUT_DIR}${c.id}-640.avif`).then((s) => s.size)))
).reduce((a, b) => a + b, 0);
console.log(`${sorted.length} images; 640px AVIF total ${(total / 1024).toFixed(0)} kB.`);
