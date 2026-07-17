import { describe, expect, it } from 'vitest';

import { csvCell } from './phase-3-operations';

describe('Phase 3 reporting', () => {
  it('escapes CSV cells without exposing excluded detail fields', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('note, with "quotes"')).toBe('"note, with ""quotes"""');
    expect(csvCell(null)).toBe('');
  });
});
