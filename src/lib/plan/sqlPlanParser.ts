/**
 * SQL → 論理プラン (PlanNode) パーサー
 *
 * SQL テキストを解析し、関係代数ベースの論理プランツリーを生成する。
 * 簡易パーサーであり、完全な SQL パーサーではないが、
 * デモ用途で主要な構造（SELECT/FROM/JOIN/WHERE/GROUP BY/ORDER BY/LIMIT/サブクエリ）を抽出する。
 */

import type { PlanNode, PlanNodeType } from '../../types/plan';

let nodeCounter = 0;

function makeId(prefix: string): string {
  return `${prefix}-${++nodeCounter}`;
}

function makeNode(
  type: PlanNodeType,
  label: string,
  children: PlanNode[] = [],
  metadata?: PlanNode['metadata'],
): PlanNode {
  return { id: makeId(type.toLowerCase()), type, label, children, metadata };
}

/** 括弧のネストを考慮してトップレベルのキーワード位置を検索 */
function findTopLevelKeyword(sql: string, keyword: string): number {
  const upper = sql.toUpperCase();
  const kw = keyword.toUpperCase();
  let depth = 0;
  for (let i = 0; i <= upper.length - kw.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && upper.substring(i, i + kw.length) === kw) {
      // キーワード境界チェック
      const before = i === 0 || /[\s,;(]/.test(sql[i - 1]);
      const after = i + kw.length >= sql.length || /[\s,;)]/.test(sql[i + kw.length]);
      if (before && after) return i;
    }
  }
  return -1;
}

