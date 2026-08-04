-- ============================================================
-- 予約詳細への画像アップロード機能
-- 開発DB（bkukjz）・本番DB（xvdec）の SQL Editor 両方で実行してください。
-- 冪等（再実行しても安全）。
--
-- ・reservation_photos: 予約に紐づく画像のメタデータ（枚数無制限）
-- ・storage バケット reservation-photos: 画像本体（非公開。
-- 　サーバー側の service_role 経由でのみアップロード/署名付きURL発行を行う）
-- ============================================================

create table if not exists reservation_photos (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null,
  path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservation_photos_reservation
  on reservation_photos (reservation_id);

-- 非公開バケット（RLSポリシーは追加しない＝anonキーからは一切アクセス不可。
-- 読み書きはすべてサーバーの service_role クライアント経由）
insert into storage.buckets (id, name, public)
values ('reservation-photos', 'reservation-photos', false)
on conflict (id) do nothing;
