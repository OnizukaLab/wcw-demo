import { calculateDRY, countTokens } from './dry';
import { calculateSN } from './sn';
import { calculateSSOA } from './ssoa';
import { calculateSSOAAst, getAstReadabilityDetails } from './ssoa_ast';
import { calculateJI } from './ji';
import { calculatePR } from './pr';
import { calculateRCore } from './rcore';
import type { CoreMetrics } from '../../types/metrics';

export { calculateDRY, countTokens, calculateSN, calculateSSOA, calculateSSOAAst, getAstReadabilityDetails, calculateJI, calculatePR, calculateRCore };
export type { CoreMetrics };

export type SSOAMode = 'ast' | 'keyword';

export interface MetricsOptions {
  language: 'sql' | 'wvlet';
  weights?: Partial<Record<string, number>>;
  /** SSOA 計算モード: 'keyword' (デフォルト, キーワードベース) | 'ast' (SDK LogicalPlanRank 使用, 特定用途向け) */
  ssoaMode?: SSOAMode;
}

/**
 * 全メトリクスを一括計算する。
 * @param code  - 分析対象のコード文字列
 * @param language - 'sql' | 'wvlet' (デフォルト: 'sql')
 * @param weights  - R_core の重み (省略可)
 * @param ssoaMode - SSOA 計算モード (デフォルト: 'keyword')
 */
export function calculateAllMetrics(
  code: string,
  language: 'sql' | 'wvlet' = 'sql',
  weights?: Partial<Record<string, number>>,
  ssoaMode: SSOAMode = 'keyword',
): CoreMetrics {
  if (!code || !code.trim()) {
    return { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 };
  }

  // SSOA: SQL・Wvlet ともにキーワードベースを使用。
  // AST モード（WvletJS.readabilityScore）は model 定義ブロックで余分な inversion を
  // カウントするため、リファクタ後に値が下がる問題がある。また SQL(AST) と Wvlet(keyword)
  // でスケールが異なるとステージ間比較が不整合になるため、一律 keyword モードに統一する。
  // ssoaMode='ast' を明示した場合のみ AST を試みる（外部から特定用途で呼ばれる場合）。
  let ssoa: number;
  if (ssoaMode === 'ast') {
    const astResult = calculateSSOAAst(code, language);
    ssoa = astResult !== null ? astResult : calculateSSOA(code, language);
  } else {
    ssoa = calculateSSOA(code, language);
  }

  const metrics = {
    DRY: calculateDRY(code, language),
    SN: calculateSN(code, language),
    SSOA: ssoa,
    JI: calculateJI(code, language),
    PR: calculatePR(code, language),
  };
  return {
    ...metrics,
    R_core: calculateRCore(metrics, weights),
  };
}
