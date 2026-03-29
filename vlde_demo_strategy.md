# **実ワークロードの実証分析に基づく次世代クエリ言語リファクタリングシステムのVLDB 2026における実演戦略報告書**

現代のデータ管理エコシステムにおいて、クエリ言語の保守性と可読性の向上は、システム全体の持続可能性を左右する決定的な課題となっている。半世紀にわたり標準の地位を維持してきたSQLは、その直感的な擬似英語構文によって普及したものの、近年のワークロードの複雑化に伴い、人間が解釈し変更を加える際の認知負荷が限界に達していることが、数々の実証分析によって指摘されている 1。本報告書では、Treasure Data社の13万件を超える実ワークロードの分析から導き出されたクエリ可読性の定量指標、およびそれに基づく自動リファクタリング手法を中核とし、国際会議VLDB 2026（Very Large Data Bases）のデモンストレーション・トラックにおける採択に向けた具体的なデモ設計と戦略的ロードマップを提示する。

## **クエリ可読性における構造的負債の定量的理解**

SQLの保守を困難にしている本質的な要因は、言語の物理的な記述順序と論理的なデータ評価順序の乖離にある。標準的なSQLでは、結果として得たい項目を定義するSELECT句が先頭に位置し、ソースデータを定義するFROM句がその後に続く。この構成は、多段階の変換を伴う分析クエリにおいて、内側のサブクエリから外側へと解釈を遡る「インサイド・アウト」の読解を強制し、人間の作業記憶に深刻な負荷を与える 1。

実運用環境における138,993件の匿名化済みSQLクエリを対象とした調査によれば、平均行数は35.2行、中央値は27行に達しており、31行以上の大規模クエリが全体の約46%を占めている事実が明らかとなっている 1。さらに、全クエリの75.7%がネスト構造を含み、一部は4段以上の深度に達している。こうした大規模化と複雑化は、コードの重複（Copy & Paste）を誘発し、保守コストの増大と技術的負債の蓄積を招いている。この現状を打破するためには、クエリの質を客観的に評価する指標の定義が不可欠である。本研究では、以下の3つの指標を可読性の柱として定義している 1。

### **クエリ可読性評価指標の体系**

| 指標名（略称） | 定義と測定対象 | 認知負荷への影響 |
| :---- | :---- | :---- |
| **重複度 (DRY)** | 同一または類似した論理構造の出現頻度。 | 変更時の修正漏れリスクと、ロジック理解の冗長性を高める。 |
| **平坦度 (SN)** | サブクエリの最大ネスト深度および依存関係の複雑さ。 | コンテキストの保持に必要な作業記憶量を増大させる。 |
| **評価順整合性 (SSOA)** | 記述順序と論理的評価順序（データフロー）の一致度。 | 脳内での順序並べ替えに必要な処理コストを増大させる。 |

これらの指標を用いることで、既存のSQLワークロードが抱える問題を定量的に可視化し、改善の指針を得ることが可能となる。特にSSOAに関しては、Google Pipe SyntaxやPRQLといったパイプライン型の言語拡張がその改善に寄与することが知られているが、本研究で採用するWvletは、これに加えて「モデルベースの抽象化」と「論理プランレベルの自動リファクタリング」を導入することで、DRYおよびSNの大幅な改善をも図るものである 1。

## **Wvlet言語と自動リファクタリングの技術的基盤**

Wvletは、関係演算の合成順序をコード上に直接反映させるFlow-styleを採用したクエリ言語であり、コンパイラ内部の論理プランと構文構造が高い同型性（Isomorphism）を持つことが特徴である 1。この特性は、人間による直感的な読解を助けるだけでなく、機械的なグラフ操作による安全なコード変換を実現するための強力な武器となる。

### **重複抽出のためのアンチユニフィケーション手法**

リファクタリングの核心となる技術は、論理プランのノードに対して定義される「構造的ハッシュ」と「アンチユニフィケーション（Anti-Unification）」である。構造的ハッシュは、具体的なテーブル名やリテラル値を無視し、演算子の種類と接続関係のみから算出されるため、記述の揺らぎを吸収した類似ロジックの検出が可能となる 1。

検出された重複候補に対して適用されるアンチユニフィケーションは、複数のプランツリーを比較し、共通する構造を維持しつつ、異なる部分を変数（パラメータ）として括り出す操作である。これにより、単なる文字列置換では不可能な、引数付きの再利用可能な「model」定義を自動生成することができる。リファクタリングの適用可否は、以下のコストモデルに基づくスコア ![][image1] によって決定される 1。

