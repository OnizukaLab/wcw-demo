/**
 * DRY (De-duplication) — Token N-gram Clone Detection
 *
 * DRY = 1 - (重複 n-gram 数) / (全 n-gram 数)
 *
 * コードクローン検出で確立された手法を応用:
 * 1. トークン化してリテラル値（文字列/数値/日付）を ? に正規化
 * 2. スライディングウィンドウで n-gram を生成
 * 3. 初出を除いた重複 n-gram の比率で DRY スコアを算出
 *
 * SQL: 同じ JOIN+フィルタパターンを3回コピペ → 多くの重複 n-gram → DRY 低い
 * Wvlet(DeDup): model定義1回 + 短い呼び出し3回 → 重複少ない → DRY 高い
 *
 * model 定義を特別扱いする必要がない:
 *   - 定義本体: n-gram は1回だけ出現 → 重複なし
 *   - 呼び出し: `from model_name(?, ?)` は短い → n-gram 数が少なく影響小
 */

/** n-gram のウィンドウサイズ（最小クローン断片長） */
const NGRAM_WINDOW = 5;

/**
 * コメント除去後のトークン数を返す。
 */
export function countTokens(code: string, language: 'sql' | 'wvlet'): number {
  const stripped = stripComments(code, language);
  return tokenize(stripped).length;
}

export function calculateDRY(code: string, language: 'sql' | 'wvlet'): number {
  const stripped = stripComments(code, language);
  const tokens = tokenize(stripped);
  const normalized = tokens.map(normalizeLiteral);

  const W = NGRAM_WINDOW;
  const total = normalized.length - W + 1;
  if (total <= 0) return 1.0;

  // n-gram 頻度マップ
  const freq = new Map<string, number>();
  for (let i = 0; i < total; i++) {
    const key = normalized.slice(i, i + W).join('\0');
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  // 初出を除いた重複 n-gram 数
  let dup = 0;
  for (const c of freq.values()) {
    dup += Math.max(0, c - 1);
  }

  return Math.max(0, Math.min(1, 1 - dup / total));
}

// ────────────────────────────────────────────
// コメント除去
// ────────────────────────────────────────────

function stripComments(code: string, language: string): string {
  let result = code;
  // -- line comments
  result = result.replace(/--[^\n]*/g, ' ');
  // /* block comments */
  result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Wvlet: # line comments
  if (language === 'wvlet') {
    result = result.replace(/#[^\n]*/g, ' ');
  }
  return result;
}

// ────────────────────────────────────────────
// トークナイザ
// ────────────────────────────────────────────

function tokenize(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < code.length) {
    // Skip whitespace
    if (/\s/.test(code[i])) { i++; continue; }

    // Triple-quoted string '''...'''
    if (i + 2 < code.length && code.slice(i, i + 3) === "'''") {
      const end = code.indexOf("'''", i + 3);
      if (end >= 0) {
        tokens.push(code.slice(i, end + 3));
        i = end + 3;
        continue;
      }
    }

    // String literal '...' or "..."
    if (code[i] === "'" || code[i] === '"') {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      tokens.push(code.slice(i, Math.min(j + 1, code.length)));
      i = j + 1;
      continue;
    }

    // Backtick identifier `...`
    if (code[i] === '`') {
      const end = code.indexOf('`', i + 1);
      if (end >= 0) {
        tokens.push(code.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w]/.test(code[j])) j++;
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }

    // Number
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push(code.slice(i, j));
      i = j;
      continue;
    }

    // Multi-char operators (>=, <=, <>, !=, ==)
    if (i + 1 < code.length) {
      const two = code.slice(i, i + 2);
      if (['>=', '<=', '<>', '!=', '==', '||', '&&'].includes(two)) {
        tokens.push(two);
        i += 2;
        continue;
      }
    }

    // Single char operator/punctuation
    tokens.push(code[i]);
    i++;
  }

  return tokens;
}

// ────────────────────────────────────────────
// リテラル正規化
// ────────────────────────────────────────────

/** リテラルトークンをプレースホルダ ? に正規化（日付だけ異なるパターンを同一視） */
function normalizeLiteral(token: string): string {
  // String literals (single, double, triple-quoted) → ?
  if (/^['"]/.test(token) || /^'''/.test(token)) return '?';

  // Number literals → ?
  if (/^\d+(\.\d+)?$/.test(token)) return '?';

  // Everything else: uppercase for case-insensitive comparison
  return token.toUpperCase();
}
