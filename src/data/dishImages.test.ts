import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DISHES } from './dishes';
import { DISH_IMAGE_FORMATS, DISH_IMAGE_WIDTHS, DISH_IMAGES, dishImage } from './dishImages';

const DIR = new URL('../../public/food/', import.meta.url);
/** Per-file budget for card and detail images. */
const MAX_BYTES = 60 * 1024;
/** Reusable on a public site with attribution. */
const ALLOWED_LICENCE = /^(CC0|Public domain|PD.*|CC BY(-SA)? \d\.\d)$/i;
const ATTRIBUTION_LICENCE = /^CC BY/;

describe('dish images', () => {
  it('belong to real dishes and cover most of them', () => {
    const ids = new Set(DISHES.map((d) => d.id));
    for (const image of DISH_IMAGES) expect(ids.has(image.id), image.id).toBe(true);
    expect(DISH_IMAGES.length).toBeGreaterThanOrEqual(DISHES.length * 0.8);
    expect(dishImage('khinkali')?.width).toBe(640);
    expect(dishImage('khachapuri-penovani')).toBeUndefined();
  });

  it.each(DISH_IMAGES.map((c) => [c.id, c] as const))(
    '%s has complete, reusable credits',
    (_id, image) => {
      expect(image.license).toMatch(ALLOWED_LICENCE);
      if (ATTRIBUTION_LICENCE.test(image.license)) {
        expect(image.author.trim()).not.toBe('');
        expect(image.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      }
      expect(image.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(image.alt.length).toBeGreaterThan(10);
      expect(image.modified).not.toBe('');
      expect(image.height * 4).toBe(image.width * 3);
    },
  );

  it('ships every size and format within the budget, and nothing else', () => {
    const expected = new Set(
      DISH_IMAGES.flatMap((image) =>
        DISH_IMAGE_WIDTHS.flatMap((w) => DISH_IMAGE_FORMATS.map((f) => `${image.id}-${w}.${f}`)),
      ),
    );
    const onDisk = readdirSync(DIR);
    expect(new Set(onDisk)).toEqual(expected);
    for (const file of onDisk) {
      expect(statSync(new URL(file, DIR)).size, file).toBeLessThanOrEqual(MAX_BYTES);
    }
  });
});