![][image2]  
ここで、![][image3] は削減される論理ノード数、![][image4] は再利用回数、![][image5] は導入されるパラメータ数であり、過度に複雑な抽象化を抑制し、人間にとって最適な可読性を維持するための制約として機能する 1。

### **ネスト構造の安全なフラット化**

もう一つの重要な変換手法は、JOINの入れ子構造を正規化するフラット化手法である。実運用上のSQLでは、自動生成ツールやテンプレートの影響で、意味を持たない括弧によるグルーピングが多用され、インデントの増大と視線移動の負荷を招いている 1。本手法では、関係代数における結合の結合法則（Associativity）を利用し、外部結合などの順序が重要なケースを除外した上で、論理プランから冗長なBracedRelationノードを削除し、Left-deepな構造へと再構成する 1。これにより、クエリを上から下へ、行単位の連鎖として追いやすい表現へと整形することが可能となる。

## **VLDB Demoトラックの採択傾向と採択戦略**

VLDB 2026におけるデモ採択を確実にするためには、過去数年間の採択傾向と評価基準を詳細に分析し、本研究の新規性と実用性を最大限にアピールする実演シナリオを構築する必要がある 8。

### **近年の採択傾向と主要なテーマ**

近年のVLDB Demonstration Track（2023-2025）の採択論文リストを概観すると、いくつかの明確なトレンドが観察される。

| カテゴリ | 特徴的な採択例 | 評価のポイント |
| :---- | :---- | :---- |
| **説明可能性とデバッグ** | *DBG-TP* (LLM支援クエリデバッガ), *UmbraPerf* (DBMSプロファイラ) 9 | ブラックボックス化されたシステムの挙動を可視化し、人間の理解を助ける。 |
| **インタラクティブ・プレイグラウンド** | *Play2Win* (ストリーム窓関数の実験場), *BFTGym* (BFTプロトコルの検証) 9 | ユーザーがパラメータを操作し、その結果をリアルタイムで観察できる。 |
| **クエリ書き換えと品質管理** | *sqlcheck* (アンチパターン検出), *VeriEQL* (SQL等価性検証) 12 | クエリの正当性や保守性を自動的に向上させる実用的なツール群。 |
| **LLMと自然言語インタフェース** | *Chat2Data*, *QueryArtisan* (データレイクのNL2SQL解析) 3 | 高度なAI技術を既存のデータ管理課題に適用し、操作の敷居を下げる。 |

本研究は「クエリの品質管理（リファクタリング）」と「説明可能性（可読性の定量化）」の双方に跨るテーマであり、VLDBのコミュニティにとって非常に関心の高い領域に位置している。特に、Treasure Data社の実ワークロードに基づいているという強固な実証的背景は、単なる理論的な提案を超えた「実用上の意義」を強く印象づける要素となる 1。

### **審査基準とインタラクティビティの要求**

VLDB 2026の公式ガイドラインによれば、デモ論文は最大4ページ（参考文献含む）のカメラレディ形式で提出され、少なくとも3名のレビュアーによって評価される 8。採択の鍵を握るのは、以下の要素である。

1. **実演シナリオの具体性**: 観客がどのようにシステムを体験するかが詳細に記述されていること 8。  
2. **高いインタラクティビティ**: ユーザーが受動的に説明を聞くのではなく、能動的にデータを操作し、即座にフィードバックを得られる設計が好まれる 8。  
3. **新規性と意義**: データ管理の研究、技術、または応用に対する貢献が明確であること 8。

さらに、5分以内のデモンストレーションビデオの提出が推奨されており、ユーザーインタフェースの直感性や、システムが提供する「Aha\! moment（なるほど！と思わせる瞬間）」を音響・視覚的に伝えることが重要となる 8。

## **提案するデモンストレーション・コンセプト：Wvlet Cognitive Workbench**

本研究の成果を効果的に実演するため、ユーザーがクエリの「カオス」を「秩序」へと変えていくプロセスを体験できる、インタラクティブなワークベンチ形式のデモを提案する。このシステムのアーキテクチャは、ブラウザ上での実行を前提とした軽量な設計とし、Scala.jsを用いたフロントエンドとDuckDB-Wasmを用いたクエリエンジンを統合する 3。

### **デモインタフェースの構成要素**

