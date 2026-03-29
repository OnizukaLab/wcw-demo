import type { Scenario } from './types';

/**
 * Scenario 1: Labyrinth Escape
 * 複雑なネストSQL → Wvlet による段階的改善を見せる
 */
export const labyrinthEscape: Scenario = {
  id: 'labyrinth-escape',
  title: 'Labyrinth Escape',
  subtitle: 'Navigate Out of Nested SQL',
  description:
    'Deep nested subqueries form a "labyrinth" that hinders readability. ' +
    'Watch Wvlet flatten and simplify step by step, improving R_core from ~0.3 to ~0.8.',
  defaultQueryId: 'tpch-q7',
  estimatedDuration: 90,
  steps: [
    { action: 'selectQuery', target: 'tpch-q7', label: 'Load TPC-H Q7 (Nested)' },
    { action: 'wait', delayMs: 1000, label: 'Analyze SQL structure' },
    { action: 'focusMetric', target: 'SN', label: 'Highlight SN (nesting)' },
    { action: 'playStages', label: 'Play transform stages' },
    { action: 'showPlan', label: 'Show plan simplification' },
    { action: 'focusMetric', target: 'R_core', label: 'Show R_core improvement' },
    { action: 'verify', label: 'Verify equivalence' },
  ],
};
