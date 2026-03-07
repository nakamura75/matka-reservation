import type { Reservation } from '@/types';

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
  const total = planPrice + optionTotal - (reservation.discountAmount ?? 0);
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
  if (scene === '七五三') {
    return [
      '当日はヘアセット後にお着付けとなりますので、お子様は前開きのお洋服をご着用いただきますようお願いいたします。また、肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。',
      '当日は5パターンの撮影が可能です。なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。',
    ];
  }
  if (scene === 'マタニティ') {
    return [
      '当店での【ヘアメイク】をご希望の場合は、スキンケアのみご自宅でお済ませください。（メイク用品やヘアセット用品のお持ち込みも可能でございます。その場合は担当の美容師に当日お声がけ下さいませ。）',
      '当日は5パターンの撮影が可能です。なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。',
    ];
  }
  return [
    '肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。',
    '当日は5パターンの撮影が可能です。なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。',
  ];
}

// ============================================================
// 予約確定メッセージ（Flex Message）
// ============================================================

export function buildConfirmMessage(
  reservation: Reservation,
  planName: string,
  checkInTime: string,
  checkOutTime: string
): LineMessage {
  const formattedDate = reservation.date.replace(/-/g, '/');
  const sceneNotes = getSceneNotes(reservation.scene);

  const bodyContents: Record<string, unknown>[] = [
    labelValue('📆 予約日', formattedDate),
    labelValue('🕐 撮影開始', reservation.timeSlot),
    labelValue('📸 プラン', planName),
    separator(),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        textComponent(`※ 当日は${checkInTime}までにご来店ください。`, { size: 'xs', color: BRAND_COLOR, weight: 'bold' }),
        textComponent(`※ 終了時間は${checkOutTime}ごろ予定ですが、前後する場合もございます。`, { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
      ],
      backgroundColor: '#FFF8F5',
      cornerRadius: '8px',
      paddingAll: '10px',
      margin: 'md',
    },
    separator(),
    textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }),
    ...sceneNotes.map((note) => textComponent(`※ ${note}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })),
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('専用駐車場を2台分ご用意しています。（黄色のカラーコーンが目印です）LINEの【Parking】で詳細をご確認ください。1組様につき1台分のお貸し出しとなります。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    separator(),
    textComponent('キャンセル規定', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('2日前：無料\n前日：50％\n当日・無断：100％', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    textComponent('※ 体調不良等の日程変更はキャンセル料不要です。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    separator(),
    textComponent('当日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];

  return {
    type: 'flex',
    altText: `✅ ご予約が確定しました（${formattedDate} ${reservation.timeSlot}）`,
    contents: {
      type: 'bubble',
      header: headerBox('✅ ご予約が確定しました', BRAND_GREEN),
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
    labelValue('🗓 予約日', formattedDate),
    labelValue('🕐 撮影開始', reservation.timeSlot),
    labelValue('📸 プラン', planName),
    separator(),
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        textComponent(`※ 明日は${checkInTime}までにご来店ください。`, { size: 'xs', color: BRAND_COLOR, weight: 'bold' }),
        textComponent(`※ 終了時間は${checkOutTime}ごろ予定ですが、前後する場合もございます。`, { size: 'xs', color: GRAY_TEXT, margin: 'xs' }),
      ],
      backgroundColor: '#FFF8F5',
      cornerRadius: '8px',
      paddingAll: '10px',
      margin: 'md',
    },
    separator(),
    textComponent('⚠️ 撮影に関する注意事項', { weight: 'bold', size: 'xs', color: '#FF6B35', margin: 'md' }),
    ...sceneNotes.map((note) => textComponent(`※ ${note}`, { size: 'xxs', color: GRAY_TEXT, margin: 'xs' })),
    separator(),
    textComponent('🅿️ 駐車場について', { weight: 'bold', size: 'xs', margin: 'md' }),
    textComponent('専用駐車場を2台分ご用意しています。（黄色のカラーコーンが目印です）LINEの【Parking】で詳細をご確認ください。1組様につき1台分のお貸し出しとなります。', { size: 'xxs', color: GRAY_TEXT, margin: 'xs' }),
    separator(),
    textComponent('明日お会いできますことを楽しみにしております！', { size: 'xs', color: DARK_TEXT, margin: 'md', align: 'center' }),
  ];

  return {
    type: 'flex',
    altText: `📅 明日のご予約のご確認（${formattedDate} ${reservation.timeSlot}）`,
    contents: {
      type: 'bubble',
      header: headerBox('📅 明日のご予約のご確認', '#5B7FFF'),
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
// LINE Webhook 署名検証
// ============================================================

import { createHmac } from 'crypto';

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}
