-- ============================================================
-- 顧客に利用区分（スタジオ/ロケ/両方）を追加
-- Supabase SQL Editor に貼り付けて実行してください（開発・本番とも）。
-- 冪等（再実行しても安全）。既存顧客は全員 'studio' 扱いになる。
-- ============================================================

alter table if exists customers
  add column if not exists shoot_type text not null default 'studio';
