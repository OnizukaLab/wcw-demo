/**
 * Wvlet → 論理プラン (PlanNode) パーサー
 *
 * Wvlet のフロー構文（from → where → group by → select）を解析し、
 * 論理プランツリーを生成する。Wvlet の構文はデータフロー順に記述されるため、
 * SQL と比べてプランへの変換が自然に行える。
 */

import type { PlanNode, PlanNodeType } from '../../types/plan';

let nodeCounter = 0;

function makeId(prefix: string): string {
  return `wv-${prefix}-${++nodeCounter}`;
}

function makeNode(
  type: PlanNodeType,
  label: string,
  children: PlanNode[] = [],
  metadata?: PlanNode['metadata'],
): PlanNode {
  return { id: makeId(type.toLowerCase()), type, label, children, metadata };
}

function truncateLabel(s: string, max = 30): string {
  const oneLine = s.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.substring(0, max - 1) + '…';
}

/** model 定義を抽出し、本体とモデルを分離 */
function extractModels(wvlet: string): { models: { name: string; params: string; body: string }[]; main: string } {
  const models: { name: string; params: string; body: string }[] = [];
  let remaining = wvlet;

  const modelRe = /^model\s+(\w+)\s*(\([^)]*\))?\s*=\s*/gm;
  let match: RegExpExecArray | null;
  const modelSpans: { start: number; end: number }[] = [];

  while ((match = modelRe.exec(wvlet)) !== null) {
    const name = match[1];
    const params = match[2] || '';
    const bodyStart = match.index + match[0].length;

    // 本体の終了位置を検出（次の model 定義 or end）
    let bodyEnd = wvlet.length;
    const nextModelRe = /^model\s+\w+/gm;
    nextModelRe.lastIndex = bodyStart;
    const nextMatch = nextModelRe.exec(wvlet);
    if (nextMatch) {
      bodyEnd = nextMatch.index;
    }

    // もし end キーワードがあれば
    const endMatch = wvlet.substring(bodyStart, bodyEnd).match(/\nend\b/);
    if (endMatch && endMatch.index !== undefined) {
      bodyEnd = bodyStart + endMatch.index + endMatch[0].length;
    }

    const body = wvlet.substring(bodyStart, bodyEnd).replace(/^\s*\n/, '').replace(/\nend\s*$/, '').trim();
    models.push({ name, params, body });
    modelSpans.push({ start: match.index, end: bodyEnd });
  }

  // モデル定義部分を除去して本体を取得
  for (let i = modelSpans.length - 1; i >= 0; i--) {
    remaining = remaining.substring(0, modelSpans[i].start) + remaining.substring(modelSpans[i].end);
  }

  return { models, main: remaining.trim() };
}

