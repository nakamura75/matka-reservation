import type { Reservation } from '@/types';
import { getActiveCampaign, isCampaignScene } from './campaign';
import { LOC_INSURANCE } from './location';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

function getHeaders() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ============================================================
// メッセージ型定義（テキスト + Flex 対応）
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: any };
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================
// 送信（リトライ付き）
// ============================================================

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/** LINE Push メッセージ送信（リトライ付き） */
export async function sendLinePush(userId: string, messages: LineMessage[]): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${LINE_API_BASE}/message/push`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ to: userId, messages }),
      });
      if (res.ok) return;

      const body = await res.text();
      // 4xx系はリトライしても無駄
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`LINE Push failed: ${res.status} ${body}`);
      }
      lastError = new Error(`LINE Push failed: ${res.status} ${body}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // 4xxエラーの場合はリトライしない
      if (lastError.message.includes('LINE Push failed: 4')) throw lastError;
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY * (attempt + 1)));
      console.warn(`LINE Push retry ${attempt + 1}/${MAX_RETRIES} for userId=${userId}`);
    }
  }
  throw lastError ?? new Error('LINE Push failed after retries');
}

/** LINE Reply メッセージ送信 */
export async function sendLineReply(replyToken: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Reply failed: ${res.status} ${body}`);
  }
}

// ============================================================
// Flex Message ヘルパー
// ============================================================

const BRAND_COLOR = '#E8552B';
const BRAND_GREEN = '#4CBF68';
const GRAY_TEXT = '#888888';
const DARK_TEXT = '#333333';
const SEPARATOR_COLOR = '#EEEEEE';

function textComponent(text: string, opts: Record<string, unknown> = {}) {
  return { type: 'text', text, size: 'sm', color: DARK_TEXT, wrap: true, ...opts };
}

function labelValue(label: string, value: string) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent(label, { flex: 0, size: 'xs', color: GRAY_TEXT }),
      textComponent(value, { align: 'end', weight: 'bold' }),
    ],
    margin: 'sm',
  };
}

function separator() {
  return { type: 'separator', color: SEPARATOR_COLOR, margin: 'lg' };
}

function headerBox(title: string, color: string) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'text', text: title, weight: 'bold', size: 'lg', color: '#FFFFFF', align: 'center' },
    ],
    backgroundColor: color,
    paddingAll: '16px',
  };
}

function storeFooter() {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'separator', color: SEPARATOR_COLOR },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          textComponent('PHOTO STUDIO matka.', { align: 'center', weight: 'bold', size: 'xs', color: BRAND_COLOR }),
          textComponent('☎ 052-846-2378', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
          textComponent('📍 名古屋市瑞穂区瑞穂通4丁目48番地 近江ビル1F', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
        ],
        paddingAll: '12px',
      },
    ],
  };
}

// ============================================================
// 仮予約完了メッセージ（Flex Message）
// ============================================================

export function buildTentativeMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number,
  options: { name: string; price: number; quantity: number }[]
): LineMessage {
  const optionTotal = options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const total = (reservation.discountAmount != null && reservation.discountAmount > 0)
    ? reservation.discountAmount
    : planPrice + optionTotal;
  const formattedDate = reservation.date.replace(/-/g, '/');

  const optionItems = options.map((o) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent(`${o.name} ×${o.quantity}`, { size: 'xs', flex: 3 }),
      textComponent(`¥${(o.price * o.quantity).toLocaleString()}`, { size: 'xs', align: 'end', flex: 2 }),
    ],
    margin: 'xs',
  }));

  const bodyContents: Record<string, unknown>[] = [
    labelValue('📅 予約日時', `${formattedDate}  ${reservation.timeSlot}`),
    labelValue('👤 代表者様', `${reservation.customerName ?? ''} 様`),
    separator(),
    labelValue('📋 プラン', planName),
    labelValue('プラン料金', `¥${planPrice.toLocaleString()}`),
  ];

  if (options.length > 0) {
    bodyContents.push(separator());
    bodyContents.push(textComponent('🎀 オプション', { size: 'xs', color: GRAY_TEXT, margin: 'md' }));
    bodyContents.push(...optionItems);
  }

  bodyContents.push(separator());
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent('合計（税込）', { weight: 'bold', flex: 3 }),
      textComponent(`¥${total.toLocaleString()}`, {
        weight: 'bold',
        color: BRAND_COLOR,
        size: 'lg',
        align: 'end',
        flex: 2,
      }),
    ],
    margin: 'md',
  } as Record<string, unknown>);

  // キャンペーン予約は仮予約メッセージにも撮影に関する注意事項を表示
  if (isCampaignScene(reservation.scene)) {
    const campaignNotes = getActiveCampaign()?.lineNoticeLines ?? [];
    if (campaignNotes.length > 0) {
      bodyContents.push(separator());
      bodyContents.push(textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }));
      bodyContents.push(...campaignNotes.map((note) => textComponent(`・${note}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })));
    }
  }

  bodyContents.push(separator());
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    contents: [
      textComponent('⚠️ こちらは仮予約です', { weight: 'bold', size: 'xs', color: '#FF6B35' }),
      textComponent('3日以内に担当者よりご連絡いたします。', { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
      textComponent('ご不明点はLINEよりお問い合わせください。', { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
    ],
    backgroundColor: '#FFF8F5',
    cornerRadius: '8px',
    paddingAll: '12px',
    margin: 'lg',
  } as Record<string, unknown>);

  return {
    type: 'flex',
    altText: `📸 仮予約を受け付けました（${formattedDate} ${reservation.timeSlot}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📸 仮予約を受け付けました', BRAND_COLOR),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '16px',
      },
      footer: storeFooter(),
    },
  };
}

// ============================================================
// 撮影シーンに応じた注意事項
// ============================================================

function getSceneNotes(scene: Reservation['scene']): string[] {
  if (isCampaignScene(scene)) {
    // キャンペーンの注意事項（仮予約・予約確定・リマインドの「⚠️撮影に関する注意事項」に表示）
    return getActiveCampaign()?.lineNoticeLines ?? [];
  }
  if (scene === '七五三') {
    return [
      '当日はヘアセット後にお着付けとなりますので、お子様は前開きのお洋服をご着用いただきますようお願いいたします。',
      '肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。',
    ];
  }
  if (scene === 'マタニティ') {
    return [
      '当店での【ヘアメイク】をご希望の場合は、メイク用品をお持ちください。スキンケアのみご自宅でお済ませください。',
      '髪にオイルやワックスなどのスタイリング剤はつけずにご来店ください。',
    ];
  }
  return [
    '肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。',
  ];
}

// ============================================================
// 予約確定メッセージ（Flex Message）
// ============================================================

export function buildConfirmMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number,
  options: { name: string; price: number; quantity: number }[],
  checkInTime: string,
  checkOutTime: string
): LineMessage {
  const formattedDate = reservation.date.replace(/-/g, '/');
  const sceneNotes = getSceneNotes(reservation.scene);

  const optionTotal = options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const total = (reservation.discountAmount != null && reservation.discountAmount > 0)
    ? reservation.discountAmount
    : planPrice + optionTotal;

  const optionItems = options.map((o) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent(`${o.name} ×${o.quantity}`, { size: 'xs', flex: 3 }),
      textComponent(`¥${(o.price * o.quantity).toLocaleString()}`, { size: 'xs', align: 'end', flex: 2 }),
    ],
    margin: 'xs',
  }));

  const bodyContents: Record<string, unknown>[] = [
    labelValue('📆 予約日時', `${formattedDate}  ${reservation.timeSlot}`),
    labelValue('📸 プラン', planName),
    labelValue('プラン料金', `¥${planPrice.toLocaleString()}`),
  ];

  if (options.length > 0) {
    bodyContents.push(separator());
    bodyContents.push(textComponent('🎀 オプション', { size: 'xs', color: GRAY_TEXT, margin: 'md' }));
    bodyContents.push(...optionItems);
  }

  bodyContents.push(separator());
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent('合計（税込）', { weight: 'bold', flex: 3 }),
      textComponent(`¥${total.toLocaleString()}`, {
        weight: 'bold',
        color: BRAND_COLOR,
        size: 'lg',
        align: 'end',
        flex: 2,
      }),
    ],
    margin: 'md',
  } as Record<string, unknown>);

  bodyContents.push(
    separator(),
    // 来店時間を大きく強調
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        textComponent('🕐 ご来店時間', { size: 'xs', color: GRAY_TEXT, align: 'center' }),
        { type: 'text', text: checkInTime || '—', weight: 'bold', size: 'xxl', color: BRAND_COLOR, align: 'center', margin: 'xs' },
        textComponent(`※ 終了予定は${checkOutTime || '—'}頃です（前後する場合がございます）`, { size: 'xxs', color: GRAY_TEXT, margin: 'sm', align: 'center' }),
        textComponent('※ ご来店時間から15分以上遅れられる場合、衣装着数が少なくなる可能性がございます', { size: 'xxs', color: '#FF6B35', margin: 'sm', align: 'center', wrap: true }),
      ],
      backgroundColor: '#FFF8F5',
      cornerRadius: '8px',
      paddingAll: '12px',
      margin: 'md',
    } as Record<string, unknown>,
    separator(),
    textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }),
  );
  bodyContents.push(...sceneNotes.map((note) => textComponent(`・${note}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })));
  bodyContents.push(
    separator(),
    textComponent('❓ よくあるご質問', { weight: 'bold', size: 'xs', margin: 'md' }),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'FAQ はこちら', size: 'xs', color: '#1a73e8', action: { type: 'uri', uri: 'https://matka-photostudio.jp/faq/' }, align: 'center' },
      ],
      margin: 'xs',
    } as Record<string, unknown>,
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('住所: 名古屋市瑞穂区佐渡町5丁目4-1', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('専用駐車場を2台分ご用意しています（黄色のカラーコーンが目印）。1組様につき1台分のお貸し出しです。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('満車の場合はお近くのコインパーキングをご利用ください。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '駐車場の詳細はこちら', size: 'xs', color: '#1a73e8', action: { type: 'uri', uri: 'https://matka-photostudio.jp/news/matka-%E5%B0%82%E7%94%A8%E9%A7%90%E8%BB%8A%E5%A0%B4%E3%81%8C%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%97%E3%81%9F%F0%9F%9A%99/' }, align: 'center' },
      ],
      margin: 'xs',
    } as Record<string, unknown>,
    separator(),
    textComponent('キャンセル規定', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('・撮影日2日前まで：無料\n・撮影日前日：ご予約料金の50%\n・撮影日当日：ご予約料金の100%\n・無断キャンセル：ご予約料金の100%', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ 体調不良等による日程変更はキャンセル料不要です。お気軽にご連絡ください。', { size: 'xxs', color: BRAND_COLOR, margin: 'xs' }),
    separator(),
    textComponent('📷 撮影データについて', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('撮影データは3営業日以内にLINEにてお送りいたします。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    separator(),
    textComponent('当日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  );

  return {
    type: 'flex',
    altText: `✅ ご予約が確定しました（${formattedDate} ${checkInTime}）`,
    contents: {
      type: 'bubble',
      header: headerBox('✅ ご予約が確定しました', BRAND_GREEN),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '16px',
      },
      footer: confirmFooter(),
    },
  };
}

// ============================================================
// ロケーション撮影 — 共通ブロック
// ============================================================

const TOZANSO = '東山荘（名古屋市瑞穂区）';

/** オプション明細（横並び） */
function optionLineItems(options: { name: string; price: number; quantity: number }[]): Record<string, unknown>[] {
  return options.map((o) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent(`${o.name} ×${o.quantity}`, { size: 'xs', flex: 3 }),
      textComponent(`¥${(o.price * o.quantity).toLocaleString()}`, { size: 'xs', align: 'end', flex: 2 }),
    ],
    margin: 'xs',
  }));
}

