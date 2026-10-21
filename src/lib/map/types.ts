/** Shape of src/data/pistes.json, produced by scripts/fetch-pistes.ts from OpenStreetMap (ODbL). */

export type Difficulty = 'novice' | 'easy' | 'intermediate' | 'advanced' | 'unknown';

export type LiftKind = 'gondola' | 'chair_lift' | 'drag_lift' | 'magic_carpet' | 'other';

export interface MapRun {
  id: string;
  name: string | null;
  difficulty: Difficulty;
  /** SVG path data in map units. */
  path: string;
  lengthM: number;
  /** Mapped as a ski area polygon rather than a line. */
  area?: true;
}

export interface MapLift {
  id: string;
  name: string | null;
  kind: LiftKind;
  path: string;
  /** Bottom and top station positions in map units. */
  stations: [number, number][];
  lengthM: number;
}

export type PoiKind = 'hotel' | 'monument' | 'peak';

export interface MapPoi {
  id: string;
  name: string;
  kind: PoiKind;
  x: number;
  y: number;
  eleM?: number;
}

export interface PisteMap {
  width: number;
  height: number;
  runs: MapRun[];
  lifts: MapLift[];
  pois: MapPoi[];
  /** ISO date the data was fetched. */
  fetchedAt: string;
}
