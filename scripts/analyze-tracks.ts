/**
 * Build-prep for the background music: for every track in
 * scripts/track-sources.ts, checks the URL streams (HEAD + byte range),
 * measures its duration (ffprobe) and loudness (ffmpeg loudnorm), and writes
 * src/data/tracks.json. Files are never re-encoded or stored: the site
 * streams them from their host unmodified.
 *
 *   node scripts/analyze-tracks.ts            # all
 *   node scripts/analyze-tracks.ts chakrulo-1957
 *
 * Needs ffmpeg/ffprobe on PATH. Re-run now and then: hosts can move files.
 */
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { TRACK_SOURCES, type TrackSource } from './track-sources.ts';

const run = promisify(execFile);
const OUT = fileURLToPath(new URL('../src/data/tracks.json', import.meta.url));
const USER_AGENT = 'gudauri-2027 build (https://github.com/Ofekfa/gudauri-2027)';
/** Quieter tracks stay as they are; louder ones are turned down to about this. */
const TARGET_LUFS = -22;
const MIN_GAIN_DB = -18;
const DELAY_MS = 1_000;
const MAX_BUFFER = 16 * 1024 * 1024;

interface Analysed extends TrackSource {
  durationS: number;
  /** Integrated loudness as measured. */
  loudnessLufs: number;
  gainDb: number;
  checkedOn: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ATTEMPTS = 3;
const RETRY_BASE_MS = 3_000;

/** Hosts (archive.org especially) answer 500 now and then; retry with backoff. */
async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (attempt >= ATTEMPTS) throw err;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }
}
const round1 = (n: number) => Math.round(n * 10) / 10;

async function checkStreamable(url: string): Promise<void> {
  const res = await fetch(url, { headers: { Range: 'bytes=0-1023', 'User-Agent': USER_AGENT } });
  if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/audio|mpeg|octet-stream/.test(type)) throw new Error(`unexpected content-type ${type}`);
  await res.body?.cancel();
}

async function duration(url: string): Promise<number> {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-user_agent',
    USER_AGENT,
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    url,
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('no duration');
  return seconds;
}

async function loudness(url: string): Promise<number> {
  const { stderr } = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-user_agent',
      USER_AGENT,
      '-i',
      url,
      '-af',
      `loudnorm=I=${TARGET_LUFS}:print_format=json`,
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: MAX_BUFFER },
  );
  // ffmpeg prints the loudnorm report as a JSON block among other log lines.
  const json = /\{[^{}]*"input_i"[^{}]*\}/.exec(stderr)?.[0];
  if (!json) throw new Error('no loudnorm report');
  const measured = Number((JSON.parse(json) as { input_i: string }).input_i);
  if (!Number.isFinite(measured)) throw new Error('no loudness');
  return measured;
}

async function existing(): Promise<Analysed[]> {
  try {
    return JSON.parse(await readFile(OUT, 'utf8')) as Analysed[];
  } catch {
    return [];
  }
}

const only = process.argv.slice(2);
const results = new Map((await existing()).map((t) => [t.id, t]));
const today = new Date().toISOString().slice(0, 10);
let failures = 0;
for (const source of TRACK_SOURCES.filter((s) => only.length === 0 || only.includes(s.id))) {
  try {
    await withRetry(() => checkStreamable(source.src));
    const durationS = round1(await withRetry(() => duration(source.src)));
    const lufs = await withRetry(() => loudness(source.src));
    const gainDb = round1(Math.max(MIN_GAIN_DB, Math.min(0, TARGET_LUFS - lufs)));
    results.set(source.id, {
      ...source,
      durationS,
      loudnessLufs: round1(lufs),
      gainDb,
      checkedOn: today,
    });
    console.log(
      `✓ ${source.id}: ${Math.round(durationS)} s, ${lufs.toFixed(1)} LUFS → ${gainDb} dB`,
    );
  } catch (err) {
    failures++;
    console.warn(`✗ ${source.id}: ${String(err).slice(0, 160)}`);
  }
  await sleep(DELAY_MS);
}

// Keep the library order of track-sources.ts; drop tracks no longer listed.
const ordered = TRACK_SOURCES.map((s) => results.get(s.id)).filter(
  (t): t is Analysed => t !== undefined,
);
await writeFile(OUT, `${JSON.stringify(ordered, null, 2)}\n`);
const total = ordered.reduce((sum, t) => sum + t.durationS, 0);
console.log(`${ordered.length} tracks, ${(total / 3600).toFixed(2)} h; ${failures} failed.`);
