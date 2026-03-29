/** コア5指標 + R_core */
export interface CoreMetrics {
  DRY: number;   // 0-1, 高いほど重複なし
  SN: number;    // 0-1, 高いほどネストなし
  SSOA: number;  // 0-1, 高いほど順序一致
  JI: number;    // 0-1, 高いほどJOIN意図明確
  PR: number;    // 0-1, 高いほど述語読みやすい
  R_core: number; // 重み付き総合スコア
}

/** 変換段階 */
export type TransformStage =
  | 'original'
  | 'flattened'
  | 'flow_reordered'
  | 'deduplicated'
  | 'final';

/** 各段階のスナップショット */
export interface StageSnapshot {
  stage: TransformStage;
  code: string;
  language: 'sql' | 'wvlet';
  metrics: CoreMetrics;
  lineCount: number;
  maxNestDepth: number;
}

/** メトリクスの重み */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  DRY: 0.34,
  SN: 0.26,
  SSOA: 0.22,
  JI: 0.10,
  PR: 0.08,
};
