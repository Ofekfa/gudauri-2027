#!/usr/bin/env node
/**
 * Resets the shared ski-game scores: `npm run scores:reset [-- --dry-run] [-- --backup-dir <dir>]`.
 *
 * 1. Backs up the live scores (GET /game/scores: every top five plus run counts)
 *    to a JSON file outside the repo (scores are personal; never commit them).
 * 2. Prints what will be deleted and waits for you to type "yes".
 * 3. Raises SCORE_EPOCH in wrangler.toml and deploys. The Durable Object logs
 *    every run and deletes them on the next request; `wrangler tail` captures
 *    that log next to the backup. Phones drop their own records when they see
 *    the new epoch.
 * 4. Checks the live scores are empty. Commit the wrangler.toml change after.
 *
 * Not an HTTP route on purpose: only someone who can deploy the Worker can reset.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const WORKER_URL =
  process.env.WORKER_URL ?? 'https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev';
const ORIGIN = 'https://ofekfa.github.io';
const TOML = new URL('../wrangler.toml', import.meta.url);
const EPOCH_LINE = /^SCORE_EPOCH = "(\d+)"$/m;
const TAIL_CONNECT_MS = 6_000;
const LOG_FLUSH_MS = 6_000;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirArg = args[args.indexOf('--backup-dir') + 1];
const backupDir = resolve(
  args.includes('--backup-dir') && dirArg ? dirArg : join(homedir(), 'gudauri-2027-backups'),
);
const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
if (backupDir.startsWith(repoRoot)) {
  console.error(`Backups must live outside the repository (${repoRoot}).`);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function liveScores() {
  const res = await fetch(`${WORKER_URL}/game/scores`, {
    headers: { Origin: ORIGIN, 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`GET /game/scores answered ${res.status}`);
  return res.json();
}

const toml = readFileSync(TOML, 'utf8');
const configured = Number(EPOCH_LINE.exec(toml)?.[1]);
if (!Number.isSafeInteger(configured)) throw new Error('SCORE_EPOCH not found in wrangler.toml');

const before = await liveScores();
mkdirSync(backupDir, { recursive: true });
const backupFile = join(backupDir, `scores-epoch${before.epoch}-${stamp}.json`);
writeFileSync(
  backupFile,
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), ...before }, null, 2)}\n`,
);
console.log(`Backup: ${backupFile}`);
console.log(
  `Live epoch ${before.epoch} (wrangler.toml: ${configured}). Runs stored per character:`,
);
const total = Object.values(before.runs ?? {}).reduce((a, b) => a + b, 0);
for (const [who, n] of Object.entries(before.runs ?? {}))
  console.log(
    `  ${who}: ${n} run(s); top: ${(before.scores[who] ?? []).map((e) => e.score).join(', ')}`,
  );
console.log(`  total: ${total}`);
if (dryRun) process.exit(0);

const next = Math.max(configured, before.epoch) + 1;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  `Type "yes" to delete all ${total} run(s) and start epoch ${next}: `,
);
rl.close();
if (answer.trim() !== 'yes') {
  console.log('Cancelled; nothing changed.');
  process.exit(0);
}

const purgeLog = join(backupDir, `scores-purge-epoch${next}-${stamp}.jsonl`);
const tail = spawn('npx', ['wrangler', 'tail', '--format', 'json'], {
  cwd: new URL('..', import.meta.url).pathname,
});
tail.stdout.pipe(createWriteStream(purgeLog));
await sleep(TAIL_CONNECT_MS);

writeFileSync(TOML, toml.replace(EPOCH_LINE, `SCORE_EPOCH = "${next}"`));
const deploy = spawnSync('npx', ['wrangler', 'deploy'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'inherit',
});
if (deploy.status !== 0) {
  writeFileSync(TOML, toml);
  tail.kill();
  console.error('Deploy failed; wrangler.toml restored, nothing was reset.');
  process.exit(1);
}

// The first request after the deploy applies the new epoch (and logs + deletes the runs).
let after = await liveScores();
for (let i = 0; i < 5 && after.epoch !== next; i++) {
  await sleep(2_000);
  after = await liveScores();
}
await sleep(LOG_FLUSH_MS);
tail.kill();
const captured = readFileSync(purgeLog, 'utf8').includes('scores-reset');
console.log(
  `Live now: epoch ${after.epoch}, ${Object.keys(after.scores).length} character(s) with scores.`,
);
console.log(
  `Purge log ${captured ? 'captured' : 'NOT captured (the GET backup above still has every top five)'}: ${purgeLog}`,
);
if (after.epoch !== next || Object.keys(after.scores).length) process.exit(1);
console.log('Done. Commit worker/wrangler.toml (SCORE_EPOCH) so CI deploys keep it.');
