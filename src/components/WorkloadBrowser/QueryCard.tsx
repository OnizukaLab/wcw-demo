import type { QueryEntry } from '../../types/catalog';

interface Props {
  query: QueryEntry;
  isSelected: boolean;
  onSelect: (query: QueryEntry) => void;
}

export function QueryCard({ query, isSelected, onSelect }: Props) {
  const improvement = query.improvement
    ? `+${(query.improvement * 100).toFixed(0)}%`
    : null;

  return (
    <div
      className={`query-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(query)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(query)}
    >
      <div className="card-header">
        <span className="query-name">{query.name}</span>
        <span className="r-core">
          R<sub>core</sub>: {query.metrics_original.R_core.toFixed(2)}
          {query.metrics_refactored && (
            <>
              <span className="arrow"> → </span>
              <span className="improved">
                {query.metrics_refactored.R_core.toFixed(2)}
              </span>
            </>
          )}
        </span>
      </div>
      <pre className="sql-preview">{query.sql_preview}</pre>
      <div className="metric-badges">
        <Badge label="DRY" value={query.metrics_original.DRY} />
        <Badge label="SN" value={query.metrics_original.SN} />
        <Badge label="SSOA" value={query.metrics_original.SSOA} />
        {improvement && (
          <span className="improvement-badge">{improvement}</span>
        )}
      </div>
      <div className="tags">
        {query.tags.map(t => <span key={t} className="tag">{t}</span>)}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: number }) {
  const color = value >= 0.8 ? 'green' : value >= 0.5 ? 'yellow' : 'red';
  return (
    <span className={`badge badge-${color}`}>
      {label}: {value.toFixed(2)}
    </span>
  );
}
