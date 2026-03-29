import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { layoutPlan } from './layout';
import type { LayoutResult } from './layout';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer, ArrowDef } from './EdgeRenderer';
import type { AnimationSpec } from './animations';
import {
  computeFlattenAnimation,
  computeMergeAnimation,
  computeReorderAnimation,
} from './animations';
import type { PlanNode } from '../../types/plan';

interface Props {
  /** SQL側の論理プラン */
  sqlPlan: PlanNode | null;
  /** Wvlet側の論理プラン */
  wvletPlan: PlanNode | null;
  /** 現在のアニメーションスペック */
  animation?: AnimationSpec | null;
  /** ノードクリック */
  onNodeClick?: (nodeId: string) => void;
}

export function PlanVisualizer({ sqlPlan, wvletPlan, animation, onNodeClick }: Props) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  const sqlLayout: LayoutResult | null = useMemo(
    () => (sqlPlan ? layoutPlan(sqlPlan) : null),
    [sqlPlan],
  );
  const wvletLayout: LayoutResult | null = useMemo(
    () => (wvletPlan ? layoutPlan(wvletPlan) : null),
    [wvletPlan],
  );

  // アニメーション進行
  useEffect(() => {
    if (!animation) {
      setProgress(0);
      return;
    }
    const start = performance.now();
    const dur = animation.duration;

    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animation]);

  // アニメーション状態
  const animStates = useMemo(() => {
    if (!animation) return null;
    switch (animation.type) {
      case 'flatten':
        return computeFlattenAnimation(animation.nodeIds, progress);
      case 'merge':
        return computeMergeAnimation(animation.nodeIds, animation.resultNodeId ?? '', progress);
      case 'reorder':
        return computeReorderAnimation(animation.nodeIds, progress);
    }
  }, [animation, progress]);

  const getNodeStyle = useCallback(
    (id: string) => {
      if (!animStates) return {};
      const s = animStates.get(id);
      if (!s) return {};
      return {
        opacity: s.opacity,
        transform: `scale(${s.scale})`,
        transition: 'opacity 0.1s',
      };
    },
    [animStates],
  );

  const renderPlan = (layout: LayoutResult | null, label: string) => {
    if (!layout) {
      return (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          No {label} plan available
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          {label} Plan ({layout.nodes.length} nodes)
        </div>
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ display: 'block' }}
        >
          <ArrowDef />
          {layout.edges.map((edge, i) => (
            <EdgeRenderer key={i} edge={edge} />
          ))}
          {layout.nodes.map((ln) => (
            <g key={ln.id} style={getNodeStyle(ln.id)}>
              <NodeRenderer
                layoutNode={ln}
                onClick={onNodeClick}
              />
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="plan-visualizer" style={{
      display: 'flex', gap: 2, height: '100%',
      background: 'var(--plan-bg)', borderRadius: 8,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {renderPlan(sqlLayout, 'SQL')}
      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
      {renderPlan(wvletLayout, 'Wvlet')}
    </div>
  );
}
