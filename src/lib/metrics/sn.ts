import { buildParenMap, preprocessSQL, stripDDLPrefix } from './helpers';

const MAX_RECURSION_DEPTH = 100;

interface Subquery {
  depth: number;
  type: string;
  isCTE: boolean;
}

/**
 * SN (Subquery Nesting) スコアを計算する。
 * penalty = Σ(depth_i × count_at_depth_i)   ※CTEは0.5倍
 * SN = 1 / (1 + penalty / k)                k = 3
 */
export function calculateSN(code: string, language: 'sql' | 'wvlet'): number {
  if (language === 'sql') return calculateSNSQL(code);
  if (language === 'wvlet') return calculateSNWvlet(code);
  return 1.0;
}

function calculateSNSQL(code: string): number {
  const processed = preprocessSQL(code);
  const subqueries = extractSubqueriesWithDepth(processed);

  if (subqueries.length === 0) return 1.0;

  let penalty = 0;
  for (const sq of subqueries) {
    penalty += sq.depth * (sq.isCTE ? 0.5 : 1.0);
  }

  const k = 3.0;
  return 1.0 / (1.0 + penalty / k);
}

function calculateSNWvlet(code: string): number {
  const cleaned = stripWvletNonCode(code)
    .replace(/\{(\s*\{)+/g, '{')
    .replace(/\}(\s*\})+/g, '}');

  // Identify positions of model/let definition braces (top-level declarations, not nesting)
  const skipBracePositions = new Set<number>();
  const modelPattern = /\b(?:model|let)\s+\w+\s*=\s*\{/gi;
  for (const m of cleaned.matchAll(modelPattern)) {
    const bracePos = m.index! + m[0].length - 1;
    skipBracePositions.add(bracePos);
  }

  // Identify positions of wrapper braces: `from { ... } as alias`
  // These are syntactic wrappers, not real nesting
  const wrapperPattern = /\bfrom\s*\{/gi;
  for (const m of cleaned.matchAll(wrapperPattern)) {
    const bracePos = m.index! + m[0].length - 1;
    skipBracePositions.add(bracePos);
  }

  let depth = 0;
  let charIdx = 0;
  let penalty = 0;
  let blockCount = 0;
  for (const ch of cleaned) {
    if (ch === '{') {
      if (skipBracePositions.has(charIdx)) {
        // model/let definition or `from { }` wrapper: skip penalty, just track brace balance
        depth++; // still track for proper brace matching
      } else {
        depth++;
        penalty += depth;
        blockCount++;
      }
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
    charIdx++;
  }

  if (blockCount === 0) return 1.0;

  const k = 3.0;
  return 1.0 / (1.0 + penalty / k);
}

function stripWvletNonCode(code: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < code.length) {
    if (code[i] === '-' && code[i + 1] === '-') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (code[i] === '#') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (code[i] === "'" || code[i] === '"') {
      const quote = code[i];
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      i++;
    } else {
      result.push(code[i]);
      i++;
    }
  }
  return result.join('');
}

function extractSubqueriesWithDepth(code: string): Subquery[] {
  const upper = stripDDLPrefix(code.toUpperCase());
  const subqueries: Subquery[] = [];

  const { cteSection, mainQuery } = extractCTEs(upper);
  if (cteSection) {
    const cteAliases = [...cteSection.matchAll(/(\w+)\s+AS\s*\(/gi)];
    for (const _match of cteAliases) {
      subqueries.push({ depth: 1, type: 'CTE', isCTE: true });
    }
  }

  const nested = extractNestedRecursive(mainQuery, 1);
  subqueries.push(...nested);

  return subqueries;
}

function extractCTEs(codeUpper: string): { cteSection: string; mainQuery: string } {
  const withMatch = codeUpper.match(/^\s*WITH\b/i);
  if (!withMatch) return { cteSection: '', mainQuery: codeUpper };

  const parenMap = buildParenMap(codeUpper);
  let pos = withMatch[0].length;

  while (pos < codeUpper.length) {
    if (codeUpper[pos] === '(') {
      const close = parenMap.get(pos);
      if (close !== undefined) { pos = close + 1; continue; }
      else break;
    }
    if (codeUpper.slice(pos, pos + 6) === 'SELECT' &&
        (pos === 0 || !/\w/.test(codeUpper[pos - 1]))) {
      const cteSection = codeUpper.slice(withMatch[0].length, pos).trim().replace(/,\s*$/, '');
      return { cteSection, mainQuery: codeUpper.slice(pos) };
    }
    pos++;
  }

  return { cteSection: '', mainQuery: codeUpper };
}

function extractNestedRecursive(code: string, currentDepth: number): Subquery[] {
  if (currentDepth > MAX_RECURSION_DEPTH) return [];

  const subqueries: Subquery[] = [];
  const parenMap = buildParenMap(code);

  // Collect all paren pairs and sort by open position
  const pairs = [...parenMap.entries()].sort((a, b) => a[0] - b[0]);

  // Track ranges already consumed by an outer subquery parenthesis
  // to avoid double-counting nested SELECTs at the same recursion level
  const consumed = new Set<number>();

  for (const [openPos, closePos] of pairs) {
    // Skip if this open paren falls inside an already-consumed subquery range
    if (consumed.has(openPos)) continue;

    const body = code.slice(openPos + 1, closePos).trim();
    if (body && /^\s*(SELECT|WITH)\b/i.test(body)) {
      // Mark all inner parens within this range as consumed
      for (const [innerOpen] of pairs) {
        if (innerOpen > openPos && innerOpen < closePos) {
          consumed.add(innerOpen);
        }
      }

      subqueries.push({ depth: currentDepth, type: 'SUBQUERY', isCTE: false });
      subqueries.push(...extractNestedRecursive(body, currentDepth + 1));
    }
  }

  return subqueries;
}
