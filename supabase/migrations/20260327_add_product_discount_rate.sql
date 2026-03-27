-- 商品割引率カラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS product_discount_rate INTEGER DEFAULT 0;
