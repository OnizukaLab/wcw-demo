export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** 自動演出ステップ */
  steps: ScenarioStep[];
  /** このシナリオのデフォルトクエリID */
  defaultQueryId?: string;
  /** デモ時間目安(秒) */
  estimatedDuration: number;
}

export interface ScenarioStep {
  action: 'selectQuery' | 'playStages' | 'focusMetric' | 'showPlan' | 'verify' | 'wait';
  /** 対象ID or パラメータ */
  target?: string;
  /** ステップ表示テキスト */
  label: string;
  /** 待機時間 ms (waitアクション) */
  delayMs?: number;
}
