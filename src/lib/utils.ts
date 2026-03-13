/** 予約番号を生成: M-YYYYMMDD-XXXX */
export function generateReservationNumber(date: string): string {
  const compact = date.replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `M-${compact}-${rand}`;
}

/** ユニークIDを生成（UUID v4 相当） */
export function generateId(): string {
  return crypto.randomUUID();
}

/** 日付が土日祝かどうかを判定（JST基準、祝日は別途チェック必要） */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** YYYY-MM-DD 形式に変換 */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 予約日時 → ISO 8601 開始日時 (Asia/Tokyo) */
export function toJSTDatetime(date: string, time: string): string {
  // "2026-02-25" + "9:00" → "2026-02-25T09:00:00+09:00"
  const [h, m] = time.split(':').map(Number);
  const padH = String(h).padStart(2, '0');
  const padM = String(m ?? 0).padStart(2, '0');
  return `${date}T${padH}:${padM}:00+09:00`;
}

/** 分を加算して終了日時を返す（JST） */
export function addMinutes(isoDatetime: string, minutes: number): string {
  const d = new Date(isoDatetime);
  d.setMinutes(d.getMinutes() + minutes);
  // toISOString() はUTCを返すため、9時間加算してJST表記に変換する
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().replace('Z', '+09:00').replace(/\.\d{3}/, '');
}

/** 金額を日本円フォーマット */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/** 日付を YYYY/MM/DD(曜日) 形式で表示（JST基準） */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const w = weekdays[d.getDay()];
  return `${y}/${m}/${day}(${w})`;
}

/** 時間の秒を削除（H:MM:SS → H:MM のみ変換。H:MM はそのまま） */
export function stripSeconds(time: string): string {
  return time ? time.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1') : time;
}
