-- ============================================================
-- ロケ予約の項目追加：見学日 / キャンセル保険
-- 開発用Supabase（bkukjz）の SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。本番には実行しないこと。
-- ============================================================

alter table if exists reservations add column if not exists visit_date text;
alter table if exists reservations add column if not exists cancel_insurance text;
