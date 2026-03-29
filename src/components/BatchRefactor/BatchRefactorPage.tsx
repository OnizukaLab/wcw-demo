import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppState } from '../../store';
import { batchRefactor, batchRefactorCrossQuery, type BatchQueryInput, type BatchResult } from '../../lib/batch';
import { splitQueries } from '../../lib/batch/splitQueries';
import { downloadMetricsCsv, downloadWvletFile } from '../../lib/batch/download';
import { CognitiveDashboard } from '../Dashboard';
import { CodePane } from '../DualEditor';
import './BatchRefactorPage.css';

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  sql: string;
}

interface QueryFolder {
  key: string;
  label: string;
  queries: CatalogEntry[];
}

type WorkloadSource = 'tpch' | 'job' | 'custom';

/** カタログをフォルダに分類する */
function groupQueries(catalog: CatalogEntry[], source: WorkloadSource): QueryFolder[] {
  if (source === 'job') {
    // JOB: 番号グループ (1, 2, ..., 33) でフォルダ化
    const groups = new Map<string, CatalogEntry[]>();
    for (const q of catalog) {
      const m = q.id.match(/^job-(\d+)/);
      const g = m ? m[1] : '?';
      const arr = groups.get(g) ?? [];
      arr.push(q);
      groups.set(g, arr);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([g, queries]) => ({
        key: `job-${g}`,
        label: `JOB Q${g}`,
        queries,
      }));
  }

  // TPC-H / catalog.json: category でフォルダ化
  const CATEGORY_LABELS: Record<string, string> = {
    tpch: 'TPC-H',
    nested: 'Nested Subquery',
    join: 'Complex Join',
    aggregation: 'Aggregation',
    llm: 'LLM',
    'flatten-dry': 'Flatten & DRY',
  };
  const groups = new Map<string, CatalogEntry[]>();
  for (const q of catalog) {
    const cat = q.category || 'other';
    const arr = groups.get(cat) ?? [];
    arr.push(q);
    groups.set(cat, arr);
  }
  // tpch を先頭にし、残りをアルファベット順
  const order = ['tpch', 'nested', 'join', 'aggregation', 'llm', 'flatten-dry'];
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return sortedKeys.map(cat => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    queries: groups.get(cat) ?? [],
  }));
}

function SharedModelsPanel({ code }: { code: string }) {
  const [open, setOpen] = useState(true);
  const modelCount = (code.match(/\bmodel\s/g) || []).length;

  return (
    <div className="batch-shared-models">
      <button
        className="batch-shared-models-header"
        onClick={() => setOpen(v => !v)}
      >
        <span className="batch-shared-models-icon">{open ? '▼' : '▶'}</span>
        <span className="batch-shared-models-title">Shared Models</span>
        <span className="batch-shared-models-badge">{modelCount} model{modelCount !== 1 ? 's' : ''} extracted</span>
        <span className="batch-shared-models-hint">{open ? 'Click to collapse' : 'Click to expand'}</span>
      </button>
      {open && (
        <div className="batch-shared-models-editor">
          <CodePane code={code} language="wvlet" readOnly />
        </div>
      )}
    </div>
  );
}

