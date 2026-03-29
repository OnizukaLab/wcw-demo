import { calculateAllMetrics } from '../metrics';
import { sqlToWvletStages } from '../transform/sqlToWvlet';
import { refactorMultipleQueriesViaCompiler } from '../wvlet';
import type { CoreMetrics } from '../../types/metrics';

export interface BatchQueryInput {
  id: string;
  name: string;
  sql: string;
}

export interface BatchResult {
  id: string;
  name: string;
  sql: string;
  wvlet: string;
  refactored: string | null;
  sqlMetrics: CoreMetrics;
  wvletMetrics: CoreMetrics;
  sqlLines: number;
  wvletLines: number;
  status: 'success' | 'error';
  error?: string;
}

/** 横断リファクタの結果 */
export interface CrossQueryResult {
  /** 共有 model 定義テキスト (複数 model を含む場合あり) */
  sharedModels: string;
  /** 各クエリの結果 */
  results: BatchResult[];
}

/**
 * 複数クエリを一括リファクタする。
 * メインスレッドで1つずつ処理し、各クエリ完了時に onProgress コールバックを呼ぶ。
 * setTimeout で UI スレッドを解放しながら処理する。
 */
export async function batchRefactor(
  queries: BatchQueryInput[],
  onProgress: (done: number, total: number, result: BatchResult) => void,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const result = await processOneQuery(queries[i]);
    results.push(result);
    onProgress(i + 1, queries.length, result);
    // UI スレッドを解放
    await new Promise(r => setTimeout(r, 0));
  }

  return results;
}

function processOneQuery(query: BatchQueryInput): Promise<BatchResult> {
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        const stages = sqlToWvletStages(query.sql);
        const wvlet = stages.length > 0 ? stages[0].wvlet : '';
        const refactored = stages.length > 1 ? stages[stages.length - 1].wvlet : null;
        const displayWvlet = refactored ?? wvlet;

        const sqlMetrics = calculateAllMetrics(query.sql, 'sql');
        const wvletMetrics = displayWvlet
          ? calculateAllMetrics(displayWvlet, 'wvlet')
          : { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 };

        resolve({
          id: query.id,
          name: query.name,
          sql: query.sql,
          wvlet,
          refactored,
          sqlMetrics,
          wvletMetrics,
          sqlLines: query.sql.split('\n').length,
          wvletLines: displayWvlet.split('\n').length,
          status: 'success',
        });
      } catch (e) {
        resolve({
          id: query.id,
          name: query.name,
          sql: query.sql,
          wvlet: '',
          refactored: null,
          sqlMetrics: { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 },
          wvletMetrics: { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 },
          sqlLines: query.sql.split('\n').length,
          wvletLines: 0,
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }, 0);
  });
}

// ────────────────────────────────────────
// 横断リファクタ: WvletJS.refactorMultipleQueries() で model 抽出
// ────────────────────────────────────────

/**
 * 複数 SQL を一括で WvletJS.refactorMultipleQueries() に渡し、
 * クエリ横断的に共通パターンを model として抽出する。
 *
 * Scala 側の PatternExtractor.analyzeMultiple() + RefactoringApplier.applyRefactoringsMultiple()
 * をネイティブに呼び出すため、セミコロン結合やパース不要。
 */
export async function batchRefactorCrossQuery(
  queries: BatchQueryInput[],
  onProgress: (done: number, total: number) => void,
): Promise<CrossQueryResult> {
  onProgress(0, queries.length);

  // UI スレッド解放
  await new Promise(r => setTimeout(r, 0));

  // WvletJS.refactorMultipleQueries() を呼び出し
  const input = queries.map(q => ({ id: q.id, sql: q.sql.replace(/;\s*$/, '') }));
  const multiResult = refactorMultipleQueriesViaCompiler(input);

  if (!multiResult.success || multiResult.queries.length === 0) {
    // 横断リファクタ失敗 → 個別リファクタにフォールバック
    console.warn('[batchRefactorCrossQuery] Cross-query failed, falling back to individual refactoring');
    return {
      sharedModels: '',
      results: await batchRefactor(queries, (done, total, _r) => onProgress(done, total)),
    };
  }

  onProgress(Math.floor(queries.length * 0.3), queries.length);
  await new Promise(r => setTimeout(r, 0));

  // 各クエリの Wvlet を id でマッピング
  const wvletMap = new Map(multiResult.queries.map(q => [q.id, q.wvlet]));
  const sharedModels = multiResult.models;

  // 各クエリごとに model 定義をストリップしてメトリクスを計算
  const results: BatchResult[] = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const rawBody = wvletMap.get(q.id) ?? '';
    // Scala API は各クエリ出力に model 定義を含むため、ストリップして本体のみにする
    const body = sharedModels ? stripModelDefs(rawBody) : rawBody;

    try {
      const sqlMetrics = calculateAllMetrics(q.sql, 'sql');
      const wvletMetrics = body
        ? calculateAllMetrics(body, 'wvlet')
        : { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 };

      results.push({
        id: q.id,
        name: q.name,
        sql: q.sql,
        wvlet: body,
        refactored: body,
        sqlMetrics,
        wvletMetrics,
        sqlLines: q.sql.split('\n').length,
        wvletLines: body.split('\n').length,
        status: 'success',
      });
    } catch (e) {
      results.push({
        id: q.id,
        name: q.name,
        sql: q.sql,
        wvlet: body,
        refactored: null,
        sqlMetrics: { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 },
        wvletMetrics: { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 },
        sqlLines: q.sql.split('\n').length,
        wvletLines: 0,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }

    onProgress(Math.floor(queries.length * 0.3) + Math.floor((i + 1) * 0.7), queries.length);
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
  }

  return { sharedModels, results };
}

/**
 * Wvlet テキストから model 定義ブロックを除去し、クエリ本体のみを返す。
 * model ... end 形式と model ... { ... } 形式の両方に対応。
 */
function stripModelDefs(wvlet: string): string {
  const lines = wvlet.split('\n');
  const result: string[] = [];
  let inModel = false;
  let braceDepth = 0;
  let usesBraces = false;

  for (const line of lines) {
    // model 定義の開始検出
    if (!inModel && /^\s*model\s+\w+/.test(line)) {
      inModel = true;
      usesBraces = false;
      braceDepth = 0;
      // 同一行に { がある場合はブレース形式
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      if (opens > 0) {
        usesBraces = true;
        braceDepth = opens - closes;
        if (braceDepth <= 0) {
          inModel = false; // 1行で完結する model
        }
      }
      continue;
    }

    if (inModel) {
      if (usesBraces) {
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;
        if (braceDepth <= 0) {
          inModel = false;
        }
      } else {
        // end キーワードで終了
        if (/^\s*end\s*$/.test(line)) {
          inModel = false;
        }
      }
      continue;
    }

    result.push(line);
  }

  // 先頭の空行を除去
  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }

  return result.join('\n').trimEnd();
}
