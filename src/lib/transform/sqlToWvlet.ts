/**
 * クライアントサイド SQL → Wvlet トランスフォーマー
 *
 * Original ステージは wvlet コンパイラの WvletJS.toWvlet() を使用。
 *   - RewriteExpr + JoinFlattener により括弧ネストを自動除去済み
 * DeDup ステージは wvlet コンパイラの WvletJS.refactorWvlet() を使用。
 *   - PatternExtractor で重複パターンを検出
 *   - RefactoringApplier で model 定義に自動抽出
 *
 *   Stage 1: Original — WvletJS.toWvlet() による FROM-first 構文変換 + JOIN フラット化
 *   Stage 2: DeDup    — WvletJS.refactorWvlet() による重複パターンの model 抽出
 */

import { sqlToWvletViaCompiler, refactorWvletViaCompiler } from '../wvlet';

// ────────────────────────────────────────────
// 公開 API
// ────────────────────────────────────────────

export interface WvletStage {
  name: string;
  wvlet: string;
}

export function sqlToWvletStages(sql: string): WvletStage[] {
  const trimmed = sql.replace(/;\s*$/, '').trim();
  if (!trimmed) return [];

  // コメント行を除去
  const cleaned = trimmed.replace(/--[^\n]*/g, '').trim();
  if (!cleaned) return [];

  try {
    // Stage 1: Original — wvlet コンパイラの WvletJS.toWvlet() を使用
    let flatWvlet = sqlToWvletViaCompiler(cleaned);

    // WvletJS.toWvlet() が失敗した場合は TS フォールバック
    if (!flatWvlet) {
      console.warn('WvletJS.toWvlet failed, falling back to TS transformer');
      flatWvlet = sqlToWvletFlatTS(cleaned);
    }

    // Stage 2: DeDup — WvletJS.refactorWvlet() (ネイティブ自動リファクタ) のみ使用
    let dedupWvlet: string | null = null;

    const nativeRefactored = refactorWvletViaCompiler(cleaned);
    if (nativeRefactored) {
      const cleanNative = cleanupWvlet(nativeRefactored);
      const cleanFlat = cleanupWvlet(flatWvlet);
      if (cleanNative !== cleanFlat) {
        dedupWvlet = nativeRefactored;
      }
    }

    // ネイティブが同一結果ならフラット版をそのまま使用
    if (!dedupWvlet) {
      dedupWvlet = flatWvlet;
    }

    const finalWvlet = cleanupWvlet(dedupWvlet);
    const cleanedFlat = cleanupWvlet(flatWvlet);

    // DeDup が Original と同一なら Original のみ返す
    const stages: WvletStage[] = [
      { name: 'Original', wvlet: cleanedFlat },
    ];
    if (finalWvlet !== cleanedFlat) {
      stages.push({ name: 'DeDup', wvlet: finalWvlet });
    }

    return stages;
  } catch (e) {
    console.warn('sqlToWvlet transform failed:', e);
    return [
      { name: 'Original', wvlet: basicSqlToWvlet(trimmed) },
    ];
  }
}

/**
 * 単一ステージの簡易変換（最終 Wvlet のみ）
 */
export function sqlToWvlet(sql: string): string {
  const stages = sqlToWvletStages(sql);
  if (stages.length === 0) return '';
  return stages[stages.length - 1].wvlet;
}

// ────────────────────────────────────────────
// Stage 1 TS フォールバック: Flatten (SQL → FROM-first Wvlet)
// WvletJS.toWvlet() が失敗した場合のみ使用
// ────────────────────────────────────────────

function sqlToWvletFlatTS(sql: string): string {
  const { ctes, body } = extractCTEs(sql);
  let wvlet = convertSelectBlock(body);

  if (ctes.length > 0) {
    const cteDefs = ctes.map(cte => {
      const cteWvlet = convertSelectBlock(cte.body);
      return `let ${cte.name} =\n${indent(cteWvlet, 2)}`;
    });
    wvlet = cteDefs.join('\n\n') + '\n\n' + wvlet;
  }

  return wvlet;
}