/** Wvlet の from...where...select ブロックを1つパース */
function parseWvletBlock(block: string): PlanNode {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
  if (lines.length === 0) return makeNode('Project', '(empty)');

  let current: PlanNode | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // from 句
    if (/^from\s+/i.test(line)) {
      const tableExpr = line.replace(/^from\s+/i, '').trim();
      current = parseFromExpr(tableExpr);
      i++;
      continue;
    }

    // join 句（Wvlet style: from T1\n  join T2 on ...）
    if (/^(left|right|inner|cross|full)?\s*join\s+/i.test(line) && current) {
      const joinMatch = line.match(/^(?:(left|right|inner|cross|full)\s+)?join\s+(\w+)(?:\s+on\s+(.+))?$/i);
      if (joinMatch) {
        const joinType = (joinMatch[1] || 'INNER').toUpperCase();
        const tableName = joinMatch[2];
        const onPred = joinMatch[3] || '';
        const rightScan = makeNode('Scan', tableName, [], { tableName });
        current = makeNode('Join', truncateLabel(onPred || `${joinType} JOIN`), [current, rightScan], {
          joinType,
          predicate: onPred,
        });
      }
      i++;
      continue;
    }

    // where 句
    if (/^where\b/i.test(line)) {
      const predParts: string[] = [];
      const whereLine = line.replace(/^where\s*/i, '').trim();
      if (whereLine) predParts.push(whereLine);
      // 次の行が and で始まる or インデントされた条件行
      while (i + 1 < lines.length && /^(and\s+|or\s+)/i.test(lines[i + 1])) {
        i++;
        predParts.push(lines[i].replace(/^(and|or)\s+/i, '').trim());
      }
      const pred = predParts.join(' AND ');
      if (current) {
        current = makeNode('Filter', truncateLabel(pred), [current], { predicate: pred });
      }
      i++;
      continue;
    }

    // group by
    if (/^group\s+by\b/i.test(line)) {
      const cols = line.replace(/^group\s+by\s+/i, '').trim();
      if (current) {
        current = makeNode('Aggregate', `GROUP BY ${truncateLabel(cols)}`, [current]);
      }
      i++;
      continue;
    }

    // agg 句（Wvlet style）
    if (/^agg\b/i.test(line)) {
      const aggExpr = line.replace(/^agg\s+/i, '').trim();
      if (current) {
        current = makeNode('Aggregate', truncateLabel(aggExpr || 'agg'), [current]);
      }
      i++;
      continue;
    }

    // select 句
    if (/^select\b/i.test(line)) {
      const selectParts: string[] = [];
      const selectLine = line.replace(/^select\s*/i, '').trim();
      if (selectLine) selectParts.push(selectLine);
      // 次の行がカラム定義かチェック
      while (i + 1 < lines.length && !isClauseStart(lines[i + 1])) {
        i++;
        selectParts.push(lines[i].replace(/^,\s*/, '').trim());
      }
      const cols = selectParts.join(', ');
      if (current) {
        current = makeNode('Project', truncateLabel(cols), [current], {
          columns: selectParts.slice(0, 5),
        });
      }
      i++;
      continue;
    }

    // order by
    if (/^order\s+by\b/i.test(line)) {
      const cols = line.replace(/^order\s+by\s+/i, '').trim();
      if (current) {
        current = makeNode('Sort', truncateLabel(cols), [current]);
      }
      i++;
      continue;
    }

    // limit
    if (/^limit\b/i.test(line)) {
      const n = line.replace(/^limit\s+/i, '').trim();
      if (current) {
        current = makeNode('Limit', `LIMIT ${n}`, [current]);
      }
      i++;
      continue;
    }

    i++;
  }

  return current ?? makeNode('Project', '(empty)');
}

function isClauseStart(line: string): boolean {
  return /^(from|where|select|group\s+by|order\s+by|agg|limit|join|left|right|inner|cross|full|model)\b/i.test(line.trim());
}

/** from 式をパース: テーブル名、カンマ区切り、model呼び出し */
function parseFromExpr(expr: string): PlanNode {
  const trimmed = expr.replace(/,\s*$/, '').trim();

  // model 呼び出し: modelName(args)
  const modelCallMatch = trimmed.match(/^(\w+)\s*\(([^)]*)\)$/);
  if (modelCallMatch) {
    return makeNode('ModelScan', modelCallMatch[1], [], {
      modelName: modelCallMatch[1],
    });
  }

  // { } サブクエリブロック
  if (trimmed.startsWith('{')) {
    const inner = trimmed.replace(/^\{/, '').replace(/\}\s*(as\s+\w+)?$/i, '').trim();
    return parseWvletBlock(inner);
  }

  // カンマ区切り複数テーブル
  if (trimmed.includes(',')) {
    const tables = trimmed.split(',').map(t => t.trim()).filter(Boolean);
    if (tables.length > 1) {
      let current = makeNode('Scan', tables[0], [], { tableName: tables[0] });
      for (let i = 1; i < tables.length; i++) {
        const right = makeNode('Scan', tables[i], [], { tableName: tables[i] });
        current = makeNode('Join', 'CROSS JOIN', [current, right], { joinType: 'CROSS' });
      }
      return current;
    }
  }

  // 単一テーブル
  const parts = trimmed.split(/\s+/);
  const tableName = parts[0];
  return makeNode('Scan', tableName, [], { tableName });
}

/**
 * Wvlet テキストから論理プランツリーを生成
 */
export function parseWvletToPlan(wvlet: string): PlanNode {
  nodeCounter = 0;
  const { models, main } = extractModels(wvlet);

  // メインクエリのプラン
  const mainPlan = parseWvletBlock(main);

  // model 定義ノードを追加
  if (models.length > 0) {
    const modelNodes = models.map(m => {
      const bodyPlan = parseWvletBlock(m.body);
      return makeNode('ModelDef', `model ${m.name}${m.params}`, [bodyPlan], {
        modelName: m.name,
      });
    });

    // model ノードをルートの children に追加
    mainPlan.children.push(...modelNodes);
  }

  return mainPlan;
}
