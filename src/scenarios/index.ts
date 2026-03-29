export type { Scenario, ScenarioStep } from './types';
export { labyrinthEscape } from './labyrinthEscape';
export { killCopyPaste } from './killCopyPaste';
export { llmCodeCleaning } from './llmCodeCleaning';

import { labyrinthEscape } from './labyrinthEscape';
import { killCopyPaste } from './killCopyPaste';
import { llmCodeCleaning } from './llmCodeCleaning';
import type { Scenario } from './types';

export const ALL_SCENARIOS: Scenario[] = [
  labyrinthEscape,
  killCopyPaste,
  llmCodeCleaning,
];
