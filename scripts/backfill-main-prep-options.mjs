// ============================================================
// 既存ロケ予約の「ご主役のお子様のお支度」を備考(customer_note)から
// 予約オプション(reservation_options)へ移行する。
//
// 前提: scripts/migrations/2026-reservation-options-main-prep.sql を先に実行しておくこと。
//
// 使い方（既定は .env.local ＝ 開発DB。--prod で .env.prod.local ＝ 本番DB）:
//   node scripts/backfill-main-prep-options.mjs                 … 開発DBの確認のみ（dry run）
//   node scripts/backfill-main-prep-options.mjs --apply         … 開発DBに書き込む
//   node scripts/backfill-main-prep-options.mjs --prod          … 本番DBの確認のみ
//   node scripts/backfill-main-prep-options.mjs --prod --apply  … 本番DBに書き込む
//
// ※ 先に新しいコードをデプロイしてから実行すること。
//   旧コードは unit_price を見ずマスター価格で計算するため、
//   デプロイ前に移行すると ¥0 のはずのお支度が満額で計上されてしまう。
//
// 変換ルール:
//   ・備考の「【ご主役のお子様のお支度】A、B（＋¥2,200）」から項目名を取り出す
//   ・プラン込みの項目は unit_price=0 / is_main_prep=true で追加
//   ・日本髪は課金対象。既に課金オプションとして登録済みならその行に
//     is_main_prep を立てるだけにして、二重課金にならないようにする
//   ・移行できた予約は備考から該当行を削除する
//   ・is_main_prep の行が既にある予約はスキップ（何度実行しても安全）
// ============================================================
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import crypto from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const PROD = process.argv.includes('--prod');
const NOTE_PREFIX = '【ご主役のお子様のお支度】';

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

// 事前チェック: 新しい列が存在するか
{
  const { error } = await sb.from('reservation_options').select('id, unit_price, is_main_prep').limit(1);
  if (error) {
    console.error('reservation_options に unit_price / is_main_prep がありません。');
    console.error('先に scripts/migrations/2026-reservation-options-main-prep.sql を実行してください。');
    console.error(error.message);
    process.exit(1);
  }
}

const { data: options, error: optErr } = await sb
  .from('options').select('id, name, price, shoot_type').eq('shoot_type', 'location');
if (optErr) throw optErr;

const { data: reservations, error: resErr } = await sb
  .from('reservations').select('id, reservation_number, status, customer_note').eq('shoot_type', 'location');
if (resErr) throw resErr;

/** 「日本髪（＋¥2,200）」→「日本髪」。金額の注記を落として名前だけにする */
function cleanItemName(raw) {
  return raw.replace(/（＋[¥￥][\d,]+）/g, '').trim();
}
function isNihongami(opt) {
  return opt.id === 'loc-opt-nihongami' || opt.name.includes('日本髪');
}

let planned = 0;
const skipped = [];

for (const r of reservations) {
  const note = r.customer_note ?? '';
  const line = note.split('\n').find((l) => l.includes(NOTE_PREFIX));
  if (!line) continue;

  const { data: existing, error: exErr } = await sb
    .from('reservation_options').select('id, option_id, quantity, unit_price, is_main_prep')
    .eq('reservation_id', r.id);
  if (exErr) throw exErr;

  if (existing.some((x) => x.is_main_prep)) {
    skipped.push(`${r.reservation_number}: 既に移行済み`);
    continue;
  }

  const names = line.slice(line.indexOf(NOTE_PREFIX) + NOTE_PREFIX.length)
    .split('、').map(cleanItemName).filter(Boolean);

  const inserts = [];
  const flags = [];   // 既存行に is_main_prep を立てるだけのもの
  const unknown = [];

  for (const name of names) {
    const opt = options.find((o) => o.name === name);
    if (!opt) { unknown.push(name); continue; }

    if (isNihongami(opt)) {
      // 課金対象。既に登録済みならその行を主役の支度として扱う（二重課金を避ける）
      const already = existing.find((x) => x.option_id === opt.id && !x.is_main_prep);
      if (already) {
        if (already.quantity !== 1) { unknown.push(`${name}（数量${already.quantity}のため手動対応）`); continue; }
        flags.push({ id: already.id, unitPrice: opt.price, name });
      } else {
        inserts.push({ optionId: opt.id, unitPrice: opt.price, name });
      }
    } else {
      // プラン込み＝単価0
      inserts.push({ optionId: opt.id, unitPrice: 0, name });
    }
  }

  if (unknown.length) {
    skipped.push(`${r.reservation_number}: 名前を特定できない項目 → ${unknown.join(' / ')}`);
    continue;
  }
  if (!inserts.length && !flags.length) continue;

  const newNote = note.split('\n').filter((l) => !l.includes(NOTE_PREFIX)).join('\n').trim();

  console.log(`${r.reservation_number} [${r.status}]`);
  for (const i of inserts) console.log(`  + 追加  ${i.name}  ¥${i.unitPrice.toLocaleString()}`);
  for (const f of flags) console.log(`  ~ 既存行にご主役フラグ  ${f.name}  ¥${f.unitPrice.toLocaleString()}`);
  console.log(`  備考: ${JSON.stringify(note)} → ${JSON.stringify(newNote)}`);
  planned++;

  if (APPLY) {
    for (const i of inserts) {
      const { error } = await sb.from('reservation_options').insert({
        id: crypto.randomUUID(),
        reservation_id: r.id,
        option_id: i.optionId,
        quantity: 1,
        note: '',
        unit_price: i.unitPrice,
        is_main_prep: true,
      });
      if (error) throw error;
    }
    for (const f of flags) {
      const { error } = await sb.from('reservation_options')
        .update({ unit_price: f.unitPrice, is_main_prep: true }).eq('id', f.id);
      if (error) throw error;
    }
    const { error } = await sb.from('reservations')
      .update({ customer_note: newNote }).eq('id', r.id);
    if (error) throw error;
  }
}

console.log(`\n対象 ${planned} 件${APPLY ? ' を更新しました。' : '（--apply で実行されます）'}`);
if (skipped.length) {
  console.log('\nスキップ:');
  for (const s of skipped) console.log(`  - ${s}`);
}
