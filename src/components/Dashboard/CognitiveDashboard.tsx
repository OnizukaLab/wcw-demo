import type { CoreMetrics } from '../../types/metrics';
import { RadarChart } from './RadarChart';
import { ContextBar } from './ContextBar';
import { SummaryCard } from './SummaryCard';
import { MetricDetailRow } from './MetricDetailRow';

interface Props {
  sqlMetrics: CoreMetrics;
  wvletMetrics: CoreMetrics;
  distribution?: [number, number][];
  totalQueries?: number;
  radarAxes?: 3 | 5;
}

const METRIC_DESCRIPTIONS: Record<string, string> = {
  DRY: 'Don\'t Repeat Yourself — duplicated SQL fragments',
  SN: 'Structural Nesting — CTE + subquery depth',
  SSOA: 'Structural Similarity — edit distance',
  JI: 'Join Intent — explicit join readability',
  PR: 'Predicate Readability — condition complexity',
  R_core: 'Weighted core readability score',
};

export function CognitiveDashboard({
  sqlMetrics,
  wvletMetrics,
  distribution,
  totalQueries = 138993,
  radarAxes = 5,
}: Props) {
  const metricKeys: (keyof CoreMetrics)[] = ['DRY', 'SN', 'SSOA', 'JI', 'PR'];

  return (
    <div className="cognitive-dashboard" style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: 12, height: '100%', overflow: 'auto',
    }}>
      {/* Summary Cards Row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SummaryCard
          label="R_core"
          icon="◉"
          sqlValue={sqlMetrics.R_core}
          wvletValue={wvletMetrics.R_core}
        />
        <SummaryCard
          label="DRY"
          icon="♻"
          sqlValue={sqlMetrics.DRY}
          wvletValue={wvletMetrics.DRY}
        />
        <SummaryCard
          label="SN"
          icon="⊞"
          sqlValue={sqlMetrics.SN}
          wvletValue={wvletMetrics.SN}
        />
        <SummaryCard
          label="SSOA"
          icon="⇅"
          sqlValue={sqlMetrics.SSOA}
          wvletValue={wvletMetrics.SSOA}
        />
      </div>

      {/* Radar Chart */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', padding: 8 }}>
        <RadarChart
          sqlMetrics={sqlMetrics}
          wvletMetrics={wvletMetrics}
          axes={radarAxes}
        />
      </div>

      {/* Distribution Histogram */}
      {distribution && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <ContextBar
            distribution={distribution}
            currentValue={wvletMetrics.R_core}
            totalQueries={totalQueries}
          />
        </div>
      )}

      {/* Metric Detail Rows */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
        padding: '8px 12px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 60px 1fr 60px 60px',
          gap: 8, fontSize: 10, color: 'var(--text-muted)', padding: '4px 0',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div>Metric</div>
          <div style={{ textAlign: 'right' }}>SQL</div>
          <div style={{ textAlign: 'center' }}>Δ</div>
          <div>Wvlet</div>
          <div style={{ textAlign: 'right' }}>Diff</div>
        </div>
        {metricKeys.map(key => (
          <MetricDetailRow
            key={key}
            name={key}
            sqlValue={sqlMetrics[key]}
            wvletValue={wvletMetrics[key]}
            description={METRIC_DESCRIPTIONS[key]}
          />
        ))}
      </div>
    </div>
  );
}
