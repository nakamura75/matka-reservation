import { NextRequest, NextResponse } from 'next/server';
import {
  verifyLineSignature,
  sendLinePush,
  sendLineReply,
  buildTentativeMessage,
  buildLocationVisitTentativeMessage,
  buildLocationShootTentativeMessage,
  type LineMessage,
} from '@/lib/line';
import {
  getReservationByNumber,
  getCustomerById,
  linkLineUserId,
  getReservationOptions,
  getOptions,
  getPlans,
  getLocationPairSibling,
} from '@/lib/db';
import { isLocationVisit, locationPlanPrice, locationShootTotal } from '@/lib/location';
import type { Reservation } from '@/types';

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

  // LINE_UserID を予約に紐づける（chatLineUserIdは手動ペーストのみ）
  await linkLineUserId(reservation.id, userId);

  // 仮予約完了通知を送信
  const [plans, options, reservationOptions, customer] = await Promise.all([
    getPlans(),
    getOptions(),
    getReservationOptions(reservation.id),
    getCustomerById(reservation.customerId),
  ]);

  const res = { ...reservation, customerName: customer?.name ?? reservation.customerName ?? '' };
  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return {
      name: opt?.name ?? '',
      price: opt?.price ?? 0,
      quantity: ro.quantity,
    };
  });

  // オプション情報を {name,price,quantity}[] に整形するヘルパー
  const toOptInfo = (ros: { optionId: string; quantity: number }[]) =>
    ros.map((ro) => {
      const opt = options.find((o) => o.id === ro.optionId);
      return { name: opt?.name ?? '', price: opt?.price ?? 0, quantity: ro.quantity };
    });
  // 撮影の仮予約メッセージを組み立て（プラン実額で計算）
  const buildShoot = (shoot: Reservation, opts: { name: string; price: number; quantity: number }[]) => {
    const plan = plans.find((p) => p.id === shoot.planId);
    const planPrice = plan?.price ?? locationPlanPrice(shoot.date);
    const total = locationShootTotal(shoot, opts, planPrice);
    return buildLocationShootTentativeMessage(shoot, plan?.name ?? 'ロケーション撮影', planPrice, opts, total);
  };

  const messages: LineMessage[] = [];
  if (res.shootType === 'location') {
    // ロケは「見学＋撮影」の2通を送る（LINE外予約は番号送信でここに来るため、片方だけにならないよう対を辿る）
    const sibling = await getLocationPairSibling(reservation);
    if (sibling) await linkLineUserId(sibling.id, userId);
    const withName = (r: Reservation | null): Reservation | null => (r ? { ...r, customerName: res.customerName } : null);
    const visitR: Reservation | null = isLocationVisit(res) ? res : withName(sibling);
    const shootR: Reservation | null = isLocationVisit(res) ? withName(sibling) : res;
    if (visitR) messages.push(buildLocationVisitTentativeMessage(visitR));
    if (shootR) {
      const shootOpts = shootR.id === reservation.id
        ? optionsWithInfo
        : toOptInfo(await getReservationOptions(shootR.id));
      messages.push(buildShoot(shootR, shootOpts));
    }
  } else {
    const plan = plans.find((p) => p.id === res.planId);
    if (!plan) return;
    messages.push(buildTentativeMessage(res, plan.name, plan.price, optionsWithInfo));
  }

  if (messages.length) await sendLinePush(userId, messages);
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
