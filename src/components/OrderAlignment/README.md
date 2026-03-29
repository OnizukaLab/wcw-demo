# Order Alignment Panel

## 概要

Order Alignment Panel は、クエリの **構文順序 (Syntax Order)** と **データフロー順序 (Dataflow Order)** の不一致を可視化するパネルです。SQL と Wvlet を横に並べ、各言語について「記述順」と「実行順」のズレを交差線で示します。

## パネル構成

```
┌─ SQL ──────────── 77% ⚠ 3 ─┬─ Wvlet ─────────── 82% ⚠ 2 ─┐
│ Syntax   ╲╱  Dataflow       │ Syntax   ╲╱  Dataflow        │
│ Order    ╱╲  Order          │ Order    ╱╲  Order           │
│ (記述順)  ──  (実行順)        │ (記述順)  ──  (実行順)         │
└─────────────────────────────┴──────────────────────────────┘
```

- **左カラム (Syntax Order)**: AST ノードをソースコード上の出現位置順に並べたもの
- **右カラム (Dataflow Order)**: 同じノードをデータフロー（意味的実行順）で並べたもの
- **中央の線**: 同一ノードを接続。交差する赤い破線 = inversion（読み順と実行順の逆転）
- **ヘッダー**: SSOA スコア (%) と inversion 数

## 2つの順序の定義

### Syntax Order（構文順序）

ソースコード上の位置（`sourceLocation.position`）でノードをソートした順番。  
**人間がクエリを上から下に読む順序** に対応する。

```scala
def syntaxRank(l: LogicalPlan)(using ctx: Context): LogicalPlanRankTable =
  val nodes = collectNodesInPostOrder(l)
  Map.from(
    nodes
      .sortBy(n => n.sourceLocation.position)  // ← ソースコード上の位置順
      .zipWithIndex
      .map: (n, rank) =>
        n -> (rank + 1)
  )
```

### Dataflow Order（データフロー順序）

AST の **Post-Order DFS（深さ優先探索・帰りがけ順）** でノードを走査した順番。

```scala
def dataflowRank(l: LogicalPlan): LogicalPlanRankTable =
  val postOrder = collectNodesInPostOrder(l)  // ← DFS post-order
  Map.from(
    postOrder
      .zipWithIndex
      .map: (n, i) =>
        n -> (i + 1)
  )
```

#### なぜ Post-Order DFS がデータフロー順序なのか？

関係代数の論理プラン木では、**葉ノード（テーブルスキャン）が最初にデータを生成し、上位ノード（フィルタ、射影、集約）が順にデータを消費する**。Post-Order DFS は子ノードをすべて訪問してから親を訪問するため、この「データの流れ」と一致する:

```
       Project (SELECT)     ← 最後に実行 = post-order rank 5
          │
       Filter (WHERE)       ← rank 4
          │
       Join                 ← rank 3
        ╱   ╲
   Scan_A   Scan_B          ← 最初に実行 = rank 1, 2
```

つまり **post-order = 意味的な実行順序（ボトムアップのデータフロー）** となる。

### 収集対象ノード

以下のノードは構造的なラッパーのためスキップされる:

| スキップ対象 | 理由 |
|---|---|
| `Query` | プレースホルダー |
| `PackageDef` | パッケージ定義 |
| `WithQuery` | CTE 定義（常にメインクエリの前に出現） |
| `BracedRelation` | 括弧のみのノード |

## SQL の例：なぜ交差が多いか

SQL は `SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY` の順で記述するが、実行は `FROM → WHERE → GROUP BY → SELECT → ORDER BY` の順。

```
Syntax Order          Dataflow Order
─────────────        ──────────────
SELECT    ──╲───────→  FROM        ← 最初に実行
FROM      ──╱───────→  WHERE
WHERE     ──────────→  GROUP BY
GROUP BY  ──────────→  SELECT      ← 記述は先頭なのに後で実行
ORDER BY  ──────────→  ORDER BY
```

SELECT が記述上は最初（syntaxRank=1）なのに実行上は4番目（dataflowRank=4）→ **inversion**。

## Wvlet の例：交差が少ない

Wvlet は `from ... where ... select ...` の順で記述でき、データフロー順と自然に一致するため交差が減る。

## スコアの計算

**SSOA (Syntax-Semantic Order Alignment)** スコアは 2 つの指標の平均:

| 指標 | 定義 |
|---|---|
| `inversionScore` | `1.0 - (inversionCount / maxInversionCount)` |
| `syntaxRankScore` | `1.0 - ((syntaxRankDist - n + 1) / (maxSyntaxRankDist - n + 1))` |
| **normalizedScore** | `(inversionScore + syntaxRankScore) / 2.0` |

- **inversionCount**: データフロー順に隣接するノードペアで、構文順序が逆転している数
- **syntaxRankDist**: データフロー順に隣接するノード間の構文ランク距離の合計（最小値は n-1 で完全一致時）

## ノードカテゴリ

パネルでは AST ノード名を以下のカテゴリに分類して表示:

| カテゴリ | 表示名 | 対応ノード名パターン |
|---|---|---|
| Scan | FROM | Scan, TableRef, AliasedRelation |
| Join | JOIN | Join |
| Filter | WHERE | Filter, Where |
| Aggregate | GROUP BY | Aggregate, GroupBy |
| Project | SELECT | Project, Select, AllColumns |
| Sort | ORDER BY | Sort, Order |
| Limit | LIMIT | Limit |
| SetOp | UNION/SET | SetOperation, Union, Intersect, Except |
| SubQuery | SUBQUERY | SubQuery |
| Other | OTHER | その他 |
