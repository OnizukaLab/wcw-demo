import type { Scenario } from './types';

/**
 * Scenario 2: Kill Copy-Paste
 * DRYスコアが低い重複コード → Wvlet のCTE/関数化で改善
 */
export const killCopyPaste: Scenario = {
  id: 'kill-copy-paste',
  title: 'Kill Copy-Paste',
  subtitle: 'Eliminate SQL Duplication',
  description:
    'Repeated SQL fragments are a maintenance nightmare. ' +
    'Wvlet extracts shared logic into reusable blocks, dramatically improving DRY score.',
  defaultQueryId: 'tpch-q11',
  estimatedDuration: 75,
  steps: [
    { action: 'selectQuery', target: 'tpch-q11', label: 'Load TPC-H Q11 (Duplicated)' },
    { action: 'wait', delayMs: 800, label: 'Detect duplicated fragments' },
    { action: 'focusMetric', target: 'DRY', label: 'Highlight DRY score' },
    { action: 'playStages', label: 'Play deduplication stages' },
    { action: 'focusMetric', target: 'DRY', label: 'Show DRY improvement' },
    { action: 'verify', label: 'Verify equivalence' },
  ],
};
