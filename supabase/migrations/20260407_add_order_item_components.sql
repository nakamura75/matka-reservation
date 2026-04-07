-- セット商品の中身（コンポーネント）を個別に進捗管理するためのテーブル
CREATE TABLE IF NOT EXISTS order_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '受注',
  selected_date TEXT,
  layout_date TEXT,
  ordered_date TEXT,
  packed_date TEXT,
  shipped_date TEXT,
  tracking_number TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE order_item_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do everything on order_item_components"
  ON order_item_components
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
