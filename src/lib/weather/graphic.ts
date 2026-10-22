/** Geometry for the side-profile mountain graphic (pure, so it can be tested). */

export const GRAPHIC = {
  width: 360,
  height: 280,
  /** Elevation range drawn on the vertical axis. */
  minElevationM: 1800,
  maxElevationM: 3300,
  /** Vertical pixel range for that elevation range. */
  topY: 30,
  bottomY: 262,
  /** The mountain occupies the left part; labels sit on the right. */
  mountainRight: 214,
  /** Snow blanket: 1 px per this many cm, capped. */
  cmPerPx: 3,
  maxSnowPx: 34,
} as const;

/** y coordinate for an elevation (higher = smaller y). */
export function elevationToY(elevationM: number): number {
  const { minElevationM, maxElevationM, topY, bottomY } = GRAPHIC;
  const t = (elevationM - minElevationM) / (maxElevationM - minElevationM);
  return Math.round((bottomY - t * (bottomY - topY)) * 10) / 10;
}

/** Height (px) of the snow blanket drawn above a zone line for a modeled depth. */
export function snowBlanketPx(depthCm: number | null): number {
  if (!depthCm || depthCm <= 0) return 0;
  return Math.min(GRAPHIC.maxSnowPx, Math.max(2, Math.round(depthCm / GRAPHIC.cmPerPx)));
}
