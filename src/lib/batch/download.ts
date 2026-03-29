import type { BatchResult } from './batchRefactor';

/**
 * バッチ結果をCSVとしてダウンロード
 */
export function downloadMetricsCsv(results: BatchResult[]): void {
  const header = 'id,name,sql_lines,wvlet_lines,line_reduction,sql_R_core,wvlet_R_core,improvement,sql_DRY,wvlet_DRY,sql_SN,wvlet_SN,sql_SSOA,wvlet_SSOA,sql_JI,wvlet_JI,sql_PR,wvlet_PR,status';
  const rows = results.map(r => {
    const lineReduction = r.sqlLines > 0
      ? ((1 - r.wvletLines / r.sqlLines) * 100).toFixed(1)
      : '0';
    const improvement = r.sqlMetrics.R_core > 0
      ? (((r.wvletMetrics.R_core - r.sqlMetrics.R_core) / r.sqlMetrics.R_core) * 100).toFixed(1)
      : '0';
    return [
      csvEscape(r.id),
      csvEscape(r.name),
      r.sqlLines,
      r.wvletLines,
      lineReduction,
      r.sqlMetrics.R_core.toFixed(3),
      r.wvletMetrics.R_core.toFixed(3),
      improvement,
      r.sqlMetrics.DRY.toFixed(3),
      r.wvletMetrics.DRY.toFixed(3),
      r.sqlMetrics.SN.toFixed(3),
      r.wvletMetrics.SN.toFixed(3),
      r.sqlMetrics.SSOA.toFixed(3),
      r.wvletMetrics.SSOA.toFixed(3),
      r.sqlMetrics.JI.toFixed(3),
      r.wvletMetrics.JI.toFixed(3),
      r.sqlMetrics.PR.toFixed(3),
      r.wvletMetrics.PR.toFixed(3),
      r.status,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  downloadBlob(csv, 'wcw-batch-metrics.csv', 'text/csv;charset=utf-8');
}

/**
 * 全 Wvlet 結果をダウンロード。
 * sharedModels がある場合は models.wv + queries.wv の 2 ファイルを生成する。
 * ない場合は従来どおり単一ファイル。
 */
export function downloadWvletFile(results: BatchResult[], sharedModels?: string): void {
  if (sharedModels) {
    // 共有モデルファイル
    downloadBlob(
      `-- Shared Models (cross-query extraction)\n\n${sharedModels}\n`,
      'wcw-shared-models.wv',
      'text/plain;charset=utf-8',
    );

    // 各クエリ本体 (model 定義なし)
    const sections = results
      .filter(r => r.status === 'success')
      .map(r => `-- ${r.name}\n${r.wvlet}`);
    const content = sections.join('\n\n-- ────────────────────────────────────────\n\n');
    downloadBlob(content, 'wcw-batch-queries.wv', 'text/plain;charset=utf-8');
  } else {
    const sections = results
      .filter(r => r.status === 'success')
      .map(r => {
        const wvlet = r.refactored ?? r.wvlet;
        return `-- ${r.name}\n${wvlet}`;
      });
    const content = sections.join('\n\n-- ────────────────────────────────────────\n\n');
    downloadBlob(content, 'wcw-batch-refactored.wv', 'text/plain;charset=utf-8');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
