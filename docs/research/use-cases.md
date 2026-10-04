# Common journeys and persona hypotheses

2026-10-04 / Proposed research protocol. 実行比較・ユーザー検証は未実施。

## Personas to test

| Hypothesis | 困りごと | 検証すべき点 |
| --- | --- | --- |
| 個人ライター／クリエイター | 原稿の変化と次の修正を継続して追いたい | 繰り返し依頼が必要か、ローカル原稿が価値か |
| 個人の情報収集者 | 同じ公開情報の重要な変化だけ知りたい | 通知頻度と根拠の見せ方への期待 |
| 日々の予定を整理する人 | 会話と予定・タスクの状態を結び付けたい | 連携必須か、ローカル機能だけでも役立つか |

第一候補をライターに固定せず、最近の具体的な作業、現在の代替手段、頻度、許せない誤動作を聞きます。利用意向だけで対象を決めません。

## Synthetic tasks

同じ小さな架空データを使い、実アカウント・支払い・送信を必要とする操作は比較対象から外します。各製品の利用可能性・費用・許可を確認してから別途実行します。

| Journey | 同じ依頼 | 観察・成功条件 |
| --- | --- | --- |
| J1 First value | 「この架空原稿の改善点を3つ」 | setupから最初の根拠付き結果までの障害 |
| J2 Recurring work | 「この架空情報を毎日確認」 | 単発との区別、次回時刻、sleep/quit時の説明 |
| J3 Review and stop | 「何が進行中？この仕事を止めて」 | 停止対象、保留・失敗・完了の区別 |
| J4 Correct memory | 「この好みを忘れて、別のBotには渡さないで」 | 編集・削除・適用範囲と承認の理解 |
| J5 Reuse a role | 「同じ編集者を別の架空原稿に」 | blueprintとinstance、記憶・scopeの混同 |

各journeyを「対応／限定／対象外／未確認」で記録。対象外なら無理に操作しません。所要時間、支援回数、結果の根拠、利用者が説明できた状態を残し、動作の正しさと好みを分けます。

## Observation record

```text
Date and timezone / product / version / plan / platform / model:
Execution location / source scope / fixture hash:
Journey and synthetic fixture:
Evidence grade and source:
Prompt / observed steps / timestamps / public-safe screenshots / visible result:
Interventions / UI estimated usage / provider records / actual billing:
Limitations / untested behavior:
Participant interpretation (anonymized):
Researcher evaluation:
Implication and linked proposed decision:
```

UIの印象だけではschedulerの耐久性、memory隔離、実行の安全性は証明できません。Nestの現行機能への回帰確認と競合UXの調査は分けます。

## Three proposed end-to-end scenarios

| Scenario | Synthetic input and request | What to compare |
| --- | --- | --- |
| S1 Draft review | 小さな架空原稿＋notes→read-only review、source gaps、3 priorities | upload copyとselected folderの違い、setup、許可、根拠・品質 |
| S2 Weekly follow-up | S1成功後「毎週月曜09:00 Asia/Tokyoに要約」 | owner / scope / timezone / next run / state / prior result / pause / edit |
| S3 Bounded review handoff | 架空brief内の根拠のない主張2件→separate reviewer→reconciled result | 実行上の委任かroleplayか、根拠、owner、cost、stop propagation |

**未実行の研究シナリオです。** 現行Nestはcalendar timezone recurrenceやBot間委任を実装していないため、S2は現行intervalと要求のgapとして、S3は将来の研究として記録。機能を追加して試験を成立させません。S2のsleep/quit/failureは後日のbounded testのみ。Run nowの成功をscheduled runの成功とは扱いません。
