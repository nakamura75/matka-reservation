-- ============================================================
-- ロケの担当割り当て用に店舗「matka.」をスタッフとして登録
-- （既存の matka. は shoot_type='studio' のためロケモードの
-- 　プルダウンに出てこない。ロケ用に1件用意する）
-- Supabase SQL Editor に貼り付けて実行（開発・本番とも）。冪等。
-- ============================================================
insert into staff (id, name, is_active, role, shoot_type) values
  ('loc-staff-matka', 'matka.', 'TRUE', '', 'location')
on conflict (id) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  shoot_type = excluded.shoot_type;
