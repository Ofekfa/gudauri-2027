import { describe, expect, it } from 'vitest';
import { FACTS } from './facts';
import { WORDS } from './words';
import { isWordFact } from '../lib/facts/types';

const MIN_WORDS = 20;
/** Mkhedruli letters (U+10D0–U+10FF) plus spaces and sentence punctuation. */
const GEORGIAN_ONLY = /^[ა-ჿ ?!,.]+$/u;
const MAX_TEXT_LENGTH = 220;

describe('Georgian words', () => {
  it(`has at least ${MIN_WORDS} words, all part of FACTS`, () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(MIN_WORDS);
    expect(FACTS.filter(isWordFact)).toHaveLength(WORDS.length);
  });

  it('writes every word in Georgian script with a Latin transliteration and meaning', () => {
    for (const w of WORDS) {
      expect(w.word).toMatch(GEORGIAN_ONLY);
      expect(w.transliteration).toMatch(/^[a-z’ ?!]+$/);
      expect(w.meaning.length).toBeGreaterThan(0);
      expect(w.text).toContain(w.word);
      expect(w.text.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
    }
  });

  it('cites a Wiktionary page for every word', () => {
    for (const w of WORDS) expect(w.source).toMatch(/^https:\/\/en\.wiktionary\.org\/wiki\/%E1%83/);
  });

  it('covers the essentials', () => {
    const meanings = WORDS.map((w) => w.meaning);
    for (const m of ['hello', 'thank you', 'no', 'please', 'cheers!', 'water', 'help!', 'five']) {
      expect(meanings).toContain(m);
    }
  });
});
