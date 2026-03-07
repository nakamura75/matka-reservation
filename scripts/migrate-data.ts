/**
 * Google Sheets → Supabase データ移行スクリプト
 *
 * 使い方:
 *   1. Google Sheets から各シートをCSVエクスポート（UTF-8）
 *   2. scripts/csv/ ディレクトリにファイルを配置:
 *      - 顧客.csv, プラン.csv, オプション.csv, 商品.csv, スタッフ.csv
 *      - 予約.csv, 予約オプション.csv, 注文.csv, 注文詳細.csv, 売上明細.csv
 *   3. 環境変数を設定:
 *      export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *      export SUPABASE_SERVICE_ROLE_KEY=xxx
 *   4. 実行:
 *      npx tsx scripts/migrate-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_DIR = join(__dirname, 'csv');

// ============================================================
// CSVパーサー（簡易版、ダブルクォート対応）
// ============================================================
function parseCSV(content: string): Record<string, string>[] {
  // ダブルクォート内の改行に対応したCSVパーサー
  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++;
        current.push(field);
        field = '';
        if (current.some((v) => v.trim())) records.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // 最後のレコード
  current.push(field);
  if (current.some((v) => v.trim())) records.push(current);

  if (records.length < 2) return [];

  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function readCSV(filename: string): Record<string, string>[] {
  const path = join(CSV_DIR, filename);
  if (!existsSync(path)) {
    console.warn(`  ⚠ ${filename} が見つかりません。スキップします。`);
    return [];
  }
  const content = readFileSync(path, 'utf-8');
  const rows = parseCSV(content);
  console.log(`  📄 ${filename}: ${rows.length}行`);
  return rows;
}

// ============================================================
// テーブルごとの移行関数
// ============================================================

async function migrateCustomers() {
  console.log('\n👥 顧客を移行中...');
  const rows = readCSV('顧客.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID顧客']?.trim())
    .map((r) => ({
      id: r['ID顧客'],
      name: r['顧客名'] ?? '',
      furigana: r['フリガナ'] ?? null,
      phone: r['電話番号'] ?? '',
      email: r['メールアドレス'] ?? null,
      zip_code: r['郵便番号'] ?? null,
      address: r['住所'] ?? null,
      line_name: r['LINE名'] ?? null,
      note: r['備考'] ?? null,
      created_at: r['登録日'] ?? null,
    }));

  const { error } = await supabase.from('customers').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migratePlans() {
  console.log('\n📋 プランを移行中...');
  const rows = readCSV('プラン.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['IDプラン']?.trim())
    .map((r) => ({
      id: r['IDプラン'],
      name: r['プラン名'] ?? '',
      price: Number(r['単価']) || 0,
      duration: Number(r['所要時間']) || 90,
      description: r['説明'] ?? null,
      is_active: r['有効'] === 'TRUE' || r['有効'] === '1' || r['有効'] === 'true',
    }));

  const { error } = await supabase.from('plans').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateOptions() {
  console.log('\n🎀 オプションを移行中...');
  const rows = readCSV('オプション.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['IDオプション']?.trim())
    .map((r) => ({
      id: r['IDオプション'],
      name: r['オプション名'] ?? '',
      price: Number(r['単価']) || 0,
      description: r['説明'] ?? null,
      is_active: r['有効'] === 'TRUE' || r['有効'] === '1' || r['有効'] === 'true',
      external_code: r['外部コード'] ?? null,
    }));

  const { error } = await supabase.from('options').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateProducts() {
  console.log('\n📦 商品を移行中...');
  const rows = readCSV('商品.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID商品']?.trim())
    .map((r) => ({
      id: r['ID商品'],
      name: r['商品名'] ?? '',
      price: Number(r['単価']) || 0,
      image: r['商品画像'] ?? null,
      description: r['説明'] ?? null,
      is_active: r['有効'] === 'TRUE' || r['有効'] === '1' || r['有効'] === 'true',
    }));

  const { error } = await supabase.from('products').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateStaff() {
  console.log('\n👤 スタッフを移行中...');
  const rows = readCSV('スタッフ.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['IDスタッフ']?.trim())
    .map((r) => ({
      id: r['IDスタッフ'],
      name: r['スタッフ名'] ?? '',
      is_active: r['有効'] ?? 'TRUE',
      role: r['担当'] ?? null,
    }));

  const { error } = await supabase.from('staff').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateReservations() {
  console.log('\n📅 予約を移行中...');
  const rows = readCSV('予約.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID予約']?.trim())
    .map((r) => ({
      id: r['ID予約'],
      customer_id: r['ID顧客']?.trim() || null,
      plan_id: r['IDプラン']?.trim() || null,
      payment_status: r['支払ステータス'] === 'TRUE' || r['支払ステータス'] === '1',
      payment_date: r['支払日'] || null,
      date: r['予約日'] ?? '',
      time_slot: r['予約時間帯'] ?? '9:00',
      children_count: r['お子様人数'] ? Number(r['お子様人数']) : null,
      adult_count: r['大人人数'] || null,
      family_note: r['構成メモ'] || null,
      status: r['ステータス'] ?? '予約済',
      reference_photo: r['参考写真'] || null,
      note: r['備考'] || null,
      created_at: r['登録日'] || null,
      line_user_id: (r['LINE_UserID'] || r['LINE_UserID '])?.trim() || null,
      flag: r['フラグ'] === 'TRUE',
      phone_preference: r['電話希望'] || null,
      scene: r['撮影シーン'] || null,
      reservation_number: r['予約番号'] || null,
      discount_amount: r['値引額'] ? Number(r['値引額']) : 0,
      discount_reason: r['値引理由'] || null,
      check_in_time: r['入店時間'] || null,
      check_out_time: r['退店時間'] || null,
      staff_assignment_json: r['担当割り当てJSON'] || null,
      customer_note: r['お客様備考'] || null,
      other_scene_note: r['その他を選んだ場合：希望の撮影シーン'] || null,
      chat_line_user_id: r['LINE_ChatUserID'] || null,
      payment_method: r['支払方法'] || null,
    }));

  // 重複IDを除外（後の行を優先）
  const deduped = Array.from(new Map(data.map((d) => [d.id, d])).values());
  console.log(`  📊 重複除外: ${data.length}行 → ${deduped.length}件`);

  // バッチで投入（500件ずつ）
  for (let i = 0; i < deduped.length; i += 500) {
    const batch = deduped.slice(i, i + 500);
    const { error } = await supabase.from('reservations').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`  ❌ バッチ ${i}〜 エラー:`, error.message);
  }
  console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateReservationOptions() {
  console.log('\n🎀 予約オプションを移行中...');
  const rows = readCSV('予約オプション.csv');
  if (!rows.length) return;

  // 投入済みの予約IDを取得して、存在しない予約を参照するレコードをスキップ
  const { data: existingRes } = await supabase.from('reservations').select('id');
  const resIds = new Set((existingRes ?? []).map((r: { id: string }) => r.id));

  const data = rows
    .filter((r) => r['ID予約オプション']?.trim() && resIds.has(r['ID予約']?.trim()))
    .map((r) => ({
      id: r['ID予約オプション'],
      reservation_id: r['ID予約'] ?? '',
      option_id: r['IDオプション'] ?? '',
      quantity: Number(r['数量']) || 1,
      note: r['備考'] || null,
    }));

  console.log(`  📊 FK整合: ${rows.length}行 → ${data.length}件（${rows.length - data.length}件スキップ）`);

  const { error } = await supabase.from('reservation_options').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateOrders() {
  console.log('\n📦 注文を移行中...');
  const rows = readCSV('注文.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID注文']?.trim())
    .map((r) => ({
      id: r['ID注文'],
      customer_id: r['ID顧客'] ?? '',
      reservation_id: r['ID予約'] || null,
      order_date: r['注文日'] ?? '',
      is_paid: r['入金済'] === 'TRUE',
      paid_date: r['入金日'] || null,
      note: r['備考'] || null,
      flag: r['フラグ'] === 'TRUE',
    }));

  const { error } = await supabase.from('orders').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateOrderItems() {
  console.log('\n📝 注文詳細を移行中...');
  const rows = readCSV('注文詳細.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID注文詳細']?.trim())
    .map((r) => ({
      id: r['ID注文詳細'],
      order_id: r['ID注文'] ?? '',
      product_id: r['ID商品'] ?? '',
      customer_id: r['ID顧客'] || null,
      quantity: Number(r['数量']) || 1,
      status: r['ステータス'] ?? '受注',
      completed_date: r['制作完了日'] || null,
      ordered_date: r['発注日'] || null,
      arrived_date: r['入荷日'] || null,
      shipped_date: r['発送日'] || null,
      tracking_number: r['追跡番号'] || null,
      note: r['備考'] || null,
    }));

  const { error } = await supabase.from('order_items').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

async function migrateSales() {
  console.log('\n💰 売上明細を移行中...');
  const rows = readCSV('売上明細.csv');
  if (!rows.length) return;

  const data = rows
    .filter((r) => r['ID売上']?.trim())
    .map((r) => ({
      id: r['ID売上'],
      payment_id: r['決済ID'] || null,
      payment_date_time: r['決済日時'] || null,
      reservation_id: r['ID予約'] ?? '',
      product_name: r['商品名'] ?? '',
      category: r['区分'] ?? '',
      amount: Number(r['金額']) || 0,
      staff_id: r['担当者'] || null,
    }));

  const { error } = await supabase.from('sales').upsert(data, { onConflict: 'id' });
  if (error) console.error('  ❌ エラー:', error.message);
  else console.log(`  ✅ ${data.length}件 投入完了`);
}

// ============================================================
// メイン実行
// ============================================================

async function main() {
  console.log('🚀 Google Sheets → Supabase データ移行を開始します');
  console.log(`📁 CSV読み込み元: ${CSV_DIR}`);
  console.log(`🔗 Supabase: ${SUPABASE_URL}`);

  // 外部キー依存の順序で投入
  await migrateCustomers();
  await migratePlans();
  await migrateOptions();
  await migrateProducts();
  await migrateStaff();
  await migrateReservations();
  await migrateReservationOptions();
  await migrateOrders();
  await migrateOrderItems();
  await migrateSales();

  console.log('\n🎉 移行完了！');
  console.log('\n📌 次のステップ:');
  console.log('  1. Supabase Dashboard でレコード数を確認');
  console.log('  2. holidays テーブルに祝日データを投入');
  console.log('  3. blocked_slots テーブルに定休日データを投入');
}

main().catch((e) => {
  console.error('移行エラー:', e);
  process.exit(1);
});
