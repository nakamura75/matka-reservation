import { NextRequest, NextResponse } from 'next/server';
import {
  verifyLineSignature,
  sendLinePush,
  sendLineReply,
  buildTentativeMessage,
} from '@/lib/line';
import {
  getReservationByNumber,
  linkLineUserId,
  saveChatLineUserId,
  getReservationOptions,
  getOptions,
  getPlans,
} from '@/lib/google-sheets';

/**
 * POST /api/line/webhook
 * LINE Messaging API からのWebhookを受信する
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  // 署名検証
  if (!verifyLineSignature(rawBody, signature)) {
    console.warn('LINE Webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // イベント処理（awaitして完了後に200を返す）
  await processEvents(body.events).catch((e) => console.error('LINE event processing error:', e));

  return NextResponse.json({ success: true });
}

async function processEvents(events: LineEvent[]) {
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      await handleTextMessage(event);
    }
  }
}

async function handleTextMessage(event: LineEvent) {
  const text = event.message?.text ?? '';
  const userId = event.source?.userId;
  const replyToken = event.replyToken;

  if (!userId) return;

  // 予約番号パターン: "matka予約: M-YYYYMMDD-XXXX"
  const match = text.match(/matka予約[:\s：]\s*(M-\d{8}-\d{4})/i);
  if (!match) return;

  const reservationNumber = match[1];
  const reservation = await getReservationByNumber(reservationNumber);

  if (!reservation) {
    if (replyToken) {
      await sendLineReply(replyToken, [{
        type: 'text',
        text: `予約番号「${reservationNumber}」が見つかりませんでした。\n正しい予約番号をご確認ください。`,
      }]);
    }
    return;
  }

  // LINE_UserID を予約に紐づける（O列：LIFFのID上書き）
  // AB列：Messaging API の実チャットUserIDとして保存
  if (reservation._rowNumber) {
    await Promise.all([
      linkLineUserId(reservation._rowNumber, userId),
      saveChatLineUserId(reservation._rowNumber, userId),
    ]);
  }

  // 仮予約完了通知を送信
  const [plans, options, reservationOptions] = await Promise.all([
    getPlans(),
    getOptions(),
    getReservationOptions(reservation.id),
  ]);

  const plan = plans.find((p) => p.id === reservation.planId);
  if (!plan) return;

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return {
      name: opt?.name ?? '',
      price: opt?.price ?? 0,
      quantity: ro.quantity,
    };
  });

  const message = buildTentativeMessage(
    { ...reservation, customerName: reservation.customerName },
    plan.name,
    plan.price,
    optionsWithInfo
  );

  await sendLinePush(userId, [message]);
}

// ============================================================
// LINE Webhook 型定義
// ============================================================

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp?: number;
  message?: {
    type: string;
    id?: string;
    text?: string;
  };
}
