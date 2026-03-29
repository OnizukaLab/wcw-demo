import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { RadarChart as ERadarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { CoreMetrics } from '../../types/metrics';

echarts.use([ERadarChart, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  sqlMetrics: CoreMetrics;
  wvletMetrics: CoreMetrics;
  /** 3-axis (DRY, SN, R_core) or 5-axis (all) */
  axes?: 3 | 5;
}

const METRIC_LABELS_5 = ['DRY', 'SN', 'SSOA', 'JI', 'PR'];
const METRIC_KEYS_5: (keyof CoreMetrics)[] = ['DRY', 'SN', 'SSOA', 'JI', 'PR'];
const METRIC_LABELS_3 = ['DRY', 'SN', 'R_core'];
const METRIC_KEYS_3: (keyof CoreMetrics)[] = ['DRY', 'SN', 'R_core'];

export function RadarChart({ sqlMetrics, wvletMetrics, axes = 5 }: Props) {
  const labels = axes === 3 ? METRIC_LABELS_3 : METRIC_LABELS_5;
  const keys = axes === 3 ? METRIC_KEYS_3 : METRIC_KEYS_5;

  // Read CSS variables for theme-aware colors
  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const accent = cs?.getPropertyValue('--accent-primary')?.trim() || '#4ecdc4';
  const danger = cs?.getPropertyValue('--accent-danger')?.trim() || '#ff6b6b';
  const textSec = cs?.getPropertyValue('--text-secondary')?.trim() || '#aaa';
  const textTert = cs?.getPropertyValue('--text-tertiary')?.trim() || '#ccc';
  const borderSubtle = cs?.getPropertyValue('--border-subtle')?.trim() || '#333';
  const borderStrong = cs?.getPropertyValue('--border-strong')?.trim() || '#444';
  const isDark = cs?.getPropertyValue('--bg-primary')?.trim()?.startsWith('#0') ?? true;

  const option = useMemo(() => ({
    tooltip: { trigger: 'item' },
    legend: {
      data: ['SQL', 'Wvlet'],
      bottom: 0,
      textStyle: { color: textSec, fontSize: 11 },
    },
    radar: {
      indicator: labels.map((name) => ({ name, max: 1, min: 0 })),
      shape: 'polygon',
      axisName: { color: textTert, fontSize: 11 },
      splitArea: { areaStyle: { color: isDark ? ['rgba(78,205,196,0.02)', 'rgba(78,205,196,0.05)'] : ['rgba(26,158,150,0.02)', 'rgba(26,158,150,0.04)'] } },
      splitLine: { lineStyle: { color: borderSubtle } },
      axisLine: { lineStyle: { color: borderStrong } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: keys.map(k => sqlMetrics[k]),
          name: 'SQL',
          lineStyle: { color: danger, width: 2 },
          areaStyle: { color: isDark ? 'rgba(255,107,107,0.15)' : 'rgba(217,83,79,0.12)' },
          itemStyle: { color: danger },
        },
        {
          value: keys.map(k => wvletMetrics[k]),
          name: 'Wvlet',
          lineStyle: { color: accent, width: 2 },
          areaStyle: { color: isDark ? 'rgba(78,205,196,0.15)' : 'rgba(26,158,150,0.12)' },
          itemStyle: { color: accent },
        },
      ],
    }],
  }), [sqlMetrics, wvletMetrics, labels, keys, accent, danger, textSec, textTert, borderSubtle, borderStrong, isDark]);

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: 260, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  );
}
