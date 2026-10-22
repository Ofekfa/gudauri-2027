# Handoff — 2026-10-22

## Current state

The last tag is **`v1.12.1`** (the album upload fix). `main` is at the docs PR that marks the bug resolved, and its CI is green.

- **Live site:** https://ofekfa.github.io/gudauri-2027/
- **Worker:** https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev

Both match `main`:

- Pages deploys on every push to `main`.
- The Worker was last deployed from `8bc7f14` (#93), and `ALBUM_SIGNING_KEY` is set.

There are no open PRs and no work-in-progress branches; old merged branches remain on the remote. Read `PLAN.md` (status, queue, decisions) and `CLAUDE.md` (conventions, gotchas) first.

## In progress

Phase 10.3 Album shipped in PRs #86–#91; the upload bug was fixed in #93 (`v1.12.1`). **Adding photos works on the live site** (verified 2026-10-22, see "Resolved bug"). Left to do:

1. Ofek's real-phone test: camera photo, gallery multi-select, airplane mode (steps in the `v1.12.1` report and below).

## Open questions for Ofek

- Two-phone shared-lists check (`v1.11.0`): did it work?
- Day-1 calendar times: still deferred ("let's deal with the time later")?
- Which, if any, of the queued ideas next: expenses, ski-day briefing, safety card, leaderboard?

## Manual steps Ofek owes

| Step                                                                                                             | Status                                                                                    | How verified                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GROUP_CODE` Worker secret                                                                                       | ✅ Done                                                                                   | `wrangler secret list`; wrong codes get `401`                                                                  |
| `CALENDAR_ICS_URL` Worker secret                                                                                 | ✅ Done                                                                                   | `wrangler secret list`; itinerary is live                                                                      |
| `ALBUM_SIGNING_KEY` Worker secret                                                                                | ✅ Done (2026-10-22, random key piped to `wrangler secret put`, never printed; Ofek's OK) | `wrangler secret list`; live session gives `401` for a wrong code (was `501`); two live uploads succeeded      |
| `ALBUM_PASSCODE`                                                                                                 | n/a                                                                                       | Doesn't exist: the album reuses `GROUP_CODE` (Ofek's decision)                                                 |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (GitHub Actions secrets)                                         | ✅ Done                                                                                   | `gh secret list` (set 2026-10-21); Worker deploys succeed                                                      |
| Album storage (Durable Object `AlbumStore`, migration `v2`) and bindings `ALBUM`, `LISTS`, `RL_AUTH`, KV `CACHE` | ✅ Done (by CI; nothing manual)                                                           | Deploy of `e549726` succeeded; live `GET /album` → `200 {"frames":{},"photos":[]}`; preflight lists `If-Match` |
| R2 bucket                                                                                                        | n/a                                                                                       | Not used                                                                                                       |
| Two-phone shared-lists test                                                                                      | ❓ Unknown                                                                                | Not reported                                                                                                   |
| Real-phone album test (iOS Safari, Android Chrome)                                                               | ❌ Not done                                                                               | Unblocked: the bug is fixed and the key is set                                                                 |
| iPhone music test; Kudebi cam phone test                                                                         | ❓ Unknown                                                                                | Not reported                                                                                                   |

To rotate the key (logs every phone out of the album; they get a new token silently): run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put ALBUM_SIGNING_KEY` in `worker/`.

## Known issues and risks

- The Worker's `RL_AUTH` rate limit (5/min per IP) also applies to token renewals. Four phones behind one hotel IP could hit it while retrying, which the client treats as "retry" (5 tries, then "Upload failed — tap to retry").
- The Worker takes `uploadedBy` from the upload's own details, not from the token's `who`. Any member can credit a photo to someone else. Low risk among four friends.
- Album images are fetched from the Worker on each view; only the browser's HTTP cache (`immutable`) keeps them offline. They aren't in the service-worker cache.
- Not verified on real phones: the iOS camera input, HEIC → JPEG conversion via `accept="image/jpeg,image/*"`, IndexedDB Blob storage on older iOS, and uploads on weak signal.
- The QA scripts (`album-e2e.mjs`, `round2.mjs`, …) and `ship-pr.sh` lived in the session scratchpad and are **not in the repo**. Ship with `gh pr create` → wait for CI → `gh pr merge --squash --delete-branch`.

## Resolved bug — Album upload stuck at "Uploading 0%" (fixed in `v1.12.1`, #93)

**Root cause:** `ALBUM_SIGNING_KEY` wasn't set, so `POST /album/session` returned `501`. The client mapped every token error (`not-set-up`, `wrong-code`, `not-joined`) to a silent retry with no limit, so the upload `POST` was never sent.

**Evidence (live, 2026-10-22):** Chrome plus `wrangler tail`. The only album request was `POST /album/session 501`, repeated at +0, +3, +6 and +15 s. The IndexedDB item stayed `queued` with its attempts climbing, and there were no console errors.

**Ruled out:**

- the `/chat` 16 kB body limit (`/chat` only; a 1.6 MB upload is accepted, tested);
- CORS preflights (POST/PATCH/PUT/DELETE with `Authorization`/`If-Match` pass, live and tested; errors carry CORS headers);
- the routes not being deployed (`GET /album` 200);
- a 401 from an expired token, and 429s;
- the image pipeline and IndexedDB (the item was stored with its preview);
- the dispatcher not starting (the session requests show it running).

**Fix:**

- `src/lib/album/uploader.ts`: token errors that waiting can't fix fail at once with a reason. A `401` on upload drops the cached token.
- `queue.ts`:
  - `MAX_ATTEMPTS` 5 online tries;
  - an `ATTEMPT_TIMEOUT_MS` 3-minute deadline per try;
  - a throw counts as a retry;
  - offline time doesn't use up tries.
- UI:
  - honest states via `uploadStatus` (`selectors.ts`);
  - "⚠️ Upload failed — tap to retry" plus the reason in the viewer;
  - a toast with the reason.
- Also: canvases are freed after encoding (iOS), and the Worker deploy filter covers the shared album, sync and countdown files.

**Verified:**

- Local, with no key: fails in about 1 s with "The album isn't set up on the server yet."
- Local, with a key: offline shows "Waiting for connection…", then the upload resumes (session 200, upload 201), and the photo survives a reload.
- Live, after the key was set: two uploads (one on the old bundle, one on the new) were listed by `GET /album`. The photo showed at full size after a reload. Both test photos were then deleted (204), so the live album is empty.

## Next action

Ofek's real-phone album test. After that, ask which queued idea is next.
