-- ============================================================
-- Phase 2: スタジオ/ロケ 設定データ分離
-- 開発用Supabase（bkukjz）の SQL Editor に貼り付けて実行してください。
-- 冪等（再実行しても安全）。本番には実行しないこと。
-- ============================================================

-- 1) 各設定テーブルに shoot_type 列を追加（既存行は studio 扱い）
alter table if exists plans    add column if not exists shoot_type text not null default 'studio';
alter table if exists options  add column if not exists shoot_type text not null default 'studio';
alter table if exists products add column if not exists shoot_type text not null default 'studio';
alter table if exists staff    add column if not exists shoot_type text not null default 'studio';

-- 2) ロケ用オプションを seed（子供向け：着付け4種＋日本髪）
insert into options (id, name, price, description, is_active, external_code, show_in_form, sort_order, shoot_type) values
  ('loc-opt-hifu',      '被布着付け',           4400, '※3歳（男女ともに）のお着付けはこちら',                     true, '', true, 1, 'location'),
  ('loc-opt-hakama',    '羽織袴着付け',         5500, '※5歳男の子のお着付けはこちら',                             true, '', true, 2, 'location'),
  ('loc-opt-tsukuri',   '着物（作り帯）着付け', 6600, '※5歳以上の女の子はこちら（当店着付けの場合は作り帯のみ）', true, '', true, 3, 'location'),
  ('loc-opt-musubi',    '着物（結び帯）着付け', 8800, '※持ち込み着物が結び帯の場合はこちら',                       true, '', true, 4, 'location'),
  ('loc-opt-nihongami', '日本髪',               1100, '',                                                         true, '', true, 5, 'location')
on conflict (id) do nothing;

-- 3) ロケ用ベーシックプラン（平日77,000円。休日+5,500円はフォーム側ロジック）
insert into plans (id, name, price, duration, description, is_active, shoot_type) values
  ('loc-plan-basic', 'ベーシックプラン', 77000, 180, '休日は+5,500円', true, 'location')
on conflict (id) do nothing;
