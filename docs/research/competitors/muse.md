# Muse

確認日：2026-10-04。製品build不明。公式紹介：September 2026。等級：announced。実機未検証。

## Facts

[M1] 紹介記事はMain chat、side chats、個性の設定、継続Memoryを説明。ActivityとGoalsで進行を表示し、Memoryは編集可能。定期・イベント作業と重要操作のapproval cardsを説明しています。

## Evaluation

会話を中心に「状態を見る」「止める」「承認する」場所を持つ構造はNestの比較対象になります。実際に初回ユーザーが理解できるか、通知を煩わしく感じるかは未確認。紹介例の成功を一般的な品質保証とは扱いません。

## Sources and visuals

- M1: [How We Designed Muse](https://introducing.muse.ai/), Mona Sarantakos with Christine Awad, September 2026; checked 2026-10-04.
- 公式記事の「Muse status and activity view」「Muse goals and progress view」「Muse checkout approval controls」を参照。画像の転載許諾を確認していないためリンクのみ。
- [比較の概念図](../assets/concepts/interaction-models.svg)：独自図、実画面ではありません。

## Open questions

対象利用者の利用可能性、製品バージョン、通知設定の実操作、誤ったmemoryの修正体験、予定の次回表示。cloudの説明をNestのローカル継続性へ転用しません。

## Execution and delegation

[M2] 技術記事は専用cloud Linux VM、同時subagentsとcrons、独立したSentinelの承認境界を説明。内部subagentsがあることは、ユーザー管理の複数Bot libraryがある証明にはなりません。復旧や承認をuniversal rollbackと解釈しません。

- M2: [How We Built Safety Into Muse](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse), published 2026-09-08; checked 2026-10-04.
- M3: [Official subscription information](https://www.meta.com/help/subscriptions/1021145227643680/), checked 2026-10-04. 最新plan・地域・allowance条件は契約前に確認が必要。

Reusable Bot roster / global Kanbanは未確認。clientの存在はlocal inferenceを意味しません。
