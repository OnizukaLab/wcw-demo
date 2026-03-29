import type { CoreMetrics } from './metrics';

/** ワークロードブラウザ用のクエリメタデータ */
export interface QueryEntry {
  id: string;
  name: string;
  category: QueryCategory;
  subcategory: string;
  source: 'tpch' | 'treasuredata' | 'llm_generated' | 'custom';
  sql: string;
  sql_preview: string;
  line_count: number;
  metrics_original: CoreMetrics;
  metrics_refactored?: CoreMetrics;
  improvement?: number;
  tags: string[];
}

export type QueryCategory = 'production' | 'tpch' | 'llm_generated' | 'custom';
