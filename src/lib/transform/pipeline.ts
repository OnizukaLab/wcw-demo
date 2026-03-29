import { WvletWorkerClient } from './wvletWorker';
import { compileViaREST } from './restFallback';
import { getPrecompiled, findPrecompiledBySQL } from './precompiledFallback';
import { calculateAllMetrics } from '../metrics';
import type { TransformResult } from './index';

let wvletWorker: WvletWorkerClient | null = null;
let wvletWorkerAvailable: boolean | null = null;

/**
 * 3段階フォールバック付きパイプライン
 * 1. Scala.js WebWorker (利用可能なら)
 * 2. REST API (ネットワーク接続があれば)
 * 3. プリコンパイル済み JSON (カタログ内クエリのみ)
 */
export async function transformSQLPipeline(sql: string): Promise<TransformResult> {
  // 戦略A: Scala.js
  if (wvletWorkerAvailable === null) {
    wvletWorker = new WvletWorkerClient();
    wvletWorkerAvailable = await wvletWorker.initialize();
  }
  if (wvletWorkerAvailable && wvletWorker) {
    try {
      const result = await wvletWorker.compile(sql);
      return attachMetrics(result);
    } catch (e) {
      console.warn('Scala.js compile failed, trying REST:', e);
    }
  }

  // 戦略B: REST API
  try {
    const result = await compileViaREST(sql);
    return attachMetrics(result);
  } catch (e) {
    console.warn('REST API failed, trying precompiled:', e);
  }

  // 戦略C: プリコンパイル済み
  const queryId = await findPrecompiledBySQL(sql);
  if (queryId) {
    const result = await getPrecompiled(queryId);
    if (result) {
      // SQL 原文ステージを先頭に追加
      const sqlStage = {
        id: 0,
        name: 'Original',
        code: sql,
        language: 'sql' as const,
        metrics: calculateAllMetrics(sql, 'sql'),
      };
      const wvletStages = result.stages.map((s, i) => ({ ...s, id: i + 1 }));
      return {
        ...result,
        stages: [sqlStage, ...wvletStages],
      };
    }
  }

  // 全戦略失敗 — Original ステージのみ返す
  return {
    stages: [{
      id: 0,
      name: 'Original',
      code: sql,
      language: 'sql',
      metrics: calculateAllMetrics(sql, 'sql'),
    }],
    success: false,
    error: 'All transform methods unavailable. Only original SQL metrics shown.',
    transformMethod: 'precompiled',
  };
}

/**
 * 各ステージにメトリクスを計算して付与
 */
function attachMetrics(result: TransformResult): TransformResult {
  return {
    ...result,
    stages: result.stages.map(stage => ({
      ...stage,
      metrics: stage.metrics ?? calculateAllMetrics(stage.code, stage.language),
    })),
  };
}
