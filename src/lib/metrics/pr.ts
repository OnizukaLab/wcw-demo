/**
 * PR (Predicate Readability)
 * WHERE句の述語の複雑さを測定
 * PR = 1 / (1 + exp(complexity - 5))
 */
export function calculatePR(code: string, language: 'sql' | 'wvlet'): number {
  const upper = code.toUpperCase();

  // WHERE句を抽出
  const whereMatch = upper.match(/WHERE\s+(.*?)(?:GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|$)/s);
  if (!whereMatch) return 0.5;

  const predicate = whereMatch[1];

  const ands = (predicate.match(/\bAND\b/g) || []).length;
  const ors = (predicate.match(/\bOR\b/g) || []).length;
  const nots = (predicate.match(/\bNOT\b/g) || []).length;
  const depth = maxParenDepth(predicate);

  const complexity = ands * 1 + ors * 2 + nots * 1 + depth * 0.5;

  return 1.0 / (1.0 + Math.exp(complexity - 5));
}

function maxParenDepth(text: string): number {
  let depth = 0, max = 0;
  for (const ch of text) {
    if (ch === '(') { depth++; max = Math.max(max, depth); }
    else if (ch === ')') depth = Math.max(0, depth - 1);
  }
  return max;
}
