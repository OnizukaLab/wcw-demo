import { useState, useCallback, useEffect } from 'react';
import { ResultPanel } from './ResultPanel';
import { SampleDataInfo } from './SampleDataInfo';
import { useEquivalence } from '../../hooks/useEquivalence';
import { wvletToSqlViaCompiler } from '../../lib/wvlet';
import type { VerificationResult } from '../../types/equivalence';

export type CompareMode = 'wvlet' | 'refactored';

interface Props {
  sqlCode: string;
  wvletCode: string;
  /** リファクタリング後の Wvlet コード（最終ステージ） */
  refactoredCode?: string;
  onVerifyResult?: (result: VerificationResult) => void;
}

const TPC_H_TABLES = ['lineitem', 'orders', 'customer', 'part', 'supplier', 'partsupp', 'nation', 'region'];

export function EquivalenceVerifier({ sqlCode, wvletCode, refactoredCode, onVerifyResult }: Props) {
  const { dataState, result, isVerifying, isDBReady, verify } = useEquivalence();
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>('wvlet');

  const hasRefactored = !!refactoredCode && refactoredCode !== wvletCode;

  // 検証結果を親に通知
  useEffect(() => {
    if (result && onVerifyResult) onVerifyResult(result);
  }, [result, onVerifyResult]);

  // モード切替時に結果をリセット
  useEffect(() => {
    setCompileError(null);
  }, [compareMode]);

  const handleVerify = useCallback(async () => {
    const targetCode = compareMode === 'refactored' && refactoredCode ? refactoredCode : wvletCode;
    if (!sqlCode.trim() || !targetCode.trim()) return;
    setCompileError(null);

    // Wvlet → SQL コンパイル
    const compiledSQL = wvletToSqlViaCompiler(targetCode);
    if (!compiledSQL) {
      const label = compareMode === 'refactored' ? 'Refactored' : 'Wvlet';
      setCompileError(`${label} → SQL compilation failed. Equivalence check requires compilable code.`);
      return;
    }

    await verify(sqlCode, compiledSQL);
  }, [sqlCode, wvletCode, refactoredCode, compareMode, verify]);

  const totalRows = dataState?.totalRows ?? 0;
  const dbStatus = !isDBReady ? 'Initializing DuckDB...' : null;

  return (
    <div className="equivalence-verifier" style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Equivalence Verifier
          </span>
          <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
            <button
              onClick={() => setCompareMode('wvlet')}
              style={{
                padding: '2px 8px', border: 'none', fontSize: 10, fontWeight: 600,
                background: compareMode === 'wvlet' ? 'var(--accent-primary)' : 'var(--border)',
                color: compareMode === 'wvlet' ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >SQL ↔ Wvlet</button>
            <button
              onClick={() => hasRefactored && setCompareMode('refactored')}
              style={{
                padding: '2px 8px', border: 'none', fontSize: 10, fontWeight: 600,
                background: compareMode === 'refactored' ? 'var(--accent-primary)' : 'var(--border)',
                color: !hasRefactored ? 'var(--text-faint)' : compareMode === 'refactored' ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                cursor: hasRefactored ? 'pointer' : 'default',
                borderLeft: '1px solid var(--border-strong)',
              }}
              title={hasRefactored ? 'SQL ↔ Refactored Wvlet' : 'Refactored 結果なし'}
            >SQL ↔ Refactored</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dbStatus && (
            <span style={{ fontSize: 10, color: '#888' }}>{dbStatus}</span>
          )}
          {isDBReady && !dataState?.loaded && (
            <span style={{ fontSize: 10, color: '#ffd93d' }}>TPC-H loading...</span>
          )}
          <button
            onClick={handleVerify}
            disabled={isVerifying || !isDBReady || !sqlCode || !(compareMode === 'refactored' ? refactoredCode : wvletCode)}
            style={{
              padding: '4px 16px', borderRadius: 4,
              background: isVerifying || !isDBReady ? 'var(--border-subtle)' : 'var(--accent-primary)',
              color: isVerifying || !isDBReady ? 'var(--text-tertiary)' : 'var(--text-on-accent)',
              border: 'none', fontWeight: 600, fontSize: 12,
              cursor: isVerifying || !isDBReady ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isVerifying ? 'Validating...' : '▶ Validate on sample data'}
          </button>
        </div>
      </div>

      {/* Sample Data Info */}
      <SampleDataInfo tables={TPC_H_TABLES} totalRows={totalRows || undefined} />

      {/* Compile Error */}
      {compileError && (
        <div style={{
          padding: '8px 12px', fontSize: 11, color: 'var(--accent-warning)',
          background: 'var(--bg-warning-subtle)', borderBottom: '1px solid var(--border-subtle)',
        }}>
          ⚠ {compileError}
        </div>
      )}

      {/* Result */}
      <ResultPanel result={result} loading={isVerifying} />
    </div>
  );
}
