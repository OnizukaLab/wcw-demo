import type { QueryCategory } from '../../types/catalog';

interface Props {
  activeCategory: QueryCategory | 'custom';
  onSelect: (cat: QueryCategory | 'custom') => void;
  counts: Record<string, number>;
}

const TABS: Array<{ key: QueryCategory | 'custom'; icon: string; label: string }> = [
  { key: 'production', icon: '🏭', label: 'Production' },
  { key: 'tpch', icon: '📊', label: 'TPC-H' },
  { key: 'llm_generated', icon: '🤖', label: 'LLM' },
  { key: 'custom', icon: '📋', label: 'Custom' },
];

export function CategoryTabs({ activeCategory, onSelect, counts }: Props) {
  return (
    <div className="category-tabs" role="tablist">
      {TABS.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeCategory === tab.key}
          className={`tab ${activeCategory === tab.key ? 'active' : ''}`}
          onClick={() => onSelect(tab.key)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
          {tab.key !== 'custom' && (
            <span className="tab-count">{counts[tab.key] ?? 0}</span>
          )}
        </button>
      ))}
    </div>
  );
}
