interface Props {
  sqlTokens: number;
  wvletTokens: number;
}

export function LineCounter({ sqlTokens, wvletTokens }: Props) {
  const diff = sqlTokens - wvletTokens;
  const pct = sqlTokens > 0 ? Math.round((diff / sqlTokens) * 100) : 0;
  const sign = diff > 0 ? '-' : '+';

  return (
    <div className="line-counter" style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: 16, padding: '4px 12px', fontSize: 12, color: 'var(--text-secondary)',
    }}>
      <span>SQL: <strong style={{ color: 'var(--text-primary)' }}>{sqlTokens}</strong> tokens</span>
      <span style={{
        padding: '2px 8px', borderRadius: 8,
        background: diff > 0 ? 'var(--bg-accent-medium)' : 'var(--bg-danger-medium)',
        color: diff > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
        fontWeight: 600,
      }}>
        {sign}{Math.abs(pct)}% ({sign}{Math.abs(diff)})
      </span>
      <span>Wvlet: <strong style={{ color: 'var(--text-primary)' }}>{wvletTokens}</strong> tokens</span>
    </div>
  );
}