/** 合計行（ロケ＝緑） */
function locTotalRow(total: number): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      textComponent('合計（税込）', { weight: 'bold', flex: 3 }),
      textComponent(`¥${total.toLocaleString()}`, { weight: 'bold', color: BRAND_GREEN, size: 'lg', align: 'end', flex: 2 }),
    ],
    margin: 'md',
  } as Record<string, unknown>;
}

/** 時刻を大きく強調するボックス（ロケ＝緑） */
function locBigTimeBox(label: string, time: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      textComponent(label, { size: 'xs', color: GRAY_TEXT, align: 'center' }),
      { type: 'text', text: time || '—', weight: 'bold', size: 'xxl', color: BRAND_GREEN, align: 'center', margin: 'xs' },
    ],
    backgroundColor: '#EBF7ED',
    cornerRadius: '8px',
    paddingAll: '12px',
    margin: 'md',
  } as Record<string, unknown>;
}

/** 「こちらは仮予約です」案内ボックス */
function locTentativeNoticeBox(): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      textComponent('⚠️ こちらは仮予約です', { weight: 'bold', size: 'xs', color: '#FF6B35' }),
      textComponent('3日以内に担当者よりご連絡いたします。', { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
      textComponent('ご不明点はLINEよりお問い合わせください。', { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
    ],
    backgroundColor: '#EBF7ED',
    cornerRadius: '8px',
    paddingAll: '12px',
    margin: 'lg',
  } as Record<string, unknown>;
}

/** 見学場所（matka.スタジオ）駐車場ブロック */
function locVisitParkingBlock(): Record<string, unknown>[] {
  return [
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('住所: 名古屋市瑞穂区佐渡町5丁目4-1', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('専用駐車場を2台分ご用意しています（黄色のカラーコーンが目印）。1組様につき1台分のお貸し出しです。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('満車の場合はお近くのコインパーキングをご利用ください。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '駐車場の詳細はこちら', size: 'xs', color: '#1a73e8', action: { type: 'uri', uri: 'https://matka-photostudio.jp/news/matka-%E5%B0%82%E7%94%A8%E9%A7%90%E8%BB%8A%E5%A0%B4%E3%81%8C%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%97%E3%81%9F%F0%9F%9A%99/' }, align: 'center' },
      ],
      margin: 'xs',
    } as Record<string, unknown>,
  ];
}

