import { useCallback, useRef, useEffect } from 'react';

interface Props {
  /** 現在のステージインデックス (0-4) */
  value: number;
  /** ステージ名ラベル */
  labels: string[];
  /** ステージ変更 */
  onChange: (index: number) => void;
  /** 自動再生中か */
  playing: boolean;
  /** 再生/一時停止トグル */
  onPlayToggle: () => void;
  /** 再生速度 (ms/ステージ) */
  interval?: number;
}

export function StageSlider({
  value,
  labels,
  onChange,
  playing,
  onPlayToggle,
  interval = 1200,
}: Props) {
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (playing) {
      timerRef.current = window.setInterval(() => {
        onChange(-1); // -1 means "next"
      }, interval);
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [playing, interval, onChange, stopTimer]);

  return (
    <div className="stage-slider" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <button
        className="play-btn"
        onClick={onPlayToggle}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid #4ecdc4', background: playing ? '#4ecdc4' : 'transparent',
          color: playing ? '#fff' : '#4ecdc4', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <input
        type="range"
        min={0}
        max={labels.length - 1}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#4ecdc4' }}
      />

      <div className="stage-labels" style={{ display: 'flex', gap: 4 }}>
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => onChange(i)}
            style={{
              padding: '2px 8px', fontSize: 11, borderRadius: 4,
              border: `1px solid ${i === value ? 'var(--accent-primary)' : 'var(--text-faint)'}`,
              background: i === value ? 'var(--accent-primary)' : 'transparent',
              color: i === value ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
