# Competitor research

競合の事実、Nestへの評価、判断記録を分けて蓄積する研究ノートです。**初回ドラフト：2026-10-04 UTC / 2026-10-05 JST。採否は未決定。** 日本語で分析し、UI labels は原文を保ちます。

## Start here

- [横断比較](comparison.md)：機能とUX、分かっていないこと
- [共通ユースケース](use-cases.md)：ペルソナ仮説と同条件の観察方法
- 製品ノート：[Dot](competitors/dot.md) / [Muse](competitors/muse.md) / [Grok Bot](competitors/grok-bot.md) / [ASIST](competitors/asist.md) / [Instinct](competitors/instinct.md)
- [画像の出典・公開条件](assets/README.md)
- [判断記録](decisions/README.md)：提案・承認・保留を区別

## Repository structure

```text
docs/research/
  README.md                   # Index, method, current status
  comparison.md               # Cross-product synthesis
  use-cases.md                # Comparable journeys and persona hypotheses
  competitors/<product>.md    # Facts, evaluation, sources, open questions
  assets/README.md            # Provenance and publication conditions
  assets/<product>/           # Only reviewed, publishable visual evidence
  assets/concepts/            # Original diagrams, never product screenshots
  decisions/README.md         # Decision index
  decisions/template.md       # Small reusable record
  decisions/0001-*.md          # Proposed or explicitly accepted decisions
```

空の製品画像ディレクトリは作らず、掲載可能な画像ができた時点で追加します。Markdownと相対リンクを基本とし、巨大な比較表より論点別の短い表を使います。

## Evidence method

| Grade | Meaning | Limit |
| --- | --- | --- |
| hands-on | 実機で観察したUI・操作 | 画面から内部実装や耐久性を推測しない |
| documented | 公式ドキュメントの記述 | 再現試験済みとは限らない |
| announced | 公式発表・紹介デモ | 対象ユーザーの利用可能性は別途確認 |
| observed public website | 未サインインの公開サイトで見たUI | installed appやAdd後の挙動の証明ではない |
| unconfirmed | 対象・出典・動作が未確認 | 非対応という意味ではない |

各ノートに確認日、製品バージョン（不明なら不明）、出典URL、観察条件を残します。主張には出典番号を付け、評価は独立した節へ。古い観察を最新仕様へ上書きせず、日付付きで訂正します。更新時は製品ノート→比較→判断記録の順に整合を確認します。

数値スコアはまだ付けません。異なる証拠等級や用途を足し合わせても、公平な順位にはならないためです。

## Current status

Dot/Muse/Grok Bot/ASISTの公開説明を確認。ASIST v0.7.0の既存実機観察は引き継ぎ情報として記載し、この調査で再試験したとは扱いません。Instinctは製品同定待ち。利用者インタビューも共通シナリオの実行比較も未実施です。

Nestの個人ライター・クリエイター中心という仮説は未検証です。現在のNestは機能的に受け入れられているというユーザー報告があり、研究はUI再実装の指示ではありません。現行動作は[repository README](../../README.md)、将来像は比較ページで明確に分離します。

公開GitにはAPI keys、メールアドレス、ローカルパス、個人会話、ユーザー状態を残しません。実機キャプチャーの閲覧許可は公開許可ではありません。次の更新で必要なもの：利用条件・費用の比較、Instinctの正確なURL、ペルソナ選定の根拠。
