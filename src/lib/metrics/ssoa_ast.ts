/**
 * AST ベースの SSOA (Syntactic-Semantic Order Agreement)
 * 
 * Wvlet コンパイラの LogicalPlanRank.syntaxReadability を使用して、
 * ソースコードの構文順序とデータフロー（意味的実行）順序の一致度を測定する。
 * 
 * キーワードベースの ssoa.ts と異なり、AST（抽象構文木）の構造に基づいて
 * 正確にスコアを算出する。
 */
import { readabilityScoreViaCompiler, type ReadabilityScoreResult } from '../wvlet';

/**
 * AST ベースの可読性スコア詳細
 */
export interface AstReadabilityScore {
  normalizedScore: number;
  inversionScore: number;
  syntaxRankScore: number;
  inversionCount: number;
  joinCount: number;
  eyeMovement: number;
  lineMovement: number;
  syntaxRankDist: number;
  numPlanNodes: number;
}

/**
 * AST ベースの SSOA スコアを計算する。
 * LogicalPlanRank.syntaxReadability の normalizedScore を返す。
 * 失敗時は null を返す（呼び出し側でキーワード版にフォールバック可能）。
 * 
 * @param code クエリコード
 * @param language 'sql' | 'wvlet'
 * @returns SSOA スコア (0-1) or null（失敗時）
 */
export function calculateSSOAAst(code: string, language: 'sql' | 'wvlet'): number | null {
  try {
    const result = readabilityScoreViaCompiler(code, language);
    if (result.success && result.score) {
      return result.score.normalizedScore;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * AST ベースの可読性スコア詳細を取得する。
 * 
 * @param code クエリコード
 * @param language 'sql' | 'wvlet'
 * @returns 詳細スコア or null（失敗時）
 */
export function getAstReadabilityDetails(code: string, language: 'sql' | 'wvlet'): AstReadabilityScore | null {
  try {
    const result = readabilityScoreViaCompiler(code, language);
    if (result.success && result.score) {
      return result.score;
    }
    return null;
  } catch {
    return null;
  }
}
