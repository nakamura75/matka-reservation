-- 1. 予約テーブルに割引率カラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS discount_rate INTEGER DEFAULT 0;

-- 2. 注文テーブルに納期カラムを追加、デフォルトを入金済に変更
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE orders ALTER COLUMN is_paid SET DEFAULT true;

-- 3. 注文詳細テーブルに新ステータス用日付カラムを追加
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_date TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS layout_date TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packed_date TEXT;

-- 4. 既存の未入金注文を入金済に更新
UPDATE orders SET is_paid = true, paid_date = order_date WHERE is_paid = false;

-- 5. 既存の旧ステータスを新ステータスにマッピング
--    制作完了 → セレクト済、入荷 → 梱包済
UPDATE order_items SET status = 'セレクト済' WHERE status = '制作完了';
UPDATE order_items SET status = '梱包済' WHERE status = '入荷';
