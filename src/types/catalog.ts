import type { CoreMetrics } from './metrics';
import type { QueryEntry, QueryCategory } from './query';

export interface Catalog {
  version: string;
  generated_at: string;
  queries: QueryEntry[];
  statistics: {
    total_count: number;
    by_category: Record<QueryCategory, number>;
    by_subcategory: Record<string, number>;
  };
}

export type { QueryEntry, QueryCategory, CoreMetrics };