提案するデモ画面は、以下の5つのエリアで構成され、ユーザーの操作がリアルタイムに全体へ波及する設計とする。

1. **ワークロード・ブラウザ**: Treasure Dataの実ワークロードから抽出された「読みづらい」クエリのカタログ。  
2. **デュアル・エディタ**: 左側に元のSQL、右側に変換・リファクタリング後のWvletを表示するサイドバイサイドのコード比較環境 2。  
3. **論理プラン・ビジュアライザ**: プランレベルでの重複箇所やネスト構造をグラフとして可視化し、アンチユニフィケーションによる抽象化プロセスをアニメーションで表示する 20。  
4. **コグニティブ・ダッシュボード**: DRY、SN、SSOAの各指標をレーダーチャートやゲージで表示し、リファクタリングによる改善を数値で証明する 1。  
5. **プラン等価性検証パネル**: 変換前後のクエリが同一の結果を返すことを証明するための実行トレース比較 23。

### **シナリオ1：大規模ワークロードからの共通ロジック発見（重複抽出）**

参加者は、数千行に及ぶ「スパゲッティSQL」ワークロードを選択することから実演を開始する。

* **操作**: ユーザーが「重複検出」ボタンをクリックする。  
* **体験**: ビジュアライザが論理プラン上の数千のサブツリーを高速にスキャンし、色分けによって共通パターンを強調表示する 1。  
* **介入**: ユーザーは提案された抽象化候補の中から一つを選択し、パラメータ名をカスタマイズしてWvlet model として定義する。  
* **結果**: 右側のエディタで、分散していた数百箇所の冗長コードが一斉に単一の関数呼び出しに置き換わり、DRYスコアが飛躍的に上昇する様子を観察する 1。

このシナリオは、単なる言語変換ツールではない「構造的最適化エンジン」としてのWvletの新規性を強調する。

### **シナリオ2：視線移動のシミュレーションとネスト解消（フラット化）**

このシナリオでは、クエリの可読性が「人間の認知機能」に与える影響を直感的に理解させる。

* **操作**: ユーザーが5段階のネストを持つ複雑なSQLを読み、特定のカラムの由来（リネージ）を特定するクイズに挑戦する。  
* **体験**: 画面上に「視線移動シミュレータ」が表示され、SQLの構造に応じて視線が上下左右に激しくジャンプする様子が可視化される 1。  
* **介入**: 「フラット化適用」をオンにすると、Wvletのパイプライン構文により、クエリが上から下への一本道のフローに再構成される。  
* **結果**: シミュレータの軌跡が垂直な直線へと変化し、SSOA指標とSN指標の改善が、人間の読解スピードの向上に直結することを実感させる。

### **シナリオ3：LLMとの協調によるクエリ保守**

VLDBのトレンドである「AIとの融合」を取り入れ、生成AIが出力した「動作はするが保守困難なSQL」をリファクタリングするシナリオを設ける。

* **操作**: ユーザーが自然言語で「過去30日間の売上上位ユーザーと、その購買頻度をJOINして出力して」と入力する。  
* **体験**: LLMが複雑で非効率なSQLを生成し、システムが即座に「保守性警告」を発動する 14。  
* **介入**: WvletコンパイラがLLMの出力を論理プランに変換し、自動リファクタリングを実行して、人間に優しいクエリへとクリーンアップする。  
* **結果**: AIが生成したコードをそのまま使うリスク（技術的負債の混入）と、Wvletが提供する「AIコードの洗浄」という新しい価値提案を実演する 24。

## **VLDB 2026採択に向けた戦略的ロードマップ**

デモ論文の執筆および準備にあたっては、レビュアーの懸念を先回りして解消する「防衛的執筆」と、強い印象を残す「攻撃的実演」のバランスが必要である。

### **論文構成の最適化（4ページ制限への対応）**

VLDBのデモ論文は極めて限られた紙幅でシステムを記述しなければならないため、以下の構成を推奨する 8。

