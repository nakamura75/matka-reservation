-- ============================================================
-- Phase 3: ロケ稼働日管理（撮影可能日 / 見学NG日）
-- 開発用Supabase（bkukjz）の SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。本番には実行しないこと。
-- 日付は 'YYYY-MM-DD' の text で保持（アプリ側の比較に合わせる）。
-- ============================================================

-- ロケ本番の撮影可能日（この日だけ予約フォームで選択可能）
create table if not exists location_shoot_days (
  date text primary key
);

-- ロケ見学のNG日（この日は見学カレンダーで選択不可）
create table if not exists location_visit_blocked_dates (
  date text primary key
);
