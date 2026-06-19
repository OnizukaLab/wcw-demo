import type { VerificationResult } from '../../types/equivalence';

interface Props {
  result: VerificationResult | null;
  loading?: boolean;
}

export function ResultPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, color: '#888',
      }}>
        <div className="spinner" style={{
          width: 20, height: 20, border: '2px solid var(--border-subtle)',
          borderTop: '2px solid #4ecdc4', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', marginRight: 8,
        }} />
        Validating on sample data (TPC-H SF=0.01)...
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        Click "Validate on sample data" to check SQL ↔ Wvlet equivalence
      </div>
    );
  }

  const isPassed = result.equivalent;

  return (
    <div style={{ padding: 12 }}>
      {/* Status Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: isPassed ? 'var(--bg-accent-medium)' : 'var(--bg-danger-medium)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {isPassed ? '✓' : '✗'}
        </div>
        <div>
          <div style={{
            color: isPassed ? 'var(--accent-primary)' : 'var(--accent-danger)',
            fontWeight: 700, fontSize: 14,
          }}>
            {isPassed ? 'EQUIVALENT' : 'NOT EQUIVALENT'}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {result.method} — {result.executionTimeMs}ms
          </div>
        </div>
      </div>

      {/* Row comparison */}
      {result.sqlRowCount !== undefined && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 8, fontSize: 12, marginBottom: 8,
        }}>
          <div style={{ background: 'var(--bg-inset)', padding: 8, borderRadius: 4 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>SQL Rows</div>
            <div style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{result.sqlRowCount}</div>
          </div>
          <div style={{ background: 'var(--bg-inset)', padding: 8, borderRadius: 4 }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>Wvlet Rows</div>
            <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{result.wvletRowCount}</div>
          </div>
        </div>
      )}

      {/* Diff rows if any */}
      {result.diffRows && result.diffRows.length > 0 && (
        <div style={{
          background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.2)',
          borderRadius: 4, padding: 8, fontSize: 11, color: '#ff6b6b',
          maxHeight: 120, overflow: 'auto',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Differences ({result.diffRows.length} rows):</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {result.diffRows.slice(0, 10).map((row, i) => (
              <div key={i}>{JSON.stringify(row)}</div>
            ))}
            {result.diffRows.length > 10 && <div>... +{result.diffRows.length - 10} more</div>}
          </pre>
        </div>
      )}

      {/* Error message */}
      {result.error && (
        <div style={{
          background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.2)',
          borderRadius: 4, padding: 8, fontSize: 11, color: '#ff6b6b',
        }}>
          {result.error}
        </div>
      )}
    </div>
  );
}