/** SELECT文ブロックを Wvlet 構文に再帰的に変換 */
function convertSelectBlock(sql: string): string {
  const trimSql = sql.trim();
  const upper = trimSql.toUpperCase();
  const lines: string[] = [];

  // FROM 句
  const fromInfo = extractClause(trimSql, upper, 'FROM', ['WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT']);
  if (fromInfo) {
    const fromWvlet = convertFromClause(fromInfo.content);
    lines.push(...fromWvlet.split('\n'));
  }

  // WHERE 句
  const whereInfo = extractClause(trimSql, upper, 'WHERE', ['GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION']);
  if (whereInfo) {
    lines.push(`where ${convertConditions(whereInfo.content)}`);
  }

  // GROUP BY 句
  const groupInfo = extractClause(trimSql, upper, 'GROUP BY', ['HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION']);
  if (groupInfo) {
    lines.push(`group by ${groupInfo.content.trim().toLowerCase()}`);
  }

  // SELECT 句 (集約/カラム選択)
  const selectInfo = extractClause(trimSql, upper, 'SELECT', ['FROM']);
  if (selectInfo) {
    const selContent = selectInfo.content.replace(/^\s*DISTINCT\s+/i, '');
    if (selContent.trim() !== '*') {
      const { aggParts, selectParts } = splitAggregations(selContent);
      if (aggParts.length > 0) {
        lines.push('agg');
        for (const agg of aggParts) {
          lines.push(`  ${convertExpression(agg).trim()},`);
        }
        const lastIdx = lines.length - 1;
        lines[lastIdx] = lines[lastIdx].replace(/,\s*$/, '');
      }
      if (selectParts.length > 0) {
        lines.push(`select`);
        for (const sel of selectParts) {
          lines.push(`  ${convertExpression(sel).trim()},`);
        }
        const lastIdx = lines.length - 1;
        lines[lastIdx] = lines[lastIdx].replace(/,\s*$/, '');
      }
    }
  }

  // HAVING 句 → where に変換（サブクエリを再帰的に変換）
  const havingInfo = extractClause(trimSql, upper, 'HAVING', ['ORDER BY', 'LIMIT', 'OFFSET', 'UNION']);
  if (havingInfo) {
    const havCond = convertHavingContent(havingInfo.content);
    lines.push(`where ${havCond}`);
  }

  // ORDER BY 句
  const orderInfo = extractClause(trimSql, upper, 'ORDER BY', ['LIMIT', 'OFFSET', 'UNION']);
  if (orderInfo) {
    lines.push(`order by ${orderInfo.content.trim().toLowerCase()}`);
  }

  // LIMIT 句
  const limitInfo = extractClause(trimSql, upper, 'LIMIT', ['OFFSET', 'UNION']);
  if (limitInfo) {
    lines.push(`limit ${limitInfo.content.trim()}`);
  }

  return lines.join('\n');
}

/**
 * HAVING句の内容を再帰的に変換
 * サブクエリ (SELECT ...) を { wvlet } に変換する
 */
function convertHavingContent(havingContent: string): string {
  // まずサブクエリを再帰変換
  const withSubqueries = convertSubqueriesInText(havingContent);
  // 残りの式を変換
  return convertExpression(withSubqueries);
}

/**
 * テキスト内の全 (SELECT ...) サブクエリを { wvlet } に再帰変換
 */
function convertSubqueriesInText(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '(') {
      const end = findMatchingParen(text, i);
      if (end < 0) {
        result += text[i];
        i++;
        continue;
      }

      const inner = text.slice(i + 1, end).trim();
      const upperInner = inner.toUpperCase();

      if (upperInner.startsWith('SELECT')) {
        // サブクエリ → 再帰的に Wvlet に変換して { } で包む
        const wvlet = convertSelectBlock(inner);
        result += '{\n' + indent(wvlet, 2) + '\n}';
        i = end + 1;
        // 直後のエイリアス (AS name) をスキップ
        const aliasMatch = text.slice(i).match(/^\s+(?:AS\s+)?(\w+)/i);
        if (aliasMatch) {
          i += aliasMatch[0].length;
        }
      } else {
        // サブクエリでない括弧はそのまま
        result += text.slice(i, end + 1);
        i = end + 1;
      }
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
}

