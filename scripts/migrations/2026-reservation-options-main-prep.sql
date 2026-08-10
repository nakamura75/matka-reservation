-- ============================================================
-- 予約オプションに「単価上書き」と「ご主役のお支度フラグ」を追加
-- Supabase SQL Editor に貼り付けて実行（開発・本番とも）。冪等。
--
-- unit_price   : この予約での単価。NULL ならオプションマスターの価格を使う。
--                ロケの「ご主役のお支度」はプラン込みのため 0 を入れる
--                （日本髪だけは課金対象なので実額 2200 が入る）。
-- is_main_prep : ご主役のお子様のお支度としての行かどうか。
--                管理画面では「ご主役」と表示し、LINE・領収書からは除外する。
-- ============================================================
alter table reservation_options add column if not exists unit_price integer;
alter table reservation_options add column if not exists is_main_prep boolean not null default false;