export function BatchRefactorPage() {
  const {
    batchResults, setBatchResults,
    batchProcessing, setBatchProcessing,
    batchProgress, setBatchProgress,
    sharedModels, setSharedModels,
    setMode, setSelectedQuery, setSqlCode,
  } = useAppState();

  const [activeSource, setActiveSource] = useState<WorkloadSource>('tpch');
  const [tpchCatalog, setTpchCatalog] = useState<CatalogEntry[]>([]);
  const [jobCatalog, setJobCatalog] = useState<CatalogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [customSql, setCustomSql] = useState('');
  const [previewResult, setPreviewResult] = useState<BatchResult | null>(null);
  const [fullscreenDetail, setFullscreenDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カタログ読み込み
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
      .then(r => r.json())
      .then(data => {
        const queries: CatalogEntry[] = data.queries || data;
        setTpchCatalog(queries);
        setSelectedIds(new Set(queries.map(q => q.id)));
      })
      .catch(() => {});

    fetch(`${import.meta.env.BASE_URL}data/job_catalog.json`)
      .then(r => r.json())
      .then(data => {
        setJobCatalog(data.queries || data);
      })
      .catch(() => {});
  }, []);

  const currentCatalog = activeSource === 'tpch' ? tpchCatalog : jobCatalog;
  const folders = useMemo(() => groupQueries(currentCatalog, activeSource), [currentCatalog, activeSource]);

  const handleSourceChange = useCallback((source: WorkloadSource) => {
    setActiveSource(source);
    setPreviewResult(null);
    setFullscreenDetail(false);
    setBatchResults([]);
    setExpandedFolders(new Set());
    if (source === 'tpch') {
      setSelectedIds(new Set(tpchCatalog.map(q => q.id)));
    } else if (source === 'job') {
      setSelectedIds(new Set(jobCatalog.filter(q => q.id.endsWith('a')).map(q => q.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [tpchCatalog, jobCatalog, setBatchResults]);

  const toggleQuery = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFolder = useCallback((folder: QueryFolder) => {
    const folderIds = folder.queries.map(q => q.id);
    const allSelected = folderIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        folderIds.forEach(id => next.delete(id));
      } else {
        folderIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [selectedIds]);

  const toggleFolderExpand = useCallback((key: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(currentCatalog.map(q => q.id)));
  }, [currentCatalog]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ファイルドロップ / 選択
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomSql(reader.result);
        setActiveSource('custom');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomSql(reader.result);
        setActiveSource('custom');
      }
    };
    reader.readAsText(file);
  }, []);

  // 一括リファクタ実行
  const handleRefactorAll = useCallback(async () => {
    let queries: BatchQueryInput[];
    if (activeSource === 'custom') {
      const sqls = splitQueries(customSql);
      queries = sqls.map((sql, i) => ({
        id: `custom-${i + 1}`,
        name: `Query ${i + 1}`,
        sql,
      }));
    } else {
      queries = currentCatalog
        .filter(q => selectedIds.has(q.id))
        .map(q => ({ id: q.id, name: q.name, sql: q.sql }));
    }

    if (queries.length === 0) return;

    setBatchProcessing(true);
    setBatchResults([]);
    setSharedModels('');
    setBatchProgress({ done: 0, total: queries.length });
    setPreviewResult(null);
    setFullscreenDetail(false);

    if (activeSource === 'custom') {
      // カスタム SQL は個別リファクタ
      const results = await batchRefactor(queries, (done, total, _result) => {
        setBatchProgress({ done, total });
      });
      setBatchResults(results);
    } else {
      // カタログソース(TPC-H / JOB)は横断リファクタ
      const { sharedModels: models, results } = await batchRefactorCrossQuery(queries, (done, total) => {
        setBatchProgress({ done, total });
      });
      setSharedModels(models);
      setBatchResults(results);
    }

    setBatchProcessing(false);
  }, [activeSource, customSql, currentCatalog, selectedIds, setBatchProcessing, setBatchResults, setBatchProgress, setSharedModels]);

  // Single Query モードに遷移
  const handleOpenInSingle = useCallback((result: BatchResult) => {
    setSqlCode(result.sql);
    setSelectedQuery(null);
    setMode('single');
  }, [setMode, setSqlCode, setSelectedQuery]);

  // 集計
  const successResults = batchResults.filter(r => r.status === 'success');
  const avgSqlRcore = successResults.length > 0
    ? successResults.reduce((s, r) => s + r.sqlMetrics.R_core, 0) / successResults.length
    : 0;
  const avgWvletRcore = successResults.length > 0
    ? successResults.reduce((s, r) => s + r.wvletMetrics.R_core, 0) / successResults.length
    : 0;
  const avgImprovement = avgSqlRcore > 0
    ? ((avgWvletRcore - avgSqlRcore) / avgSqlRcore) * 100
    : 0;

  return (
    <div className="batch-page">
      {/* Source Selection */}
      <div className="batch-source-bar">
        <div className="batch-source-tabs">
          <button
            className={`batch-source-tab ${activeSource === 'tpch' ? 'active' : ''}`}
            onClick={() => handleSourceChange('tpch')}
          >
            TPC-H ({tpchCatalog.length})
          </button>
          <button
            className={`batch-source-tab ${activeSource === 'job' ? 'active' : ''}`}
            onClick={() => handleSourceChange('job')}
          >
            JOB ({jobCatalog.length})
          </button>
          <button
            className={`batch-source-tab ${activeSource === 'custom' ? 'active' : ''}`}
            onClick={() => handleSourceChange('custom')}
          >
            Custom SQL
          </button>
        </div>

        <div className="batch-actions">
          <button
            className="batch-btn batch-btn-primary"
            onClick={handleRefactorAll}
            disabled={batchProcessing || (activeSource !== 'custom' && selectedIds.size === 0) || (activeSource === 'custom' && !customSql.trim())}
          >
            {batchProcessing
              ? `Processing ${batchProgress.done}/${batchProgress.total}...`
              : `Refactor All ▶`}
          </button>
        </div>
      </div>

      <div className="batch-body">
        {/* Left: Query Selector */}
        <div className="batch-selector">
          {activeSource === 'custom' ? (
            <div className="batch-custom-input">
              <div
                className="batch-drop-zone"
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <textarea
                  value={customSql}
                  onChange={e => setCustomSql(e.target.value)}
                  placeholder="Paste SQL queries here (semicolon-separated)&#10;&#10;Or drag & drop a .sql file"
                  spellCheck={false}
                />
              </div>
              <div className="batch-custom-footer">
                <button className="batch-btn batch-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  Choose .sql file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <span className="batch-custom-count">
                  {customSql.trim() ? `${splitQueries(customSql).length} queries detected` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div className="batch-checklist">
              <div className="batch-checklist-header">
                <button className="batch-link" onClick={selectAll}>Select All</button>
                <button className="batch-link" onClick={deselectAll}>Deselect All</button>
                <span className="batch-selected-count">{selectedIds.size} selected</span>
              </div>
              <div className="batch-checklist-items">
                {folders.map(folder => {
                  const folderIds = folder.queries.map(q => q.id);
                  const selectedCount = folderIds.filter(id => selectedIds.has(id)).length;
                  const allSelected = selectedCount === folderIds.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  const isExpanded = expandedFolders.has(folder.key);

                  return (
                    <div key={folder.key} className="batch-folder">
                      <div className="batch-folder-header">
                        <button
                          className="batch-folder-toggle"
                          onClick={() => toggleFolderExpand(folder.key)}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <label className="batch-folder-label">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected; }}
                            onChange={() => toggleFolder(folder)}
                          />
                          <span className="batch-folder-name">{folder.label}</span>
                          <span className="batch-folder-count">
                            {selectedCount}/{folderIds.length}
                          </span>
                        </label>
                      </div>
                      {isExpanded && (
                        <div className="batch-folder-children">
                          {folder.queries.map(q => (
                            <label key={q.id} className="batch-check-item">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(q.id)}
                                onChange={() => toggleQuery(q.id)}
                              />
                              <span className="batch-check-name">{q.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Results Table */}
        <div className="batch-results-area">
          {batchProcessing && (
            <div className="batch-progress">
              <div className="batch-progress-bar">
                <div
                  className="batch-progress-fill"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
              <span>{batchProgress.done} / {batchProgress.total}</span>
            </div>
          )}

          {batchResults.length > 0 && (
            <>
              {/* Summary */}
              <div className="batch-summary">
                <div className="batch-summary-stat">
                  <span className="batch-summary-label">Queries</span>
                  <span className="batch-summary-value">{successResults.length}</span>
                </div>
                <div className="batch-summary-stat">
                  <span className="batch-summary-label">Avg R_core (SQL)</span>
                  <span className="batch-summary-value">{avgSqlRcore.toFixed(3)}</span>
                </div>
                <div className="batch-summary-stat">
                  <span className="batch-summary-label">Avg R_core (Wvlet)</span>
                  <span className="batch-summary-value batch-summary-wvlet">{avgWvletRcore.toFixed(3)}</span>
                </div>
                <div className="batch-summary-stat">
                  <span className="batch-summary-label">Improvement</span>
                  <span className={`batch-summary-value ${avgImprovement > 0 ? 'batch-positive' : 'batch-negative'}`}>
                    {avgImprovement > 0 ? '+' : ''}{avgImprovement.toFixed(1)}%
                  </span>
                </div>
                <div className="batch-download-group">
                  <button className="batch-btn batch-btn-secondary" onClick={() => downloadMetricsCsv(batchResults)}>
                    ↓ CSV
                  </button>
                  <button className="batch-btn batch-btn-secondary" onClick={() => downloadWvletFile(batchResults, sharedModels || undefined)}>
                    ↓ Wvlet
                  </button>
                </div>
              </div>

              {/* Shared Models (cross-query) */}
              {sharedModels && (
                <SharedModelsPanel code={sharedModels} />              )}

              {/* Table */}
              <div className={`batch-table-wrapper ${previewResult ? 'batch-table-compact' : ''}`}>
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Query</th>
                      <th>Lines</th>
                      <th>R_core (SQL)</th>
                      <th>R_core (Wvlet)</th>
                      <th>Δ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.map((r, i) => {
                      const delta = r.sqlMetrics.R_core > 0
                        ? ((r.wvletMetrics.R_core - r.sqlMetrics.R_core) / r.sqlMetrics.R_core) * 100
                        : 0;
                      const isSelected = previewResult?.id === r.id;
                      return (
                        <tr
                          key={r.id}
                          className={`batch-table-row ${isSelected ? 'batch-row-selected' : ''} ${r.status === 'error' ? 'batch-row-error' : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setPreviewResult(null);
                              setFullscreenDetail(false);
                            } else {
                              setPreviewResult(r);
                              setFullscreenDetail(false);
                            }
                          }}
                        >
                          <td className="batch-td-num">{i + 1}</td>
                          <td className="batch-td-name">{r.name}</td>
                          <td className="batch-td-lines">
                            {r.sqlLines} → {r.wvletLines}
                          </td>
                          <td className="batch-td-metric">
                            <span className="batch-rcore-bar" style={{ width: `${r.sqlMetrics.R_core * 100}%` }} />
                            {r.sqlMetrics.R_core.toFixed(3)}
                          </td>
                          <td className="batch-td-metric">
                            <span className="batch-rcore-bar batch-rcore-wvlet" style={{ width: `${r.wvletMetrics.R_core * 100}%` }} />
                            {r.wvletMetrics.R_core.toFixed(3)}
                          </td>
                          <td className={`batch-td-delta ${delta > 0 ? 'batch-positive' : delta < 0 ? 'batch-negative' : ''}`}>
                            {r.status === 'error' ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                          </td>
                          <td>
                            <button
                              className="batch-btn-icon"
                              title="Open in Single Query mode"
                              onClick={e => { e.stopPropagation(); handleOpenInSingle(r); }}
                            >
                              →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Preview Panel */}
              {previewResult && !fullscreenDetail && (
                <div className="batch-preview">
                  <div className="batch-preview-header">
                    <h3>{previewResult.name}</h3>
                    <span className="batch-detail-lines">
                      {previewResult.sqlLines} lines → {previewResult.wvletLines} lines
                    </span>
                    <div className="batch-preview-actions">
                      <button
                        className="batch-btn batch-btn-primary"
                        onClick={() => setFullscreenDetail(true)}
                        title="Expand to full screen"
                      >
                        ⤢ Expand
                      </button>
                      <button
                        className="batch-btn batch-btn-secondary"
                        onClick={() => handleOpenInSingle(previewResult)}
                      >
                        Open in Single Query →
                      </button>
                      <button
                        className="batch-btn-icon"
                        onClick={() => { setPreviewResult(null); setFullscreenDetail(false); }}
                        title="Close preview"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="batch-preview-body">
                    <div className="batch-preview-editors">
                      <div className="batch-detail-pane">
                        <div className="batch-detail-label">SQL</div>
                        <div className="batch-detail-editor">
                          <CodePane code={previewResult.sql} language="sql" readOnly />
                        </div>
                      </div>
                      <div className="batch-detail-divider" />
                      <div className="batch-detail-pane">
                        <div className="batch-detail-label">Wvlet</div>
                        <div className="batch-detail-editor">
                          <CodePane code={previewResult.wvlet} language="wvlet" readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {batchResults.length === 0 && !batchProcessing && (
            <div className="batch-empty">
              Select queries and click <strong>Refactor All</strong> to begin batch analysis.
            </div>
          )}

          {/* Fullscreen Detail Overlay */}
          {previewResult && fullscreenDetail && (
            <div className="batch-detail-overlay">
              <div className="batch-detail">
                <div className="batch-detail-header">
                  <button className="batch-btn batch-btn-secondary" onClick={() => setFullscreenDetail(false)}>
                    ⤡ Collapse
                  </button>
                  <h3>{previewResult.name}</h3>
                  <div className="batch-detail-header-right">
                    <span className="batch-detail-lines">
                      {previewResult.sqlLines} lines → {previewResult.wvletLines} lines
                    </span>
                    <button className="batch-btn batch-btn-secondary" onClick={() => handleOpenInSingle(previewResult)}>
                      Open in Single Query →
                    </button>
                    <button
                      className="batch-btn-icon"
                      onClick={() => { setPreviewResult(null); setFullscreenDetail(false); }}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="batch-detail-body">
                  <div className="batch-detail-editors">
                    <div className="batch-detail-pane">
                      <div className="batch-detail-label">SQL</div>
                      <div className="batch-detail-editor">
                        <CodePane code={previewResult.sql} language="sql" readOnly />
                      </div>
                    </div>
                    <div className="batch-detail-divider" />
                    <div className="batch-detail-pane">
                      <div className="batch-detail-label">Wvlet</div>
                      <div className="batch-detail-editor">
                        <CodePane code={previewResult.wvlet} language="wvlet" readOnly />
                      </div>
                    </div>
                  </div>
                  <div className="batch-detail-metrics">
                    <CognitiveDashboard
                      sqlMetrics={previewResult.sqlMetrics}
                      wvletMetrics={previewResult.wvletMetrics}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
