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

/** 撮影シーンに応じた注意事項 */
function getSceneNotes(scene: Reservation['scene']): string {
  if (scene === '七五三') {
    return `⚠️撮影に関する注意事項
※当日はヘアセット後にお着付けとなりますので、お子様は前開きのお洋服をご着用いただきますようお願いいたします。
また、肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。

※当日は5パターンの撮影が可能です。
なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。`;
  }
  if (scene === 'マタニティ') {
    return `⚠️撮影に関する注意事項
※当店での【ヘアメイク】をご希望の場合は、スキンケアのみご自宅でお済ませください。
(メイク用品やヘアセット用品のお持ち込みも可能でございます。その場合は担当の美容師に当日お声がけ下さいませ。)

※当日は5パターンの撮影が可能です。
なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。`;
  }
  // ベビー・バースデー・その他
  return `⚠️撮影に関する注意事項
※肌着は首の空いたタンクトップやキャミソールタイプのものをご着用ください。

※当日は5パターンの撮影が可能です。
なお、ご来店時間から15分以上遅れた場合、衣装着数が少なくなる可能性がございます。`;
}

/** 予約確定メッセージ */
export function buildConfirmMessage(
  reservation: Reservation,
  planName: string,
  checkInTime: string,
  checkOutTime: string
): LineMessage {
  const formattedDate = reservation.date.replace(/-/g, '/');
  const sceneNotes = getSceneNotes(reservation.scene);
  const text = `✅ ご予約が確定しました！

【ご予約内容】
━━━━━━━━━━━━━━
📆 予約日
${formattedDate}

🕐 撮影開始時間
${reservation.timeSlot}
　※当日は${checkInTime}までにご来店ください。
　※終了時間は${checkOutTime}ごろ予定ですが、前後する場合もございます。

📸 プラン
${planName}
━━━━━━━━━━━━━━
${sceneNotes}

※お車でご来店の場合、専用駐車場を2台分設けております。
(黄色のカラーコーンが目印です。)
駐車場周辺の住所、外観等の詳細はLINEの【Parking】をご確認ください。
1組様につき1台分のお貸し出しとなりますので、ご親戚様等、お車2台以上でお越しの場合、1台以外はコインパーキングをご利用ください。
公式instagramにて、駐車場から当店までの経路をご確認いただけます。

※キャンセル規定は下記の通りでございます。
-------------------
2日前：無料
前日：ご予約料金の50％
当日：ご予約料金の100％
無断キャンセル：ご予約料金の100％
-------------------
体調不良等によりお日にちをご変更いただいた場合、キャンセル料金は頂戴しておりません。

何かご不明な点等ございましたらお気軽にお問い合わせくださいませ。
当日お会いできますことを楽しみにしております！

matka.
- - - - - - - - - - - - - - - - - -
PHOTO STUDIO matka.
☎052-846-2378
📍名古屋市瑞穂区瑞穂通4丁目48番地 近江ビル1F
- - - - - - - - - - - - - - - - - -`;

  return { type: 'text', text };
}

/** 前日リマインドメッセージ */
export function buildReminderMessage(
  reservation: Reservation,
  planName: string,
  checkInTime: string,
  checkOutTime: string
): LineMessage {
  const formattedDate = reservation.date.replace(/-/g, '/');
  const sceneNotes = getSceneNotes(reservation.scene);
  const text = `📅 明日のご予約のご確認

【ご予約内容】
━━━━━━━━━━━━━━
🗓 予約日
${formattedDate}

🕐 撮影開始時間
${reservation.timeSlot}
　※当日は${checkInTime}までにご来店ください。
　※終了時間は${checkOutTime}ごろ予定ですが、前後する場合もございます。

📸 プラン
${planName}
━━━━━━━━━━━━━━
${sceneNotes}

※お車でご来店の場合、専用駐車場を2台分設けております。
(黄色のカラーコーンが目印です。)
駐車場周辺の住所、外観等の詳細はLINEの【Parking】をご確認ください。
1組様につき1台分のお貸し出しとなりますので、ご親戚様等、お車2台以上でお越しの場合、1台以外はコインパーキングをご利用ください。
公式instagramにて、駐車場から当店までの経路をご確認いただけます。

明日お会いできますことを楽しみにしております！
何かご不明な点等ございましたらお気軽にお問い合わせくださいませ。

matka.
- - - - - - - - - - - - - - - - - -
PHOTO STUDIO matka.
☎052-846-2378
📍名古屋市瑞穂区瑞穂通4丁目48番地 近江ビル1F
- - - - - - - - - - - - - - - - - -`;

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
