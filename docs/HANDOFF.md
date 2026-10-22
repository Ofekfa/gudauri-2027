# Handoff — 2026-10-22

## Current state

The last tag is **`v1.12.0`** (Phase 10.3, trip album). `main` is at the docs PR that adds this file, and its CI is green.

- **Live site:** https://ofekfa.github.io/gudauri-2027/
- **Worker:** https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev

Both match `main`:

- Pages deploys on every push to `main`.
- The Worker was last deployed from `e549726` (#89). No file the Worker bundles has changed since.

There are no open PRs and no work-in-progress branches; old merged branches remain on the remote. Read `PLAN.md` (status, queue, decisions) and `CLAUDE.md` (conventions, gotchas) first.

## In progress

Phase 10.3 Album has shipped in PRs #86–#91:

- Worker storage, tokens and routes: `worker/src/album/`, `worker/src/routes/album.ts`.
- Client library: `src/lib/album/`.
- UI: `src/pages/Album*.tsx`, `src/components/album/`.
- Home Quick add: `src/components/album/QuickAdd.tsx`.

Unit tests (404 site, 75 Worker) and a local end-to-end run pass, but **adding photos doesn't work on the live site**; see "Open bug". Left to do:

1. Fix the open bug.
2. Ofek sets `ALBUM_SIGNING_KEY`.
3. Verify adding live.
4. Ofek's real-phone test (script in the `v1.12.0` report: join → 📷 on Snowman → gallery ×3 + Undo → airplane mode, add, reopen → second phone sees it).

## Open questions for Ofek

- Where did you see the stuck upload: the live site or local? On which device and browser? Not stated yet; the report template was left as "[e.g. iPhone, Safari]" and "[live site / local]".
- Two-phone shared-lists check (`v1.11.0`): did it work?
- Day-1 calendar times: still deferred ("let's deal with the time later")?
- Which, if any, of the queued ideas next: expenses, ski-day briefing, safety card, leaderboard?

## Manual steps Ofek owes

| Step                                                                                                             | Status                          | How verified                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GROUP_CODE` Worker secret                                                                                       | ✅ Done                         | `wrangler secret list`; wrong codes get `401`                                                                  |
| `CALENDAR_ICS_URL` Worker secret                                                                                 | ✅ Done                         | `wrangler secret list`; itinerary is live                                                                      |
| **`ALBUM_SIGNING_KEY` Worker secret**                                                                            | ❌ **Not done**                 | Absent from `wrangler secret list`; live `POST /album/session` → `501 Album not set up`                        |
| `ALBUM_PASSCODE`                                                                                                 | n/a                             | Doesn't exist: the album reuses `GROUP_CODE` (Ofek's decision)                                                 |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (GitHub Actions secrets)                                         | ✅ Done                         | `gh secret list` (set 2026-10-21); Worker deploys succeed                                                      |
| Album storage (Durable Object `AlbumStore`, migration `v2`) and bindings `ALBUM`, `LISTS`, `RL_AUTH`, KV `CACHE` | ✅ Done (by CI; nothing manual) | Deploy of `e549726` succeeded; live `GET /album` → `200 {"frames":{},"photos":[]}`; preflight lists `If-Match` |
| R2 bucket                                                                                                        | n/a                             | Not used                                                                                                       |
| Two-phone shared-lists test                                                                                      | ❓ Unknown                      | Not reported                                                                                                   |
| Real-phone album test (iOS Safari, Android Chrome)                                                               | ❌ Not done                     | Blocked by the bug and the key                                                                                 |
| iPhone music test; Kudebi cam phone test                                                                         | ❓ Unknown                      | Not reported                                                                                                   |

Command for the key (run in `worker/`; the key prints only into the pipe):
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put ALBUM_SIGNING_KEY`

## Known issues and risks

- **The Worker's deploy path filter has gaps.** The Worker bundles `src/lib/album/protocol.ts`, `src/lib/album/jpeg.ts` `src/lib/sync/protocol.ts` and `src/lib/time/countdown.ts` (via `worker/src/liveContext.ts`), but `.github/workflows/worker-deploy.yml` doesn't watch `src/lib/album/**`, `src/lib/sync/**` or `src/lib/time/**`. A change there alone would not redeploy the Worker. Workaround: `gh workflow run worker-deploy.yml`.
- The Worker's `RL_AUTH` rate limit (5/min per IP) also applies to token renewals. Four phones behind one hotel IP could hit it while retrying, which the client treats as "retry".
- The Worker takes `uploadedBy` from the upload's own details, not from the token's `who`. Any member can credit a photo to someone else. Low risk among four friends.
- Album images are fetched from the Worker on each view; only the browser's HTTP cache (`immutable`) keeps them offline. They aren't in the service-worker cache.
- Not verified on real phones: the iOS camera input, HEIC → JPEG conversion via `accept="image/jpeg,image/*"`, IndexedDB Blob storage on older iOS, and uploads on weak signal.
- The QA scripts (`album-e2e.mjs`, `round2.mjs`, …) and `ship-pr.sh` lived in the session scratchpad and are **not in the repo**. Ship with `gh pr create` → wait for CI → `gh pr merge --squash --delete-branch`.

## Open bug — Album photo upload never completes

**Symptom (reported):** adding a photo to a moment in the Trip Album never uploads. Progress stays at **0%** indefinitely (still 0% after an hour) and no error is shown.

- **Device/browser:** not specified (to confirm with Ofek).
- **Where:** not specified (to confirm). On the live site it reproduces for everyone today.

### How the upload works, end to end

1. **File input.** `src/components/album/AddPhotoButtons.tsx`:
   - two `<input type="file" accept="image/jpeg,image/*">` (one with `capture="environment"`, one `multiple`);
   - `onPick` → `addPhotos(frameId, files)`. Shown only when the phone has joined (`isJoined(syncSettings)`).
2. **Processing.** `addPhotos` (`src/lib/album/service.ts:134`) → `processImage` (`src/lib/album/pipeline.ts:105`):
   - decode: `createImageBitmap` (applies EXIF orientation), falling back to `<img>`; a decode failure → `UnsupportedImageError` toast;
   - resize: `fitWithin` to `FULL_EDGE` 2048 / `THUMB_EDGE` 480;
   - re-encode: canvas `toBlob('image/jpeg')` at quality 0.82 → 0.72 → 0.62, then 1600 px, then 1280 px, until ≤ `MAX_FULL_OUTPUT` 1.5 MB;
   - `stripJpegMetadata` (`jpeg.ts`) runs last.
   - Each file becomes a `QueueItem` (id from `crypto.randomUUID()`, `uploadedBy` = joined traveller). A toast "Photo added to X" with Undo follows, then `queue.enqueue`.
3. **IndexedDB queue.** `src/lib/album/queue.ts`:
   - DB `gudauri-album`, store `uploads`, with a memory fallback;
   - states `queued | uploading | waiting-offline | failed`;
   - `localStorage` flag `gudauri2027:album:pending` so `AlbumQueueHost` (app shell) restarts the queue after a reload.
4. **Dispatcher.** `pump()` / `runOne()` / `schedule()` in `queue.ts`:
   - `MAX_PARALLEL_UPLOADS` 2; due items are those with `state === 'queued'` and `nextAttemptAt <= now`;
   - re-runs on `online`, on `visibilitychange` → visible, and on `start()`.
5. **Token.** The `upload` dependency in `service.ts:55` first calls `getAlbumToken()` (`src/lib/album/token.ts:48`):
   - it needs the joined `{code, me}` from `sync:settings`, the stored token `album:token`, or `POST /album/session` with `{code, who}` (15 s `AbortSignal.timeout`);
   - it returns `{token}` or `{error: 'not-joined' | 'wrong-code' | 'not-set-up' | 'offline'}`.
   - **Any error → `{kind: 'retry', status: 401}`** (`service.ts:57`).
6. **Request.** `repository.upload` (`src/lib/album/repository.ts:92`):
   - **XMLHttpRequest** `POST /album/:frameId/photos`, multipart `meta` + `full` + `thumb`, `Authorization: Bearer <token>`, `xhr.timeout` 120 s;
   - 200/201 → done; 400/409/413/415 → `failed` with a reason; anything else, network error or timeout → `retry`.
7. **Worker route.** `albumAddRoute` in `worker/src/routes/album.ts`:
   - verifies the token (501 if the album isn't set up, 401 if the token is invalid);
   - checks the frame, sizes, JPEG magic bytes; idempotent by id; strips metadata again.
8. **Storage.** `frameStore(env, frameId).putImages` (a Durable Object `AlbumStore` instance `frame:<id>`, table `images`) runs first, then `index.addPhoto` (instance `index`, table `photos`, cap of 30 per frame). If the frame is full, the images are deleted and the route returns 409.
9. **Metadata back to the UI.**
   - The uploaded `AlbumPhoto` → queue event `uploaded` → merged into the listing in `service.ts`.
   - `useAlbum` (`src/lib/album/useAlbum.ts`) refreshes `GET /album` on mount and every 60 s.
10. **Progress UI.**
    - Progress comes **only** from XHR `xhr.upload.onprogress` (`repository.ts:102`, needs `lengthComputable`) → `queue.progress[id]`.
    - The viewer shows `Uploading N%` for any item not `failed` or `waiting-offline` (`src/pages/AlbumFramePage.tsx:152`).
    - Cards show "Uploading N…" (`pendingLabel`, `selectors.ts`).
    - **`fetch` isn't used for uploads**, so progress events do exist. But progress stays 0 whenever no XHR is sent.

### Retry, backoff and error surfacing

- **Backoff:** `backoffMs`: 2 s × 2ⁿ⁻¹, ±25% jitter, capped at **5 min** (`MAX_BACKOFF_MS`).
- **No limit on attempts.** `attempts` only grows.
- **Timeouts:**
  - XHR 120 s; token fetch 15 s;
  - **no overall per-item deadline.**
- **Retry outcomes are invisible.** After a retry the item goes back to `queued` (or `waiting-offline` if `navigator.onLine` is false), and the UI keeps saying "Uploading 0%".
- **Only `failed` outcomes surface:** a toast, "N couldn't be added" on the card, and a "Try again" button in the viewer.
- **Token errors are never shown.** `not-set-up`, `wrong-code` and `not-joined` are all turned into retries.

### Evidence

- **Live:**
  - `POST https://gudauri-2027-assistant…workers.dev/album/session` → **`501 {"error":"Album not set up"}`**;
  - `wrangler secret list` shows only `CALENDAR_ICS_URL` and `GROUP_CODE`;
  - `GET /album` → `200`, empty.
- **Reproduced locally** (2026-10-22): a Worker with `GROUP_CODE` but no `ALBUM_SIGNING_KEY`; an emulated iPhone 13 that has joined; one photo added. After 45 s:
  - the viewer shows "Ofek · … · **Uploading 0%**";
  - no toast;
  - IndexedDB item `{state: 'queued', attempts: 5}`;
  - network: `POST /album/session 501` at +0, +2, +7, +13, +31 s;
  - the upload `POST` was never sent; no page errors.
- With the key set (local e2e), the same flow uploaded in about 1.5 s.

### Hypotheses, ranked

1. **(Confirmed for the live site.)** `ALBUM_SIGNING_KEY` isn't set → session `501` → `getAlbumToken` returns `not-set-up` → mapped to `retry` forever → 0% with no error.
2. **Wrong or changed group code on the phone:** `401` → `wrong-code`, which clears the token and also maps to a silent retry forever. The same symptom, even after the key is set.
3. **`RL_AUTH` (5/min/IP) 429s** while several phones retry token requests from one IP: silent retries. These would clear eventually, but stretch the backoff.
4. **iOS-specific:**
   - `AbortSignal.timeout` missing (iOS < 16) or `crypto.randomUUID` missing (iOS < 15.4) would throw: the first inside the token `try` (→ "offline" → silent retry); the second inside the `try` in `addPhotos` (→ "That photo couldn't be read" toast, nothing queued, so not this symptom);
   - XHR `upload.onprogress` may not report `lengthComputable` → progress stays 0% even while uploading. Only cosmetic if the upload finishes.
5. **`navigator.onLine` false or flaky:** the item stays `waiting-offline`, but that shows "waiting for signal", not 0%, so it's unlikely to be this report.

### Fix directions (not started)

- Surface token errors:
  - `not-set-up` / `wrong-code` → a `failed`-like state with a message and the join form;
  - stop retrying until something changes.
- Cap attempts or add a deadline after which the item shows "Couldn't upload — Try again".
- Show "Waiting…" instead of "Uploading 0%" until bytes are actually sent.
- Ofek sets `ALBUM_SIGNING_KEY`.
- Add `src/lib/album/**` and `src/lib/sync/**` to the Worker's deploy path filter.

## Next action

**Fix the Album upload bug.**
