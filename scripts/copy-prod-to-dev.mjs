// ============================================================
// 本番Supabase → 開発Supabase へ全テーブルのデータをコピーする。
//   読み元: .env.prod.local（本番・読み取りのみ）
//   書き先: .env.local       （開発・upsertで投入）
// 冪等: id一致でupsertするため再実行しても重複しない。
//   実行: node scripts/copy-prod-to-dev.mjs
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(path) {
  const txt = readFileSync(path, 'utf8');
  const get = (k) => {
    const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

const prodEnv = loadEnv('.env.prod.local');
const devEnv = loadEnv('.env.local');

// 取り違え防止: 読み元(本番)と書き先(開発)が同じURLなら中止
if (!prodEnv.url || !devEnv.url) { console.error('URL/KEY 取得失敗'); process.exit(1); }
if (prodEnv.url === devEnv.url) {
  console.error('!! 読み元(本番)と書き先(開発)のURLが同一です。中止します。');
  console.error('   .env.local が開発DBを指しているか確認してください。');
  process.exit(1);
}

const ref = (u) => (u.match(/https:\/\/([^.]+)\./) || [])[1] ?? u;
console.log(`読み元(本番): ${ref(prodEnv.url)}`);
console.log(`書き先(開発): ${ref(devEnv.url)}`);
console.log('');

const prod = createClient(prodEnv.url, prodEnv.key);
const dev = createClient(devEnv.url, devEnv.key);

// 依存の緩い順（FK制約は無いので順不同でも可）
const TABLES = [
  'customers', 'plans', 'options', 'products', 'staff', 'holidays', 'blocked_slots',
  'reservations', 'reservation_options', 'orders', 'order_items', 'order_item_components', 'sales',
];

const PAGE = 1000;
const BATCH = 500;

for (const table of TABLES) {
  // --- 本番から全件取得（ページング） ---
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await prod.from(table).select('*').range(from, from + PAGE - 1);
    if (error) { console.error(`  [${table}] 読み取りエラー:`, error.message); all = null; break; }
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (all === null) continue;

  if (all.length === 0) { console.log(`  ${table}: 0件（スキップ）`); continue; }

  // --- 開発へ upsert（バッチ） ---
  let inserted = 0;
  let failed = false;
  for (let i = 0; i < all.length; i += BATCH) {
    const chunk = all.slice(i, i + BATCH);
    const { error } = await dev.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) { console.error(`  [${table}] 書き込みエラー:`, error.message); failed = true; break; }
    inserted += chunk.length;
  }
  console.log(`  ${table}: ${inserted}/${all.length} 件コピー${failed ? '（途中失敗）' : ''}`);
}

console.log('\n=== 完了 ===');
