import { describe, expect, it } from 'vitest';
import { createProjection, haversineM, simplify, toSvgPath, type Point } from './geometry.ts';

describe('haversineM', () => {
  it('measures ~111 km per degree of latitude', () => {
    const d = haversineM({ lat: 42, lon: 44 }, { lat: 43, lon: 44 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('createProjection', () => {
  const bounds = { south: 42, west: 44, north: 43, east: 45 };
  const { project, width, height } = createProjection(bounds, 1000);

  it('maps the north-west corner to the origin and north up', () => {
    expect(project({ lat: 43, lon: 44 })).toEqual([0, 0]);
    const [, ySouth] = project({ lat: 42, lon: 44 });
    expect(ySouth).toBeCloseTo(height);
  });

  it('shrinks longitude by cos(latitude) so shapes are not stretched', () => {
    expect(width).toBe(1000);
    expect(height / width).toBeCloseTo(1 / Math.cos((42.5 * Math.PI) / 180), 5);
  });
});

describe('simplify', () => {
  it('drops collinear points', () => {
    const line: Point[] = [
      [0, 0],
      [1, 0.01],
      [2, 0],
      [3, 0],
    ];
    expect(simplify(line, 0.5)).toEqual([
      [0, 0],
      [3, 0],
    ]);
  });

  it('keeps corners', () => {
    const corner: Point[] = [
      [0, 0],
      [5, 0],
      [5, 5],
    ];
    expect(simplify(corner, 0.5)).toEqual(corner);
  });
});

describe('toSvgPath', () => {
  it('builds compact path data', () => {
    expect(
      toSvgPath([
        [0, 0],
        [1.5, 2],
      ]),
    ).toBe('M0 0L1.5 2');
  });
});
