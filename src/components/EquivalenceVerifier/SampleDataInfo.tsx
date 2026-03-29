interface Props {
  tables: string[];
  totalRows?: number;
}

export function SampleDataInfo({ tables, totalRows }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)',
      background: 'var(--bg-inset)', borderRadius: 4,
    }}>
      <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>TPC-H SF=0.01</span>
      <span>•</span>
      <span>{tables.length} tables</span>
      {totalRows !== undefined && totalRows > 0 && (
        <>
          <span>•</span>
          <span>{totalRows.toLocaleString()} rows</span>
        </>
      )}
      <span style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>
        DuckDB-Wasm (in-browser)
      </span>
    </div>
  );
}
