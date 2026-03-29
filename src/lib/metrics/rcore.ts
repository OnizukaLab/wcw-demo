import type { CoreMetrics } from '../../types/metrics';

const DEFAULT_WEIGHTS = {
  DRY: 0.34,
  SN: 0.26,
  SSOA: 0.22,
  JI: 0.10,
  PR: 0.08,
};

/**
 * R_core = Σ(weight_i × metric_i)
 */
export function calculateRCore(
  metrics: Omit<CoreMetrics, 'R_core'>,
  weights: Partial<Record<string, number>> = {}
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const rcore =
    metrics.DRY * w.DRY +
    metrics.SN * w.SN +
    metrics.SSOA * w.SSOA +
    metrics.JI * w.JI +
    metrics.PR * w.PR;
  return Math.max(0, Math.min(1, rcore));
}
