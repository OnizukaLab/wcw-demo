interface Props {
  leftLabel: string;
  rightLabel: string;
  leftTokens: number;
  rightTokens: number;
}

export function LineCounter({ leftLabel, rightLabel, leftTokens, rightTokens }: Props) {
  const diff = leftTokens - rightTokens;
  const pct = leftTokens > 0 ? Math.round((diff / leftTokens) * 100) : 0;
  const sign = diff > 0 ? '-' : '+';

  return (
    <div className="line-counter" style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: 16, padding: '4px 12px', fontSize: 12, color: 'var(--text-secondary)',
    }}>
      <span>{leftLabel}: <strong style={{ color: 'var(--text-primary)' }}>{leftTokens}</strong> tokens</span>
      <span style={{
        padding: '2px 8px', borderRadius: 8,
        background: diff > 0 ? 'var(--bg-accent-medium)' : 'var(--bg-danger-medium)',
        color: diff > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
        fontWeight: 600,
      }}>
        {sign}{Math.abs(pct)}% ({sign}{Math.abs(diff)})
      </span>
      <span>{rightLabel}: <strong style={{ color: 'var(--text-primary)' }}>{rightTokens}</strong> tokens</span>
    </div>
  );
}
