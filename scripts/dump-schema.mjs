// ============================================================
// 本番Supabaseのスキーマ（テーブル定義）を読み取り専用で抽出し、
// 開発用Supabaseにそのまま貼れる CREATE TABLE 一式を生成する。
//
// PostgREST が公開している OpenAPI 定義(GET /rest/v1/)を読むだけなので、
// 本番DBへの書き込みは一切行わない。
//   実行: node scripts/dump-schema.mjs
//   出力: scripts/dev-schema.sql（標準出力にも表示）
// ============================================================
import { readFileSync, writeFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) { console.error('URL/KEY が .env.local に見つかりません'); process.exit(1); }

// OpenAPI 定義を取得（読み取りのみ）
const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
});
if (!res.ok) { console.error('取得失敗:', res.status, await res.text()); process.exit(1); }
const spec = await res.json();
const defs = spec.definitions || {};

// OpenAPI の format(=実Postgres型) を優先。無ければ type からマップ
function pgType(prop) {
  if (prop.format) return prop.format;          // 例: uuid / text / timestamp with time zone / integer / numeric / boolean / date
  switch (prop.type) {
    case 'integer': return 'integer';
    case 'number': return 'numeric';
    case 'boolean': return 'boolean';
    case 'string': return 'text';
    default: return 'text';
  }
}

const tables = Object.keys(defs).sort();
let sql = `-- 本番(${url.replace(/https:\/\/([^.]+).*/, '$1')})のスキーマから自動生成\n`;
sql += `-- 開発用Supabaseの SQL Editor に貼り付けて実行してください\n`;
sql += `-- 注意: デフォルト値(gen_random_uuid()/now()等)・索引・外部キー・RLSは含まれません（必要なら別途）\n\n`;

for (const t of tables) {
  const def = defs[t];
  if (!def || def.type !== 'object' || !def.properties) continue;
  const required = new Set(def.required || []);
  const pkCols = [];
  const lines = [];
  for (const [col, prop] of Object.entries(def.properties)) {
    const type = pgType(prop);
    const isPk = typeof prop.description === 'string' && prop.description.includes('<pk/>');
    if (isPk) pkCols.push(col);
    const notNull = required.has(col) ? ' NOT NULL' : '';
    // uuid主キーはアプリが値を設定しないものがあるため自動採番デフォルトを付与
    const def_ = (type === 'uuid' && isPk) ? ' DEFAULT gen_random_uuid()' : '';
    lines.push(`  "${col}" ${type}${def_}${notNull}`);
  }
  if (pkCols.length) lines.push(`  PRIMARY KEY (${pkCols.map((c) => `"${c}"`).join(', ')})`);
  sql += `CREATE TABLE IF NOT EXISTS "${t}" (\n${lines.join(',\n')}\n);\n\n`;
}

writeFileSync('scripts/dev-schema.sql', sql);
console.log(sql);
console.log(`\n=== ${tables.length} テーブルを scripts/dev-schema.sql に出力しました ===`);
