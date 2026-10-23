/**
 * Wires engine + renderer + input to a canvas: fixed-timestep loop on
 * requestAnimationFrame, resize handling, and auto-pause when the tab is hidden.
 */
import type { TravelerId } from '../data/trip';
import {
  FIXED_STEP,
  MAX_DEVICE_PIXEL_RATIO,
  MAX_FIELD_WIDTH,
  MAX_STEPS_PER_FRAME,
  METERS_PER_PX,
  SCORE,
  type DifficultyProfile,
} from './constants';
import { addFloater, clearEffects, createEffects, pulseLives, tickEffects } from './effects';
import {
  createGameState,
  resetGame,
  resizeGame,
  score,
  skierScreenY,
  startGame,
  step,
  type GameState,
  type Random,
} from './engine';
import { createInput } from './input';
import { createRng, randomSeed } from './random';
import { renderFrame } from './render';
import { createEntitySprites, createSkierSprite } from './sprites';

export type ControllerStatus = 'ready' | 'playing' | 'paused' | 'over';

export interface GameResult {
  score: number;
  meters: number;
  khachapuri: number;
  snowflakes: number;
  hearts: number;
  powerUps: number;
  /** Play time, pauses excluded (simulation time). */
  seconds: number;
}

export interface ControllerOptions {
  field: HTMLElement;
  canvas: HTMLCanvasElement;
  character: TravelerId;
  profile: DifficultyProfile;
  /** A small HUD label naming a trial preset (only when picked by link). */
  presetLabel: string | null;
  onStatus: (status: ControllerStatus, result?: GameResult) => void;
}

/** Long frames (tab switches, GC pauses) are capped so the skier doesn't teleport. */
const MAX_FRAME_SECONDS = 0.25;
const CRASH_VIBRATION_MS = 60;
const SHIELD_VIBRATION_MS = 25;
/** Floating text appears this far above the skier. */
const FLOATER_OFFSET_Y = 34;

export async function createGameController({
  field,
  canvas,
  character,
  profile,
  presetLabel,
  onStatus,
}: ControllerOptions) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const sprites = createEntitySprites(dpr);
  const skier = await createSkierSprite(character, dpr);
  const state: GameState = createGameState(1, 1, { profile });
  const effects = createEffects();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Each run gets its own seed; the engine itself stays deterministic.
  let random: Random = createRng(randomSeed());
  let status: ControllerStatus = 'ready';
  let frame = 0;
  let last = 0;
  let accumulator = 0;

  const setStatus = (next: ControllerStatus) => {
    if (next === status) return;
    status = next;
    if (next === 'over') {
      onStatus(next, {
        score: score(state),
        meters: Math.floor(state.distance * METERS_PER_PX),
        khachapuri: state.collectedKhachapuri,
        snowflakes: state.collectedSnowflakes,
        hearts: state.collectedHearts,
        powerUps: state.collectedPowerUps,
        seconds: state.time,
      });
    } else {
      onStatus(next);
    }
  };

  const resize = () => {
    const width = Math.min(field.clientWidth, MAX_FIELD_WIDTH);
    const height = field.clientHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const firstLayout = state.width === 1;
    resizeGame(state, width, height);
    if (firstLayout) resetGame(state);
  };

  const pause = () => {
    if (status === 'playing') {
      input.release();
      setStatus('paused');
    }
  };
  const resume = () => {
    if (status === 'paused') {
      last = performance.now();
      setStatus('playing');
    }
  };
  const start = () => {
    if (status === 'ready' || status === 'over') {
      random = createRng(randomSeed());
      clearEffects(effects);
      startGame(state);
      last = performance.now();
      accumulator = 0;
      setStatus('playing');
    } else if (status === 'paused') {
      resume();
    }
  };
  const restart = () => {
    resetGame(state);
    setStatus('ready');
    start();
  };

  const input = createInput(
    canvas,
    (action) => {
      if (action === 'pause') {
        if (status === 'playing') pause();
        else if (status === 'paused') resume();
      } else start();
    },
    () => status === 'playing',
  );

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (status === 'playing') {
      accumulator += Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      let steps = 0;
      while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
        step(state, input.state, FIXED_STEP, random);
        accumulator -= FIXED_STEP;
        steps++;
        react();
        if (state.status === 'over') {
          setStatus('over');
          break;
        }
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
      tickEffects(effects, Math.min((now - last) / 1000, MAX_FRAME_SECONDS));
    }
    last = now;
    renderFrame(ctx, state, {
      sprites,
      skier,
      maxLives: profile.lives.max,
      presetLabel,
      effects,
      reducedMotion: motionQuery.matches,
    });
  };

  /** Turns this step's events into feedback (vibration, floating text, HUD pulse). */
  const react = () => {
    const x = state.skierX;
    const y = skierScreenY(state) - FLOATER_OFFSET_Y;
    if (state.shieldBrokeThisStep) {
      navigator.vibrate?.(SHIELD_VIBRATION_MS);
      addFloater(effects, '🛡️ Saved!', x, y);
    }
    if (state.crashedThisStep) {
      navigator.vibrate?.(CRASH_VIBRATION_MS);
      pulseLives(effects, state.lives);
    }
    if (state.lifeGainedThisStep) {
      addFloater(effects, '+1 ❤️', x, y);
      pulseLives(effects, state.lives - 1);
    } else if (state.collectedThisStep === 'heart') {
      addFloater(effects, `+${SCORE.heartAtCap}`, x, y);
    }
    const def = state.powerUpDefs[state.poweredUpThisStep];
    if (def) addFloater(effects, `${def.icon} ${def.label}!`, x, y);
  };

  const onVisibility = () => {
    if (document.hidden) pause();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(field);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', pause);
  resize();
  frame = requestAnimationFrame(loop);

  return {
    start,
    pause,
    resume,
    restart,
    getStatus: () => status,
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
      input.destroy();
    },
  };
}

export type GameController = Awaited<ReturnType<typeof createGameController>>;