/** 撮影場所（東山荘）駐車場ブロック */
function tozansoParkingBlock(): Record<string, unknown>[] {
  return [
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('東山荘駐車場をご利用ください。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('住所: 名古屋市瑞穂区初日町2丁目3番地', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('駐車スペースは10台分ございますが、ハイシーズンは混み合うため、なるべく乗り合わせてお越しくださいませ。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('満車の場合はお近くのコインパーキングをご利用ください。（駐車料金はお客様負担です）', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
  ];
}

/** ロケ撮影 注意事項ブロック */
function locShootNotesBlock(): Record<string, unknown>[] {
  const notes = [
    '当日はヘアセット後にお着付けとなりますので、お子様は前開きのお洋服をご着用いただきますようお願いいたします。',
    '肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。',
    'お洋服の貸し出しは行なっておりません。',
  ];
  return [
    separator(),
    textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }),
    ...notes.map((n) => textComponent(`・${n}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })),
  ];
}

/** ロケ キャンセル規定ブロック */
function locCancelPolicyBlock(): Record<string, unknown>[] {
  return [
    separator(),
    textComponent('キャンセル規定', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('・撮影日1週間前より：ご予約のプランに関わらずベーシックプラン料金の50%', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('・撮影日当日：ご予約のプランに関わらずベーシックプラン料金の100%', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ 撮影日1週間前より、日程変更等もキャンセルと同じ金額をお支払いいただきます。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ キャンセル料は土日祝料金も含みます。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ お子様が体調を崩しやすい方やお仕事の都合などで急な予定変更が予想される方は、キャンセル保険5,500円へのご加入をおすすめします。', { size: 'xxs', color: BRAND_COLOR, margin: 'xs' }),
  ];
}

/** ロケ 撮影データについてブロック */
function locDataDeliveryBlock(): Record<string, unknown>[] {
  return [
    separator(),
    textComponent('📷 撮影データについて', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('撮影データの納品期限は撮影より1週間とさせていただきます。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
  ];
}

/** 振込先ブロック */
function bankTransferBlock(): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      textComponent('🏦 お振込先', { weight: 'bold', size: 'xs', color: BRAND_GREEN }),
      textComponent('名古屋銀行 堀田支店', { size: 'sm', color: DARK_TEXT, margin: 'sm', weight: 'bold' }),
      textComponent('普通 5022325', { size: 'sm', color: DARK_TEXT, margin: 'xs', weight: 'bold' }),
      textComponent('※ お振込は撮影日の2週間前までにお願いいたします。', { size: 'xxs', color: '#FF6B35', margin: 'sm' }),
    ],
    backgroundColor: '#EBF7ED',
    cornerRadius: '8px',
    paddingAll: '12px',
    margin: 'md',
  } as Record<string, unknown>;
}

// ============================================================
// ① 仮予約（見学）
// ============================================================
export function buildLocationVisitTentativeMessage(reservation: Reservation): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '16:30';
  const body: Record<string, unknown>[] = [
    labelValue('🏛 見学日時', `${d}  ${t}`),
    labelValue('👤 代表者様', `${reservation.customerName ?? ''} 様`),
    separator(),
    locTentativeNoticeBox(),
    separator(),
    textComponent('📍 見学場所はmatka.のスタジオでございます。', { size: 'xs', color: DARK_TEXT, margin: 'md' }),
    textComponent('駐車場はmatka.専用駐車場をご利用ください。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
  ];
  return {
    type: 'flex',
    altText: `🏛 見学の仮予約を受け付けました（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('🏛 見学の仮予約を受け付けました', BRAND_GREEN),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: storeFooter(),
    },
  };
}

// ============================================================
// ② 仮予約（撮影）
// ============================================================
export function buildLocationShootTentativeMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number,
  options: { name: string; price: number; quantity: number }[],
  total: number
): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '';
  const body: Record<string, unknown>[] = [
    labelValue('📆 撮影日時', `${d}  ${t}`),
    labelValue('👤 代表者様', `${reservation.customerName ?? ''} 様`),
    separator(),
    labelValue('📋 プラン', planName),
    labelValue('プラン料金', `¥${planPrice.toLocaleString()}`),
  ];
  if (options.length > 0) {
    body.push(separator(), textComponent('🎀 オプション', { size: 'xs', color: GRAY_TEXT, margin: 'md' }), ...optionLineItems(options));
  }
  if (reservation.cancelInsurance === '加入する') {
    body.push(separator(), labelValue('🛡 キャンセル保険', `¥${LOC_INSURANCE.toLocaleString()}`));
  }
  body.push(separator(), locTotalRow(total));
  body.push(textComponent('※ 見学時のご相談内容により、最終金額が変更になる場合がございます。', { size: 'xxs', color: '#FF6B35', margin: 'sm', wrap: true }));
  body.push(separator(), locTentativeNoticeBox());
  body.push(
    separator(),
    textComponent(`📍 撮影場所は${TOZANSO}でございます。`, { size: 'xs', color: DARK_TEXT, margin: 'md' }),
    textComponent('ご集合は東山荘駐車場へお願いします。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
  );
  return {
    type: 'flex',
    altText: `📸 撮影の仮予約を受け付けました（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📸 撮影の仮予約を受け付けました', BRAND_GREEN),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: storeFooter(),
    },
  };
}

// ============================================================
// ③ 予約確定（見学）
// ============================================================
export function buildLocationVisitConfirmMessage(reservation: Reservation): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '16:30';
  const body: Record<string, unknown>[] = [
    labelValue('🏛 見学日時', `${d}  ${t}`),
    labelValue('👤 代表者様', `${reservation.customerName ?? ''} 様`),
    separator(),
    locBigTimeBox('🕐 ご来店時間', t),
    ...locVisitParkingBlock(),
    separator(),
    textComponent('当日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];
  return {
    type: 'flex',
    altText: `✅ 見学のご予約が確定しました（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('✅ 見学のご予約が確定しました', BRAND_GREEN),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: confirmFooter(),
    },
  };
}

