-- ============================================================
-- ロケーション撮影にもモデル撮影プランを追加
-- 開発DB（bkukjz）・本番DB（xvdec）の SQL Editor 両方で実行してください。
-- 冪等（再実行しても安全）。
--
-- スタジオの 'model-shooting' と同じ仕組み:
--   show_in_form = false のため、お客様の予約フォーム(/booking)には表示されず、
--   スタッフの手動予約（管理画面の新規予約・ロケモード）でのみ選択できる。
--   空き枠でモデルさんを呼んでサンプル撮影する運用に使う。
-- ============================================================

insert into plans (id, name, price, duration, description, is_active, show_in_form, shoot_type)
values ('loc-model-shooting', 'モデル撮影（撮影代 ¥0）', 0, 60, null, true, false, 'location')
on conflict (id) do nothing;
