/**
 * Wvlet テキスト上の重複パターン検出 + model 抽出リファクタ
 *
 * WvletJS.toWvlet() の出力（FROM-first + { } ブロック）を解析し、
 * 構造的に同じ from...where ブロックを model 定義に抽出する。
 *
 * WvletJS.toWvlet() 出力フォーマット:
 *   - トップレベル: `from T1, T2\nwhere\n  cond1\n  and cond2\ngroup by ...\nselect ...`
 *   - サブクエリ: `{ from T1, T2\n  where\n    cond1\n  select ... }`
 *     ※ { } 内のブロックはネスト先頭がインデントされている
 *   - `from { { ... } } as alias` — 二重ブレースのサブクエリ参照
 *   - `where\n  SUM(...) > { ... }` — HAVING相当は2回目のwhereで表現
 *   - リテラル型サフィックス: `'1995-01-01':date`
 *   - `between X and Y` — and は条件区切りではない
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface WvletBlock {
  /** 元テキスト中の開始位置(fromの先頭) */
  startIdx: number;
  /** 元テキスト中の終了位置 */
  endIdx: number;
  /** テーブル名リスト */
  tables: string[];
  /** join 条件リスト (例: "ps_suppkey = s_suppkey") */
  joinConditions: string[];
  /** where 条件行リスト(各行は個別条件、{SUBQUERY}プレースホルダ含む場合あり) */
  whereConditions: string[];
  /** { } サブクエリ参照を含む条件行のraw行テキスト (置換後にwhere句として再構築用) */
  subqueryRawLines: string[];
  /** suffix行(group by, select, order by等) */
  suffixLines: string[];
  /** ブロック先頭のインデント */
  baseIndent: string;
}

interface ParamInfo {
  name: string;
  values: string[];
  templateExpr: string;
  /** reference block の whereConditions 内のインデックス */
  whereIndex: number;
  /** このパラメータが適用された後のテンプレート行全体 */
  fullTemplateExpr: string;
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

export function refactorWvletTS(wvlet: string): string | null {
  const blocks = extractAllBlocks(wvlet);
  if (blocks.length < 2) return null;

  const groups = groupByStructuralKey(blocks);

  // 2つ以上の出現がある最大グループを選択
  let bestGroup: WvletBlock[] | null = null;
  for (const group of groups.values()) {
    if (group.length >= 2) {
      if (!bestGroup || group.length > bestGroup.length ||
          (group.length === bestGroup.length && group[0].tables.length > bestGroup[0].tables.length)) {
        bestGroup = group;
      }
    }
  }
  if (!bestGroup || bestGroup.length < 2) return null;

  const params = antiUnify(bestGroup);
  const modelName = inferModelName(bestGroup[0]);
  const modelDef = buildModel(modelName, bestGroup[0], params);

  // 後ろから置換してインデックスずれ回避
  let result = wvlet;
  const sorted = [...bestGroup].sort((a, b) => b.startIdx - a.startIdx);

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];
    const blockIdx = bestGroup.indexOf(block);
    const args = params.map(p => p.values[blockIdx]);
    const argsStr = args.length > 0 ? `(${args.join(', ')})` : '()';
    let replacement = `${block.baseIndent}from ${modelName}${argsStr}`;

    // サブクエリ参照条件があれば where 句として再構築
    if (block.subqueryRawLines.length > 0) {
      replacement += `\n${block.baseIndent}where`;
      for (let si = 0; si < block.subqueryRawLines.length; si++) {
        const rawLine = block.subqueryRawLines[si];
        // 元のインデントを保持 (and 接頭辞付き)
        const prefix = si === 0 ? `${block.baseIndent}  ` : `${block.baseIndent}  and `;
        // rawLine は `and l_extendedprice * ... > {` のような形
        const cleaned = rawLine.replace(/^\s*and\s+/, '');
        replacement += `\n${prefix}${cleaned}`;
      }
    }

