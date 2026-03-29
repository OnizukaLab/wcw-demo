import { describe, it, expect } from 'vitest';
import { calculateAllMetrics } from '../index';

describe('R_core (calculateAllMetrics)', () => {
  it('全指標が0-1の範囲で返される', () => {
    const metrics = calculateAllMetrics('SELECT id FROM users', { language: 'sql' });
    expect(metrics.DRY).toBeGreaterThanOrEqual(0);
    expect(metrics.DRY).toBeLessThanOrEqual(1);
    expect(metrics.SN).toBeGreaterThanOrEqual(0);
    expect(metrics.SN).toBeLessThanOrEqual(1);
    expect(metrics.SSOA).toBeGreaterThanOrEqual(0);
    expect(metrics.SSOA).toBeLessThanOrEqual(1);
    expect(metrics.JI).toBeGreaterThanOrEqual(0);
    expect(metrics.JI).toBeLessThanOrEqual(1);
    expect(metrics.PR).toBeGreaterThanOrEqual(0);
    expect(metrics.PR).toBeLessThanOrEqual(1);
    expect(metrics.R_core).toBeGreaterThanOrEqual(0);
    expect(metrics.R_core).toBeLessThanOrEqual(1);
  });

  it('R_core は重み付き総合スコアである', () => {
    const metrics = calculateAllMetrics('SELECT id FROM users WHERE age > 20', { language: 'sql' });
    const expected = 0.34 * metrics.DRY + 0.26 * metrics.SN + 0.22 * metrics.SSOA + 0.10 * metrics.JI + 0.08 * metrics.PR;
    expect(metrics.R_core).toBeCloseTo(expected, 5);
  });
});