1. **Introduction (0.5 page)**: Treasure Data社の13万件の解析結果を引用し、SQLの保守性問題が「性能」ではなく「人間」の問題であることを定義する 1。  
2. **Metric Framework (0.5 page)**: DRY, SN, SSOAの数学的定義と、それがどのように認知負荷と相関するかを簡潔に述べる。  
3. **Wvlet Language & Refactoring Engine (1 page)**: フロー型構文の利点、アンチユニフィケーション・アルゴリズム、およびフラット化の理論的根拠（結合の結合法則）を技術的に記述する。  
4. **Demonstration Scenarios (1.5 pages)**: 上述の3つのシナリオを、実際のUIスクリーンショットを交えて詳述する。特に「ユーザーが何を行い、何が起こるか」を明確にする 8。  
5. **Evaluation Snapshot (0.5 page)**: リファクタリング適用前後の指標改善データ（平均でどの程度DRYやSNが向上したか）をテーブルで提示する 1。

### **インタラクティビティを最大化する技術選択**

デモブースでの体験価値を高めるため、技術的な「スムーズさ」を追求する。

* **Local Processing with DuckDB-Wasm**: サーバーとの通信遅延を排除するため、すべての解析とクエリ実行をブラウザ内のWebWorkerで実行し、ユーザーがコードを一文字変更するたびに指標をリアルタイム更新する 3。  
* **Interactive Graph Diff**: 変化を静止画で見せるのではなく、ノードが移動し、合体し、消滅するアニメーションをD3.js等で実装し、論理的な変換プロセスを「物理的な変化」として視覚化する 21。  
* **Video Quality**: 提出ビデオにはプロフェッショナルなナレーションを付け、SQLの複雑さを「ノイズ（不協和音）」、Wvletの明快さを「ハーモニー（和音）」として表現する音響演出を検討する 8。

### **レビュアーへの対策と想定問答**

VLDBのレビュアーは、特に「実用性」と「既存手法との差分」を厳しくチェックする傾向にある 8。

| 想定される質問 | 推奨される回答戦略 |
| :---- | :---- |
| **なぜSQL自体を拡張する（Google Pipe Syntax等）だけでは不十分なのか？** | 構文の逐次性（SSOA）だけでは、大規模ワークロードに蔓延する「ロジックの重複（DRY）」と「構造的ネスト（SN）」を根本から解決できないため。Wvletは「モデル化」という抽象化基盤を持つ点で本質的に異なる 1。 |
| **リファクタリングがクエリの意味（結果）を変えてしまわないか？** | 変換はすべて論理代数の等価規則（結合法則、分配法則等）に基づき、オプティマイザの等価性保証範囲内で行われる。また、デモではVeriEQL等を用いた等価性検証プロセスも提示可能である 1。 |
| **ユーザーは新しい言語を学ぶ学習コストを許容できるのか？** | WvletはSQLと高い互換性を持ち、かつ「SQL生成機能」を備えているため、既存のデータベースインフラを変更せずに導入可能である。学習コストは、将来の保守コストの削減分によって十分にオフセットされる 3。 |

## **結論と今後の展望**

本報告書で提案した「Wvlet Cognitive Workbench」は、Treasure Data社での大規模な実証分析という揺るぎないエビデンスに基づいており、VLDB 2026のデモトラックにおいて極めて競争力が高い。クエリの保守性を「認知心理学的な視点」から再定義し、それを「論理プランレベルのグラフ変換」という堅牢な技術で解決するアプローチは、アカデミアと産業界の双方に強いメッセージを届けることができる 1。採択を勝ち取るためには、2026年3月の提出期限に向け、DuckDB-Wasmを用いたローカル実演環境の完成度を高めるとともに、4ページの論文内で「データに基づく説得力」と「UIの視覚的インパクト」を高度に融合させることが求められる。

VLDBでの実演成功は、Wvletが単なる研究プロジェクトを超え、次世代のクエリ開発標準としての地位を確立するための重要なマイルストーンとなる。参加者が「自らの手で」クエリの迷宮を整理し、指標が改善される喜びを体験できるデモは、VLDB Best Demo Awardへの最も確実な道筋である 8。

### **VLDB 2026 デモトラック提出スケジュール**

| マイルストーン | 期限 | 実施内容 |
| :---- | :---- | :---- |
| **プロトタイプ完成** | 2025年12月 | 基本的なリファクタリング・ロジックとUIの統合。 |
| **実データセットの組み込み** | 2026年1月 | Treasure Dataワークロードから代表的なシナリオを抽出。 |
| **ビデオ制作開始** | 2026年2月 | 5分間のストーリーボード作成と撮影。 |
| **論文執筆と推敲** | 2026年2月-3月 | 4ページのフォーマットに合わせた技術解説と実演記述。 |
| **最終提出** | 2026年3月29日 | AoE（Anywhere on Earth）期限内でのPDFおよびビデオ提出 8。 |

