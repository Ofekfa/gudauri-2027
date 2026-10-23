/**
 * Shared ski-game high scores. Reading is public (like viewing the album);
 * posting a run needs the album token, so visitors can't post fake records.
 */
import { HIGH_SCORES_PER_CHARACTER } from '../../../src/game/constants';
import { FIRST_EPOCH, parseScoreSubmission, type ScoreSubmission } from '../../../src/game/scores';
import type { TravelerId } from '../../../src/data/trip';
import type { ScoreListing, StaleEpoch, SubmitResult } from '../game/logic';
import type { Env } from '../env';
import { errorJson, json } from '../http';
import type { Route } from '../router';
import { authorise } from './album';

/** The Durable Object stub's RPC surface (see game/ScoresStore.ts). */
export interface ScoresStub {
  list(limit: number, epoch: number): Promise<ScoreListing>;
  submit(
    submission: ScoreSubmission,
    playedBy: TravelerId,
    epoch: number,
  ): Promise<SubmitResult | StaleEpoch>;
}

/** The configured score epoch (`SCORE_EPOCH` in wrangler.toml); bumping it resets the scores. */
export function configuredEpoch(env: Env): number {
  const n = Number(env.SCORE_EPOCH);
  return Number.isSafeInteger(n) && n >= FIRST_EPOCH ? n : FIRST_EPOCH;
}

/** Short shared cache: a new record shows on other phones within this long. */
const SCORES_MAX_AGE_S = 20;
const MAX_BODY = 1_000;
const store = (env: Env) => env.SCORES!.get(env.SCORES!.idFromName('scores'));

export const gameScoresListRoute: Route = {
  method: 'GET',
  path: '/game/scores',
  rateLimit: 'RL_DATA',
  async handler({ env, cors }) {
    if (!env.SCORES) return errorJson(501, 'Scores not set up', cors);
    return json(200, await store(env).list(HIGH_SCORES_PER_CHARACTER, configuredEpoch(env)), {
      ...cors,
      'Cache-Control': `public, max-age=${SCORES_MAX_AGE_S}`,
    });
  },
};

export const gameScoresSubmitRoute: Route = {
  method: 'POST',
  path: '/game/scores',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, now } = ctx;
    if (!env.SCORES) return errorJson(501, 'Scores not set up', cors);
    let raw: unknown;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) return errorJson(413, 'Request too large', cors);
      raw = JSON.parse(text);
    } catch {
      return errorJson(400, 'Invalid request', cors);
    }
    const parsed = parseScoreSubmission(raw, now.getTime());
    if (!parsed.ok) return errorJson(parsed.status, parsed.error, cors);
    // Who played comes from the token, never from the request.
    const result = await store(env).submit(parsed.value, auth.who, configuredEpoch(env));
    // From before a reset: the phone drops it quietly and catches up with the new epoch.
    if ('stale' in result)
      return json(
        409,
        { error: 'The scores were reset', epoch: result.epoch },
        { ...cors, 'Cache-Control': 'no-store' },
      );
    return json(
      result.created ? 201 : 200,
      { character: result.character, top: result.top, newBest: result.newBest },
      { ...cors, 'Cache-Control': 'no-store' },
    );
  },
};

export const gameRoutes = [gameScoresListRoute, gameScoresSubmitRoute];
