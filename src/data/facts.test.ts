import { describe, expect, it } from 'vitest';
import { FACT_TOPICS } from '../lib/facts/types';
import { FACTS } from './facts';

const MIN_FACTS = 40;
const MIN_PER_TOPIC = 5;
/** Keeps pop-ups short enough to read at a glance. */
const MAX_TEXT_LENGTH = 220;

describe('FACTS', () => {
  it(`has at least ${MIN_FACTS} facts with unique ids`, () => {
    expect(FACTS.length).toBeGreaterThanOrEqual(MIN_FACTS);
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
  });

  it(`covers every topic with at least ${MIN_PER_TOPIC} facts`, () => {
    for (const topic of FACT_TOPICS) {
      expect(FACTS.filter((f) => f.topic === topic).length).toBeGreaterThanOrEqual(MIN_PER_TOPIC);
    }
  });

  it('has a short text, a title and an https source for every fact', () => {
    for (const fact of FACTS) {
      expect(fact.title.length).toBeGreaterThan(0);
      expect(fact.text.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
      expect(fact.source).toMatch(/^https:\/\//);
    }
  });
});