// ============================================================
// ④ 予約確定（撮影）
// ============================================================
export function buildLocationShootConfirmMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number,
  options: { name: string; price: number; quantity: number }[],
  total: number
): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '';
  const body: Record<string, unknown>[] = [
    labelValue('📆 撮影日時', `${d}  ${t}`),
    labelValue('📸 プラン', planName),
    labelValue('プラン料金', `¥${planPrice.toLocaleString()}`),
  ];
  if (options.length > 0) {
    body.push(separator(), textComponent('🎀 オプション', { size: 'xs', color: GRAY_TEXT, margin: 'md' }), ...optionLineItems(options));
  }
  if (reservation.cancelInsurance === '加入する') {
    body.push(separator(), labelValue('🛡 キャンセル保険', `¥${LOC_INSURANCE.toLocaleString()}`));
  }
  body.push(separator(), locTotalRow(total));
  body.push(separator(), bankTransferBlock());
  body.push(separator(), locBigTimeBox('🕐 ご集合時間', t));
  body.push(...locShootNotesBlock());
  body.push(...tozansoParkingBlock());
  body.push(...locCancelPolicyBlock());
  body.push(...locDataDeliveryBlock());
  body.push(separator(), textComponent('当日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }));
  return {
    type: 'flex',
    altText: `✅ 撮影のご予約が確定しました（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('✅ 撮影のご予約が確定しました', BRAND_GREEN),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: confirmFooter(),
    },
  };
}

// ============================================================
// ⑤ 前日リマインド（見学）
// ============================================================
export function buildLocationVisitReminderMessage(reservation: Reservation): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '16:30';
  const body: Record<string, unknown>[] = [
    labelValue('🏛 見学日時', `${d}  ${t}`),
    separator(),
    locBigTimeBox('🕐 明日のご来店時間', t),
    ...locVisitParkingBlock(),
    separator(),
    textComponent('明日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];
  return {
    type: 'flex',
    altText: `📅 明日の見学のご確認（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📅 明日のご予約のご確認（見学）', '#5B7FFF'),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: reminderFooter(),
    },
  };
}

