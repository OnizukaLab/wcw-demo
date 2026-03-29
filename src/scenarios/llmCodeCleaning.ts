import type { Scenario } from './types';

/**
 * Scenario 3: LLM Code Cleaning
 * LLM生成SQLの品質問題 → Wvletによる構造改善
 */
export const llmCodeCleaning: Scenario = {
  id: 'llm-code-cleaning',
  title: 'LLM Code Cleaning',
  subtitle: 'Fix AI-Generated SQL',
  description:
    'LLM-generated SQL often has poor structure: unnecessary subqueries, ' +
    'implicit joins, and redundant predicates. Wvlet cleans it systematically.',
  defaultQueryId: 'llm-sample-1',
  estimatedDuration: 60,
  steps: [
    { action: 'selectQuery', target: 'llm-sample-1', label: 'Load LLM-generated SQL' },
    { action: 'wait', delayMs: 600, label: 'Identify issues' },
    { action: 'focusMetric', target: 'SSOA', label: 'Highlight poor SSOA' },
    { action: 'playStages', label: 'Play cleanup stages' },
    { action: 'showPlan', label: 'Compare plans' },
    { action: 'focusMetric', target: 'R_core', label: 'Show overall improvement' },
    { action: 'verify', label: 'Verify equivalence' },
  ],
};
