-- ============================================================
-- 2026-10-15 料金改定（スタジオ: Maternityプラン + お支度/ヘアメイク系オプション14件）
--
-- 方式: 料金マスターは予約から参照され続けるため、既存行の価格は書き換えず
--       「新料金の行を新規作成し、旧料金の行を無効化・フォーム非表示にする」。
--       これにより過去・既存予約は予約時の料金のまま、新規予約のみ新料金になる。
--
-- 実行: pg_cron に job 名 'price-revision-20261015' で登録し、
--       2026-10-14 15:00 UTC（= 10/15 0:00 JST）に自動実行。
--       実行結果は cron.job_run_details で確認し、確認後 cron.unschedule する。
--
-- 対象外: ロケーションのプラン・お支度（先方確認済み）、商品（10/3に先方が変更済み・
--         過去注文への unit_price 焼き付け修復は 10/13 実施済み）。
--
-- 担当配分: 新Maternityプランは Discovery と統一配分（コード側 LEGACY_MATERNITY_PLAN_IDS 参照）。
-- ============================================================

-- ■ 新プラン（旧: 平日33,000 / 休日38,500 → 新: Discoveryと統一価格）
insert into plans (id, name, price, duration, is_active, show_in_form, shoot_type) values
  ('20261015-maternity-weekday', 'Maternity Plan（平日）', 49500, 90, true, true, 'studio'),
  ('20261015-maternity-holiday', 'Maternity Plan（休日）', 55000, 90, true, true, 'studio')
on conflict (id) do nothing;

-- 旧Maternityプランをフォーム非表示・無効化（過去予約の表示・金額参照はそのまま生きる）
update plans set show_in_form = false, is_active = false
where id in ('20260122221555_4134C939', '20260122221555_BDA7648C');

-- ■ 新オプション（名前・説明・表示設定は旧行を踏襲、価格のみ新料金。外部コードは新行へ引き継ぎ）
insert into options (id, name, price, description, is_active, show_in_form, shoot_type, external_code) values
  ('20261015-op001-hifu',            '被布着付け',                 6600, '※3歳(男女ともに)のお着付けはこちら',                                        true, true,  'studio', 'OP001'),
  ('20261015-op002-haori-hakama',    '羽織袴着付け',               7700, '※5歳男の子のお着付けはこちら',                                              true, true,  'studio', 'OP002'),
  ('20261015-op003-tsukuriobi',      '着物（作り帯）着付け',       8800, '※5歳以上の女の子はこちら（当店着付けの場合は作り帯のみ）',                  true, true,  'studio', 'OP003'),
  ('20261015-op004-musubiobi',       '着物（結び帯）着付け',      11000, '※持ち込み着物が結び帯の場合はこちら',                                        true, true,  'studio', 'OP004'),
  ('20261015-op005-nihongami',       '日本髪',                     3300, '',                                                                            true, true,  'studio', 'OP005'),
  ('20261015-op006-mother-hair',     'お母様ヘアセット',           6600, '※人員のかねあいにより日時変更をお願いする可能性がございます。',              true, true,  'studio', 'OP006'),
  ('20261015-op007-mother-makeup',   'お母様フェイスメイク',       5500, '※人員のかねあいにより日時変更をお願いする可能性がございます。',              true, true,  'studio', 'OP007'),
  ('20261015-op008-father-hair',     'お父様ヘアセット',           4400, '※人員のかねあいにより日時変更をお願いする可能性がございます。',              true, true,  'studio', 'OP008'),
  ('20261015-op009-mother-kitsuke',  'お母様着付け',               9900, '※月曜日は不可（人員のかねあいにより日時変更をお願いする可能性がございます。）', true, true,  'studio', 'OP009'),
  ('20261015-op010-father-kitsuke',  'お父様着付け（ヘアセット込）', 9900, '※月曜日は不可（人員のかねあいにより日時変更をお願いする可能性がございます。）', true, true,  'studio', 'OP010'),
  ('20261015-father-hair-makeup',    'お父様ヘア+フェイスメイク',  5500, '※人員のかねあいにより日時変更をお願いする可能性がございます。',              true, true,  'studio', ''),
  ('20261015-furisode',              '振袖着付け',                15400, '',                                                                            true, false, 'studio', ''),
  ('20261015-seijin-hair',           '成人式ヘアセット',          11000, '',                                                                            true, false, 'studio', ''),
  ('20261015-seijin-makeup',         '成人式フェイスメイク',       7700, '',                                                                            true, false, 'studio', '')
on conflict (id) do nothing;

-- 旧オプションをフォーム非表示・無効化（管理画面の追加候補から消え、既存予約の金額参照はそのまま）
-- 外部コードは新行へ移したため旧行からは外す
update options set show_in_form = false, is_active = false, external_code = ''
where id in (
  '20260122205222_E07C5B3E', '20260122205222_4959FA9C', '20260122205222_F735435B',
  '20260122205222_CC3481D5', '20260122205222_C239EBF0', '20260122205222_0135B48D',
  '20260122205222_A2E78B7A', '20260122205222_88F96FD9', '20260122205222_3B60CFC2',
  'opt_father_makeup', '20260122205222_75D70EC7', 'opt_furisode',
  'opt_seijin_hair', 'opt_seijin_makeup'
);
