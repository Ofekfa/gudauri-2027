import type { Difficulty, LiftKind, MapLift, MapRun } from './types';

export interface DifficultyInfo {
  label: string;
  /** Color name used on European piste maps. */
  colorName: string;
  /** Sort order, easiest first. */
  order: number;
}

/** OSM uses the European scale: novice=green, easy=blue, intermediate=red, advanced=black. */
export const DIFFICULTY: Record<Difficulty, DifficultyInfo> = {
  novice: { label: 'Beginner', colorName: 'green', order: 0 },
  easy: { label: 'Easy', colorName: 'blue', order: 1 },
  intermediate: { label: 'Intermediate', colorName: 'red', order: 2 },
  advanced: { label: 'Advanced', colorName: 'black', order: 3 },
  unknown: { label: 'Unrated', colorName: 'grey', order: 4 },
};

export const LIFT_LABEL: Record<LiftKind, string> = {
  gondola: 'Gondola',
  chair_lift: 'Chairlift',
  drag_lift: 'Drag lift',
  magic_carpet: 'Magic carpet',
  other: 'Lift',
};

export interface RunGroup {
  /** Stable key, also used to highlight all segments on the map. */
  key: string;
  name: string | null;
  difficulty: Difficulty;
  lengthM: number;
  runIds: string[];
}

/** OSM often splits one named run into several ways; merge them for lists and selection. */
export function groupRuns(runs: MapRun[]): RunGroup[] {
  const groups = new Map<string, RunGroup>();
  for (const run of runs) {
    const key = run.name ? `run:${run.name}:${run.difficulty}` : `run:${run.id}`;
    const group = groups.get(key);
    if (group) {
      group.lengthM += run.lengthM;
      group.runIds.push(run.id);
    } else {
      groups.set(key, {
        key,
        name: run.name,
        difficulty: run.difficulty,
        lengthM: run.lengthM,
        runIds: [run.id],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      DIFFICULTY[a.difficulty].order - DIFFICULTY[b.difficulty].order ||
      (a.name ?? '').localeCompare(b.name ?? '', 'en', { numeric: true }),
  );
}

export const liftKey = (lift: MapLift) => `lift:${lift.id}`;

const METERS_PER_KM = 1000;

export function formatLength(meters: number): string {
  return meters >= METERS_PER_KM
    ? `${(meters / METERS_PER_KM).toFixed(1)} km`
    : `${Math.round(meters / 10) * 10} m`;
}
