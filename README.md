# WCW — Wvlet Cognitive Workbench (VLDB 2026 Demo)

An interactive workbench for exploring how [Wvlet](https://wvlet.org) improves SQL readability through structural transformations, duplicate elimination, and cross-query model extraction.

## Features

### Single Query Mode

**Workload Browser**
Browse pre-loaded query catalogs — TPC-H (Q1–Q22), nested subqueries, complex joins, aggregation, LLM-generated, and flatten-dry examples (28 queries). You can also paste your own SQL in the **Custom** tab.

**Step-by-Step Transformation Viewer**
Watch how SQL is transformed into Wvlet in two stages:
- **Wvlet**: SQL compiled to flow-style syntax (`from … where … select`) via the Wvlet Scala.js compiler, with implicit joins automatically converted to explicit `join ... on` syntax.
- **Refactored**: Repeated sub-query patterns extracted into reusable `model` definitions with parameters (DRY optimization).

SQL and Wvlet are displayed side-by-side in CodeMirror editors with syntax highlighting and line numbers.

**Cognitive Metrics Dashboard**
Real-time readability metrics for SQL vs. Wvlet:
| Metric | Description |
|--------|-------------|
| **DRY** | Duplicate detection via token N-gram clone analysis |
| **SN** | Subquery nesting depth penalty |
| **SSOA** | Syntactic-semantic order agreement (edit distance) |
| **JI** | Join intent clarity (explicit vs. implicit JOIN ratio) |
| **PR** | Predicate readability (WHERE clause complexity) |
| **R_core** | Weighted composite score (DRY 0.34, SN 0.26, SSOA 0.22, JI 0.10, PR 0.08) |

Includes radar chart, summary cards, metric detail bars, and an R_core distribution histogram.

**Logical Plan Visualizer**
Tree-based visualization of both SQL and Wvlet logical plans (dagre + SVG).

**Equivalence Verifier**
Runs both SQL and Wvlet against DuckDB-Wasm (in-browser) on TPC-H SF=0.01 sample data. Uses `EXCEPT`-based bidirectional comparison.

### Batch Refactor Mode

**Workload Sources**
- **TPC-H** — 28 pre-loaded queries with category-based folders
- **JOB** (Join Order Benchmark) — 113 queries grouped by query number (Q1–Q33)
- **Custom SQL** — Paste or drag-and-drop `.sql` files with semicolon-separated queries

**Cross-Query Refactoring**
TPC-H and JOB workloads use cross-query analysis (`refactorMultipleQueries`) to extract shared join patterns as reusable `model` definitions across the entire workload.

**Results Table**
Shows per-query R_core scores (SQL vs. Wvlet) with improvement percentages. Export results as CSV or download all Wvlet files.

**Per-Query Detail View**
Click any row to open a full-panel detail view with:
- CodeMirror editors (SQL and Wvlet side-by-side with syntax highlighting)
- Cognitive metrics dashboard (radar chart, summary cards, individual metric improvements)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **State**: Zustand
- **Editor**: CodeMirror 6 (SQL + custom Wvlet syntax highlighting)
- **Charts**: D3, ECharts
- **Compiler**: Wvlet Scala.js SDK (SQL → Wvlet conversion, refactoring, implicit join rewriting)
- **Verification**: DuckDB-Wasm (in-browser SQL execution)
- **Layout**: dagre (plan tree visualization)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173/

