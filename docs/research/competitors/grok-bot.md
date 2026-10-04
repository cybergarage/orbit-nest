# Grok Bot

確認日：2026-10-04。アプリbuild不明。G1更新：2026-09-29、G2更新：2026-09-21。等級：documented。実機未検証。

## Facts

[G1] 名前・jobを持つBotに役割を与えます。Duplicateはprofile等を引き継ぐ一方、履歴・学習memoryを複製しません。template共有は別のcopyを作成します。

[G2] Botごとの会話と文脈は分かれますが、computerのfiles・sessions・loginsは共有。cloudで継続し、Bot間のhandoffも説明されています。

[G3] 公開Marketplaceには検索、用途別category、character cardsが表示されています。Add後の動作は試していません。

## Evaluation

「役割の型」と「実際に働く個体」を分ける比較材料になります。名前が分かれていても資源まで隔離されるとは限らない点は、Nestのscope説明で確認したい論点です。複数Botの存在だけを目的にせず、引継ぎに価値がある仕事を先に調べます。

## Sources and visuals

- G1: [Create and manage Bots](https://docs.x.ai/grok-bot/bots), checked 2026-10-04.
- G2: [Grok Bot overview](https://docs.x.ai/grok-bot/overview), checked 2026-10-04.
- 今回の資料は操作説明。[G3: 公開Marketplace](https://x.ai/bot/marketplace)の[画面引用](../assets/grok-bot/marketplace-public.jpg)を掲載。公開サイトの観察でありinstalled appではありません。実画面を再現した画像は作っていません。[独自概念図](../assets/concepts/interaction-models.svg)を参照。

## Open questions

実際の作成・複製・停止画面、次回予定の分かりやすさ、記憶修正体験、利用可能性。職業的jobの事例が個人ライターにも適合するかは未検証。

## Routines, delegation, models

[G4] Routinesはschedule / supported events、owning Bot、timezone、next run、edit/pause/test/historyを説明。Run nowだけでは予定実行を検証したことになりません。

[G5] 非同期メッセージで相手Botを起こし、2–6 Botsのgroupとhandoffを説明。ユーザー管理のBot rosterと内部subagentを区別します。耐久的なglobal Kanbanは今回の資料では未確認。

- G4: [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations), updated 2026-09-14; checked 2026-10-04.
- G5: [Message and collaborate](https://docs.x.ai/grok-bot/chat-and-collaboration), updated 2026-09-21; checked 2026-10-04.
- G6: [Settings and notifications](https://docs.x.ai/grok-bot/settings-and-notifications), updated 2026-09-28; checked 2026-10-04. 現行の当該ページはCursorがmodel selectionを管理しpickerはないと記述。一般のGrok/API全体の仕様ではありません。
- G7: [Plans and usage](https://cursor.com/help/grok-bot/plans), checked 2026-10-04. 対象paid plan・weekly allowance・overage条件があり、無制限無料とは扱いません。
