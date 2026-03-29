export interface VerificationResult {
  status: 'equivalent' | 'not-equivalent' | 'error' | 'pending';
  equivalent: boolean;
  method: string;
  executionTimeMs: number;
  sqlRowCount?: number;
  wvletRowCount?: number;
  diffRows?: Record<string, unknown>[];
  error?: string;
  test1?: TestResult;
  test2?: TestResult;
  totalTimeMs?: number;
}

export interface TestResult {
  name: string;
  query: string;
  rowCount: number;
  rows?: Record<string, unknown>[];
  timeMs: number;
  error?: string;
}

export interface DataState {
  loaded: boolean;
  tableCount: number;
  totalRows: number;
  sizeBytes: number;
  tables: Array<{
    name: string;
    rowCount: number;
  }>;
}
