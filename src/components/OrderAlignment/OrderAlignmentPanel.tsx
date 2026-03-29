import { useMemo } from 'react';
import type { AlignmentNode, ReadabilityAlignmentResult } from '../../lib/wvlet';
import { readabilityAlignmentViaCompiler, readabilityAlignmentFromSqlViaCompiler } from '../../lib/wvlet';
import './OrderAlignmentPanel.css';

interface Props {
  sqlCode: string;
  wvletCode: string;
}

/** カテゴリ表示名 */
const CATEGORY_LABEL: Record<string, string> = {
  Scan: 'FROM',
  Join: 'JOIN',
  Filter: 'WHERE',
  Aggregate: 'GROUP BY',
  Project: 'SELECT',
  Sort: 'ORDER BY',
  Limit: 'LIMIT',
  SetOp: 'UNION/SET',
  SubQuery: 'SUBQUERY',
  Other: 'OTHER',
};

/** カテゴリごとの色 */
const CATEGORY_COLOR: Record<string, string> = {
  Scan: '#4fc3f7',
  Join: '#ff8a65',
  Filter: '#aed581',
  Aggregate: '#ce93d8',
  Project: '#fff176',
  Sort: '#90caf9',
  Limit: '#80cbc4',
  SetOp: '#ef9a9a',
  SubQuery: '#b0bec5',
  Other: '#bdbdbd',
};

/** 単一言語のアライメントカラム */
function AlignmentColumn({
  label,
  result,
  isRight,
}: {
  label: string;
  result: ReadabilityAlignmentResult | null;
  isRight?: boolean;
}) {
  if (!result?.success || !result.nodes || result.nodes.length === 0) {
    return (
      <div className="alignment-column">
        <div className="alignment-column-header">{label}</div>
        <div className="alignment-empty">No data</div>
      </div>
    );
  }

  const { nodes, score } = result;

  // 各ノードにユニークIDを付与してからソート
  type IndexedNode = AlignmentNode & { uid: number };
  const indexed: IndexedNode[] = nodes.map((n, i) => ({ ...n, uid: i }));

  // 左カラム: syntaxRank順, 右カラム: dataflowRank順
  const syntaxSorted = [...indexed].sort((a, b) => a.syntaxRank - b.syntaxRank);
  const dataflowSorted = [...indexed].sort((a, b) => a.dataflowRank - b.dataflowRank);

  const nodeCount = nodes.length;
  const rowH = Math.min(28, Math.max(16, Math.floor(180 / nodeCount)));
  const svgH = rowH * nodeCount;

  // 行のY中心位置
  const yCenter = (index: number) => index * rowH + rowH / 2;

  // dataflowSorted 内での uid → index マップ
  const dfIndexByUid = new Map<number, number>();
  dataflowSorted.forEach((n, i) => dfIndexByUid.set(n.uid, i));

  // 接続線: syntaxRank順の各ノードが dataflowRank順で何番目かを uid で正確に特定
  const connections = syntaxSorted.map((sNode, sIndex) => {
    const dfIndex = dfIndexByUid.get(sNode.uid) ?? sIndex;
    return { sNode, sIndex, dfIndex };
  });

  const inversionCount = score?.inversionCount ?? 0;
  const normalizedScore = score?.normalizedScore ?? 0;

  return (
    <div className={`alignment-column ${isRight ? 'right' : ''}`}>
      <div className="alignment-column-header">
        <span className="alignment-label">{label}</span>
        <span className="alignment-score" title="SSOA Score">
          {(normalizedScore * 100).toFixed(0)}%
        </span>
        {inversionCount > 0 && (
          <span className="alignment-inversions" title="Inversion count">
            ⚠ {inversionCount}
          </span>
        )}
      </div>
      <div className="alignment-body">
        {/* 左: Syntax Order（記述順） */}
        <div className="alignment-list syntax-list">
          {syntaxSorted.map((node, i) => (
            <div
              key={`s-${i}`}
              className={`alignment-node ${node.inverted ? 'inverted' : ''}`}
              style={{
                height: rowH,
                borderLeftColor: CATEGORY_COLOR[node.category] ?? '#999',
              }}
              title={`${node.nodeName} (line ${node.line})`}
            >
              <span className="node-label">
                {CATEGORY_LABEL[node.category] ?? node.category}
              </span>
            </div>
          ))}
        </div>

        {/* 中: 接続線SVG */}
        <svg className="alignment-svg" width={60} height={svgH}>
          {connections.map(({ sNode, sIndex, dfIndex }, i) => {
            const y1 = yCenter(sIndex);
            const y2 = yCenter(dfIndex);
            const crossed = sIndex !== dfIndex;
            return (
              <line
                key={i}
                x1={0}
                y1={y1}
                x2={60}
                y2={y2}
                className={crossed ? 'crossing-line' : 'straight-line'}
                stroke={crossed ? '#ef5350' : CATEGORY_COLOR[sNode.category] ?? '#666'}
                strokeWidth={crossed ? 2 : 1.5}
                opacity={crossed ? 0.8 : 0.5}
              />
            );
          })}
        </svg>

        {/* 右: Dataflow Order（実行順） */}
        <div className="alignment-list dataflow-list">
          {dataflowSorted.map((node, i) => (
            <div
              key={`d-${i}`}
              className={`alignment-node ${node.inverted ? 'inverted' : ''}`}
              style={{
                height: rowH,
                borderLeftColor: CATEGORY_COLOR[node.category] ?? '#999',
              }}
              title={`${node.nodeName} (line ${node.line})`}
            >
              <span className="node-label">
                {CATEGORY_LABEL[node.category] ?? node.category}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="alignment-axis-labels">
        <span>Syntax Order</span>
        <span>Dataflow Order</span>
      </div>
    </div>
  );
}

export function OrderAlignmentPanel({ sqlCode, wvletCode }: Props) {
  const sqlResult = useMemo<ReadabilityAlignmentResult | null>(() => {
    if (!sqlCode.trim()) return null;
    return readabilityAlignmentViaCompiler(sqlCode, 'sql');
  }, [sqlCode]);

  const wvletResult = useMemo<ReadabilityAlignmentResult | null>(() => {
    if (!wvletCode.trim()) return null;
    // Try direct Wvlet parse first
    const direct = readabilityAlignmentViaCompiler(wvletCode, 'wvlet');
    if (direct.success) return direct;
    // Fallback: compute Wvlet alignment from original SQL
    // (avoids Wvlet parser syntax gaps for toWvlet-generated code)
    if (sqlCode.trim()) {
      return readabilityAlignmentFromSqlViaCompiler(sqlCode);
    }
    return null;
  }, [wvletCode, sqlCode]);

  return (
    <div className="order-alignment-panel">
      <AlignmentColumn label="SQL" result={sqlResult} />
      <div className="alignment-divider" />
      <AlignmentColumn label="Wvlet" result={wvletResult} isRight />
    </div>
  );
}
