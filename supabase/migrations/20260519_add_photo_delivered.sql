-- 撮影データ送付済みフラグ
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS photo_delivered BOOLEAN DEFAULT false;
