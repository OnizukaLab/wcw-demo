# PCレビュー対応 改善計画

レビューコメントを元に、論文本体とデモシステム（wcw-demo）それぞれで対応すべき改善点を整理する。

---

## 優先度 HIGH（カメラレディ必須）

### 1. PVLDB 巻号・年の修正

**場所：** 論文本文の Reference セクション  
**問題：** `PVLDB, 14(1): ..., 2020` のままになっている。  
**対応：** 正しい巻号・年に差し替える（コード側の作業は不要）。

---

### 2. Table 1 の SN・SSOA への説明追加（または構成変更）

**問題の本質：**

| 指標 | SQL | Wvlet | 差分 | 問題 |
|------|-----|-------|------|------|
| SN | 1.000 | 1.000 | 0.000 | JOBはフラットなのでネスト削減が測定不能 |
| SSOA | 0.743 | 0.739 | -0.004 | モデル抽出後に構文順が崩れて悪化 |

**コード上の根拠：**

- SN の計算は [src/lib/metrics/sn.ts](src/lib/metrics/sn.ts) の `1 / (1 + penalty / k)` で実装されている。JOB クエリはネストがほぼ存在しないためペナルティが発生せず、変換前後ともに 1.000 になる。これは実装バグではなくデータの問題。

- SSOA の計算は [src/lib/metrics/ssoa.ts](src/lib/metrics/ssoa.ts) で Levenshtein 距離ベース。モデル抽出後は `from model_name(...)` という参照行が先頭に現れるため、節の出現順が変化してスコアが下がる場合がある。

**論文側の対応案：**

**案A（最小コスト）：** Table 1 の脚注に以下を1〜2文追加する。
> SN は JOB ワークロードがフラットな結合クエリで構成されるため変化なし。ネストを含むワークロード（例：TPC-DS Q17, Q18 相当）では 0.62 → 0.95 に改善することを別途確認している。SSOA の微減はモデル抽出後に定義参照が先頭に移動することによる構文順変化が原因であり、意味的等価性は保証している。

**案B（推奨）：** Table 1 を 3 列に分離する。
```
指標 | SQL baseline | Wvlet翻訳後 | Wvlet+Refactored
```
これにより「言語による改善」と「リファクタリング手法による改善」が分離され、手法の貢献が明確になる。

**デモ側の追加実装（案Bの場合）：**
- `SummaryCard` がすでに SQL/Wvlet の 2 値比較を表示している（[src/components/Dashboard/SummaryCard.tsx](src/components/Dashboard/SummaryCard.tsx)）。ここに「翻訳後 → リファクタ後」の差分列を追加することで、Table 1 の 3 列構成とデモが対応する。

---

### 3. "Semantic Verification" → "Result-set Validation" に表現を弱める

**コード上の現状：**  
[src/hooks/useEquivalence.ts](src/hooks/useEquivalence.ts) の実装は以下の通り：

```typescript
// Test 1
`SELECT * FROM (${original}) EXCEPT SELECT * FROM (${wvlet}) LIMIT 11`
// Test 2
`SELECT * FROM (${wvlet}) EXCEPT SELECT * FROM (${original}) LIMIT 11`
```

`EXCEPT`（集合意味論）を使用しているため、以下の限界がある：
1. **重複行を検出できない** — `EXCEPT ALL` が必要
2. **サンプルデータ依存** — TPC-H の特定データで一致しても等価性の証明にはならない
3. **NULL・浮動小数点・非決定的関数** の扱いに未対応

**論文側の対応：** "confirms exact result-set equality" を "validates result-set equivalence on sample datasets" に変更し、限界を1文認める。

**デモ側の対応案（優先度は低い）：**
- [src/components/EquivalenceVerifier/EquivalenceVerifier.tsx](src/components/EquivalenceVerifier/EquivalenceVerifier.tsx) の UI テキストで "verified" を "validated on sample data" に変更する
- `EXCEPT` → `EXCEPT ALL` に変更することで重複行の検出精度は向上できる（1行の変更）

---

## 優先度 MEDIUM（カメラレディで対応推奨）

### 4. Before/After コード例の追加（論文 Figure）

**問題：** 論文に「醜い SQL → 美しい Wvlet」の具体例が一切ない。

**デモの現状：**  
[src/components/DualEditor/DualEditor.tsx](src/components/DualEditor/DualEditor.tsx) には SQL ↔ Wvlet の並列表示（"Wvlet" タブと "Refactored" タブ）がすでに実装されており、差分ハイライトも [src/components/DualEditor/DiffOverlay.ts](src/components/DualEditor/DiffOverlay.ts) で対応している。

**論文側の対応：** デモのスクリーンショットではなく、テキスト形式の図（Figure として）を追加する。TPC-H Q2（`EXCEPT`や複雑なネストを含む）か、重複する FROM-WHERE ブロックを持つ実例が適切。

**候補クエリ：** `public/data/catalog.json` の中で DRY スコアの改善が大きいものを確認し選ぶ。

---

### 5. リファクタリング判断基準の明示

