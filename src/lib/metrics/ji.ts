/**
 * JI (Join Intent Clarity)
 * 明示的JOINの割合を測定
 * JI = (明示的JOIN数) / (全JOIN数)
 */
export function calculateJI(code: string, language: 'sql' | 'wvlet'): number {
  if (language === 'wvlet') {
    // Wvlet は常に明示的な join 構文を使用
    const joinCount = (code.match(/\bjoin\b/gi) || []).length;
    return joinCount > 0 ? 1.0 : 1.0;
  }

  const upper = code.toUpperCase();

  // 明示的JOIN: INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL JOIN, CROSS JOIN
  const explicitJoins = (upper.match(/\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b/g) || []).length;
  // 暗黙的JOIN: FROM a, b (カンマ区切り)
  const fromClause = upper.match(/FROM\s+(.*?)(?:WHERE|GROUP|ORDER|HAVING|LIMIT|$)/s)?.[1] ?? '';
  const implicitJoins = Math.max(0, (fromClause.match(/,/g) || []).length);
  // 単なるJOIN（種類未指定）
  const bareJoins = (upper.match(/\bJOIN\b/g) || []).length - explicitJoins;

  const total = explicitJoins + implicitJoins + bareJoins;
  if (total === 0) return 1.0;

  const score = explicitJoins / total;
  return 0.5 + 0.5 * score;
}
