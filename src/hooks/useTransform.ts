import { useState, useCallback, useRef } from 'react';
import { transformSQL } from '../lib/transform';
import type { TransformResult, TransformStageResult } from '../lib/transform';

export function useTransform() {
  const [result, setResult] = useState<TransformResult | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const transform = useCallback(async (sql: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsTransforming(true);
    setCurrentStage(0);

    try {
      const r = await transformSQL(sql);
      setResult(r);
      return r;
    } finally {
      setIsTransforming(false);
    }
  }, []);

  const playStages = useCallback(async (delayMs = 800) => {
    if (!result?.stages) return;
    for (let i = 0; i < result.stages.length; i++) {
      setCurrentStage(i);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }, [result]);

  const stage: TransformStageResult | null = result?.stages[currentStage] ?? null;

  return {
    result,
    stage,
    currentStage,
    setCurrentStage,
    isTransforming,
    transform,
    playStages,
  };
}
