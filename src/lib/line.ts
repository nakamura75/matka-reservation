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

/** LINE Push メッセージ送信 */
export async function sendLinePush(userId: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ to: userId, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Push failed: ${res.status} ${body}`);
  }
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
// 通知テンプレート
// ============================================================

export type LineMessage = {
  type: 'text';
  text: string;
};

/** 仮予約完了メッセージ */
export function buildTentativeMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number,
  options: { name: string; price: number; quantity: number }[]
): LineMessage {
  const optionLines =
    options.length > 0
      ? options.map((o) => `・${o.name} ×${o.quantity}  ￥${(o.price * o.quantity).toLocaleString()}`).join('\n')
      : '（なし）';
  const optionTotal = options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const total = planPrice + optionTotal - (reservation.discountAmount ?? 0);

  const text = `📸 仮予約を受け付けました！

【ご予約内容】
━━━━━━━━━━━━━━
📅 予約日時
${reservation.date} ${reservation.timeSlot}

👤 代表者様
${reservation.customerName ?? ''} 様

📋 プラン
${planName}
￥${planPrice.toLocaleString()}

🎀 オプション
${optionLines}
${options.length > 0 ? `￥${optionTotal.toLocaleString()}` : ''}
━━━━━━━━━━━━━━
💰 合計金額
￥${total.toLocaleString()}（税込）
━━━━━━━━━━━━━━

⚠️ こちらは仮予約です。
3日以内に担当者よりご連絡いたします。

ご不明点はLINEよりお問い合わせください。`;

  return { type: 'text', text };
}

/** 予約確定メッセージ */
export function buildConfirmMessage(
  reservation: Reservation,
  planName: string,
  planPrice: number
): LineMessage {
  const text = `✅ ご予約が確定しました！

【ご予約内容】
━━━━━━━━━━━━━━
📅 予約日時
${reservation.date} ${reservation.timeSlot}

👤 代表者様
${reservation.customerName ?? ''} 様

📋 プラン
${planName}
￥${planPrice.toLocaleString()}

━━━━━━━━━━━━━━

当日お会いできることを楽しみにしております！
ご不明点はLINEよりお問い合わせください。`;

  return { type: 'text', text };
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