    result = result.slice(0, block.startIdx) + replacement + result.slice(block.endIdx);
  }

  result = modelDef + '\n\n' + result;
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

// ────────────────────────────────────────────
// Block Extraction — 完全書き直し
// ────────────────────────────────────────────

/**
 * トップレベルと { } 内の全 from ブロックを再帰的に抽出する。
 *
 * アプローチ: テキストを「スコープ」に分割して各スコープ内の from ブロックをパースする。
 * スコープ = テキスト全体、または { } で囲まれた部分文字列
 * 各スコープ内では { } を飛ばしてフラットに from...where ブロックを検出。
 */
function extractAllBlocks(wvlet: string): WvletBlock[] {
  const blocks: WvletBlock[] = [];
  extractFromScopes(wvlet, 0, blocks);
  return blocks;
}

/**
 * 指定テキスト内の from ブロックを検出し、{ } 内は再帰的にスキャン。
 * { } 内の内容は別スコープとして再帰処理。
 */
function extractFromScopes(text: string, globalOff: number, out: WvletBlock[]): void {
  // まず { } ペアを全て見つけてスキップ領域を記録
  const braceRanges = findAllBraceRanges(text);

  // 各 { } の中身を再帰的にスキャン
  for (const [start, end] of braceRanges) {
    const inner = text.slice(start + 1, end);
    extractFromScopes(inner, globalOff + start + 1, out);
  }

  // このスコープ内の from ブロックをパース（{ } 範囲は条件に含めない）
  parseFromBlocksInScope(text, globalOff, braceRanges, out);
}

/**
 * テキスト内のトップレベルの { } ペアを全て検出（ネストは含まない）
 */
function findAllBraceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "'") {
      // 文字列リテラルをスキップ
      i++;
      while (i < text.length && text[i] !== "'") i++;
      i++;
      continue;
    }
    if (text[i] === '{') {
      const end = findMatchingBrace(text, i);
      if (end > i) {
        ranges.push([i, end]);
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

/**
 * スコープ内の from ブロックをパースする。
 * braceRanges 内の文字位置はスキップして条件解析しない。
 */
function parseFromBlocksInScope(
  text: string,
  globalOff: number,
  braceRanges: [number, number][],
  out: WvletBlock[],
): void {
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }

  /** charIdx が { } 範囲内かどうか */
  function isInBrace(charIdx: number): boolean {
    return braceRanges.some(([s, e]) => charIdx > s && charIdx < e);
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();
    const lineStart = lineStarts[li];

    // { } の中の行はスキップ (再帰で処理済み)
    if (isInBrace(lineStart)) continue;

    // from 行の検出
    if (!trimmed.startsWith('from ') || trimmed.match(/^from\s*[\{]/)) continue;

    const baseIndent = line.match(/^(\s*)/)?.[1] ?? '';
    const baseLen = baseIndent.length;

    // テーブル名を解析
    const fromContent = trimmed.replace(/^from\s+/, '');
    const tables = fromContent.split(/\s*,\s*/).map(t => t.trim()).filter(Boolean);

    const joinConditions: string[] = [];
    const whereConditions: string[] = [];
    const subqueryRawLines: string[] = [];  // { } サブクエリ参照条件行のraw行テキスト
    const suffixLines: string[] = [];
    let inWhere = false;
    let seenGroupBy = false;  // group by 後の where は HAVING として suffix 扱い
    let inHaving = false;     // HAVING ブロック内かどうか
    let lastWhereLine = li;   // where条件の最終行（suffixは含まない）
    let lastParsedLine = li;

    // 後続行をパース
    for (let lj = li + 1; lj < lines.length; lj++) {
      const ln = lines[lj];
      const tr = ln.trim();
      const indent = ln.length - ln.trimStart().length;
      const lnStart = lineStarts[lj];

      if (tr === '') continue;

      // { } 内の行はスキップ
      if (isInBrace(lnStart)) continue;

      // インデントがfromより浅ければブロック終了
      if (indent < baseLen) break;

      // 同じインデントの別 from は新ブロック
      if (indent === baseLen && tr.startsWith('from ')) break;

      // join 行の検出: `join TABLE on CONDITION`
      if (indent === baseLen && tr.startsWith('join ')) {
        const joinMatch = tr.match(/^join\s+(\S+)\s+on\s+(.+)$/i);
        if (joinMatch) {
          tables.push(joinMatch[1].trim());
          joinConditions.push(joinMatch[2].trim());
        }
        lastParsedLine = lj;
        lastWhereLine = lj;
        continue;
      }

      // suffix キーワード (group by, select, order by, limit, agg)
      if (indent === baseLen && (
        tr.startsWith('group by') || tr.startsWith('select ') ||
        tr.startsWith('order by') || tr.startsWith('limit ') ||
        tr.startsWith('agg ')
      )) {
        if (tr.startsWith('group by')) seenGroupBy = true;
        inWhere = false;
        inHaving = false;
        suffixLines.push(tr);
        lastParsedLine = lj;
        continue;
      }

      // where キーワード
      if (indent === baseLen && tr.startsWith('where')) {
        // group by 後の where は HAVING — suffix として扱い、whereConditions には入れない
        if (seenGroupBy) {
          inHaving = true;
          inWhere = false;
          // HAVING 行全体を suffix に追加（後続の条件行も）
          suffixLines.push(tr);
          lastParsedLine = lj;
          continue;
        }
        inWhere = true;
        lastWhereLine = lj;
        const afterWhere = tr.slice(5).trim();
        if (afterWhere && !afterWhere.includes('{')) {
          whereConditions.push(afterWhere);
        } else if (afterWhere && afterWhere.includes('{')) {
          const bracePos = afterWhere.indexOf('{');
          const before = afterWhere.slice(0, bracePos).trim();
          if (before) whereConditions.push(before + ' {SUBQUERY}');
        }
        lastParsedLine = lj;
        continue;
      }

      // HAVING 条件の継続行 — suffix として扱う
      if (inHaving && indent > baseLen) {
        suffixLines.push(tr);
        lastParsedLine = lj;
        continue;
      }

      // where 条件の継続行
      if (inWhere && indent > baseLen) {
        let condText = tr;
        if (condText.startsWith('and ')) condText = condText.slice(4);

        // { } を含む行は {SUBQUERY} に置換、rawテキストを記録
        if (condText.includes('{')) {
          const bracePos = condText.indexOf('{');
          const before = condText.slice(0, bracePos).trim();
          if (before) whereConditions.push(before + ' {SUBQUERY}');
          subqueryRawLines.push(tr);  // 元の行テキスト("and l_extendedprice * ... > {")
          lastWhereLine = lj;  // サブクエリ参照行もendIdxに含める
        } else {
          whereConditions.push(condText);
          lastWhereLine = lj;
        }
        lastParsedLine = lj;
        continue;
      }

      // それ以外 — ブロック終了
      break;
    }

    // テーブルが2つ以上のブロックのみ対象
    if (tables.length >= 2) {
      // endIdx: where条件の最終行の末尾（suffix、{ } 内コンテンツは含めない）
      const endIdx = lineStarts[lastWhereLine] + lines[lastWhereLine].length;

      out.push({
        startIdx: globalOff + lineStart,
        endIdx: globalOff + endIdx,
        tables: tables.map(t => t.toLowerCase()),
        joinConditions,
        whereConditions,
        subqueryRawLines,
        suffixLines,
        baseIndent,
      });
    }
  }
}

// ────────────────────────────────────────────
// Structural Grouping
// ────────────────────────────────────────────

function normalizeForKey(cond: string): string {
  return cond
    .replace(/'[^']*'(:\w+)?/g, '?')
    .replace(/\b\d+(\.\d+)?\b/g, '#')
    .trim()
    .toLowerCase();
}

function structuralKey(block: WvletBlock): string {
  const tableKey = [...block.tables].sort().join(',');
  const joinKey = [...block.joinConditions].sort().map(normalizeForKey).join('|');
  const whereKey = [...block.whereConditions]
    .filter(w => !w.includes('{SUBQUERY}'))
    .map(normalizeForKey)
    .sort()
    .join('|');
  return `${tableKey}::${joinKey}::${whereKey}`;
}

function groupByStructuralKey(blocks: WvletBlock[]): Map<string, WvletBlock[]> {
  const groups = new Map<string, WvletBlock[]>();
  for (const block of blocks) {
    const key = structuralKey(block);
    const existing = groups.get(key) ?? [];
    existing.push(block);
    groups.set(key, existing);
  }
  return groups;
}

// ────────────────────────────────────────────
// Anti-Unification
// ────────────────────────────────────────────

function antiUnify(blocks: WvletBlock[]): ParamInfo[] {
  const params: ParamInfo[] = [];
  const reference = blocks[0];

  for (let wi = 0; wi < reference.whereConditions.length; wi++) {
    const refLine = reference.whereConditions[wi];
    if (refLine.includes('{SUBQUERY}')) continue;

    const refNorm = normalizeForKey(refLine);

    const matchedValues: string[] = [];
    let allSame = true;

    for (const block of blocks) {
      const matched = block.whereConditions.find(w => normalizeForKey(w) === refNorm);
      if (matched) {
        matchedValues.push(matched);
        if (matched !== refLine) allSame = false;
      } else {
        matchedValues.push(refLine);
      }
    }

    if (allSame) continue;

    // リテラル値を抽出
    const literals = matchedValues.map(extractLiterals);
    if (literals.some(l => l.length === 0)) continue;

    const refLiterals = literals[0];
    for (let li = 0; li < refLiterals.length; li++) {
      const vals = literals.map(l => l[li] ?? refLiterals[li]);
      const hasDiff = vals.some(v => v !== vals[0]);
      if (!hasDiff) continue;

      const paramName = inferParamName(refLine, li, params.length);
      const templateExpr = replaceNthLiteral(refLine, li, paramName);

      params.push({
        name: paramName,
        values: vals,
        templateExpr,
        whereIndex: wi,
        fullTemplateExpr: templateExpr,
      });
    }
  }

  // 同じ whereIndex に複数パラメータがある場合、テンプレートを累積
  const byIndex = new Map<number, ParamInfo[]>();
  for (const p of params) {
    const arr = byIndex.get(p.whereIndex) ?? [];
    arr.push(p);
    byIndex.set(p.whereIndex, arr);
  }
  for (const [, ps] of byIndex) {
    if (ps.length > 1) {
      // 全パラメータを1つの行に累積適用
      let expr = reference.whereConditions[ps[0].whereIndex];
      for (const p of ps) {
        expr = expr.replace(p.values[0], p.name);
      }
      for (const p of ps) {
        p.fullTemplateExpr = expr;
      }
    }
  }

  return params;
}

function extractLiterals(text: string): string[] {
  const literals: string[] = [];
  const strRe = /'[^']*'(:\w+)?/g;
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(text)) !== null) {
    literals.push(m[0]);
  }
  const withoutStr = text.replace(/'[^']*'(:\w+)?/g, '');
  const numRe = /\b(\d+(?:\.\d+)?)\b/g;
  while ((m = numRe.exec(withoutStr)) !== null) {
    literals.push(m[0]);
  }
  return literals;
}

