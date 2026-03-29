import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, TooltipComponent, GridComponent, MarkLineComponent, CanvasRenderer]);

interface Props {
  /** ヒストグラム分布データ [bucket_start, count][] */
  distribution: [number, number][];
  /** 現在のクエリのR_core値 */
  currentValue: number;
  /** タイトル */
  title?: string;
  /** 合計クエリ数表示 */
  totalQueries?: number;
}

export function ContextBar({ distribution, currentValue, title = 'R_core Distribution', totalQueries }: Props) {
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const accent = cs?.getPropertyValue('--accent-primary')?.trim() || '#4ecdc4';
  const borderColor = cs?.getPropertyValue('--border')?.trim() || '#2a2a3a';
  const barColor = cs?.getPropertyValue('--bar-inactive')?.trim() || '#3a3a5a';

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: { value: [string, number] }[]) => {
        const p = params[0];
        return `${p.value[0]}: ${p.value[1]} queries`;
      },
    },
    grid: { left: 40, right: 16, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: distribution.map(d => d[0].toFixed(2)),
      axisLabel: { color: '#888', fontSize: 9, interval: 4 },
      axisLine: { lineStyle: { color: '#444' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#888', fontSize: 9 },
      splitLine: { lineStyle: { color: borderColor } },
    },
    series: [{
      type: 'bar',
      data: distribution.map(d => d[1]),
      itemStyle: { color: barColor, borderRadius: [2, 2, 0, 0] },
      markLine: {
        silent: true,
        data: [{
          xAxis: currentValue.toFixed(2),
          lineStyle: { color: accent, width: 2 },
          label: {
            formatter: `Current: ${currentValue.toFixed(3)}`,
            color: accent,
            fontSize: 10,
          },
        }],
      },
    }],
  }), [distribution, currentValue, accent, borderColor, barColor]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        {totalQueries && <span style={{ color: 'var(--text-muted)' }}>n={totalQueries.toLocaleString()}</span>}
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 140, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}
