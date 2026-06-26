-- 本番(xvdeclpopokvdogyycop)のスキーマから自動生成
-- 開発用Supabaseの SQL Editor に貼り付けて実行してください
-- 注意: デフォルト値(gen_random_uuid()/now()等)・索引・外部キー・RLSは含まれません（必要なら別途）

CREATE TABLE IF NOT EXISTS "blocked_slots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "time_slot" text,
  "reason" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "furigana" text,
  "phone" text NOT NULL,
  "email" text,
  "zip_code" text,
  "address" text,
  "line_name" text,
  "line_user_id" text,
  "chat_line_user_id" text,
  "note" text,
  "created_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "holidays" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "options" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL,
  "external_code" text,
  "sort_order" integer,
  "show_in_form" boolean,
  "shoot_type" text NOT NULL DEFAULT 'studio',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_item_components" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_item_id" text NOT NULL,
  "name" text NOT NULL,
  "quantity" integer NOT NULL,
  "status" text NOT NULL,
  "selected_date" text,
  "layout_date" text,
  "ordered_date" text,
  "packed_date" text,
  "shipped_date" text,
  "tracking_number" text,
  "note" text,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" text NOT NULL,
  "order_id" text,
  "product_id" text,
  "customer_id" text,
  "quantity" integer NOT NULL,
  "status" text NOT NULL,
  "completed_date" text,
  "ordered_date" text,
  "arrived_date" text,
  "shipped_date" text,
  "tracking_number" text,
  "note" text,
  "selected_date" text,
  "layout_date" text,
  "packed_date" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text NOT NULL,
  "customer_id" text,
  "reservation_id" text,
  "order_date" text NOT NULL,
  "is_paid" boolean NOT NULL,
  "paid_date" text,
  "note" text,
  "flag" boolean,
  "deadline" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "plans" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "duration" integer NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL,
  "show_in_form" boolean,
  "shoot_type" text NOT NULL DEFAULT 'studio',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "image" text,
  "description" text,
  "is_active" boolean NOT NULL,
  "sort_order" integer,
  "shoot_type" text NOT NULL DEFAULT 'studio',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservation_options" (
  "id" text NOT NULL,
  "reservation_id" text,
  "option_id" text,
  "quantity" integer NOT NULL,
  "note" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" text NOT NULL,
  "customer_id" text,
  "plan_id" text,
  "payment_status" boolean NOT NULL,
  "payment_date" text,
  "date" text NOT NULL,
  "time_slot" text NOT NULL,
  "children_count" integer,
  "adult_count" text,
  "family_note" text,
  "status" text NOT NULL,
  "reference_photo" text,
  "note" text,
  "created_at" text,
  "line_user_id" text,
  "flag" boolean,
  "phone_preference" text,
  "scene" text,
  "reservation_number" text,
  "discount_amount" integer,
  "discount_reason" text,
  "check_in_time" text,
  "check_out_time" text,
  "calendar_event_id" text,
  "pdf_url" text,
  "staff_assignment_json" text,
  "customer_note" text,
  "other_scene_note" text,
  "chat_line_user_id" text,
  "payment_method" text,
  "discount_rate" integer,
  "sns_permission" text,
  "product_discount_rate" integer,
  "photo_delivered" boolean,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sales" (
  "id" text NOT NULL,
  "payment_id" text,
  "payment_date_time" text,
  "reservation_id" text,
  "product_name" text NOT NULL,
  "category" text NOT NULL,
  "amount" integer NOT NULL,
  "staff_id" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "staff" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "is_active" text,
  "role" text,
  "shoot_type" text NOT NULL DEFAULT 'studio',
  PRIMARY KEY ("id")
);

