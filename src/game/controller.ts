/**
 * Wires engine + renderer + input to a canvas: fixed-timestep loop on
 * requestAnimationFrame, resize handling, and auto-pause when the tab is hidden.
 */
import type { TravelerId } from '../data/trip';
import {
  FIXED_STEP,
  LIVES,
  MAX_DEVICE_PIXEL_RATIO,
  MAX_FIELD_WIDTH,
  MAX_STEPS_PER_FRAME,
  METERS_PER_PX,
} from './constants';
import {
  createGameState,
  resetGame,
  resizeGame,
  score,
  startGame,
  step,
  type GameState,
} from './engine';
import { createInput } from './input';
import { renderFrame } from './render';
import { createEntitySprites, createSkierSprite } from './sprites';

export type ControllerStatus = 'ready' | 'playing' | 'paused' | 'over';

export interface GameResult {
  score: number;
  meters: number;
  khachapuri: number;
  snowflakes: number;
}

export interface ControllerOptions {
  field: HTMLElement;
  canvas: HTMLCanvasElement;
  character: TravelerId;
  onStatus: (status: ControllerStatus, result?: GameResult) => void;
}

/** Long frames (tab switches, GC pauses) are capped so the skier doesn't teleport. */
const MAX_FRAME_SECONDS = 0.25;
const CRASH_VIBRATION_MS = 60;

export async function createGameController({
  field,
  canvas,
  character,
  onStatus,
}: ControllerOptions) {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const sprites = createEntitySprites(dpr);
  const skier = await createSkierSprite(character, dpr);
  const state: GameState = createGameState(1, 1);
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
        step(state, input.state, FIXED_STEP, Math.random);
        accumulator -= FIXED_STEP;
        steps++;
        if (state.crashedThisStep) navigator.vibrate?.(CRASH_VIBRATION_MS);
        if (state.status === 'over') {
          setStatus('over');
          break;
        }
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    }
    last = now;
    renderFrame(ctx, state, { sprites, skier, maxLives: LIVES });
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
