import { useState, useCallback } from 'react';

interface Props {
  onAnalyze: (sql: string) => void;
  isAnalyzing: boolean;
}

export function PastePanel({ onAnalyze, isAnalyzing }: Props) {
  const [sql, setSQL] = useState('');

  const handleAnalyze = useCallback(() => {
    const trimmed = sql.trim();
    if (trimmed.length > 0) {
      onAnalyze(trimmed);
    }
  }, [sql, onAnalyze]);

  return (
    <div className="paste-panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={sql}
        onChange={e => setSQL(e.target.value)}
        placeholder="Paste your SQL query here..."
        rows={8}
        spellCheck={false}
        aria-label="Custom SQL input"
        style={{
          width: '100%', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 8,
          fontFamily: 'monospace', fontSize: 11, resize: 'vertical',
        }}
      />
      <div className="paste-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sql.length} chars</span>
        <button
          onClick={handleAnalyze}
          disabled={!sql.trim() || isAnalyzing}
          style={{
            padding: '6px 16px', borderRadius: 4,
            background: !sql.trim() || isAnalyzing ? 'var(--border-subtle)' : 'var(--accent-primary)',
            color: !sql.trim() || isAnalyzing ? 'var(--text-tertiary)' : 'var(--text-on-accent)',
            border: 'none', fontWeight: 600, fontSize: 12,
            cursor: !sql.trim() || isAnalyzing ? 'not-allowed' : 'pointer',
          }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze ▶'}
        </button>
      </div>
    </div>
  );
}