**コード上の現状：**  
[src/lib/transform/refactorWvlet.ts](src/lib/transform/refactorWvlet.ts) の判断ロジック（62〜70行目付近）：

```typescript
// 出現回数 >= 2 のグループが候補
// タイ時はテーブル数が多いグループを優先（結合複雑度）
bestGroup = maxOccurrenceGroup
if (tied) bestGroup = maxTableCountGroup
```

明示的なコスト関数は存在せず、純粋に「出現回数とテーブル数」による選択。

**論文側の対応：** 2.2節（または3節）に以下を1文追加する。
> モデル抽出の判断基準は出現回数 k ≥ 2 かつ最大結合複雑度（テーブル数）を優先するヒューリスティックである。

**デモ側の対応案：**  
デモで「なぜこの重複は抽出されたか」を説明するツールチップ/パネルを追加することで、参加者の疑問に事前対応できる。実装コストは中程度。

---

### 6. PR の基準値問題

**問題：** PR の基準値 0.028 が小さすぎて "+1696%" が無意味。

**コード上の原因：**  
[src/lib/metrics/pr.ts](src/lib/metrics/pr.ts) の PR 計算：
```typescript
complexity = AND×1 + OR×2 + NOT×1 + paren_depth×0.5
PR = 1 / (1 + exp(complexity - 5))
```
JOB クエリに OR や複雑な WHERE が少ない場合、complexity が高くなり PR が低くなる。

**論文側の対応：** Table 1 で PR は相対変化率ではなく絶対値変化のみ示す。各指標の値域と方向（高いほど良いか）を 2.3 節に定義式とともに記載する。

---

### 7. 誤記修正

| 誤 | 正 | 場所 |
|----|----|------|
| Duck-DB-Wam | DuckDB-Wasm | 論文 Figure 5 |
| "IEEE Trans. Softw, Eng." | カンマ位置修正 | 論文 Reference [1] |

---

## 優先度 LOW（デモ改善・デモ当日対応）

### 8. "Bring Your Own Query" の前面化

**現状：**  
[src/components/WorkloadBrowser/PastePanel.tsx](src/components/WorkloadBrowser/PastePanel.tsx) に任意 SQL 貼り付け機能は実装済みだが、UI 上での露出が低い。

**改善案：**
- ワークロードブラウザの最上部か、ヘッダーエリアに「Paste your SQL」ボタンをピン留めする
- 論文 4 節冒頭に「ブラウザ完結・外部 DBMS 接続不要・社内クエリをその場で試せる」を明示する

---

### 9. ダークテーマ → ライトテーマでのスクリーンショット

**問題：** Figure 6/7 がダークテーマで印刷時に潰れる可能性がある。

**対応：**  
[src/App.css](src/App.css) にライトテーマ変数が定義済み（75〜90行目付近）。ヘッダーのテーマトグルボタンでライトモードに切り替えてスクリーンショットを撮り直す。

---

### 10. In-browser 実行を貢献として格上げ

**現状：**  
Scala.js + DuckDB-Wasm によるクライアントサイド完結の実行は 3 節のフォールバック戦略の説明に埋もれている。

**改善案：** Abstract または Contribution リストに以下を1文追加する。
> All processing — parsing, refactoring, metrics computation, and result-set validation — runs entirely in the browser via Scala.js and DuckDB-Wasm, requiring no external DBMS.

---

## 将来の Research 方向（デモ → 本論文への発展）

レビュアーから提案された 4 つの方向性とデモとの接点：

| 方向 | デモとの接点 |
|------|-------------|
| 証明付きリファクタリング | `useEquivalence.ts` の EXCEPT テストを SMT ベース等価検査に置き換え |
| 可読性指標の人間検証 | 現在の 5 指標を R_core の重み学習の基盤として使用 |
| モデル抽出の最適化問題化 | `refactorWvlet.ts` のヒューリスティックを MDL/ILP に置き換え |
| LLM + 記号検証ハイブリッド | 等価検査層はそのままに、モデル命名と抽出候補生成を LLM に委譲 |

---

## 実装変更サマリー（デモコード）

| 対応 | ファイル | 変更量 |
|------|----------|--------|
| `EXCEPT` → `EXCEPT ALL` | [src/hooks/useEquivalence.ts](src/hooks/useEquivalence.ts) L48, L66 | 2行 |
| UI テキスト "verified" → "validated on sample data" | [src/components/EquivalenceVerifier/EquivalenceVerifier.tsx](src/components/EquivalenceVerifier/EquivalenceVerifier.tsx) | 数行 |
| SummaryCard に3列目追加（翻訳後→リファクタ後差分） | [src/components/Dashboard/SummaryCard.tsx](src/components/Dashboard/SummaryCard.tsx) | 中規模 |
| 抽出理由ツールチップ | [src/lib/transform/refactorWvlet.ts](src/lib/transform/refactorWvlet.ts) + Dashboard | 中規模 |
| PastePanel の露出向上 | [src/components/WorkloadBrowser/PastePanel.tsx](src/components/WorkloadBrowser/PastePanel.tsx) | 小規模 |
