import { describe, expect, it } from 'vitest';

import { csvCell, csvDataRowCount } from './phase-3-operations';

describe('Phase 3 reporting', () => {
  it('escapes CSV cells without exposing excluded detail fields', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('note, with "quotes"')).toBe('"note, with ""quotes"""');
    expect(csvCell(null)).toBe('');
  });

  it('counts only exported data rows for bounded audit metadata', () => {
    expect(csvDataRowCount('header\r\nrow-one\r\nrow-two')).toBe(2);
    expect(csvDataRowCount('header')).toBe(0);
  });
});
