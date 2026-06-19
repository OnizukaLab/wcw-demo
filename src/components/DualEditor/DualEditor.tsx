import { useCallback, useRef, useState, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { CodePane } from './CodePane';
import { LineCounter } from './LineCounter';
import { countTokens } from '../../lib/metrics';

/** 変換ステージデータ */
export interface TransformStageData {
  name: string;
  wvlet: string;
}

/** パネルのタブ種別 */
export type PaneTab = 'sql' | 'wvlet' | 'refactored';
/** 後方互換 */
export type RightTab = PaneTab;

interface Props {
  sqlCode: string;
  wvletCode: string;
  stages: TransformStageData[];
  stageIndex: number;
  onStageChange: (index: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  /** 中間ステージの Wvlet コード (stageIndex に応じて変化) */
  intermediateCode?: string;
  /** SQL直接編集コールバック */
  onSqlChange?: (sql: string) => void;
  /** 右パネルのタブ変更コールバック */
  onRightTabChange?: (tab: PaneTab) => void;
}

export function DualEditor({
  sqlCode,
  wvletCode,
  stages,
  stageIndex,
  onStageChange,
  intermediateCode,
  onSqlChange,
  onRightTabChange,
}: Props) {
  const leftScrollRef = useRef<EditorView | null>(null);
  const rightScrollRef = useRef<EditorView | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [leftTab, setLeftTab] = useState<PaneTab>('sql');
  const [rightTab, setRightTab] = useState<PaneTab>('wvlet');

  const wvletOriginal = stages[0]?.wvlet ?? (intermediateCode ?? wvletCode);
  const hasRefactored = stages.length > 1;
  const wvletRefactored = hasRefactored
    ? stages[stages.length - 1].wvlet
    : wvletOriginal;

  const refactorReduction = hasRefactored
    ? Math.round((1 - wvletRefactored.split('\n').length / Math.max(wvletOriginal.split('\n').length, 1)) * 100)
    : 0;
  const modelCount = hasRefactored
    ? (wvletRefactored.match(/^model\s+/gm) || []).length
    : 0;

  const getCode = useCallback((tab: PaneTab): string => {
    if (tab === 'sql') return sqlCode;
    if (tab === 'refactored') return wvletRefactored;
    return wvletOriginal;
  }, [sqlCode, wvletOriginal, wvletRefactored]);

  const getLang = (tab: PaneTab): 'sql' | 'wvlet' => tab === 'sql' ? 'sql' : 'wvlet';

  const syncStage = useCallback((tab: PaneTab) => {
    if (tab === 'wvlet') onStageChange(0);
    else if (tab === 'refactored' && stages.length > 1) onStageChange(stages.length - 1);
  }, [onStageChange, stages.length]);

  const handleLeftTabChange = useCallback((tab: PaneTab) => {
    if (tab === 'refactored' && !hasRefactored) return;
    setLeftTab(tab);
  }, [hasRefactored]);

  const handleRightTabChange = useCallback((tab: PaneTab) => {
    if (tab === 'refactored' && !hasRefactored) return;
    setRightTab(tab);
    syncStage(tab);
    onRightTabChange?.(tab);
  }, [hasRefactored, syncStage, onRightTabChange]);

  // stages が変わったらタブをリセット
  useEffect(() => {
    setLeftTab('sql');
    setRightTab('wvlet');
  }, [stages]);

  // 同期スクロール
  const handleLeftScroll = useCallback(
    (info: { top: number; height: number }) => {
      if (syncing) return;
      setSyncing(true);
      if (rightScrollRef.current) {
        const rightHeight = rightScrollRef.current.scrollDOM.scrollHeight;
        const ratio = info.top / Math.max(info.height, 1);
        rightScrollRef.current.scrollDOM.scrollTop = ratio * rightHeight;
      }
      requestAnimationFrame(() => setSyncing(false));
    },
    [syncing],
  );

  const handleRightScroll = useCallback(
    (info: { top: number; height: number }) => {
      if (syncing) return;
      setSyncing(true);
      if (leftScrollRef.current) {
        const leftHeight = leftScrollRef.current.scrollDOM.scrollHeight;
        const ratio = info.top / Math.max(info.height, 1);
        leftScrollRef.current.scrollDOM.scrollTop = ratio * leftHeight;
      }
      requestAnimationFrame(() => setSyncing(false));
    },
    [syncing],
  );

  const leftCode = getCode(leftTab);
  const rightCode = getCode(rightTab);
  const leftTokens = countTokens(leftCode, getLang(leftTab));
  const rightTokens = countTokens(rightCode, getLang(rightTab));

  const tabLabel = (tab: PaneTab): string => {
    if (tab === 'sql') return 'SQL';
    if (tab === 'refactored') return 'Refactored';
    return 'Wvlet';
  };

  const tabStyle = (isActive: boolean, disabled = false): React.CSSProperties => ({
    padding: '5px 16px',
    fontSize: 12,
    fontWeight: isActive ? 600 : 400,
    color: disabled ? 'var(--text-faint)' : isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
    background: isActive ? 'var(--bg-card)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  });

  const renderTabHeader = (
    active: PaneTab,
    onChange: (tab: PaneTab) => void,
  ) => (
    <div style={{
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-inset)',
    }}>
      {(['sql', 'wvlet', 'refactored'] as PaneTab[]).map((tab) => {
        const disabled = tab === 'refactored' && !hasRefactored;
        return (
          <button
            key={tab}
            style={tabStyle(active === tab, disabled)}
            onClick={() => !disabled && onChange(tab)}
            title={
              tab === 'refactored' && !hasRefactored
                ? 'リファクタリング結果なし（変換と同一）'
                : undefined
            }
          >
            {tabLabel(tab)}
            {tab === 'refactored' && hasRefactored && (
              <>
                {modelCount > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, padding: '1px 5px',
                    borderRadius: 4, background: 'var(--bg-accent-strong)',
                    color: 'var(--accent-primary)',
                  }}>
                    {modelCount} model{modelCount > 1 ? 's' : ''}
                  </span>
                )}
                {refactorReduction > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, padding: '1px 5px',
                    borderRadius: 4, background: 'var(--bg-accent-medium)',
                    color: 'var(--accent-primary)',
                  }}>
                    -{refactorReduction}%
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="dual-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Line Counter */}
      <LineCounter
        leftLabel={tabLabel(leftTab)}
        rightLabel={tabLabel(rightTab)}
        leftTokens={leftTokens}
        rightTokens={rightTokens}
      />

      {/* Dual Panes */}
      <div style={{ display: 'flex', flex: 1, gap: 2, overflow: 'hidden' }}>
        {/* Left Pane */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderTabHeader(leftTab, handleLeftTabChange)}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CodePane
              code={leftCode}
              language={getLang(leftTab)}
              readOnly={leftTab !== 'sql' || !onSqlChange}
              onChange={leftTab === 'sql' ? onSqlChange : undefined}
              scrollRef={leftScrollRef}
              onScroll={handleLeftScroll}
            />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 2, background: 'var(--border-subtle)' }} />

        {/* Right Pane */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderTabHeader(rightTab, handleRightTabChange)}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CodePane
              code={rightCode}
              language={getLang(rightTab)}
              readOnly
              scrollRef={rightScrollRef}
              onScroll={handleRightScroll}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
