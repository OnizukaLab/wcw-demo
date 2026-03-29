import type { LayoutNode } from './layout';

interface Props {
  layoutNode: LayoutNode;
  highlighted?: boolean;
  onClick?: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  Scan: '#4ecdc4',
  Filter: '#ff6b6b',
  Project: '#ffd93d',
  Join: '#6c5ce7',
  Aggregate: '#fd79a8',
  Sort: '#a29bfe',
  Limit: '#81ecec',
  Union: '#fab1a0',
  CTE: '#74b9ff',
  SubqueryAlias: '#dfe6e9',
  ModelDef: '#00cec9',
  ModelScan: '#55efc4',
};

export function NodeRenderer({ layoutNode, highlighted, onClick }: Props) {
  const { id, x, y, width, height, node } = layoutNode;
  const color = TYPE_COLORS[node.type] ?? '#888';

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick?.(id)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={highlighted ? color : 'var(--bg-card)'}
        stroke={color}
        strokeWidth={highlighted ? 2.5 : 1.5}
        opacity={highlighted ? 1 : 0.85}
      />
      <text
        x={width / 2}
        y={16}
        textAnchor="middle"
        fill={color}
        fontSize={11}
        fontWeight={700}
      >
        {node.type}
      </text>
      <text
        x={width / 2}
        y={34}
        textAnchor="middle"
        fill="var(--text-secondary)"
        fontSize={9}
      >
        {node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label}
      </text>
      {node.cost !== undefined && (
        <text
          x={width - 4}
          y={12}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize={8}
        >
          {node.cost.toFixed(0)}
        </text>
      )}
    </g>
  );
}
