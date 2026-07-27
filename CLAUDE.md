# matka-reservation 開発ルール

Matka Photo Studio の撮影予約システム（Next.js + Supabase / Vercel にデプロイ）。

## 日付・時刻の取り扱い（重要）

**前提: 本番サーバー(Vercel)の時計は世界標準時(UTC)で、日本より9時間遅れている。**
開発PCは日本時間(JST)のため、タイムゾーン起因のずれは「手元では絶対に再現しない」。
実際に 2026-03 のリファクタで混入した1行の `getDate()` が原因で、本番の領収書の
撮影日が3ヶ月以上1日前に印字されていた（2026-07 に発覚、PR #51/#52 で修正）。

### ルール

1. **日付は `"YYYY-MM-DD"` の文字列のまま** 保存・受け渡し・表示する。
   表示するときも文字列を分解する。Date型に変換してから取り出さない。

2. **Date型から日付・曜日を取り出すのは原則禁止。**
   - ダメな例: `d.getDate()` / `d.getDay()` / `d.toLocaleDateString('ja-JP')`（timeZone未指定）
   - 使うなら必ずタイムゾーンを明示する:
     - `toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })`
     - または `Date.UTC(...)` + `getUTCDay()` などのUTC系メソッド
   - 例外: `'use client'` コンポーネント内は利用者のブラウザ(JST)で動くため
     ローカルゲッターでも実害はないが、コードのコピペ事故を防ぐため同じルールを推奨。

3. **サーバー側で「今日の日付」を作るときは JST を明示する**
   （`src/lib/utils.ts` の `formatDate` / `isWeekend` はタイムゾーン非依存に修正済み。
   　`src/lib/slots.ts` の JSTヘルパー方式も可）。

4. **日付まわりの動作確認は UTC で行う**:
   `TZ=UTC node -e '...'` で本番と同じ条件を再現してから確認する。
   日本時間のPCで正常に見えても本番でずれることがある。

5. レビュー時の合言葉: **「getDate() を見たら疑え」**

## その他

- 本番DB は Supabase `xvdeclpopokvdogyycop`（matka-reservation）、
  開発DB は `bkukjzrlawczylzmhhnz`（matka_resarvation_Development DB）。
  `.env.local` は開発DBを指すこと（`scripts/copy-prod-to-dev.mjs` 参照）。
- 予約フォームは `/booking`（スタジオ / ロケ）。ロケは見学あり・なしの両導線がある。
