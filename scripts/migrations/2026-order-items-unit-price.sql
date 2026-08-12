-- 注文明細に単価上書き列を追加
-- セットプラン（Album Plan / Frame Plan）に含まれる商品を注文に自動計上する際、
-- 商品マスターの定価ではなくセット掛け値（Crystal Book ¥39,600 / Walnut Frame 8×10 ¥12,100）で
-- 計上するために使う。NULL はマスター価格を使う意味（reservation_options.unit_price と同じ規約）。
alter table order_items add column if not exists unit_price integer;
