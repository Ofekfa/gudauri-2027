import { describe, expect, it } from 'vitest';
import { FACTS } from '../../data/facts';
import { FACT_TOPICS, type BaseFact, type Fact } from './types';

describe('Fact union', () => {
  it('keeps every fact usable through the shared base fields', () => {
    // Compile-time check: every Fact is assignable to BaseFact.
    const bases: BaseFact[] = FACTS satisfies Fact[];
    for (const f of bases) expect(typeof f.text).toBe('string');
  });

  it('only uses known topics', () => {
    for (const f of FACTS) expect(FACT_TOPICS).toContain(f.topic);
  });
});
