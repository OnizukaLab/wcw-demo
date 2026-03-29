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

/** 右パネルのタブ種別 */
export type RightTab = 'wvlet' | 'refactored';

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
  onRightTabChange?: (tab: RightTab) => void;
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
  const [activeTab, setActiveTab] = useState<RightTab>('wvlet');

  // 基本変換 Wvlet (最初のステージ)
  const wvletOriginal = stages[0]?.wvlet ?? (intermediateCode ?? wvletCode);

  // リファクタリング後 Wvlet (最後のステージ、ステージが2つ以上ある場合)
  const hasRefactored = stages.length > 1;
  const wvletRefactored = hasRefactored
    ? stages[stages.length - 1].wvlet
    : wvletOriginal;

  // リファクタリングの改善指標
  const refactorReduction = hasRefactored
    ? Math.round((1 - wvletRefactored.split('\n').length / Math.max(wvletOriginal.split('\n').length, 1)) * 100)
    : 0;
  const modelCount = hasRefactored
    ? (wvletRefactored.match(/^model\s+/gm) || []).length
    : 0;

  // タブに応じた右ペインのコード
  const rightCode = activeTab === 'refactored' ? wvletRefactored : wvletOriginal;

  // タブ変更ハンドラ
  const handleTabChange = useCallback((tab: RightTab) => {
    setActiveTab(tab);
    // ステージインデックスも同期: Wvlet → 0, Refactored → last
    if (tab === 'wvlet') {
      onStageChange(0);
    } else if (stages.length > 1) {
      onStageChange(stages.length - 1);
    }
    onRightTabChange?.(tab);
  }, [onStageChange, onRightTabChange, stages.length]);

  // stages が変わったらタブをリセット
  useEffect(() => {
    setActiveTab('wvlet');
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

  const sqlTokens = countTokens(sqlCode, 'sql');
  const wvletTokens = countTokens(rightCode, 'wvlet');

  // タブスタイル
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

  return (
    <div className="dual-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Line Counter */}
      <LineCounter sqlTokens={sqlTokens} wvletTokens={wvletTokens} />

      {/* Dual Panes */}
      <div
        style={{ display: 'flex', flex: 1, gap: 2, overflow: 'hidden' }}
      >
        {/* Left: SQL */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '4px 12px', fontSize: 11, color: 'var(--text-tertiary)',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>SQL {onSqlChange ? '(editable)' : '(Original)'}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CodePane
              code={sqlCode}
              language="sql"
              readOnly={!onSqlChange}
              onChange={onSqlChange}
              scrollRef={leftScrollRef}
              onScroll={handleLeftScroll}
            />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 2, background: 'var(--border-subtle)' }} />

        {/* Right: Wvlet (tabbed) */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-inset)',
          }}>
            <button
              style={tabStyle(activeTab === 'wvlet')}
              onClick={() => handleTabChange('wvlet')}
            >
              Wvlet
            </button>
            <button
              style={tabStyle(activeTab === 'refactored', !hasRefactored)}
              onClick={() => hasRefactored && handleTabChange('refactored')}
              title={hasRefactored ? 'リファクタリング後の Wvlet（model 抽出による DRY 化）' : 'リファクタリング結果なし（変換と同一）'}
            >
              Refactored
              {hasRefactored && (
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
                  {modelCount === 0 && refactorReduction <= 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, padding: '1px 5px',
                      borderRadius: 4, background: 'var(--bg-accent-strong)',
                      color: 'var(--accent-primary)',
                    }}>
                      {stages[stages.length - 1].name}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CodePane
              code={rightCode}
              language="wvlet"
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
