import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getReservations,
  createReservation,
  createReservationOption,
  createCustomer,
  getPlans,
  getOptions,
  getReservationById,
  updateCalendarEventId,
} from '@/lib/google-sheets';
import { createCalendarEvent } from '@/lib/google-calendar';
import { sendLinePush, buildTentativeMessage } from '@/lib/line';
import { generateId, generateReservationNumber, toJSTDatetime } from '@/lib/utils';
import { CALENDAR_COLOR_ID_VISIT } from '@/lib/constants';
import type { ReservationFormData, Reservation } from '@/types';

/** GET /api/reservations - 予約一覧 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reservations = await getReservations();
    return NextResponse.json({ success: true, data: reservations });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

/** POST /api/reservations - 予約作成（フォーム送信） */
export async function POST(req: import('next/server').NextRequest) {
  try {
    const body: ReservationFormData & { isVisit?: boolean; existingCustomerId?: string } = await req.json();

    const isVisit = body.isVisit === true;

    // プラン情報取得（見学の場合はスキップ）
    const plans = await getPlans();
    const plan = isVisit ? null : plans.find((p) => p.id === body.planId);
    if (!isVisit && !plan) {
      return NextResponse.json({ error: 'プランが見つかりません' }, { status: 400 });
    }

    // 顧客の重複チェック（電話番号で検索）
    const allCustomers = await import('@/lib/google-sheets').then((m) => m.getCustomers());
    let customer = allCustomers.find((c) => c.phone === body.phone);

    const now = new Date().toLocaleDateString('ja-JP');
    const reservationId = generateId();
    const reservationNumber = generateReservationNumber(body.date);

    if (!customer) {
      // 新規顧客登録
      const customerId = generateId();
      customer = {
        id: customerId,
        name: body.customerName,
        furigana: body.furigana,
        phone: body.phone,
        email: body.email,
        zipCode: body.zipCode,
        address: body.address,
        lineName: body.lineName,
        createdAt: now,
      };
      await createCustomer(customer);
    }

    // 予約作成
    const reservation = {
      id: reservationId,
      customerId: customer.id,
      customerName: customer.name,
      planId: body.planId ?? '',
      planName: plan?.name ?? '',
      paymentStatus: false,
      date: body.date,
      timeSlot: body.timeSlot,
      childrenCount: body.childrenCount,
      adultCount: body.adultCount,
      familyNote: body.childrenDetail,
      status: (isVisit ? '見学' : '予約済') as import('@/types').ReservationStatus,
      customerNote: body.note,
      otherSceneNote: body.otherSceneNote,
      createdAt: new Date().toISOString(),
      lineUserId: body.lineUserId ?? '',
      flag: false,
      phonePreference: body.phoneCallPreference,
      scene: body.scene,
      reservationNumber,
    };
    await createReservation(reservation);

    // 予約オプション作成
    for (const opt of body.selectedOptions) {
      await createReservationOption({
        id: generateId(),
        reservationId,
        optionId: opt.optionId,
        quantity: opt.quantity,
      });
    }

    // Google Calendar イベント作成 → イベントIDをSheetsに保存
    const startISO = toJSTDatetime(body.date, body.timeSlot);
    const endDate = new Date(startISO);
    // 見学は30分、撮影はプランの所要時間
    endDate.setMinutes(endDate.getMinutes() + (isVisit ? 30 : (plan?.duration ?? 60)));
    const endISO = endDate.toISOString().replace('Z', '+09:00');

    const calendarTitle = isVisit
      ? `【見学】${body.customerName} 様`
      : `【仮予約】${body.customerName} 様 (${body.scene})`;
    const calendarDesc = isVisit
      ? `予約番号: ${reservationNumber}\n電話: ${body.phone}`
      : `予約番号: ${reservationNumber}\nプラン: ${plan?.name ?? ''}\n電話: ${body.phone}`;

    const calendarEventId = await createCalendarEvent({
      title: calendarTitle,
      startDateTime: startISO,
      endDateTime: endISO,
      description: calendarDesc,
      ...(isVisit ? { colorId: CALENDAR_COLOR_ID_VISIT } : {}),
    }).catch((e) => { console.error('Calendar event creation failed:', e); return null; });

    if (calendarEventId) {
      const saved = await getReservationById(reservationId).catch(() => null);
      if (saved?._rowNumber) {
        await updateCalendarEventId(saved._rowNumber, calendarEventId).catch((e) =>
          console.error('Calendar event ID save failed:', e)
        );
      }
    }

    // LIFF経由でlineUserIdがある場合、仮予約LINEを送信（見学はスキップ）
    if (!isVisit && body.lineUserId) {
      const allOptions = await getOptions().catch(() => []);
      const optionsWithInfo = body.selectedOptions.map((sel) => {
        const opt = allOptions.find((o) => o.id === sel.optionId);
        return opt ? { name: opt.name, price: opt.price, quantity: sel.quantity } : null;
      }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);

      await sendLinePush(body.lineUserId, [
        buildTentativeMessage(reservation as Reservation, plan.name, plan.price, optionsWithInfo),
      ]).catch((e) => console.error('LINE Push failed:', e));
    }

    return NextResponse.json({
      success: true,
      data: {
        reservationId,
        reservationNumber,
        customerId: customer.id,
      },
    });
  } catch (error) {
    console.error('POST /api/reservations error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
