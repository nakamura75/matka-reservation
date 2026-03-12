-- ============================================================
-- Matka Reservation - Supabase Schema
-- Google Sheets/Calendar → Supabase 移行用
-- ============================================================

-- UUID生成用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 顧客 (customers)
-- ============================================================
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  furigana TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  zip_code TEXT,
  address TEXT,
  line_name TEXT,
  line_user_id TEXT,
  chat_line_user_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_line_user_id ON customers(line_user_id);

-- ============================================================
-- 2. プラン (plans)
-- ============================================================
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 90,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 3. オプション (options)
-- ============================================================
CREATE TABLE options (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  external_code TEXT
);

-- ============================================================
-- 4. 商品 (products)
-- ============================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 5. スタッフ (staff)
-- ============================================================
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active TEXT DEFAULT 'TRUE',
  role TEXT
);

-- ============================================================
-- 6. 予約 (reservations)
-- ============================================================
CREATE TABLE reservations (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES plans(id),
  payment_status BOOLEAN NOT NULL DEFAULT false,
  payment_date TEXT,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  children_count INTEGER,
  adult_count TEXT,
  family_note TEXT,
  status TEXT NOT NULL DEFAULT '予約済',
  reference_photo TEXT,
  note TEXT,
  created_at TEXT,
  line_user_id TEXT,
  flag BOOLEAN DEFAULT false,
  phone_preference TEXT,
  scene TEXT,
  reservation_number TEXT,
  discount_amount INTEGER DEFAULT 0,
  discount_reason TEXT,
  check_in_time TEXT,
  check_out_time TEXT,
  calendar_event_id TEXT,
  pdf_url TEXT,
  staff_assignment_json TEXT,
  customer_note TEXT,
  other_scene_note TEXT,
  chat_line_user_id TEXT,
  payment_method TEXT
);

CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX idx_reservations_reservation_number ON reservations(reservation_number);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_line_user_id ON reservations(line_user_id);

-- 同日同時間帯の重複予約を防止（キャンセル・見学・保留は除外するため部分インデックス）
CREATE UNIQUE INDEX idx_reservations_no_duplicate
  ON reservations(date, time_slot)
  WHERE status NOT IN ('キャンセル', '見学', '保留');

-- ============================================================
-- 7. 予約オプション (reservation_options)
-- ============================================================
CREATE TABLE reservation_options (
  id TEXT PRIMARY KEY,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
  option_id TEXT REFERENCES options(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT
);

CREATE INDEX idx_reservation_options_reservation_id ON reservation_options(reservation_id);

-- ============================================================
-- 8. 注文 (orders)
-- ============================================================
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  reservation_id TEXT,
  order_date TEXT NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date TEXT,
  note TEXT,
  flag BOOLEAN DEFAULT false
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- ============================================================
-- 9. 注文詳細 (order_items)
-- ============================================================
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  customer_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '受注',
  completed_date TEXT,
  ordered_date TEXT,
  arrived_date TEXT,
  shipped_date TEXT,
  tracking_number TEXT,
  note TEXT
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- 10. 売上明細 (sales)
-- ============================================================
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  payment_date_time TEXT,
  reservation_id TEXT,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  staff_id TEXT
);

CREATE INDEX idx_sales_reservation_id ON sales(reservation_id);

-- ============================================================
-- 11. 祝日 (holidays) - 新規（Google Calendar祝日の代替）
-- ============================================================
CREATE TABLE holidays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'holiday'
);

-- ============================================================
-- 12. ブロック枠 (blocked_slots) - 新規（Google Calendar代替）
-- ============================================================
CREATE TABLE blocked_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  time_slot TEXT,
  reason TEXT
);

CREATE INDEX idx_blocked_slots_date ON blocked_slots(date);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

-- 全テーブルでRLSを有効化
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザー（管理者）→ 全テーブル全操作
CREATE POLICY "admin_all" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON plans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON options FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON staff FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON reservations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON reservation_options FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON order_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON sales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON holidays FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_all" ON blocked_slots FOR ALL USING (auth.role() = 'authenticated');
-- 匿名（予約フォーム）→ マスターデータの参照
CREATE POLICY "anon_read_plans" ON plans FOR SELECT USING (true);
CREATE POLICY "anon_read_options" ON options FOR SELECT USING (true);
CREATE POLICY "anon_read_holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "anon_read_blocked_slots" ON blocked_slots FOR SELECT USING (true);

-- 匿名（予約フォーム）→ 予約関連の書き込み
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_customers" ON customers FOR SELECT USING (true);
CREATE POLICY "anon_insert_reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "anon_insert_reservation_options" ON reservation_options FOR INSERT WITH CHECK (true);
