# ASIST

確認日：2026-10-04。既存実機観察：v0.7.0 / macOS / 2026-10-04（引き継ぎ情報、今回再試験なし）。公式READMEはmoving main、固定版の仕様とは区別。等級：documented + inherited hands-on。

## Facts

[A1] 音声・テキスト会話、Cards、Tasks / Agent jobs / Notes / Mail / Memory / Calendarのmini appsを説明。会話モデルを選び、長い仕事をCLIへ渡す前に承認。ローカル保存とモデルproviderへの送信を区別しています。

[H1] 既存実機観察ではsetupに準備済み／未準備の段階があり、会話、Tasks、Agent jobs、Memoryが別画面でした。これはUI観察であり内部schedulerの検証ではありません。

## Evaluation

用途から始めるsetupは初回成功への導線として有望。既存観察では狭い会話領域とTasks / Agent jobs / Memoryの使い分けが曖昧に感じられました。観察者の評価であり、一般ユーザーにも同じ問題があるとは未検証です。

## Sources and visuals

- A1: [Official repository README](https://github.com/nyosegawa/asist), checked 2026-10-04; [official documentation](https://asist-agent.com/en/docs/usage/)は今回の取得でアクセスできず、根拠として利用していません。
- H1: Prior user-authorized local observation supplied to this task; private captures are excluded from Git. 公開再現可能な証拠はA1を優先。
- READMEのCalendar / Agent jobs / Memory / Mail紹介と公式サイトを参照。画像は転載せず、[独自概念図](../assets/concepts/interaction-models.svg)に抽象化。

## Open questions

TasksとAgent jobsの関係、反復予定・次回実行の説明、記憶の適用範囲。これらはUIからbackendを推定せず別途確認します。

## Version and limits

- A2: [ASIST v0.7.0 release](https://github.com/nyosegawa/asist/releases/tag/v0.7.0), released 2026-10-03; checked 2026-10-04. 実機観察のversionと対応します。
- A3: [Model settings](https://asist-agent.com/en/docs/settings/models/), checked 2026-10-04; 今回のWeb取得は失敗。モデルprovider選択はA1のREADMEを根拠にしています。

既存観察にTasksのdue dateはあるものの、任意のユーザー反復jobは未確認。毎日のmemory整理とユーザーの定期依頼は同じ機能ではありません。CLI jobの承認は任意操作の安全保証でもuniversal undoでもありません。API usageのUI見積と実請求、CLI provider費用は分けて記録します。
