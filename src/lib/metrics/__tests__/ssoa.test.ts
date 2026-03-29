import { describe, it, expect } from 'vitest';
import { calculateSSOA } from '../ssoa';

describe('SSOA', () => {
  it('SQL: SELECT...FROM → SSOA < 1.0', () => {
    const sql = 'SELECT id FROM users WHERE age > 20';
    expect(calculateSSOA(sql, 'sql')).toBeLessThan(1.0);
  });

  it('Wvlet: from...select → SSOA ≈ 1.0', () => {
    const wvlet = 'from users\nwhere age > 20\nselect id';
    expect(calculateSSOA(wvlet, 'wvlet')).toBeCloseTo(1.0, 1);
  });
});