/** FROM句をフラット化して変換（サブクエリ対応） */
function convertFromClause(fromContent: string): string {
  const trimmed = fromContent.trim();

  // FROM (SELECT ...) AS alias のケース（サブクエリ from）
  if (trimmed.startsWith('(')) {
    const end = findMatchingParen(trimmed, 0);
    if (end >= 0) {
      const inner = trimmed.slice(1, end).trim();
      const upperInner = inner.toUpperCase();
      if (upperInner.startsWith('SELECT')) {
        // FROM (SELECT ...) AS alias → from { wvlet }
        const wvlet = convertSelectBlock(inner);
        let result = `from {\n${indent(wvlet, 2)}\n}`;
        // エイリアスがあれば付ける
        const after = trimmed.slice(end + 1).trim();
        const aliasMatch = after.match(/^(?:AS\s+)?(\w+)/i);
        if (aliasMatch) {
          result = `from {\n${indent(wvlet, 2)}\n} as ${aliasMatch[1].toLowerCase()}`;
        }
        return result;
      }
    }
  }

  // 括弧で囲まれたJOINを除去してフラット化
  let content = removeBracedJoins(trimmed);

  // テーブル参照とJOINに分割
  const lines = parseFromJoins(content);

  if (lines.length === 0) {
    return formatFromClauseSimple(fromContent);
  }

  return lines.join('\n');
}

/** FROM句のテーブル参照とJOIN群をパースしてWvlet行群に変換 */
function parseFromJoins(content: string): string[] {
  const joinPattern = /\b((?:LEFT|RIGHT|FULL|CROSS|INNER|OUTER|LEFT\s+OUTER|RIGHT\s+OUTER|FULL\s+OUTER)\s+)?JOIN\b/gi;
  const parts = content.split(joinPattern);
  const lines: string[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i]?.trim();
    if (!part) { i++; continue; }

    const upperPart = part.toUpperCase().trim();

    if (upperPart.match(/^(LEFT|RIGHT|FULL|CROSS|INNER|OUTER|LEFT\s+OUTER|RIGHT\s+OUTER|FULL\s+OUTER)$/i)) {
      const joinType = part.toLowerCase();
      i++;
      if (parts[i]?.toUpperCase?.().trim() === 'JOIN') i++;
      const joinBody = parts[i]?.trim() ?? '';
      lines.push(convertJoinPart(joinBody, joinType));
      i++;
      continue;
    }

    if (upperPart === 'JOIN') {
      i++;
      const joinBody = parts[i]?.trim() ?? '';
      lines.push(convertJoinPart(joinBody, 'join'));
      i++;
      continue;
    }

    if (!upperPart.match(/^(LEFT|RIGHT|FULL|CROSS|INNER|OUTER|JOIN)$/i)) {
      const tables = part.split(',').map(t => t.trim()).filter(t => t);
      for (let ti = 0; ti < tables.length; ti++) {
        const table = tables[ti];
        if (ti === 0 && lines.length === 0) {
          lines.push(`from ${convertTableRef(table)}`);
        } else {
          lines.push(`join ${convertTableRef(table)}`);
        }
      }
    }
    i++;
  }

  return lines;
}

/** 括弧で囲まれたJOIN構造を平坦化する（サブクエリ SELECT は保持） */
function removeBracedJoins(text: string): string {
  let result = text;
  let changed = true;
  let passes = 0;
  while (changed && passes < 20) {
    changed = false;
    passes++;
    result = result.replace(/\(([^()]*)\)/g, (match, inner: string) => {
      const upperInner = inner.toUpperCase().trimStart();
      // サブクエリ(SELECT...)は保持
      if (upperInner.startsWith('SELECT')) return match;
      // JOIN/テーブル参照を含む括弧は除去
      if (upperInner.includes('JOIN') || /^\s*\w+/i.test(inner.trim())) {
        changed = true;
        return ` ${inner.trim()} `;
      }
      return match;
    });
  }
  return result;
}

function convertJoinPart(body: string, joinType: string): string {
  const onMatch = body.match(/\bON\b\s+(.*)/is);
  const tablePart = onMatch ? body.slice(0, onMatch.index).trim() : body.trim();
  const onCond = onMatch ? onMatch[1].trim() : '';

  const table = convertTableRef(tablePart);
  const jType = joinType.replace(/\bjoin\b/i, '').trim();
  const prefix = jType ? `${jType} join` : 'join';

  if (onCond) {
    return `${prefix} ${table} on ${onCond.toLowerCase()}`;
  }
  return `${prefix} ${table}`;
}

