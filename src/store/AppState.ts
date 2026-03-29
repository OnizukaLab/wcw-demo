import { create } from 'zustand';
import type { QueryEntry } from '../types/query';
import type { CoreMetrics } from '../types/metrics';
import type { PlanNode } from '../types/plan';
import type { VerificationResult } from '../types/equivalence';
import type { Scenario, ScenarioStep } from '../scenarios/types';
import type { BatchResult } from '../lib/batch/batchRefactor';

export type AppMode = 'single' | 'batch';

export interface AppState {
  // Mode
  mode: AppMode;
  setMode: (m: AppMode) => void;

  // Batch
  batchResults: BatchResult[];
  setBatchResults: (r: BatchResult[]) => void;
  batchProcessing: boolean;
  setBatchProcessing: (p: boolean) => void;
  sharedModels: string;
  setSharedModels: (m: string) => void;
  batchProgress: { done: number; total: number };
  setBatchProgress: (p: { done: number; total: number }) => void;

  // Query selection
  selectedQuery: QueryEntry | null;
  setSelectedQuery: (query: QueryEntry | null) => void;

  // Transform
  sqlCode: string;
  wvletCode: string;
  intermediateCode: string;
  setSqlCode: (code: string) => void;
  setWvletCode: (code: string) => void;
  setIntermediateCode: (code: string) => void;

  // Stage
  stageIndex: number;
  setStageIndex: (index: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;

  // Transform stages
  transformStages: { name: string; wvlet: string }[];
  setTransformStages: (stages: { name: string; wvlet: string }[]) => void;

  // Metrics
  sqlMetrics: CoreMetrics;
  wvletMetrics: CoreMetrics;
  setSqlMetrics: (m: CoreMetrics) => void;
  setWvletMetrics: (m: CoreMetrics) => void;

  // Plan
  sqlPlan: PlanNode | null;
  wvletPlan: PlanNode | null;
  setSqlPlan: (p: PlanNode | null) => void;
  setWvletPlan: (p: PlanNode | null) => void;

  // Equivalence
  verificationResult: VerificationResult | null;
  setVerificationResult: (r: VerificationResult | null) => void;

  // Scenario
  activeScenario: Scenario | null;
  scenarioStepIndex: number;
  scenarioPlaying: boolean;
  setActiveScenario: (s: Scenario | null) => void;
  setScenarioStepIndex: (i: number) => void;
  setScenarioPlaying: (p: boolean) => void;
  currentScenarioStep: () => ScenarioStep | null;

  // UI
  focusedMetric: string | null;
  setFocusedMetric: (m: string | null) => void;

  // Distribution data
  distribution: [number, number][];
  setDistribution: (d: [number, number][]) => void;
}

const DEFAULT_METRICS: CoreMetrics = {
  DRY: 0,
  SN: 0,
  SSOA: 0,
  JI: 0,
  PR: 0,
  R_core: 0,
};

export const useAppState = create<AppState>((set, get) => ({
  // Mode
  mode: 'single',
  setMode: (m) => set({ mode: m }),

  // Batch
  batchResults: [],
  setBatchResults: (r) => set({ batchResults: r }),
  batchProcessing: false,
  setBatchProcessing: (p) => set({ batchProcessing: p }),
  sharedModels: '',
  setSharedModels: (m) => set({ sharedModels: m }),
  batchProgress: { done: 0, total: 0 },
  setBatchProgress: (p) => set({ batchProgress: p }),

  // Query
  selectedQuery: null,
  setSelectedQuery: (query) => set({ selectedQuery: query }),

  // Code
  sqlCode: '',
  wvletCode: '',
  intermediateCode: '',
  setSqlCode: (code) => set({ sqlCode: code }),
  setWvletCode: (code) => set({ wvletCode: code }),
  setIntermediateCode: (code) => set({ intermediateCode: code }),

  // Stage
  stageIndex: 0,
  setStageIndex: (index) => set({ stageIndex: index }),
  playing: false,
  setPlaying: (playing) => set({ playing }),

  // Transform stages
  transformStages: [],
  setTransformStages: (stages) => set({ transformStages: stages }),

  // Metrics
  sqlMetrics: { ...DEFAULT_METRICS },
  wvletMetrics: { ...DEFAULT_METRICS },
  setSqlMetrics: (m) => set({ sqlMetrics: m }),
  setWvletMetrics: (m) => set({ wvletMetrics: m }),

  // Plan
  sqlPlan: null,
  wvletPlan: null,
  setSqlPlan: (p) => set({ sqlPlan: p }),
  setWvletPlan: (p) => set({ wvletPlan: p }),

  // Equivalence
  verificationResult: null,
  setVerificationResult: (r) => set({ verificationResult: r }),

  // Scenario
  activeScenario: null,
  scenarioStepIndex: 0,
  scenarioPlaying: false,
  setActiveScenario: (s) => set({ activeScenario: s, scenarioStepIndex: 0, scenarioPlaying: !!s }),
  setScenarioStepIndex: (i) => set({ scenarioStepIndex: i }),
  setScenarioPlaying: (p) => set({ scenarioPlaying: p }),
  currentScenarioStep: () => {
    const { activeScenario, scenarioStepIndex } = get();
    if (!activeScenario) return null;
    return activeScenario.steps[scenarioStepIndex] ?? null;
  },

  // UI
  focusedMetric: null,
  setFocusedMetric: (m) => set({ focusedMetric: m }),

  // Distribution
  distribution: [],
  setDistribution: (d) => set({ distribution: d }),
}));
