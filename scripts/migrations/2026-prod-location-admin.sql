-- ============================================================
-- 本番DB（xvdec）用マイグレーション：スタジオ/ロケ 管理画面の本番反映
-- Supabase 本番プロジェクトの SQL Editor に貼り付けて実行してください。
-- すべて冪等（再実行しても安全）。
--
-- 内容：
--   1. 設定テーブルへ shoot_type 列を追加（既存行は studio 扱い）
--   2. reservations へ shoot_type / visit_date / cancel_insurance 列を追加
--   3. ロケ稼働日テーブル（撮影可能日 / 見学NG日）を作成
--   4. ロケ用の初期プラン・オプションを seed
--      （管理画面から後で編集・削除可能。不要なら §4 を実行しない選択も可）
-- ============================================================

-- 1) 設定テーブルに shoot_type 列（既存データは studio）
alter table if exists plans    add column if not exists shoot_type text not null default 'studio';
alter table if exists options  add column if not exists shoot_type text not null default 'studio';
alter table if exists products add column if not exists shoot_type text not null default 'studio';
alter table if exists staff    add column if not exists shoot_type text not null default 'studio';

-- 2) reservations にロケ用の列（shoot_type / 見学日 / キャンセル保険）
alter table if exists reservations add column if not exists shoot_type       text not null default 'studio';
alter table if exists reservations add column if not exists visit_date       text;
alter table if exists reservations add column if not exists cancel_insurance text;

-- 3) ロケ稼働日テーブル（日付は 'YYYY-MM-DD' の text）
create table if not exists location_shoot_days (
  date text primary key
);
create table if not exists location_visit_blocked_dates (
  date text primary key
);

-- 4) ロケ用 初期データ（本物の料金表・2026-07）※管理画面で後から編集・削除可
--    先に既存の仮ロケデータ（開発DBで先行投入したもの）を掃除して置き換える。
--    ※ shoot_type='location' のプラン/オプション/商品のみ削除（スタジオには影響なし）
delete from plans   where shoot_type = 'location';
delete from options where shoot_type = 'location';
delete from products where shoot_type = 'location';

--    プラン（平日/休日を別レコード）
insert into plans (id, name, price, duration, description, is_active, shoot_type) values
  ('loc-plan-basic-weekday',   'Basic Plan（平日）',   77000,  180, '', true, 'location'),
  ('loc-plan-basic-holiday',   'Basic Plan（休日）',   82500,  180, '', true, 'location'),
  ('loc-plan-frame-weekday',   'Frame Plan（平日）',   89100,  180, '', true, 'location'),
  ('loc-plan-frame-holiday',   'Frame Plan（休日）',   94600,  180, '', true, 'location'),
  ('loc-plan-album-weekday',   'Album Plan（平日）',  116600,  180, '', true, 'location'),
  ('loc-plan-album-holiday',   'Album Plan（休日）',  122100,  180, '', true, 'location')
on conflict (id) do nothing;

--    オプション（着付け＋ヘアメイク）
insert into options (id, name, price, description, is_active, external_code, show_in_form, sort_order, shoot_type) values
  ('loc-opt-3m-hifu',   '3歳男の子 被布+ヘアメイク', 8800,  '', true, '', true, 1, 'location'),
  ('loc-opt-3f-hifu',   '3歳女の子 被布+ヘアメイク', 13200, '', true, '', true, 2, 'location'),
  ('loc-opt-5m-hakama', '5歳男の子 袴+ヘアメイク',   9900,  '', true, '', true, 3, 'location'),
  ('loc-opt-7f-obi',    '7歳女の子 帯+ヘアメイク',   15400, '', true, '', true, 4, 'location'),
  ('loc-opt-hm-boy',    'ヘアメイクのみ（男の子）',  4400,  '', true, '', true, 5, 'location'),
  ('loc-opt-hm-girl',   'ヘアメイクのみ（女の子）',  8800,  '', true, '', true, 6, 'location')
on conflict (id) do nothing;

--    商品（アルバム／フレーム）
insert into products (id, name, price, description, is_active, sort_order, shoot_type) values
  ('loc-prod-crystal-book',  'Crystal Book（アルバム）',  49500, '', true, 1, 'location'),
  ('loc-prod-photo-magazine','Photo Magazine（アルバム）',27500, '', true, 2, 'location'),
  ('loc-prod-walnut-6x8',    'Walnut Frame 6×8',          15400, '', true, 3, 'location'),
  ('loc-prod-walnut-8x10',   'Walnut Frame 8×10',         19800, '', true, 4, 'location'),
  ('loc-prod-walnut-10x10',  'Walnut Frame 10×10',        24200, '', true, 5, 'location')
on conflict (id) do nothing;

-- ============================================================
-- 確認用（任意）：
--   select column_name from information_schema.columns
--     where table_name='reservations' and column_name in ('shoot_type','visit_date','cancel_insurance');
--   select id,name,price from plans   where shoot_type='location' order by id;
--   select id,name,price from options where shoot_type='location' order by sort_order;
--   select id,name,price from products where shoot_type='location' order by sort_order;
-- ============================================================
