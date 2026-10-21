import { describe, expect, it } from 'vitest';
import { backupFileName } from './backup';
import { defaultIdGenerator } from './ids';
import { normalizeText } from './text';

describe('list helpers', () => {
  it('normalizes whitespace and caps length', () => {
    expect(normalizeText('  Ski   gloves \n', 80)).toBe('Ski gloves');
    expect(normalizeText('abcdef', 3)).toBe('abc');
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => defaultIdGenerator()));
    expect(ids.size).toBe(50);
  });

  it('builds dated backup file names', () => {
    expect(backupFileName('gudauri-todo', new Date('2027-01-31T10:00:00Z'))).toBe(
      'gudauri-todo-2027-01-31.json',
    );
  });
});
