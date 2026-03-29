import dagre from '@dagrejs/dagre';
import type { PlanNode } from '../../types/plan';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: PlanNode;
}

export interface LayoutEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

export function layoutPlan(root: PlanNode): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 60,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // BFS to flatten tree
  const queue: PlanNode[] = [root];
  const nodeMap = new Map<string, PlanNode>();
  const edges: { from: string; to: string }[] = [];

  while (queue.length > 0) {
    const n = queue.shift()!;
    if (nodeMap.has(n.id)) continue;
    nodeMap.set(n.id, n);
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });

    for (const child of n.children) {
      edges.push({ from: n.id, to: child.id });
      g.setEdge(n.id, child.id);
      queue.push(child);
    }
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = [];
  g.nodes().forEach((id) => {
    const pos = g.node(id);
    const node = nodeMap.get(id);
    if (pos && node) {
      layoutNodes.push({
        id,
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        node,
      });
    }
  });

  const layoutEdges: LayoutEdge[] = [];
  g.edges().forEach((e) => {
    const edgeData = g.edge(e);
    layoutEdges.push({
      from: e.v,
      to: e.w,
      points: edgeData.points || [],
    });
  });

  const graphInfo = g.graph();
  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: (graphInfo.width ?? 400) + 40,
    height: (graphInfo.height ?? 300) + 40,
  };
}