本報告書で詳述した戦略を忠実に実行することで、VLDB 2026における実演、そして採択、最終的にはBest Demo Awardの受賞へと繋がることを確信している。Wvletが切り拓く「人間に優しい」データ操作の未来を、ボストンの地で世界に示す準備は整っている。

#### **引用文献**

1. deim2026\_KainaAnderson.pdf  
2. SQL Has Problems. We Can Fix Them: Pipe Syntax In SQL \- VLDB ..., 3月 11, 2026にアクセス、 [https://www.vldb.org/pvldb/vol17/p4051-shute.pdf](https://www.vldb.org/pvldb/vol17/p4051-shute.pdf)  
3. wvlet/wvlet: A flow-style query language for SQL engines \- GitHub, 3月 11, 2026にアクセス、 [https://github.com/wvlet/wvlet](https://github.com/wvlet/wvlet)  
4. Introduction | Wvlet, 3月 11, 2026にアクセス、 [https://wvlet.org/wvlet/docs/](https://wvlet.org/wvlet/docs/)  
5. prql \- a simple, powerful, pipelined SQL replacement \- GitHub, 3月 11, 2026にアクセス、 [https://github.com/PRQL/prql](https://github.com/PRQL/prql)  
6. VLDB Test of Time Award, 3月 11, 2026にアクセス、 [https://www.vldb.org/awards\_10year.html](https://www.vldb.org/awards_10year.html)  
7. VLDB 2023 \- Conference Awards \- VLDB Endowment, 3月 11, 2026にアクセス、 [https://vldb.org/2023/?conference-awards](https://vldb.org/2023/?conference-awards)  
8. VLDB 2026 | Call for Contributions \- Demonstrations, 3月 11, 2026にアクセス、 [https://vldb.org/2026/call-for-demonstrations.html](https://vldb.org/2026/call-for-demonstrations.html)  
9. VLDB 2024: Demonstration Track Papers, 3月 11, 2026にアクセス、 [https://vldb.org/2024/?papers-demo](https://vldb.org/2024/?papers-demo)  
10. VLDB 2025 \- Conference Awards, 3月 11, 2026にアクセス、 [https://vldb.org/2025/?conference-awards](https://vldb.org/2025/?conference-awards)  
11. Play2Win: A Windowing Playground for Continuous Queries \- VLDB ..., 3月 11, 2026にアクセス、 [https://www.vldb.org/pvldb/vol18/p5407-ferri.pdf](https://www.vldb.org/pvldb/vol18/p5407-ferri.pdf)  
12. Eleven papers by CSE researchers at VLDB 2024 \- University of Michigan, 3月 11, 2026にアクセス、 [https://cse.engin.umich.edu/stories/eleven-papers-by-cse-researchers-at-vldb-2024](https://cse.engin.umich.edu/stories/eleven-papers-by-cse-researchers-at-vldb-2024)  
13. Interactive Demonstration of SQLCheck \- VLDB Endowment, 3月 11, 2026にアクセス、 [http://vldb.org/pvldb/vol14/p2779-ghosh.pdf](http://vldb.org/pvldb/vol14/p2779-ghosh.pdf)  
14. A Demonstration of QueryArtisan: Real-Time Data Lake Analysis via Dynamically Generated Data Manipulation Code \- VLDB Endowment, 3月 11, 2026にアクセス、 [https://www.vldb.org/pvldb/vol18/p5263-tang.pdf](https://www.vldb.org/pvldb/vol18/p5263-tang.pdf)  
15. VLDB 2023 \- Call for Contributions \- Demonstrations, 3月 11, 2026にアクセス、 [https://vldb.org/2023/?call-for-demonstrations](https://vldb.org/2023/?call-for-demonstrations)  
16. VLDB 2025 \- Call for Contributions \- Demonstrations, 3月 11, 2026にアクセス、 [https://vldb.org/2025/?call-for-demonstrations](https://vldb.org/2025/?call-for-demonstrations)  
17. VLDB 2024 \- Call for Contributions \- Demonstrations, 3月 11, 2026にアクセス、 [https://vldb.org/2024/?call-for-demonstrations](https://vldb.org/2024/?call-for-demonstrations)  
18. Wvlet: Redesigning 50-Year-Old SQL for Modern Data Analytics, 3月 11, 2026にアクセス、 [https://wvlet.org/wvlet/blog/release-2024-9/](https://wvlet.org/wvlet/blog/release-2024-9/)  
19. A Demonstration of Q O: Quantum-augmented Query Optimizer \- VLDB Endowment, 3月 11, 2026にアクセス、 [https://www.vldb.org/pvldb/vol18/p5439-liu.pdf](https://www.vldb.org/pvldb/vol18/p5439-liu.pdf)  
20. Top Free, Open Source Postgres Explain Tool to Analyze Database 2025 \- Bytebase, 3月 11, 2026にアクセス、 [https://www.bytebase.com/blog/top-open-source-postgres-explain-tool/](https://www.bytebase.com/blog/top-open-source-postgres-explain-tool/)  
21. mk3-20/interactive-query-plan-vis \- GitHub, 3月 11, 2026にアクセス、 [https://github.com/mk3-20/interactive-query-plan-vis](https://github.com/mk3-20/interactive-query-plan-vis)  
22. Visualizing software refactoring using radar charts, 3月 11, 2026にアクセス、 [https://d-nb.info/1317507908/34](https://d-nb.info/1317507908/34)  
23. VeriEQL: Bounded Equivalence Verification for Complex SQL Queries with Integrity Constraints \- School of Computing Science, 3月 11, 2026にアクセス、 [https://www.cs.sfu.ca/\~yuepeng/pubs/oopsla24.pdf](https://www.cs.sfu.ca/~yuepeng/pubs/oopsla24.pdf)  
24. Design Philosophy | Wvlet, 3月 11, 2026にアクセス、 [https://wvlet.org/wvlet/docs/development/design/](https://wvlet.org/wvlet/docs/development/design/)  
25. Sphinteract: Resolving Ambiguities in NL2SQL Through User Interaction \- VLDB Endowment, 3月 11, 2026にアクセス、 [https://www.vldb.org/pvldb/vol18/p1145-zhao.pdf](https://www.vldb.org/pvldb/vol18/p1145-zhao.pdf)  
26. VLDB 2020 Reviews \- dbis \- TU Dortmund, 3月 11, 2026にアクセス、 [https://dbis.cs.tu-dortmund.de/publikationen/2020/like-water-and-oil/vldb-2020-reviews/](https://dbis.cs.tu-dortmund.de/publikationen/2020/like-water-and-oil/vldb-2020-reviews/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAYCAYAAAAh8HdUAAAAwklEQVR4Xu2RIQ9BYRiF32qKyM8wkxWbwgRZ0BXBvxBsKkERFL9DvKrNBIEuMIzz3ve97u7hboLGsz377s75Tvh2RX6LOgzgEHY868f1KyV4hwu48u+8n2+pwTOHYoM1h0pXrMxxAaawzaFyERtluQAjDiKOYiO1TF0qM4lH6hwWEjdSKEpyGPkxDYlHVepCJhw4Y7FRjwtly4Gjl3XU5EL/y4FDZyMpbxqIFRnKK/AGW5SHXP3ciY338ASXzxt/vsQDfiMviUeWUysAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAYCAYAAABN9iVRAAACiUlEQVR4Xu2YS6hNYRTH/5555S155K2QgUcGBqYeSVGYSMpAKQN3YkJKiikprxQxETMTM2WAiDySAWUmMvCITDzX/661nPWtc07n1t0G9j2/+rfXt9Z39trfe+8DdOnSZSAzVDRHNNc0oogqs0XjRaNEY82uBbtFv4PuluFeYpz6Wob/f3pEH6GNa8VZ0Z7srAODRR+g05+NP1hElXfZURf2i76b7VM708pXCzjqx83eC23o0ka4l0upXBvY2LVmj7Yy17gzT7QrlGvFvVT+Be0ALgdyJcRqxXLRuuRbj3LtV7neV4reio7kQMU8Rx/y3MgOwxu/QPQqxfrLa9G47PwHdMzzKTuML9DGnxCdT7H+UuVMascs9CHPz+wwFqMx+tNSbFCwJwfb4XvDpOwUFto1PtTwYLdjiGh6dqL5RCJ8Nta9iA6N5w7+LDsDm9D6Btuh/gvQ932vs030AHpikH125brjJsoH41p8bP4Z0G8J//1ElIOxTHRLNFW0U3TM/J6HPLQrYR7W4/cK7+l5muD7Oaf8Z2jCA2X4L+9TmdOJxE4ZE3wjRfNFt83nncO9g7DDNpt9CHqM3rfyKZT3jbaP8h3zM89W0TXzx0EgtD1PpUwRPU0+nhAvk4+wQZdDOc+kR2h0KGcHZwbZGOwIf98pz0zRkxCrFPb4yeTbILqZfOQ69MvRiVOcxGnO2BnRFuhH1NUQc1inU54daDyf56kMrqVWG9qPYB+F/j+wRHTYfKehD88163B0uRfwXYOxNaJz0E3zTajHjy3ejx3iebhZvjDb8/Be30QrUOapDK7pdqxC8wnATY0vN2QYytOC+H7ABucdfDUap0SEeTLMM8HsRWjO02XA8gcRN4gnT31ifAAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAYCAYAAABTPxXiAAAB90lEQVR4Xu2Xu0tcURDGRw0aTSEaVPCBiqZQgiAoiIqVlRosVQQLExQs0vmqrEVsbA2kSKGFVlqICoog+gcIpvDRWGjjC8UiEp2Pmbv37HB3q104xf7g48z55nCYvffcuXeJMmTIkIxsVjWrhlWrYyWrhFUYW+U5/ay3JFpl5cZWe844SdGWaRL/i034yBlF/wgA/8mavjFEUuiVTTCfSHJHNuEbf0kK/W4TzAUlvkNeETzEdcavUn/K+F5iO1KgLXeRz5RTWLTLqXrtxveSXyTF/jH+vPq7xveSc5Jifxh/T/0N43sJCo1qrcERW7AJkrYLGuNc4TPrq/FyzDyKemso2AufRglBEoWO2QSFP2JG54+sMpL3xTbrmuT9guMIgvdJwK2Oo+qv6XyR9U1jgI44qfGl4++zBjXucfw4nlkPrDuSAl8ofnM80PesV9YBq4Xk06SCwmJLdQTwPrI6WLM6djq5Xo3/6xiwwjokaTDBHesmOeZFJHvdqJ9S3CseEOWBPtZvZx61bp3Eb9U57vZwmE4P9mqCqOIAutyIM8c6XGGQx/qp8Q7J8QTHrDaN0wI+3ZesyfxjZWncxJrTeIA1ofEmSdfD8QE4nl0an+gI8DAva4y93FxKKLCGQwPrgzWZfFazxuheLvivUmw8gOcjqvtl8Ip3Uvht6Md3Dn0AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAYCAYAAABEHYUrAAACTElEQVR4Xu2Xu2sWURDFx0SJRAuVoCaG+EIMiiiCkD/AwioiBAkWIiq+OgVLMZ19AhaKIgo+sFG7hBBSCDZJYSWoYCEkYiOCCiI+znFm8s0Oa5B81S7fDw47O3P37p29O3fvirRo0aLKtEG9UB+01US7G1oPLW80rT5HoN+L6BO0Y6F1TTgjmtyy5N9k/mfJX2neiCZVhs9yLRgWTeZDDhi1SvaVaDLncwDsE40N5UBV8ZnrzwEwKzWaVeLJ3oCuQ7egj+Z7GtpVHn5Pa1WTi3FTNNGpHKgjb0WTvZIDdYSJfoVW5ECiK9hbgh1Zlx1gVbDL7rE9O6S4Y+PW1WFf3N6WsUvK+1+AF/7PrK6BOqCf0DvzfWmE/36yjkPtUqz9F9CE6Pd7vxSv4efuudm85pDZd6EB6KXoPn2jxadFd3ePRcfjMEHf3Q1K+cOTb9Bn0b0v7R/QhUKLBieg1dD74ONgD0BzUkww2r7VdJgwOQfdD35vw1k8DY1Cx8zHz2HsY9p8zlnRCdgN9QR/U1yDToZzHwCP98zmXxJnJBIH6vANiTOQ2/wK9gP598N0bov6y2JLgq/ktnAekz1l9lHRWeHRazwO3MmDYpu4JsT4PPQ9nHvM38IxO7IUc79Lhh0dNHsS2hn8I6L/vSwH1tsdix0WTT7zCOo0+zU0Ds00woUHxP6vms3/bl7LjQ5/Tfk6X7LYQ+iJ2U3Dm66E9uaAqH+t2bGePKEyWJ97zN4QA1JccVkakVyXXLQ2J19TcJWLC0pt4Sp8EbpsdqX4A/CPgNPxZ/4bAAAAAElFTkSuQmCC>