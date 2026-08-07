-- ============================================================
-- 見学日を「NG日方式」→「見学可能日方式（開けた日だけ予約可）」に変更
-- 開発DB（bkukjz）・本番DB（xvdec）の SQL Editor 両方で実行してください。
--
-- 背景: ロケ撮影の90日上限撤廃(PR #65)により、見学カレンダーが
-- 「撮影日の8日前」まで無制限に開き、スタッフが判断していない遠い日にも
-- 見学が入り得る状態になったため、撮影可能日と同じホワイトリスト方式に統一する。
--
-- 初期データ: 今日(JST)から90日分を自動で開放（既存の見学NG日は除く）。
-- 現在の「NG日以外は開いている」状態をそのまま引き継ぎ、切替時に
-- 見学が選べなくなる事故を防ぐ。
-- ※ 初期データ投入はテーブルが空のときだけ実行される（再実行しても
--   スタッフが閉じた日を勝手に開け直さない）。
-- ============================================================

create table if not exists location_visit_days (
  date text primary key
);

insert into location_visit_days (date)
select to_char(d, 'YYYY-MM-DD')
from generate_series(
  (now() at time zone 'Asia/Tokyo')::date,
  (now() at time zone 'Asia/Tokyo')::date + interval '90 days',
  interval '1 day'
) as d
where not exists (select 1 from location_visit_days)
  and to_char(d, 'YYYY-MM-DD') not in (select date from location_visit_blocked_dates)
on conflict (date) do nothing;
