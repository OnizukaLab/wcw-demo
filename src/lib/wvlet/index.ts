/**
 * Wvlet SDK ラッパー
 * 
 * wvlet サブモジュールの Scala.js ビルド (`WvletJS`) を呼び出して
 * SQL ↔ Wvlet の双方向変換を提供する。
 */

// @ts-ignore — Scala.js 生成バンドル（型定義なし）
import { WvletJS } from './wvlet-sdk.js';

export interface WvletCompileResult {
  success: boolean;
  sql?: string;
  error?: {
    statusCode: string;
    message: string;
    location?: {
      path: string;
      fileName: string;
      line: number;
      column: number;
      lineContent?: string;
    };
  };
}

/**
 * SQL クエリを Wvlet 構文に変換する（wvlet コンパイラ使用）
 * @param sqlQuery SQL クエリ文字列
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns Wvlet 文字列。失敗時は空文字列。
 */
export function sqlToWvletViaCompiler(sqlQuery: string, target: string = 'duckdb'): string {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.toWvlet(sqlQuery, options);
    const response: WvletCompileResult = JSON.parse(responseJson);
    if (response.success && response.sql) {
      return response.sql;
    }
    console.warn('[WvletJS.toWvlet] Conversion failed:', response.error?.message);
    return '';
  } catch (e) {
    console.warn('[WvletJS.toWvlet] Error:', e);
    return '';
  }
}

/**
 * Wvlet クエリを SQL にコンパイルする（wvlet コンパイラ使用）
 * @param wvletQuery Wvlet クエリ文字列
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns SQL 文字列。失敗時は空文字列。
 */
export function wvletToSqlViaCompiler(wvletQuery: string, target: string = 'duckdb'): string {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.compile(wvletQuery, options);
    const response: WvletCompileResult = JSON.parse(responseJson);
    if (response.success && response.sql) {
      return response.sql;
    }
    console.warn('[WvletJS.compile] Compilation failed:', response.error?.message);
    return '';
  } catch (e) {
    console.warn('[WvletJS.compile] Error:', e);
    return '';
  }
}

/**
 * Wvlet コンパイラのバージョンを取得
 */
export function getWvletVersion(): string {
  try {
    return WvletJS.getVersion();
  } catch {
    return 'unknown';
  }
}

/**
 * SQL クエリを Wvlet に変換後、自動リファクタリング（重複パターンの model 抽出）を適用する。
 * wvlet コンパイラの PatternExtractor + RefactoringApplier を使用。
 *
 * @param sqlQuery SQL クエリ文字列
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns リファクタリング済み Wvlet 文字列。失敗時は空文字列。
 */
export function refactorWvletViaCompiler(sqlQuery: string, target: string = 'duckdb'): string {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.refactorWvlet(sqlQuery, options);
    const response: WvletCompileResult = JSON.parse(responseJson);
    if (response.success && response.sql) {
      return response.sql;
    }
    console.warn('[WvletJS.refactorWvlet] Refactoring failed:', response.error?.message);
    return '';
  } catch (e) {
    console.warn('[WvletJS.refactorWvlet] Error:', e);
    return '';
  }
}

/**
 * 複数 SQL クエリを一括で横断的にリファクタリングする。
 * PatternExtractor.analyzeMultiple() + RefactoringApplier.applyRefactoringsMultiple() を使用し、
 * クエリ間の共通パターンを model として抽出する。
 *
 * @param queries {id, sql}[] の配列
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns { success, models, queries: {id, wvlet}[] }
 */
export interface MultiRefactorResult {
  success: boolean;
  models: string;
  queries: { id: string; wvlet: string }[];
  error?: string;
}

export function refactorMultipleQueriesViaCompiler(
  queries: { id: string; sql: string }[],
  target: string = 'duckdb',
): MultiRefactorResult {
  try {
    const queriesJson = JSON.stringify(queries);
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.refactorMultipleQueries(queriesJson, options);
    return JSON.parse(responseJson);
  } catch (e) {
    console.warn('[WvletJS.refactorMultipleQueries] Error:', e);
    return { success: false, models: '', queries: [], error: String(e) };
  }
}

/**
 * LogicalPlanRank ベースの AST 可読性スコア
 */
export interface ReadabilityScoreResult {
  success: boolean;
  score?: {
    normalizedScore: number;
    inversionScore: number;
    syntaxRankScore: number;
    inversionCount: number;
    joinCount: number;
    eyeMovement: number;
    lineMovement: number;
    syntaxRankDist: number;
    numPlanNodes: number;
  };
  error?: string;
}

/**
 * AST ベースの可読性スコアを計算する (LogicalPlanRank.syntaxReadability)。
 * 構文順序（ソースコード上の位置）とデータフロー順序（意味的実行順序）の
 * 一致度を測定する。
 *
 * @param code クエリコード (SQL or Wvlet)
 * @param language 'sql' | 'wvlet'
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns ReadabilityScoreResult
 */
export function readabilityScoreViaCompiler(
  code: string,
  language: 'sql' | 'wvlet' = 'sql',
  target: string = 'duckdb',
): ReadabilityScoreResult {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.readabilityScore(code, language, options);
    return JSON.parse(responseJson);
  } catch (e) {
    console.warn('[WvletJS.readabilityScore] Error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Order Alignment Panel 用のノードごとの alignment データ
 */
export interface AlignmentNode {
  nodeName: string;
  category: string;
  syntaxRank: number;
  dataflowRank: number;
  line: number;
  inverted: boolean;
}

export interface ReadabilityAlignmentResult {
  success: boolean;
  score?: ReadabilityScoreResult['score'];
  nodes?: AlignmentNode[];
  error?: string;
}

/**
 * AST ベースのノードごと alignment データを取得する。
 * 各ノードの syntaxRank（ソースコード順序）と dataflowRank（意味実行順序）を返す。
 * Order Alignment Panel でクロッシングラインを描画するために使用。
 *
 * @param code クエリコード (SQL or Wvlet)
 * @param language 'sql' | 'wvlet'
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns ReadabilityAlignmentResult
 */
export function readabilityAlignmentViaCompiler(
  code: string,
  language: 'sql' | 'wvlet' = 'sql',
  target: string = 'duckdb',
): ReadabilityAlignmentResult {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.readabilityAlignment(code, language, options);
    return JSON.parse(responseJson);
  } catch (e) {
    console.warn('[WvletJS.readabilityAlignment] Error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * SQL から Wvlet 変換後の alignment データを取得する。
 * 生成された Wvlet を再パースせず、toWvlet パイプラインの中間論理プランから
 * alignment を計算する。Wvlet パーサーの構文ギャップを回避。
 *
 * @param sqlCode 元の SQL コード
 * @param target ターゲットDB方言 ('duckdb' | 'trino')
 * @returns ReadabilityAlignmentResult
 */
export function readabilityAlignmentFromSqlViaCompiler(
  sqlCode: string,
  target: string = 'duckdb',
): ReadabilityAlignmentResult {
  try {
    const options = JSON.stringify({ target });
    const responseJson: string = WvletJS.readabilityAlignmentFromSql(sqlCode, options);
    return JSON.parse(responseJson);
  } catch (e) {
    console.warn('[WvletJS.readabilityAlignmentFromSql] Error:', e);
    return { success: false, error: String(e) };
  }
}
