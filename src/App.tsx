import { useEffect, useCallback, useRef, useState } from 'react';
import './App.css';
import { useAppState } from './store';
import { WorkloadBrowser } from './components/WorkloadBrowser/WorkloadBrowser';
import { DualEditor } from './components/DualEditor';
import { CognitiveDashboard } from './components/Dashboard';
import { OrderAlignmentPanel } from './components/OrderAlignment';
import { EquivalenceVerifier } from './components/EquivalenceVerifier';
import { BatchRefactorPage } from './components/BatchRefactor';
import { calculateAllMetrics } from './lib/metrics';
import { sqlToWvletStages } from './lib/transform/sqlToWvlet';

import type { CatalogQuery } from './hooks/useCatalog';
import type { RightTab } from './components/DualEditor/DualEditor';
import type { AppMode } from './store/AppState';

function App() {
  const {
    mode, setMode,
    selectedQuery, setSelectedQuery,
    sqlCode, wvletCode, intermediateCode,
    setSqlCode, setWvletCode, setIntermediateCode,
    stageIndex, setStageIndex,
    playing, setPlaying,
    sqlMetrics, wvletMetrics,
    setSqlMetrics, setWvletMetrics,

    distribution, setDistribution,
    transformStages, setTransformStages,
  } = useAppState();

  // カタログ & 分布データ読み込み
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/distributions.json`)
      .then(r => r.json())
      .then(data => {
        if (data.rcore) setDistribution(data.rcore);
      })
      .catch(() => {});
  }, [setDistribution]);

  // ref 宣言（handleQuerySelect, handleSqlChange 両方で使用）
  const transformTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoTransformRef = useRef(false);

  // クエリ選択ハンドラ
  const handleQuerySelect = useCallback((query: CatalogQuery) => {
    // カタログ選択時は自動変換デバウンスをキャンセル + スキップフラグ
    if (transformTimerRef.current) {
      clearTimeout(transformTimerRef.current);
      transformTimerRef.current = null;
    }
    skipAutoTransformRef.current = true;
    setSelectedQuery(query as any);
    setSqlCode(query.sql);
    setPlaying(false);

    // メトリクス計算
    const sqlM = calculateAllMetrics(query.sql, 'sql');
    setSqlMetrics(sqlM);

    // WvletJS コンパイラでランタイム生成
    const autoStages = sqlToWvletStages(query.sql);
    setTransformStages(autoStages);
    setStageIndex(0);
    const firstWvlet = autoStages.length > 0 ? autoStages[0].wvlet : '';
    setWvletCode(firstWvlet);
    setIntermediateCode(firstWvlet);
    if (firstWvlet) {
      setWvletMetrics(calculateAllMetrics(firstWvlet, 'wvlet'));
    } else {
      setWvletMetrics({ DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 });
    }
  }, [setSelectedQuery, setSqlCode, setWvletCode, setIntermediateCode, setStageIndex, setPlaying, setSqlMetrics, setWvletMetrics, setTransformStages]);

  // SQL直接編集 → 自動変換 + メトリクス再計算
  const handleSqlChange = useCallback((sql: string) => {
    setSqlCode(sql);
    if (sql.trim()) {
      const sqlM = calculateAllMetrics(sql, 'sql');
      setSqlMetrics(sqlM);
    }
    // デバウンス: 500ms後に自動変換
    if (transformTimerRef.current) clearTimeout(transformTimerRef.current);
    transformTimerRef.current = setTimeout(() => {
      // カタログ選択直後のonChange発火はスキップ
      if (skipAutoTransformRef.current) {
        skipAutoTransformRef.current = false;
        return;
      }
      if (!sql.trim()) return;
      const autoStages = sqlToWvletStages(sql);
      setTransformStages(autoStages);
      setStageIndex(0);
      const firstWvlet = autoStages.length > 0 ? autoStages[0].wvlet : '';
      setWvletCode(firstWvlet);
      setIntermediateCode(firstWvlet);
      if (firstWvlet) {
        setWvletMetrics(calculateAllMetrics(firstWvlet, 'wvlet'));
      }
    }, 500);
  }, [setSqlCode, setSqlMetrics, setTransformStages, setStageIndex, setWvletCode, setIntermediateCode, setWvletMetrics]);

  // Custom SQLの分析ハンドラ
  const handleAnalyzeCustomSQL = useCallback((sql: string) => {
    setSqlCode(sql);
    setPlaying(false);
    setSelectedQuery(null);

    const sqlM = calculateAllMetrics(sql, 'sql');
    setSqlMetrics(sqlM);

    // 自動変換
    const autoStages = sqlToWvletStages(sql);
    setTransformStages(autoStages);
    setStageIndex(0);
    const firstWvlet = autoStages.length > 0 ? autoStages[0].wvlet : '';
    setWvletCode(firstWvlet);
    setIntermediateCode(firstWvlet);
    if (firstWvlet) {
      setWvletMetrics(calculateAllMetrics(firstWvlet, 'wvlet'));
    } else {
      setWvletMetrics({ DRY: 0, SN: 0, SSOA: 0, JI: 0, PR: 0, R_core: 0 });
    }
  }, [setSqlCode, setWvletCode, setIntermediateCode, setStageIndex, setPlaying, setSelectedQuery, setSqlMetrics, setWvletMetrics, setTransformStages]);

  // 右パネルタブ変更 → メトリクス再計算
  const handleRightTabChange = useCallback((_tab: RightTab) => {
    // stageIndex は DualEditor 内で既に更新済み（onStageChange 経由）
    // useEffect[stageIndex, transformStages] がメトリクスを再計算する
  }, []);

  // ステージ変更時 → wvlet メトリクス再計算
  useEffect(() => {
    if (transformStages[stageIndex]) {
      const stageWvlet = transformStages[stageIndex].wvlet;
      const wvM = calculateAllMetrics(stageWvlet, 'wvlet');
      setWvletMetrics(wvM);
    }
  }, [stageIndex, transformStages, setWvletMetrics]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <h1>WCW</h1>
          <span className="subtitle">Wvlet Cognitive Workbench — VLDB 2026 Demo</span>
          <nav className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >
              Single Query
            </button>
            <button
              className={`mode-tab ${mode === 'batch' ? 'active' : ''}`}
              onClick={() => setMode('batch')}
            >
              Batch Refactor
            </button>
          </nav>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {mode === 'single'
            ? (selectedQuery ? selectedQuery.name : 'Select a query to begin')
            : 'Batch mode — refactor multiple queries at once'}
        </div>
      </header>

      {mode === 'single' ? (
        /* Single Query: 3-panel layout */
        <div className="app-main">
          <div className="panel-left">
            <WorkloadBrowser
              onSelectQuery={handleQuerySelect}
              onAnalyzeCustomSQL={handleAnalyzeCustomSQL}
              selectedQueryId={selectedQuery?.id ?? null}
            />
          </div>
          <div className="panel-center">
            <div className="panel-center-top">
              <DualEditor
                sqlCode={sqlCode}
                wvletCode={wvletCode}
                stages={transformStages}
                stageIndex={stageIndex}
                onStageChange={setStageIndex}
                playing={playing}
                onPlayToggle={() => setPlaying(!playing)}
                intermediateCode={intermediateCode}
                onSqlChange={handleSqlChange}
                onRightTabChange={handleRightTabChange}
              />
            </div>
            <div className="panel-center-bottom">
              <OrderAlignmentPanel
                sqlCode={sqlCode}
                wvletCode={transformStages[stageIndex]?.wvlet ?? wvletCode}
              />
              <EquivalenceVerifier
                sqlCode={sqlCode}
                wvletCode={wvletCode}
                refactoredCode={transformStages.length > 1 ? transformStages[transformStages.length - 1].wvlet : undefined}
              />
            </div>
          </div>
          <div className="panel-right">
            <CognitiveDashboard
              sqlMetrics={sqlMetrics}
              wvletMetrics={wvletMetrics}
              distribution={distribution.length > 0 ? distribution : undefined}
            />
          </div>
        </div>
      ) : (
        /* Batch Refactor: full-width layout */
        <div className="app-main-batch">
          <BatchRefactorPage />
        </div>
      )}
    </div>
  );
}

export default App;
