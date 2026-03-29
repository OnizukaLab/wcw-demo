import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  name: string;
  sqlValue: number;
  wvletValue: number;
  description?: string;
}

export function MetricDetailRow({ name, sqlValue, wvletValue, description }: Props) {
  const diff = wvletValue - sqlValue;
  const isPositive = diff > 0;
  const barWidth = Math.abs(diff) * 100; // scaled for 0-1 range

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '60px 60px 1fr 60px 60px',
      alignItems: 'center',
      gap: 8,
      padding: '6px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 12,
    }}>
      <div style={{ color: '#ccc', fontWeight: 600 }}>{name}</div>
      <div style={{ color: 'var(--accent-danger)', textAlign: 'right', fontFamily: 'monospace' }}>
        {sqlValue.toFixed(3)}
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        {/* bar visualization */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 2,
          height: 12,
          width: `${barWidth}%`,
          maxWidth: '48%',
          transform: isPositive ? 'none' : 'translateX(-100%)',
          background: isPositive
            ? 'var(--gradient-positive)'
            : 'var(--gradient-negative)',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
        <div style={{
          position: 'absolute', left: '50%', top: 0,
          width: 1, height: 16, background: 'var(--border-strong)',
        }} />
      </div>
      <div style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
        <AnimatedNumber value={wvletValue} decimals={3} />
      </div>
      <div style={{
        color: isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)',
        fontWeight: 600, fontSize: 11, textAlign: 'right',
      }}>
        {isPositive ? '+' : ''}{diff.toFixed(3)}
      </div>
      {description && (
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>
          {description}
        </div>
      )}
    </div>
  );
}