/** 括弧のネストを考慮してカンマで分割 */
function splitTopLevel(sql: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  const upper = sql.toUpperCase();
  const delim = delimiter.toUpperCase();

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (depth === 0 && upper.substring(i, i + delim.length) === delim) {
      const before = i === 0 || /[\s,]/.test(sql[i - 1]);
      const after = i + delim.length >= sql.length || /[\s,]/.test(sql[i + delim.length]);
      if (delimiter === ',' || (before && after)) {
        parts.push(current.trim());
        current = '';
        i += delim.length - 1;
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** サブクエリ（括弧内の SELECT）を検出してプランノードに変換 */
function extractSubqueryScans(expr: string): { cleaned: string; nodes: PlanNode[] } {
  const nodes: PlanNode[] = [];
  let result = expr;

  // 括弧内のSELECTを検出
  const re = /\(\s*SELECT\s/gi;
  let match: RegExpExecArray | null;
  const replacements: { start: number; end: number; alias: string; node: PlanNode }[] = [];

  while ((match = re.exec(expr)) !== null) {
    const start = match.index;
    let depth = 0;
    let end = start;
    for (let i = start; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    const subSql = expr.substring(start + 1, end - 1).trim();
    const subPlan = parseSqlToPlanInternal(subSql);

    // alias 検出
    let alias = 'subquery';
    const afterSub = expr.substring(end).trim();
    const aliasMatch = afterSub.match(/^(?:AS\s+)?(\w+)/i);
    if (aliasMatch) alias = aliasMatch[1];

    const aliasNode = makeNode('SubqueryAlias', alias, [subPlan], { tableName: alias });
    replacements.push({ start, end, alias, node: aliasNode });
  }

  // 後ろから置換
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    nodes.unshift(r.node);
    result = result.substring(0, r.start) + `__SUBQ_${r.alias}__` + result.substring(r.end);
  }

  return { cleaned: result, nodes };
}

/** テーブル参照を Scan ノードに変換 */
function parseTableRef(ref: string): PlanNode {
  const trimmed = ref.trim();
  // サブクエリプレースホルダ
  if (trimmed.startsWith('__SUBQ_')) return makeNode('Scan', trimmed);

  const parts = trimmed.split(/\s+(?:AS\s+)?/i).filter(Boolean);
  const tableName = parts[0].replace(/[`"[\]]/g, '');
  const alias = parts[1] || tableName;
  return makeNode('Scan', alias, [], { tableName, columns: [] });
}

/** WITH CTE を解析 */
function parseCTEs(sql: string): { cteNodes: PlanNode[]; mainSql: string } {
  const trimmed = sql.trim();
  if (!/^WITH\s/i.test(trimmed)) return { cteNodes: [], mainSql: trimmed };

  // WITH と最後の SELECT を分離
  let depth = 0;
  let mainStart = -1;
  const upper = trimmed.toUpperCase();

  for (let i = 4; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++;
    else if (trimmed[i] === ')') depth--;
    else if (depth === 0 && upper.substring(i, i + 7) === 'SELECT ') {
      // CTE定義内の SELECT ではなくトップレベルの SELECT かチェック
      const before = trimmed.substring(0, i).trim();
      if (before.endsWith(',') || /\)\s*$/i.test(before) || /^WITH\s/i.test(before)) {
        // まだCTEの一部の可能性 — 最後のトップレベルSELECTを探す
      }
      mainStart = i;
    }
  }

  if (mainStart === -1) return { cteNodes: [], mainSql: trimmed };

  const withPart = trimmed.substring(4, mainStart).trim();
  const mainSql = trimmed.substring(mainStart);

  // CTE をパース: name AS (...)
  const cteNodes: PlanNode[] = [];
  const cteRegex = /(\w+)\s+AS\s*\(/gi;
  let cteMatch: RegExpExecArray | null;
  while ((cteMatch = cteRegex.exec(withPart)) !== null) {
    const cteName = cteMatch[1];
    const parenStart = cteMatch.index + cteMatch[0].length - 1;
    let d = 0;
    let parenEnd = parenStart;
    for (let j = parenStart; j < withPart.length; j++) {
      if (withPart[j] === '(') d++;
      else if (withPart[j] === ')') { d--; if (d === 0) { parenEnd = j; break; } }
    }
    const cteSql = withPart.substring(parenStart + 1, parenEnd).trim();
    const ctePlan = parseSqlToPlanInternal(cteSql);
    cteNodes.push(makeNode('CTE', cteName, [ctePlan], { tableName: cteName }));
  }

  return { cteNodes, mainSql };
}

function parseSqlToPlanInternal(sql: string): PlanNode {
  const trimmed = sql.replace(/;\s*$/, '').trim();
  if (!trimmed) return makeNode('Project', '(empty)');

  // CTE
  const { cteNodes, mainSql } = parseCTEs(trimmed);

  // LIMIT
  const limitPos = findTopLevelKeyword(mainSql, 'LIMIT');
  let afterLimit = mainSql;
  let limitNode: PlanNode | null = null;
  if (limitPos >= 0) {
    const limitExpr = mainSql.substring(limitPos + 5).trim().split(/\s/)[0];
    afterLimit = mainSql.substring(0, limitPos).trim();
    limitNode = makeNode('Limit', `LIMIT ${limitExpr}`);
  }

  // ORDER BY
  const orderPos = findTopLevelKeyword(afterLimit, 'ORDER BY');
  let afterOrder = afterLimit;
  let sortNode: PlanNode | null = null;
  if (orderPos >= 0) {
    const orderExpr = afterLimit.substring(orderPos + 8).trim();
    afterOrder = afterLimit.substring(0, orderPos).trim();
    const cols = orderExpr.split(',').map(c => c.trim().split(/\s+/)[0]).slice(0, 3);
    sortNode = makeNode('Sort', cols.join(', '));
  }

  // HAVING
  const havingPos = findTopLevelKeyword(afterOrder, 'HAVING');
  let afterHaving = afterOrder;
  let havingNode: PlanNode | null = null;
  if (havingPos >= 0) {
    const havingExpr = afterOrder.substring(havingPos + 6).trim();
    afterHaving = afterOrder.substring(0, havingPos).trim();
    havingNode = makeNode('Filter', truncateLabel(havingExpr), [], { predicate: havingExpr });
  }

  // GROUP BY
  const groupPos = findTopLevelKeyword(afterHaving, 'GROUP BY');
  let afterGroup = afterHaving;
  let aggNode: PlanNode | null = null;
  if (groupPos >= 0) {
    const groupExpr = afterHaving.substring(groupPos + 8).trim();
    afterGroup = afterHaving.substring(0, groupPos).trim();
    const cols = groupExpr.split(',').map(c => c.trim()).slice(0, 3);
    aggNode = makeNode('Aggregate', `GROUP BY ${cols.join(', ')}`);
  }

  // WHERE
  const wherePos = findTopLevelKeyword(afterGroup, 'WHERE');
  let afterWhere = afterGroup;
  let filterNode: PlanNode | null = null;
  if (wherePos >= 0) {
    const whereExpr = afterGroup.substring(wherePos + 5).trim();
    afterWhere = afterGroup.substring(0, wherePos).trim();
    const { cleaned, nodes: subNodes } = extractSubqueryScans(whereExpr);
    filterNode = makeNode('Filter', truncateLabel(cleaned), subNodes, { predicate: cleaned });
  }

  // FROM + JOINs
  const fromPos = findTopLevelKeyword(afterWhere, 'FROM');
  let selectExpr = afterWhere;
  let scanNodes: PlanNode[] = [];

  if (fromPos >= 0) {
    selectExpr = afterWhere.substring(0, fromPos).trim();
    const fromClause = afterWhere.substring(fromPos + 4).trim();
    const { cleaned, nodes: subNodes } = extractSubqueryScans(fromClause);

    // JOIN を検出
    const joinParts = splitTopLevel(cleaned, ' JOIN ');
    if (joinParts.length > 1) {
      // JOIN ありの場合
      const tables: PlanNode[] = [];
      for (let i = 0; i < joinParts.length; i++) {
        let part = joinParts[i];
        // JOIN 型を抽出
        let joinType = 'INNER';
        const jtMatch = part.match(/\b(LEFT|RIGHT|FULL|CROSS|INNER|OUTER)\s*$/i);
        if (jtMatch) {
          joinType = jtMatch[1].toUpperCase();
          part = part.substring(0, jtMatch.index).trim();
        }

        // ON 条件を分離
        const onPos = findTopLevelKeyword(part, ' ON ');
        let tableRef = part;
        let onPred = '';
        if (onPos >= 0) {
          onPred = part.substring(onPos + 4).trim();
          tableRef = part.substring(0, onPos).trim();
        }

        // テーブル参照 or サブクエリ
        const subRef = subNodes.find(n => tableRef.includes(`__SUBQ_${n.label}__`));
        const scan = subRef ?? parseTableRef(tableRef);
        tables.push(scan);

        if (i > 0 && tables.length >= 2) {
          const right = tables.pop()!;
          const left = tables.pop()!;
          const joinNode = makeNode('Join', truncateLabel(onPred || `${joinType} JOIN`), [left, right], {
            joinType,
            predicate: onPred,
          });
          tables.push(joinNode);
        }
      }
      scanNodes = tables;
    } else {
      // カンマ区切りのテーブル参照
      const tableRefs = splitTopLevel(cleaned, ',');
      scanNodes = tableRefs.map(ref => {
        const subRef = subNodes.find(n => ref.includes(`__SUBQ_${n.label}__`));
        return subRef ?? parseTableRef(ref);
      });
      // 複数テーブルのカンマ結合 → Cross Join として表現
      if (scanNodes.length > 1) {
        let current = scanNodes[0];
        for (let i = 1; i < scanNodes.length; i++) {
          current = makeNode('Join', 'CROSS JOIN', [current, scanNodes[i]], { joinType: 'CROSS' });
        }
        scanNodes = [current];
      }
    }
  }

  // SELECT → Project
  const selectCols = selectExpr.replace(/^SELECT\s+(DISTINCT\s+)?/i, '').trim();
  const cols = selectCols === '*' ? ['*'] : splitTopLevel(selectCols, ',').map(c => {
    const asMatch = c.match(/\bAS\s+(\w+)\s*$/i);
    return asMatch ? asMatch[1] : c.trim().split(/\s+/).pop() ?? c.trim();
  }).slice(0, 5);
  const projectLabel = cols.join(', ') + (cols.length >= 5 ? ', ...' : '');

  // ツリーを組み立て（ボトムアップ）
  let current: PlanNode = scanNodes.length === 1 ? scanNodes[0] : makeNode('Scan', '(none)');

  if (filterNode) {
    filterNode.children = [current, ...filterNode.children];
    current = filterNode;
  }
  if (aggNode) {
    aggNode.children = [current];
    current = aggNode;
  }
  if (havingNode) {
    havingNode.children = [current];
    current = havingNode;
  }

  const project = makeNode('Project', truncateLabel(projectLabel), [current], { columns: cols });
  current = project;

  if (sortNode) {
    sortNode.children = [current];
    current = sortNode;
  }
  if (limitNode) {
    limitNode.children = [current];
    current = limitNode;
  }

  // CTE を最上段に追加
  if (cteNodes.length > 0) {
    // CTE は Project の scan children に追加
    for (const cte of cteNodes) {
      current.children.push(cte);
    }
  }

  return current;
}

function truncateLabel(s: string, max = 30): string {
  const oneLine = s.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.substring(0, max - 1) + '…';
}

/**
 * SQL テキストから論理プランツリーを生成
 */
export function parseSqlToPlan(sql: string): PlanNode {
  nodeCounter = 0;
  return parseSqlToPlanInternal(sql);
}