function inferParamName(condLine: string, litIndex: number, paramCount: number): string {
  const lower = condLine.toLowerCase();
  if (lower.includes('n_name')) return 'country';
  if (lower.includes('o_totalprice')) return 'min_price';
  if (lower.includes('l_quantity') && lower.includes('between')) {
    return litIndex === 0 ? 'qty_low' : 'qty_high';
  }
  if (lower.includes('c_acctbal')) return 'min_acctbal';
  if (lower.includes('orderdate') && lower.includes('>=')) return 'start_date';
  if (lower.includes('orderdate') && lower.includes('<')) return 'end_date';
  return `p${paramCount + 1}`;
}

function replaceNthLiteral(text: string, n: number, paramName: string): string {
  // 全リテラル(文字列+数値)を出現順に収集
  const lits: { start: number; end: number; value: string }[] = [];

  const strRe = /'[^']*'(:\w+)?/g;
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(text)) !== null) {
    lits.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
  }

  const strRanges = lits.map(l => [l.start, l.end] as [number, number]);
  const numRe = /\b(\d+(?:\.\d+)?)\b/g;
  while ((m = numRe.exec(text)) !== null) {
    const inStr = strRanges.some(([s, e]) => m!.index >= s && m!.index < e);
    if (!inStr) {
      lits.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
    }
  }
  lits.sort((a, b) => a.start - b.start);

  if (n >= lits.length) return text;
  const target = lits[n];
  return text.slice(0, target.start) + paramName + text.slice(target.end);
}

