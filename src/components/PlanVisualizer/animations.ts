/**
 * Plan animation types:
 *  - flatten: CTE/subquery がインライン化されるアニメーション
 *  - merge: 複数ノードが1つに統合されるアニメーション
 *  - reorder: ノードの順序が変わるアニメーション
 */

export interface AnimationSpec {
  type: 'flatten' | 'merge' | 'reorder';
  /** 対象ノードID群 */
  nodeIds: string[];
  /** 結果ノードID (merge時) */
  resultNodeId?: string;
  /** アニメーション時間 (ms) */
  duration: number;
}

export interface AnimationState {
  progress: number; // 0-1
  activeSpec: AnimationSpec | null;
  nodePositions: Map<string, { x: number; y: number; opacity: number; scale: number }>;
}

export function interpolatePosition(
  fromX: number, fromY: number,
  toX: number, toY: number,
  progress: number,
): { x: number; y: number } {
  // ease-in-out cubic
  const t = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  return {
    x: fromX + (toX - fromX) * t,
    y: fromY + (toY - fromY) * t,
  };
}

export function computeFlattenAnimation(
  nodeIds: string[],
  progress: number,
): Map<string, { opacity: number; scale: number }> {
  const result = new Map<string, { opacity: number; scale: number }>();
  for (const id of nodeIds) {
    // フラット化: ノードが消えていく
    result.set(id, {
      opacity: Math.max(0, 1 - progress * 1.5),
      scale: 1 - progress * 0.3,
    });
  }
  return result;
}

export function computeMergeAnimation(
  nodeIds: string[],
  resultNodeId: string,
  progress: number,
): Map<string, { opacity: number; scale: number }> {
  const result = new Map<string, { opacity: number; scale: number }>();
  for (const id of nodeIds) {
    if (id === resultNodeId) {
      result.set(id, { opacity: 1, scale: 1 + progress * 0.1 });
    } else {
      result.set(id, {
        opacity: Math.max(0, 1 - progress * 2),
        scale: 1 - progress * 0.5,
      });
    }
  }
  return result;
}

export function computeReorderAnimation(
  _nodeIds: string[],
  progress: number,
): Map<string, { opacity: number; scale: number }> {
  // Reorder ではインターフェースの interpolatePosition を使用
  const result = new Map<string, { opacity: number; scale: number }>();
  // 途中でフラッシュ効果
  const flash = progress > 0.3 && progress < 0.7 ? 0.8 : 1;
  for (const id of _nodeIds) {
    result.set(id, { opacity: flash, scale: 1 });
  }
  return result;
}
