// ============================================================
// ロケ本番の集合時刻の変更にあわせて、受付済みの予約の time_slot を更新する。
//   午前  9:10 → 9:20
//   午後 13:00 → 13:20
// （施設の開放が9:00で準備時間が足りなかったための変更。終了時刻は据え置き）
//
// 使い方（既定は .env.local ＝ 開発DB。--prod で .env.prod.local ＝ 本番DB）:
//   node scripts/migrate-location-shoot-times.mjs                 … 開発DBの確認のみ
//   node scripts/migrate-location-shoot-times.mjs --apply         … 開発DBに書き込む
//   node scripts/migrate-location-shoot-times.mjs --prod          … 本番DBの確認のみ
//   node scripts/migrate-location-shoot-times.mjs --prod --apply  … 本番DBに書き込む
//
// ※ 新しいコードをデプロイしてから実行すること。
//   旧コードは新時刻を撮影枠として解決できず、タイムラインの所要時間や
//   予約フォームの空き判定がずれる。
//
// ※ 対象のお客様には既に旧時刻でご案内済みのため、別途ご連絡が必要。
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const PROD = process.argv.includes('--prod');

// 旧時刻 → 新時刻
const TIME_MAP = { '9:10': '9:20', '13:00': '13:20' };

const envFile = PROD ? '.env.prod.local' : '.env.local';
const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

if (PROD && APPLY) {
  console.log('================================================');
  console.log(' 本番DBに書き込みます');
  console.log('================================================');
}
console.log(`対象: ${PROD ? '本番' : '開発'}DB (${envFile})`);
console.log(`DB  : ${env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`Mode: ${APPLY ? '★ 書き込みあり (--apply)' : 'dry run（確認のみ）'}\n`);

const { data: rs, error } = await sb
  .from('reservations')
  .select('id, reservation_number, date, time_slot, status')
  .eq('shoot_type', 'location')
  .in('time_slot', Object.keys(TIME_MAP))
  .order('date');
if (error) throw error;

if (!rs.length) {
  console.log('対象の予約はありません（すべて新しい時刻に移行済み）。');
  process.exit(0);
}

// 移行後に同じ日・同じ時刻の予約が重ならないか確認（重複防止インデックスに引っかかる）
const seen = new Set();
const conflicts = [];
for (const r of rs) {
  const key = `${r.date}|${TIME_MAP[r.time_slot]}`;
  if (r.status !== 'キャンセル' && r.status !== '見学' && r.status !== '保留') {
    if (seen.has(key)) conflicts.push(`${r.reservation_number} (${key})`);
    seen.add(key);
  }
}
const { data: already } = await sb
  .from('reservations')
  .select('reservation_number, date, time_slot, status')
  .in('time_slot', Object.values(TIME_MAP))
  .in('date', [...new Set(rs.map((r) => r.date))]);
for (const a of already ?? []) {
  if (a.status === 'キャンセル' || a.status === '見学' || a.status === '保留') continue;
  if (seen.has(`${a.date}|${a.time_slot}`)) conflicts.push(`${a.reservation_number} (既存 ${a.date}|${a.time_slot})`);
}

for (const r of rs) {
  console.log(`${r.reservation_number} [${r.status}]  ${r.date}  ${r.time_slot} → ${TIME_MAP[r.time_slot]}`);
}
console.log(`\n対象 ${rs.length} 件${APPLY ? '' : '（--apply で実行されます）'}`);

if (conflicts.length) {
  console.error('\n移行すると同じ日時の予約が重複します。中止しました:');
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}

if (APPLY) {
  for (const r of rs) {
    const { error: e } = await sb
      .from('reservations')
      .update({ time_slot: TIME_MAP[r.time_slot] })
      .eq('id', r.id);
    if (e) throw e;
  }
  console.log('更新しました。');
}