// ────────────────────────────────────────────
// Model Generation
// ────────────────────────────────────────────

function inferModelName(block: WvletBlock): string {
  if (block.tables.length >= 3) {
    const has = (t: string) => block.tables.includes(t);
    if (has('customer') && has('orders') && has('lineitem')) return 'market_query';
    if (has('partsupp') && has('supplier') && has('nation')) return 'supply_base';
  }
  if (block.tables.length >= 2) return `${block.tables[0]}_${block.tables[1]}`;
  return 'common_pattern';
}

function buildModel(
  name: string,
  reference: WvletBlock,
  params: ParamInfo[],
): string {
  const paramDecl = params.length > 0
    ? `(${params.map(p => p.name).join(', ')})`
    : '';

  const bodyLines: string[] = [];
  bodyLines.push(`from ${reference.tables[0]}`);

  // join 句を再構築
  for (let ji = 0; ji < reference.joinConditions.length; ji++) {
    const joinTable = reference.tables[ji + 1] ?? reference.tables[0];
    bodyLines.push(`join ${joinTable} on ${reference.joinConditions[ji]}`);
  }

  // tables がカンマ区切り形式の場合のフォールバック
  if (reference.joinConditions.length === 0 && reference.tables.length > 1) {
    bodyLines[0] = `from ${reference.tables.join(', ')}`;
  }

  // where 句 — パラメータ化済みテンプレートを使用
  const whereConditions: string[] = [];
  const paramsByWhereIdx = new Map<number, ParamInfo[]>();
  for (const p of params) {
    const arr = paramsByWhereIdx.get(p.whereIndex) ?? [];
    arr.push(p);
    paramsByWhereIdx.set(p.whereIndex, arr);
  }
  for (let wi = 0; wi < reference.whereConditions.length; wi++) {
    const line = reference.whereConditions[wi];
    if (line.includes('{SUBQUERY}')) continue;
    const ps = paramsByWhereIdx.get(wi);
    if (ps && ps.length > 0) {
      // パラメータ化されたテンプレートを使用
      whereConditions.push(ps[0].fullTemplateExpr);
    } else {
      whereConditions.push(line);
    }
  }

  if (whereConditions.length > 0) {
    bodyLines.push('where');
    for (let i = 0; i < whereConditions.length; i++) {
      const prefix = i === 0 ? '  ' : '  and ';
      bodyLines.push(`${prefix}${whereConditions[i]}`);
    }
  }

  const body = bodyLines.join('\n');
  return `model ${name}${paramDecl} = {\n  ${body.split('\n').join('\n  ')}\n}`;
}

// ────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────

function findMatchingBrace(text: string, startIdx: number): number {
  // シングルクォート内の { } を無視
  let depth = 0;
  let inStr = false;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "'" && !inStr) { inStr = true; continue; }
    if (text[i] === "'" && inStr) { inStr = false; continue; }
    if (inStr) continue;
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