function convertTableRef(ref: string): string {
  const trimRef = ref.trim();
  // (SELECT ...) AS alias → サブクエリ
  if (trimRef.startsWith('(')) {
    const end = findMatchingParen(trimRef, 0);
    if (end >= 0) {
      const inner = trimRef.slice(1, end).trim();
      if (inner.toUpperCase().startsWith('SELECT')) {
        const wvlet = convertSelectBlock(inner);
        const after = trimRef.slice(end + 1).trim();
        const aliasMatch = after.match(/^(?:AS\s+)?(\w+)/i);
        const alias = aliasMatch ? ` as ${aliasMatch[1].toLowerCase()}` : '';
        return `{\n${indent(wvlet, 2)}\n}${alias}`;
      }
    }
  }
  // table AS alias / table alias
  const asMatch = trimRef.match(/^(\w+)\s+(?:AS\s+)?(\w+)$/i);
  if (asMatch) {
    return `${asMatch[1].toLowerCase()} as ${asMatch[2].toLowerCase()}`;
  }
  return trimRef.toLowerCase().trim();
}

/** 簡易FROM変換のフォールバック */
function formatFromClauseSimple(fromContent: string): string {
  const lines: string[] = [];
  const joinRe = /\b((?:LEFT|RIGHT|FULL|CROSS|INNER|LEFT\s+OUTER|RIGHT\s+OUTER|FULL\s+OUTER)\s+)?JOIN\b/gi;
  const matches = [...fromContent.matchAll(joinRe)];

  if (matches.length === 0) {
    const tables = fromContent.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tables.length > 0) {
      lines.push(`from ${tables[0]}`);
      for (let i = 1; i < tables.length; i++) {
        lines.push(`join ${tables[i]}`);
      }
    }
    return lines.join('\n');
  }

  const firstTable = fromContent.slice(0, matches[0].index).trim();
  lines.push(`from ${removeBracedJoins(firstTable).trim().toLowerCase()}`);

  for (let mi = 0; mi < matches.length; mi++) {
    const m = matches[mi];
    const nextIdx = mi + 1 < matches.length ? matches[mi + 1].index! : fromContent.length;
    const joinBody = fromContent.slice(m.index! + m[0].length, nextIdx).trim();
    const joinType = (m[1] || '').trim().toLowerCase();
    const prefix = joinType ? `${joinType} join` : 'join';

    const onMatch = joinBody.match(/\bON\b\s+(.*)/is);
    const table = onMatch ? joinBody.slice(0, onMatch.index).trim() : joinBody;
    const cond = onMatch ? onMatch[1].trim() : '';

    const cleanTable = removeBracedJoins(table).trim().toLowerCase();
    if (cond) {
      lines.push(`${prefix} ${cleanTable} on ${cond.toLowerCase()}`);
    } else {
      lines.push(`${prefix} ${cleanTable}`);
    }
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────
// Stage 2: Deduplicate (Wvlet テキスト上で重複パターン抽出)
// ────────────────────────────────────────────

/**
 * フラット化済み Wvlet から重複する from...join...where ブロックを検出し、
 * model 定義に抽出して再利用する（TS 独自実装 — wvlet コンパイラに未実装）。
 * Wvlet model 構文: model name(params) = { body }
 */
function deduplicateWvlet(flatWvlet: string): string {
  // Wvlet テキストから全 from...join... ブロックを抽出
  const blocks = extractWvletFromBlocks(flatWvlet);

  if (blocks.length < 2) return flatWvlet;

  // 構造的に同じブロックのグループを探す（テーブル名+JOIN条件が同じ）
  const groups = groupByStructure(blocks);

  // 2つ以上の出現があるグループを探す
  let bestGroup: WvletFromBlock[] | null = null;
  for (const group of groups.values()) {
    if (group.length >= 2) {
      if (!bestGroup || group.length > bestGroup.length) {
        bestGroup = group;
      }
    }
  }

  if (!bestGroup || bestGroup.length < 2) return flatWvlet;

  // 共通部分とパラメータ化部分を分離して model 定義を構築
  const { modelName, modelDef, parameterized } = buildModelDefinition(bestGroup);
  if (!modelDef) return flatWvlet;

  // 元の Wvlet テキスト内の各出現箇所を from <modelName>(...) に置換
  // 位置順（後ろから前へ）で置換してインデックスのずれを防ぐ
  let result = flatWvlet;
  const sortedByPos = [...parameterized].sort((a, b) => b.startIdx - a.startIdx);

  for (const { startIdx, endIdx, replacement, indent: blockIndent } of sortedByPos) {
    result = result.slice(0, startIdx) + blockIndent + replacement + result.slice(endIdx);
  }

  return `${modelDef}\n\n${result}`;
}

interface WvletFromBlock {
  /** ブロック全体のテキスト（元テキストからの正確な抜粋、インデント含む） */
  fullText: string;
  /** テーブル名リスト */
  tables: string[];
  /** JOIN条件リスト (on xxx = yyy) */
  joinConditions: string[];
  /** WHERE条件リスト */
  whereConditions: string[];
  /** Wvlet テキスト中の開始位置 */
  startIdx: number;
  /** Wvlet テキスト中の終了位置（ブロック末尾の\n位置またはEOF） */
  endIdx: number;
  /** 先頭行のインデント文字列 */
  baseIndent: string;
}

/**
 * Wvlet テキストから from...join...where ブロックを全て抽出する
 * ネストされた { } 内のブロックも再帰的に探索する
 */
function extractWvletFromBlocks(wvlet: string): WvletFromBlock[] {
  const blocks: WvletFromBlock[] = [];
  // "from <table>" で始まる行を探す
  const fromRe = /^(\s*)from\s+(\w+)\s*$/gm;
  let match;

  while ((match = fromRe.exec(wvlet)) !== null) {
    const startIdx = match.index;
    const baseIndentStr = match[1];
    const baseIndentLen = baseIndentStr.length;
    const firstTable = match[2];

    const tables: string[] = [firstTable];
    const joinConditions: string[] = [];
    const whereConditions: string[] = [];

    // blockEnd: 最後に解析した行の末尾位置（\nの位置、またはEOF）
    let blockEnd = startIdx + match[0].length;
    let pos = blockEnd;
    if (pos < wvlet.length && wvlet[pos] === '\n') pos++;

    // 続く join/where 行を読み取る
    let inWhere = false;
    while (pos < wvlet.length) {
      const lineEnd = wvlet.indexOf('\n', pos);
      const lineEndPos = lineEnd >= 0 ? lineEnd : wvlet.length;
      const line = wvlet.slice(pos, lineEndPos);
      const trimLine = line.trim();
      const lineIndent = line.length - line.trimStart().length;

      // 同じインデントレベル以上の関連行のみ
      if (trimLine === '' || lineIndent < baseIndentLen) break;

      if (trimLine.startsWith('join ')) {
        const joinMatch = trimLine.match(/^join\s+(\w+)(?:\s+on\s+(.*))?$/i);
        if (joinMatch) {
          tables.push(joinMatch[1]);
          if (joinMatch[2]) joinConditions.push(joinMatch[2].trim());
        }
        blockEnd = lineEndPos;
        inWhere = false;
      } else if (lineIndent === baseIndentLen && (trimLine === 'where' || trimLine.startsWith('where '))) {
        // "where" 単独行 or "where <cond>" — コンパイラは where を独立行にする場合がある
        const afterWhere = trimLine.slice(5).trim();
        if (afterWhere) whereConditions.push(afterWhere);
        blockEnd = lineEndPos;
        inWhere = true;
      } else if (inWhere && (lineIndent > baseIndentLen || trimLine.startsWith('and '))) {
        // where 句の継続行（深いインデント or "and" 開始）
        let cond = trimLine;
        if (cond.startsWith('and ')) cond = cond.slice(4);
        if (cond.trim()) whereConditions.push(cond.trim());
        blockEnd = lineEndPos;
      } else {
        break;
      }

      pos = lineEnd >= 0 ? lineEnd + 1 : wvlet.length;
    }

    // 元テキストからの正確なスライス（インデント含む）
    const fullText = wvlet.slice(startIdx, blockEnd);

    // テーブルが2つ以上（JOINあり）のブロックのみ対象
    if (tables.length >= 2 && joinConditions.length >= 1) {
      blocks.push({
        fullText,
        tables,
        joinConditions,
        whereConditions,
        startIdx,
        endIdx: blockEnd,
        baseIndent: baseIndentStr,
      });
    }
  }

  return blocks;
}

/** ブロックを構造的類似性でグループ化 */
function groupByStructure(blocks: WvletFromBlock[]): Map<string, WvletFromBlock[]> {
  const groups = new Map<string, WvletFromBlock[]>();
  for (const block of blocks) {
    // テーブル名 + JOIN条件でキーを作成（WHERE条件は無視）
    const key = [...block.tables].sort().join(',') + '|' + [...block.joinConditions].sort().join(',');
    const existing = groups.get(key) ?? [];
    existing.push(block);
    groups.set(key, existing);
  }
  return groups;
}

interface ParameterizedBlock {
  original: string;     // 元テキスト（インデント含む）
  replacement: string;  // from letName(params...)
  startIdx: number;     // 元テキスト中の開始位置
  endIdx: number;       // 元テキスト中の終了位置
  indent: string;       // ブロックのインデント
}

/**
 * 重複ブロック群から model 定義と、各出現の置換テキストを生成
 * Wvlet 構文: model name(params) = { body }
 */
function buildModelDefinition(blocks: WvletFromBlock[]): {
  modelName: string;
  modelDef: string;
  parameterized: ParameterizedBlock[];
} {
  if (blocks.length < 2) return { modelName: '', modelDef: '', parameterized: [] };

  // 共通 WHERE 条件と異なる条件を分離
  const allCondSets = blocks.map(b => b.whereConditions);
  const commonConds: string[] = [];
  const varyingCondSets: string[][] = [];

  if (allCondSets[0]) {
    for (const cond of allCondSets[0]) {
      // 全ブロックで完全一致する条件のみ共通と判定（値が異なる場合はパラメータ化対象）
      const isExactlyCommon = allCondSets.every(condSet =>
        condSet.some(c => c === cond)
      );
      if (isExactlyCommon) {
        commonConds.push(cond);
      }
    }
  }

  for (const condSet of allCondSets) {
    const varying = condSet.filter(c => !commonConds.includes(c));
    varyingCondSets.push(varying);
  }

  // 異なる条件から日付パラメータを抽出
  const params = extractDateParameters(varyingCondSets);

  // model 名を推測
  const modelName = guessModelName(blocks[0], commonConds);

  // model 定義の本体（共通FROM+JOIN+WHERE）を構築
  const bodyLines: string[] = [];
  bodyLines.push(`from ${blocks[0].tables[0]}`);
  for (let ji = 0; ji < blocks[0].joinConditions.length; ji++) {
    const table = blocks[0].tables[ji + 1] || '';
    bodyLines.push(`join ${table} on ${blocks[0].joinConditions[ji]}`);
  }

  // 共通 WHERE 条件
  if (commonConds.length > 0 || params.paramNames.length > 0) {
    const whereLines: string[] = [];
    for (const cond of commonConds) {
      whereLines.push(cond);
    }
    // パラメータ化された条件を追加
    for (const paramCond of params.templateConditions) {
      whereLines.push(paramCond);
    }
    if (whereLines.length > 0) {
      bodyLines.push(`where ${whereLines[0]}`);
      for (let wi = 1; wi < whereLines.length; wi++) {
        bodyLines.push(`  and ${whereLines[wi]}`);
      }
    }
  }

  // model 定義（Wvlet 構文: model name(params) = { body }）
  const paramDecl = params.paramNames.length > 0
    ? `(${params.paramNames.join(', ')})`
    : '';
  const modelDef = `model ${modelName}${paramDecl} = {\n${indent(bodyLines.join('\n'), 2)}\n}`;

  // 各出現の置換テキスト
  const parameterized: ParameterizedBlock[] = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const paramArgs = params.paramValues[bi] || [];
    // paramValues には既にクォートと型サフィックスが含まれる（例: '1996-01-01':date）
    const argStr = paramArgs.length > 0
      ? `(${paramArgs.join(', ')})`
      : '';
    parameterized.push({
      original: block.fullText,
      replacement: `from ${modelName}${argStr}`,
      startIdx: block.startIdx,
      endIdx: block.endIdx,
      indent: block.baseIndent,
    });
  }

  return { modelName, modelDef, parameterized };
}

