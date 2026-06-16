import { editDistance } from './helpers';

/**
 * SSOA (Syntactic-Semantic Order Agreement)
 * SSOA = 1 - EditDistance(構文順序, 意味順序) / max(|構文順序|, |意味順序|)
 */
export function calculateSSOA(code: string, language: 'sql' | 'wvlet'): number {
  if (language === 'sql') return calculateSSOASQL(code);
  if (language === 'wvlet') return calculateSSOAWvlet(code);
  return 1.0;
}

const SEMANTIC_ORDER = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'LIMIT', 'OFFSET'];
const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET'];

function calculateSSOASQL(code: string): number {
  const upper = code.toUpperCase();

  const found: Array<{ pos: number; kw: string }> = [];
  for (const kw of SQL_KEYWORDS) {
    const pos = upper.indexOf(kw);
    if (pos >= 0) found.push({ pos, kw });
  }
  found.sort((a, b) => a.pos - b.pos);
  const syntacticSequence = found.map(f => f.kw);

  const relevantSemantic = SEMANTIC_ORDER.filter(kw => syntacticSequence.includes(kw));

  if (syntacticSequence.length === 0 || relevantSemantic.length === 0) return 1.0;

  const distance = editDistance(syntacticSequence, relevantSemantic);
  return 1.0 - distance / syntacticSequence.length;
}

const WVLET_FLOW_ORDER = ['from', 'join', 'where', 'group by', 'having', 'select', 'order by', 'limit', 'offset'];

// { } ブロック（サブクエリ・model定義）を再帰的に除去する。
// サブクエリは別スコープであり、メインクエリの節順とは独立しているため除去して評価する。
// Wvlet ではすべての { } がサブクエリまたは model 定義であり、文字列リテラル等への誤削除は起きない。
function stripBraceBlocks(code: string): string {
  let result = code;
  let prev: string;
  do {
    prev = result;
    result = result.replace(/\{[^{}]*\}/gs, '');
  } while (result !== prev);
  return result;
}

function calculateSSOAWvlet(code: string): number {
  const lines = stripBraceBlocks(code).split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const kwPositions = new Map(WVLET_FLOW_ORDER.map((kw, i) => [kw, i]));

  const found: Array<{ lineIdx: number; kw: string }> = [];
  let seenGroupBy = false;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const kw of WVLET_FLOW_ORDER) {
      if (lower.startsWith(kw)) {
        // group by の後に現れる where は Wvlet での HAVING 表現なので having として扱う
        const effectiveKw = (kw === 'where' && seenGroupBy) ? 'having' : kw;
        found.push({ lineIdx: i, kw: effectiveKw });
        if (kw === 'group by') seenGroupBy = true;
        break;
      }
    }
  }

  if (found.length === 0) return 1.0;

  const actualSeq = found.map(f => f.kw);
  const idealSeq = [...actualSeq].sort((a, b) => (kwPositions.get(a) ?? 999) - (kwPositions.get(b) ?? 999));

  const dist = editDistance(actualSeq, idealSeq);
  return 1.0 - dist / actualSeq.length;
}
