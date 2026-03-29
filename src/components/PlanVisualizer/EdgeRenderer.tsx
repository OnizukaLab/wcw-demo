import type { LayoutEdge } from './layout';

interface Props {
  edge: LayoutEdge;
  highlighted?: boolean;
}

export function EdgeRenderer({ edge, highlighted }: Props) {
  if (edge.points.length < 2) return null;

  const d = edge.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={highlighted ? '#4ecdc4' : 'var(--svg-edge)'}
        strokeWidth={highlighted ? 2 : 1}
        opacity={highlighted ? 1 : 0.6}
        markerEnd="url(#arrow)"
      />
    </g>
  );
}

/** SVG arrow marker definition */
export function ArrowDef() {
  return (
    <defs>
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerWidth={8}
        markerHeight={8}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--svg-arrow)" />
      </marker>
    </defs>
  );
}