/** 条件の正規化（日付リテラルと数値を ? に置換） */
function normalizeCond(cond: string): string {
  return cond.replace(/'[^']*'/g, '?').replace(/\d+/g, '?').trim();
}

/**
 * 異なる WHERE 条件セットから日付パラメータを抽出する
 * 例: ["o_orderdate >= '1996-01-01'", "o_orderdate < '1997-01-01'"]
 *   → params: start_date, end_date
 */
function extractDateParameters(varyingCondSets: string[][]): {
  paramNames: string[];
  paramValues: string[][];
  templateConditions: string[];
} {
  if (varyingCondSets.length === 0 || varyingCondSets[0].length === 0) {
    return { paramNames: [], paramValues: [], templateConditions: [] };
  }

  const paramNames: string[] = [];
  const paramValues: string[][] = varyingCondSets.map(() => []);
  const templateConditions: string[] = [];

  // 各ブロックの異なる条件を比較してパラメータ化
  const firstSet = varyingCondSets[0];
  for (let ci = 0; ci < firstSet.length; ci++) {
    const cond = firstSet[ci];
    // 日付や文字列リテラルを含む条件を検出
    // 日付や文字列リテラルを含む条件を検出（:type サフィックス対応）
    const literalMatch = cond.match(/([\w_.]+\s*(?:>=|<=|>|<|=|!=)\s*)'([^']+)'(:\w+)?/);
    if (literalMatch) {
      // パラメータ名を推測
      const operator = literalMatch[1].trim();
      let paramName: string;
      if (operator.includes('>=')) {
        paramName = 'start_date';
      } else if (operator.includes('<') && !operator.includes('<=')) {
        paramName = 'end_date';
      } else {
        paramName = `param_${ci + 1}`;
      }

      // 重複を避ける
      let finalName = paramName;
      let suffix = 2;
      while (paramNames.includes(finalName)) {
        finalName = `${paramName}_${suffix}`;
        suffix++;
      }
      paramNames.push(finalName);

      // テンプレート条件（リテラルと型サフィックスをパラメータ名に置換）
      templateConditions.push(cond.replace(/'[^']+'(:\w+)?/g, finalName));

      // 各ブロックの実際の値（型サフィックス付き）
      for (let bi = 0; bi < varyingCondSets.length; bi++) {
        const blockCond = varyingCondSets[bi][ci];
        if (blockCond) {
          const valMatch = blockCond.match(/'([^']+)'(:\w+)?/);
          paramValues[bi].push(valMatch ? `'${valMatch[1]}'${valMatch[2] || ''}` : '');
        }
      }
    } else {
      // リテラルがない差分条件はそのままテンプレートに
      templateConditions.push(cond);
    }
  }

  return { paramNames, paramValues, templateConditions };
}

