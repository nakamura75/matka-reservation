-- UI 上「完了」表示の予約（status='予約確定' かつ予約日が過去）は
-- 実運用上すでに撮影データ送付済のため、photo_delivered を一括で true に更新する。
-- 未送付トラッキングは本マイグレーション以降に「完了」になる予約に対して運用する。
UPDATE reservations
SET photo_delivered = true
WHERE status = '予約確定'
  AND date::date < CURRENT_DATE
  AND photo_delivered IS NOT TRUE;
