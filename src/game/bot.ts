/**
 * A scripted skier for balance tests (test-only; never imported by the app).
 */
import { ENTITY, SKIER } from './constants';
import { skierScreenY, step, type GameInput, type GameState, type Random } from './engine';

/** How far ahead the bot plans, in seconds of travel. */
const PLAN_AHEAD_S = 1.4;
/** Candidate lanes across the field. */
const LANE_STEP = 12;
const LANE_HALF_WIDTH = 30;
/** Pickups are worth this much clear distance (px) when choosing a lane. */
const HEART_VALUE = 260;
const POWER_UP_VALUE = 200;
const COLLECTIBLE_VALUE = 50;
const DEADZONE = 6;
/** Re-plan every few steps (40 times a second at 120 Hz): quicker than a person, and cheap. */
const DECIDE_EVERY = 3;

/**
 * Scores each lane by how far it stays clear (and what it can grab on the
 * way), counting only lanes the skier can reach before its first obstacle,
 * then steers toward the best one. Roughly a decent (not perfect) player.
 */
export function botInput(state: GameState): GameInput {
  const skierY = state.distance + skierScreenY(state);
  const horizon = state.speed * PLAN_AHEAD_S;
  let bestX = state.skierX;
  let bestScore = -Infinity;
  for (let x = SKIER.edgeMargin; x <= state.width - SKIER.edgeMargin; x += LANE_STEP) {
    // Time to get there at top lateral speed, as slope distance travelled meanwhile.
    const reachPx = (Math.abs(x - state.skierX) / SKIER.maxLateralSpeed) * state.speed;
    let clear = horizon;
    let gain = 0;
    for (const e of state.entities) {
      if (!e.active) continue;
      const dy = e.y - skierY;
      if (dy < -12 || dy > horizon) continue;
      const role = ENTITY[e.kind].role;
      const inLane = Math.abs(e.x - x) < LANE_HALF_WIDTH;
      // Obstacles between here and the lane, before we'd get there, block the move too.
      const onTheWay =
        dy < reachPx &&
        e.x > Math.min(x, state.skierX) - LANE_HALF_WIDTH &&
        e.x < Math.max(x, state.skierX) + LANE_HALF_WIDTH;
      if (role === 'obstacle') {
        if (inLane || onTheWay) clear = Math.min(clear, Math.max(0, dy));
      } else if (inLane && dy > reachPx) {
        gain +=
          e.kind === 'heart'
            ? HEART_VALUE
            : role === 'powerup'
              ? POWER_UP_VALUE
              : COLLECTIBLE_VALUE;
      }
    }
    const score = clear + (clear >= horizon ? gain : 0) - Math.abs(x - state.skierX) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestX = x;
    }
  }
  if (Math.abs(bestX - state.skierX) <= DEADZONE) return { left: false, right: false };
  return { left: bestX < state.skierX, right: bestX > state.skierX };
}

export interface BotRun {
  seconds: number;
  score: number;
  hearts: number;
  powerUps: number;
}

/** Plays one run to the end (or `maxSeconds`) with the bot steering. */
export function playBotRun(
  state: GameState,
  random: Random,
  dt: number,
  maxSeconds: number,
  score: (s: GameState) => number,
): BotRun {
  let input = botInput(state);
  for (let n = 0; state.status === 'playing' && state.time < maxSeconds; n++) {
    if (n % DECIDE_EVERY === 0) input = botInput(state);
    step(state, input, dt, random);
  }
  return {
    seconds: state.time,
    score: score(state),
    hearts: state.collectedHearts,
    powerUps: state.collectedPowerUps,
  };
}