/** model 名を推測 */
function guessModelName(block: WvletFromBlock, commonConds: string[]): string {
  // WHERE条件に国名があればそれを使う
  for (const cond of commonConds) {
    const nameMatch = cond.match(/n_name\s*=\s*'(\w+)'/i);
    if (nameMatch) return `${nameMatch[1].toLowerCase()}_orders`;
  }
  // テーブル名から推測
  const tables = block.tables;
  if (tables.length <= 2) return tables.join('_');
  return `common_${tables[0]}`;
}

// ────────────────────────────────────────────
// WvletGenerator 出力の正規化
// ────────────────────────────────────────────

/**
 * WvletGenerator の出力フォーマットを正規化する。
 *
 * 1. インライン JOIN を分割:
 *    "from customer join orders on ..." → "from customer\njoin orders on ..."
 *
 * 2. 継続 on 行をマージ:
 *    "join lineitem\n  on o_orderkey = ..." → "join lineitem on o_orderkey = ..."
 */
function normalizeWvletJoins(wvlet: string): string {
  let result = wvlet;

  // 1. "from <table> join ..." をインデントを保持しつつ分割
  result = result.replace(/^(\s*)(from\s+\w+)[ \t]+(join\s+)/gm, '$1$2\n$1$3');

  // 2. "join <table>\n  on <cond>" を1行にマージ
  result = result.replace(/^(\s*)(join\s+\w+)[ \t]*\n[ \t]+on[ \t]+/gm, '$1$2 on ');

  return result;
}

