import type { CoreMetrics } from '../../types/metrics';
import type { LogicalPlan } from '../../types/plan';

export interface TransformStageResult {
  id: number;
  name: string;
  code: string;
  language: 'sql' | 'wvlet';
  metrics: CoreMetrics;
  logicalPlan?: LogicalPlan;
  diff?: {
    addedLines: number[];
    removedLines: number[];
    modifiedLines: number[];
  };
}

export interface TransformResult {
  stages: TransformStageResult[];
  success: boolean;
  error?: string;
  transformMethod: 'scalajs' | 'rest' | 'precompiled';
}

/**
 * SQL を段階的に Wvlet に変換する。
 * 3 つの戦略（Scala.js → REST → プリコンパイル）を順に試行する。
 */
export async function transformSQL(sql: string): Promise<TransformResult> {
  const { transformSQLPipeline } = await import('./pipeline');
  return transformSQLPipeline(sql);
}

/**
 * 特定のステージだけを取得する（アニメーション用）
 */
export async function getStage(sql: string, stageId: number): Promise<TransformStageResult | null> {
  const result = await transformSQL(sql);
  return result.stages[stageId] ?? null;
}
