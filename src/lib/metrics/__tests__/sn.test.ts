import { describe, it, expect } from 'vitest';
import { calculateSN } from '../sn';

describe('SN', () => {
  it('ネストなしSQLでは1.0を返す', () => {
    expect(calculateSN('SELECT id FROM users', 'sql')).toBe(1.0);
  });

  it('1段ネストで1未満を返す', () => {
    const sql = 'SELECT * FROM (SELECT id FROM t) sub';
    const sn = calculateSN(sql, 'sql');
    expect(sn).toBeLessThan(1.0);
    expect(sn).toBeGreaterThan(0);
  });

  it('深いネストほどスコアが低い', () => {
    const shallow = 'SELECT * FROM (SELECT id FROM t) sub';
    const deep = 'SELECT * FROM (SELECT * FROM (SELECT id FROM t) s1) s2';
    expect(calculateSN(shallow, 'sql')).toBeGreaterThan(calculateSN(deep, 'sql'));
  });

  it('Wvlet: {} なしで1.0', () => {
    expect(calculateSN('from users\nselect id', 'wvlet')).toBe(1.0);
  });
});
