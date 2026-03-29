import type { TransformResult, TransformStageResult } from './index';
import { calculateAllMetrics } from '../metrics';

// Pre-loaded transformations cache
let transformationsCache: Record<string, TransformResult> | null = null;

async function loadTransformations(): Promise<Record<string, TransformResult>> {
  if (transformationsCache) return transformationsCache;
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/transformations.json`);
    if (!resp.ok) throw new Error('Failed to load');
    const data = await resp.json();

    const cache: Record<string, TransformResult> = {};
    // 形式: { transformations: { "tpch-q1": { stages: [{name, wvlet},...] }, ... } }
    const transformations = data.transformations ?? data;
    for (const [id, entry] of Object.entries(transformations)) {
      const raw = entry as { stages: Array<{ name: string; wvlet: string }> };
      if (!raw.stages) continue;
      const stages: TransformStageResult[] = raw.stages.map((s, i) => ({
        id: i,
        name: s.name,
        code: s.wvlet,
        language: 'wvlet' as const,
        metrics: calculateAllMetrics(s.wvlet, 'wvlet'),
      }));
      cache[id] = {
        stages,
        success: true,
        transformMethod: 'precompiled',
      };
    }
    transformationsCache = cache;
    return cache;
  } catch {
    transformationsCache = {};
    return {};
  }
}

/**
 * プリコンパイル済み JSON を返す。カタログ内の 50 クエリのみ対応。
 */
export async function getPrecompiled(queryId: string): Promise<TransformResult | null> {
  const cache = await loadTransformations();
  return cache[queryId] ?? null;
}

/**
 * SQL のハッシュからカタログの queryId を検索
 */
export async function findPrecompiledBySQL(sql: string): Promise<string | null> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/catalog.json`);
    if (!resp.ok) return null;
    const catalog = await resp.json();
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const queries = catalog.queries || catalog;

    for (const entry of queries) {
      const entryNorm = entry.sql.replace(/\s+/g, ' ').trim().toLowerCase();
      if (entryNorm === normalized) return entry.id;
    }
    return null;
  } catch {
    return null;
  }
}
