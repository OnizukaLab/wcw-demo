import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: string;
  sqlValue: number;
  wvletValue: number;
  icon?: string;
}

export function SummaryCard({ label, sqlValue, wvletValue, icon }: Props) {
  const improvement = wvletValue - sqlValue;
  const isPositive = improvement > 0;
  const isZero = Math.abs(improvement) < 0.0001;

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 8,
      padding: '12px 16px',
      border: '1px solid var(--border)',
      minWidth: 120,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          <AnimatedNumber value={wvletValue} />
        </span>
        <span style={{
          fontSize: 12,
          color: isZero ? 'var(--text-muted)' : isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)',
          fontWeight: 600,
        }}>
          {isZero ? '0.000' : isPositive ? `+${improvement.toFixed(3)}` : improvement.toFixed(3)}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
        SQL: {sqlValue.toFixed(3)}
      </div>
    </div>
  );
}