// ────────────────────────────────────────────
// Stage 3: Final (クリーンアップ)
// ────────────────────────────────────────────

function cleanupWvlet(wvlet: string): string {
  let result = wvlet;
  // 連続空行を1つに
  result = result.replace(/\n{3,}/g, '\n\n');
  // 末尾スペース除去
  result = result.split('\n').map(l => l.trimEnd()).join('\n');
  // 末尾改行
  result = result.trim();
  return result;
}

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────

interface CTE {
  name: string;
  body: string;
}

function extractCTEs(sql: string): { ctes: CTE[]; body: string } {
  const ctes: CTE[] = [];
  let remaining = sql.trim();

  const withMatch = remaining.match(/^\s*WITH\s+/i);
  if (!withMatch) return { ctes, body: remaining };

  remaining = remaining.slice(withMatch[0].length);

  while (true) {
    const cteMatch = remaining.match(/^(\w+)\s+AS\s*\(/i);
    if (!cteMatch) break;

    const cteName = cteMatch[1].toLowerCase();
    const afterAs = remaining.slice(cteMatch[0].length - 1);

    const endIdx = findMatchingParen(afterAs, 0);
    if (endIdx < 0) break;

    const cteBody = afterAs.slice(1, endIdx).trim();
    ctes.push({ name: cteName, body: cteBody });

    remaining = afterAs.slice(endIdx + 1).trim();
    if (remaining.startsWith(',')) {
      remaining = remaining.slice(1).trim();
    }
  }

  return { ctes, body: remaining };
}

function findMatchingParen(text: string, startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface ClauseInfo {
  content: string;
  startIdx: number;
  endIdx: number;
}

function extractClause(sql: string, upper: string, keyword: string, terminators: string[]): ClauseInfo | null {
  const pos = findTopLevelKeyword(upper, keyword);
  if (pos < 0) return null;

  const afterKeyword = pos + keyword.length;

  let endIdx = sql.length;
  for (const term of terminators) {
    const termPos = findTopLevelKeyword(upper, term, afterKeyword);
    if (termPos >= 0 && termPos < endIdx) {
      endIdx = termPos;
    }
  }

  return {
    content: sql.slice(afterKeyword, endIdx).trim(),
    startIdx: pos,
    endIdx,
  };
}

/** トップレベルのキーワード位置を探す（括弧/サブクエリ内を無視） */
function findTopLevelKeyword(upper: string, keyword: string, startFrom = 0): number {
  let depth = 0;
  const kw = keyword.toUpperCase();
  for (let i = startFrom; i <= upper.length - kw.length; i++) {
    if (upper[i] === '(') { depth++; continue; }
    if (upper[i] === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0 && upper.slice(i, i + kw.length) === kw) {
      const before = i > 0 ? upper[i - 1] : ' ';
      const after = i + kw.length < upper.length ? upper[i + kw.length] : ' ';
      if (/\W/.test(before) && /\W/.test(after)) {
        return i;
      }
    }
  }
  return -1;
}

/** WHERE/条件テキストを Wvlet 形式に変換 */
function convertConditions(text: string): string {
  return text
    .replace(/\bDATE\s+'/gi, "'")
    .replace(/\bINTERVAL\s+'(\d+)'\s+(\w+)/gi, "'$1 $2'")
    .replace(/\s+/g, ' ')  // 空白を正規化
    .trim()
    .toLowerCase()
    .replace(/\band\b/g, '\n  and')
    .replace(/\bor\b/g, '\n  or');
}

/** SQL式をWvlet形式に変換（DATE リテラル除去など） */
function convertExpression(text: string): string {
  return text
    .replace(/\bDATE\s+'/gi, "'")
    .trim()
    .toLowerCase();
}

function splitAggregations(selectContent: string): { aggParts: string[]; selectParts: string[] } {
  const items = splitByTopLevelComma(selectContent);
  const aggParts: string[] = [];
  const selectParts: string[] = [];

  for (const item of items) {
    const upper = item.trim().toUpperCase();
    if (upper.match(/^\s*(SUM|AVG|COUNT|MIN|MAX|GROUP_CONCAT)\s*\(/i)) {
      aggParts.push(item.trim());
    } else if (upper.includes('OVER')) {
      selectParts.push(item.trim());
    } else {
      selectParts.push(item.trim());
    }
  }

  return { aggParts, selectParts };
}

function splitByTopLevelComma(text: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => pad + l).join('\n');
}

/** 超簡易フォールバック変換 */
function basicSqlToWvlet(sql: string): string {
  return sql
    .replace(/\bSELECT\b/gi, 'select')
    .replace(/\bFROM\b/gi, 'from')
    .replace(/\bWHERE\b/gi, 'where')
    .replace(/\bGROUP BY\b/gi, 'group by')
    .replace(/\bORDER BY\b/gi, 'order by')
    .replace(/\bJOIN\b/gi, 'join')
    .replace(/\bON\b/gi, 'on')
    .replace(/\bHAVING\b/gi, 'having')
    .replace(/\bLIMIT\b/gi, 'limit')
    .replace(/\bAS\b/gi, 'as')
    .trim();
}
