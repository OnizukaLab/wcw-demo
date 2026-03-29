/** 論理プランノード */
export interface PlanNode {
  id: string;
  type: PlanNodeType;
  label: string;
  children: PlanNode[];
  cost?: number;
  metadata?: {
    tableName?: string;
    columns?: string[];
    predicate?: string;
    joinType?: string;
    modelName?: string;
  };
}

export type PlanNodeType =
  | 'Scan'
  | 'Filter'
  | 'Project'
  | 'Join'
  | 'Aggregate'
  | 'Sort'
  | 'Limit'
  | 'Union'
  | 'SubqueryAlias'
  | 'CTE'
  | 'ModelDef'
  | 'ModelScan';

/** 論理プランDAG */
export interface LogicalPlan {
  nodes: PlanNode[];
  rootId: string;
  language: 'sql' | 'wvlet';
  stage: number;
}

/** プラン差分（アニメーション用） */
export interface PlanDiff {
  addedNodes: string[];
  removedNodes: string[];
  movedNodes: Array<{
    id: string;
    fromPos: { x: number; y: number };
    toPos: { x: number; y: number };
  }>;
  mergedNodes: Array<{
    sourceIds: string[];
    targetId: string;
  }>;
}
