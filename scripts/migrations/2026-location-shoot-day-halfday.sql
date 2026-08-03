-- ============================================================
-- ロケ撮影可能日を「午前 / 午後」で分けて公開できるようにする
-- 開発DB（bkukjz）・本番DB（xvdec）の SQL Editor 両方で実行してください。
-- 冪等（再実行しても安全）。
--
-- 既存の公開日は am / pm ともに true ＝「終日公開」として引き継がれるため、
-- 実行しても現在の公開状況は変わりません。
--   am = 午前の部（9:10〜12:00）を公開するか
--   pm = 午後の部（13:00〜16:00）を公開するか
-- 両方 false の日は行ごと削除する運用（＝非公開）。
-- ============================================================

alter table if exists location_shoot_days
  add column if not exists am boolean not null default true;

alter table if exists location_shoot_days
  add column if not exists pm boolean not null default true;

-- 念のため：万一 NULL が入っている行があれば true（終日公開）に寄せる
update location_shoot_days set am = true where am is null;
update location_shoot_days set pm = true where pm is null;
