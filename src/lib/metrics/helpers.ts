/**
 * 括弧対応マップを O(n) で構築する。
 * @returns Map<開き括弧位置, 閉じ括弧位置>
 */
export function buildParenMap(text: string): Map<number, number> {
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      stack.push(i);
    } else if (text[i] === ')' && stack.length > 0) {
      const openI = stack.pop()!;
      pairs.set(openI, i);
    }
  }
  return pairs;
}

/**
 * start_pos の '(' から対応する ')' までを抽出する。
 */
export function extractBalancedParens(
  text: string,
  startPos: number,
  parenMap?: Map<number, number>
): { body: string; endPos: number } {
  if (startPos >= text.length || text[startPos] !== '(') {
    return { body: '', endPos: startPos };
  }
  if (parenMap) {
    const endPos = parenMap.get(startPos);
    if (endPos !== undefined && endPos > startPos) {
      return { body: text.slice(startPos + 1, endPos).trim(), endPos };
    }
  }
  let depth = 0;
  for (let i = startPos; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) {
        return { body: text.slice(startPos + 1, i).trim(), endPos: i };
      }
    }
  }
  return { body: '', endPos: startPos };
}

/**
 * SQLをメトリクス計算用に前処理する。
 */
export function preprocessSQL(code: string): string {
  let out = code;
  if (out.includes('{')) {
    out = out.replace(/\{%.*?%\}/gs, ' ');
    out = out.replace(/\{\{.*?\}\}/gs, 'TEMPLATE');
    out = out.replace(/\b(FROM|JOIN)(TEMPLATE\b)/gi, '$1 $2');
  }
  return collapseRedundantParens(out);
}

function collapseRedundantParens(text: string, maxPasses = 8): string {
  if ((text.match(/\(/g) || []).length < 2) return text;
  let s = text;
  for (let pass = 0; pass < maxPasses; pass++) {
    const parenMap = buildParenMap(s);
    const toRemove = new Set<number>();
    for (const [openI, closeI] of parenMap) {
      if (toRemove.has(openI) || toRemove.has(closeI)) continue;
      const inner = s.slice(openI + 1, closeI);
      const trimmed = inner.trim();
      if (!trimmed) continue;
      const innerStart = openI + 1 + (inner.length - inner.trimStart().length);
      const innerEnd = closeI - (inner.length - inner.trimEnd().length);
      if (innerStart < innerEnd && s[innerStart] === '(') {
        const innerClose = parenMap.get(innerStart);
        if (innerClose !== undefined && innerClose === innerEnd - 1) {
          toRemove.add(openI);
          toRemove.add(closeI);
        }
      }
    }
    if (toRemove.size === 0) break;
    s = [...s].filter((_, i) => !toRemove.has(i)).join('');
  }
  return s;
}

/**
 * DDLプレフィックス (INSERT INTO, CREATE TABLE AS) を除去
 */
export function stripDDLPrefix(code: string): string {
  const upper = code.toUpperCase();
  const match = upper.match(/\b(WITH|SELECT)\b/);
  if (match && match.index !== undefined) {
    return code.slice(match.index);
  }
  return code;
}

/**
 * レーベンシュタイン編集距離
 */
export function editDistance(seq1: string[], seq2: string[]): number {
  const m = seq1.length;
  const n = seq2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}