// ============================================================
// ⑥ 前日リマインド（撮影）
// ============================================================
export function buildLocationShootReminderMessage(reservation: Reservation, planName: string): LineMessage {
  const d = (reservation.date ?? '').replace(/-/g, '/');
  const t = reservation.timeSlot ?? '';
  const body: Record<string, unknown>[] = [
    labelValue('📆 撮影日時', `${d}  ${t}`),
    labelValue('📸 プラン', planName),
    separator(),
    locBigTimeBox('🕐 明日のご集合時間', t),
    ...locShootNotesBlock(),
    ...tozansoParkingBlock(),
    ...locCancelPolicyBlock(),
    ...locDataDeliveryBlock(),
    separator(),
    textComponent('明日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];
  return {
    type: 'flex',
    altText: `📅 明日の撮影のご確認（${d} ${t}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📅 明日のご予約のご確認（撮影）', '#5B7FFF'),
      body: { type: 'box', layout: 'vertical', contents: body, paddingAll: '16px' },
      footer: reminderFooter(),
    },
  };
}

/** 確定LINE用フッター（電話・メール・住所） */
function confirmFooter() {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'separator', color: SEPARATOR_COLOR },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          textComponent('PHOTO STUDIO matka.', { align: 'center', weight: 'bold', size: 'xs', color: BRAND_COLOR }),
          textComponent('☎ 052-846-2378', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
          textComponent('✉ info@matka-photostudio.jp', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
          textComponent('📍 名古屋市瑞穂区瑞穂通4丁目48番地 近江ビル1F', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
        ],
        paddingAll: '12px',
      },
    ],
  };
}

/** リマインドLINE用フッター（電話・住所のみ、メールなし） */
function reminderFooter() {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      { type: 'separator', color: SEPARATOR_COLOR },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          textComponent('PHOTO STUDIO matka.', { align: 'center', weight: 'bold', size: 'xs', color: BRAND_COLOR }),
          textComponent('☎ 052-846-2378', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
          textComponent('📍 名古屋市瑞穂区瑞穂通4丁目48番地 近江ビル1F', { align: 'center', size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
        ],
        paddingAll: '12px',
      },
    ],
  };
}

// ============================================================
// 前日リマインドメッセージ（Flex Message）
// ============================================================

export function buildReminderMessage(
  reservation: Reservation,
  planName: string,
  checkInTime: string,
  checkOutTime: string
): LineMessage {
  const formattedDate = reservation.date.replace(/-/g, '/');
  const sceneNotes = getSceneNotes(reservation.scene);

  const bodyContents: Record<string, unknown>[] = [
    labelValue('📆 予約日時', `${formattedDate}  ${reservation.timeSlot}`),
    labelValue('📸 プラン', planName),
    separator(),
    // 来店時間を大きく強調
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        textComponent('🕐 明日のご来店時間', { size: 'xs', color: GRAY_TEXT, align: 'center' }),
        { type: 'text', text: checkInTime || '—', weight: 'bold', size: 'xxl', color: BRAND_COLOR, align: 'center', margin: 'xs' },
        textComponent(`※ 終了予定は${checkOutTime || '—'}頃です（前後する場合がございます）`, { size: 'xxs', color: GRAY_TEXT, margin: 'sm', align: 'center' }),
        textComponent('※ ご来店時間から15分以上遅れられる場合、衣装着数が少なくなる可能性がございます', { size: 'xxs', color: '#FF6B35', margin: 'sm', align: 'center', wrap: true }),
      ],
      backgroundColor: '#FFF8F5',
      cornerRadius: '8px',
      paddingAll: '12px',
      margin: 'md',
    },
    separator(),
    textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }),
    ...sceneNotes.map((note) => textComponent(`・${note}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })),
    separator(),
    textComponent('❓ よくあるご質問', { weight: 'bold', size: 'xs', margin: 'md' }),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: 'FAQ はこちら', size: 'xs', color: '#1a73e8', action: { type: 'uri', uri: 'https://matka-photostudio.jp/faq/' }, align: 'center' },
      ],
      margin: 'xs',
    } as Record<string, unknown>,
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('住所: 名古屋市瑞穂区佐渡町5丁目4-1', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('専用駐車場を2台分ご用意しています（黄色のカラーコーンが目印）。1組様につき1台分のお貸し出しです。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('満車の場合はお近くのコインパーキングをご利用ください。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '駐車場の詳細はこちら', size: 'xs', color: '#1a73e8', action: { type: 'uri', uri: 'https://matka-photostudio.jp/news/matka-%E5%B0%82%E7%94%A8%E9%A7%90%E8%BB%8A%E5%A0%B4%E3%81%8C%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%97%E3%81%9F%F0%9F%9A%99/' }, align: 'center' },
      ],
      margin: 'xs',
    } as Record<string, unknown>,
    separator(),
    textComponent('キャンセル規定', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('・撮影日2日前まで：無料\n・撮影日前日：ご予約料金の50%\n・撮影日当日：ご予約料金の100%\n・無断キャンセル：ご予約料金の100%', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ 体調不良等による日程変更はキャンセル料不要です。お気軽にご連絡ください。', { size: 'xxs', color: BRAND_COLOR, margin: 'xs' }),
    separator(),
    textComponent('📷 撮影データについて', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('撮影データは3営業日以内にLINEにてお送りいたします。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    separator(),
    textComponent('明日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];

  return {
    type: 'flex',
    altText: `📅 明日のご予約のご確認（${formattedDate} ${checkInTime}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📅 明日のご予約のご確認', '#5B7FFF'),
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '16px',
      },
      footer: reminderFooter(),
    },
  };
}

// ============================================================
// LINE Webhook 署名検証
// ============================================================

import { createHmac, timingSafeEqual } from 'crypto';

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = createHmac('sha256', secret).update(body).digest('base64');
  const hashBuf = Buffer.from(hash, 'base64');
  const sigBuf = Buffer.from(signature, 'base64');
  if (hashBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(hashBuf, sigBuf);
}
