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
  /** SSOA 計算モード: 'ast' (デフォルト, SDK LogicalPlanRank 使用) | 'keyword' (従来のキーワードベース) */
  ssoaMode?: SSOAMode;
}

/**
 * 全メトリクスを一括計算する。
 * @param code  - 分析対象のコード文字列
 * @param language - 'sql' | 'wvlet' (デフォルト: 'sql')
 * @param weights  - R_core の重み (省略可)
 * @param ssoaMode - SSOA 計算モード (デフォルト: 'ast')
 */
export function calculateAllMetrics(
  code: string,
  language: 'sql' | 'wvlet' = 'sql',
  weights?: Partial<Record<string, number>>,
  ssoaMode: SSOAMode = 'ast',
): CoreMetrics {
  if (!code || !code.trim()) {
    return { DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 };
  }

  // SSOA: AST モードの場合、SDK で計算を試み、失敗時はキーワード版にフォールバック
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
