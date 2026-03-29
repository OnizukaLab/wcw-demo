import { useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import type { CatalogQuery } from '../../hooks/useCatalog';
import { QuerySearch } from './QuerySearch';
import { PastePanel } from './PastePanel';

interface Props {
  onSelectQuery: (query: CatalogQuery) => void;
  onAnalyzeCustomSQL?: (sql: string) => void;
  selectedQueryId?: string | null;
}

const CATEGORY_TABS = [
  { key: 'tpch', icon: '📊', label: 'TPC-H' },
  { key: 'job', icon: '🎬', label: 'JOB' },
  { key: 'nested', icon: '🔄', label: 'Nested' },
  { key: 'join', icon: '🔗', label: 'Join' },
  { key: 'aggregation', icon: '📈', label: 'Agg' },
  { key: 'llm', icon: '🤖', label: 'LLM' },
  { key: 'custom', icon: '📋', label: 'Custom' },
];

export function WorkloadBrowser({ onSelectQuery, onAnalyzeCustomSQL, selectedQueryId }: Props) {
  const { queries, loading, getByCategory, search, counts } = useCatalog();
  const [activeCategory, setActiveCategory] = useState('tpch');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQueries = searchTerm
    ? search(searchTerm)
    : activeCategory === 'custom'
    ? []
    : getByCategory(activeCategory);

  if (loading) {
    return (
      <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Loading catalog...</div>
    );
  }

  return (
    <div className="workload-browser" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Workload Browser</h3>
        <QuerySearch onSearch={setSearchTerm} />
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            style={{
              padding: '3px 10px', fontSize: 11, borderRadius: 4,
              border: `1px solid ${activeCategory === tab.key ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              background: activeCategory === tab.key ? 'var(--bg-accent-subtle)' : 'transparent',
              color: activeCategory === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {tab.icon}{tab.label}
            {tab.key !== 'custom' && counts[tab.key] ? <span style={{ marginLeft: 4, opacity: 0.6 }}>{counts[tab.key]}</span> : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {activeCategory === 'custom' ? (
          <PastePanel
            onAnalyze={onAnalyzeCustomSQL ?? (() => {})}
            isAnalyzing={false}
          />
        ) : (
          <>
            {filteredQueries.map(q => (
              <div
                key={q.id}
                onClick={() => onSelectQuery(q)}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderBottom: '1px solid #1a1a2a',
                  background: selectedQueryId === q.id ? 'var(--bg-selected)' : 'transparent',
                  borderLeft: selectedQueryId === q.id ? '3px solid #4ecdc4' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (selectedQueryId !== q.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (selectedQueryId !== q.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{q.name}</div>
                {q.description && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{q.description}</div>}
                <pre style={{
                  fontSize: 10, color: 'var(--text-tertiary)', margin: 0,
                  whiteSpace: 'pre-wrap', maxHeight: 48, overflow: 'hidden',
                  fontFamily: 'monospace',
                }}>
                  {q.sql.slice(0, 120)}{q.sql.length > 120 ? '...' : ''}
                </pre>
                {q.complexity && (
                  <span style={{
                    fontSize: 9, marginTop: 4, display: 'inline-block',
                    padding: '1px 6px', borderRadius: 3,
                    background: q.complexity === 'high' ? 'var(--bg-danger-subtle)' : q.complexity === 'medium' ? 'var(--bg-warning-subtle)' : 'var(--bg-accent-subtle)',
                    color: q.complexity === 'high' ? 'var(--accent-danger)' : q.complexity === 'medium' ? 'var(--accent-warning)' : 'var(--accent-primary)',
                  }}>
                    {q.complexity}
                  </span>
                )}
              </div>
            ))}
            {filteredQueries.length === 0 && (
              <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>No queries found.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
