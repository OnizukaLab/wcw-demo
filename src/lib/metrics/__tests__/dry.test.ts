import { describe, it, expect } from 'vitest';
import { calculateDRY } from '../dry';

describe('DRY', () => {
  it('重複なしSQLでは1.0を返す', () => {
    expect(calculateDRY('SELECT id FROM users', 'sql')).toBe(1.0);
  });

  it('重複サブクエリがある場合は1未満を返す', () => {
    const sql = `
      SELECT * FROM (SELECT id FROM t1) a
      JOIN (SELECT id FROM t1) b ON a.id = b.id
    `;
    expect(calculateDRY(sql, 'sql')).toBeLessThan(1.0);
  });

  it('CTEで重複排除した場合は高スコア', () => {
    const sql = `
      WITH tmp AS (SELECT id FROM t1)
      SELECT * FROM tmp a JOIN tmp b ON a.id = b.id
    `;
    expect(calculateDRY(sql, 'sql')).toBeGreaterThan(0.8);
  });
});
