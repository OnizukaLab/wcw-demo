import { ALL_SCENARIOS } from '../../scenarios';
import type { Scenario } from '../../scenarios';

interface Props {
  activeScenarioId: string | null;
  onSelect: (scenario: Scenario) => void;
  onStop: () => void;
  playing: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export function ScenarioBar({
  activeScenarioId,
  onSelect,
  onStop,
  playing,
  currentStep,
  totalSteps,
}: Props) {
  return (
    <div className="scenario-bar" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>Scenarios:</span>

      {ALL_SCENARIOS.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 11,
            border: `1px solid ${s.id === activeScenarioId ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            background: s.id === activeScenarioId ? 'var(--bg-accent-subtle)' : 'transparent',
            color: s.id === activeScenarioId ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {s.title}
        </button>
      ))}

      {/* Progress indicator */}
      {playing && currentStep !== undefined && totalSteps !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 100, height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              height: '100%', background: '#4ecdc4', borderRadius: 2,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 10, color: '#888' }}>
            Step {currentStep + 1}/{totalSteps}
          </span>
          <button
            onClick={onStop}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10,
              border: '1px solid #ff6b6b', background: 'transparent',
              color: '#ff6b6b', cursor: 'pointer',
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Free mode indicator */}
      {!activeScenarioId && (
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)' }}>
          Free Exploration Mode
        </span>
      )}
    </div>
  );
}
