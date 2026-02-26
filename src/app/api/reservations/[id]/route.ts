import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getReservationById,
  getReservationOptions,
  updateReservationStatus,
} from '@/lib/google-sheets';
import { sendLinePush, buildConfirmMessage } from '@/lib/line';
import { getPlans } from '@/lib/google-sheets';
import { deleteCalendarEvent } from '@/lib/google-calendar';
import { SHEET_NAMES } from '@/lib/constants';
import type { ReservationStatus } from '@/types';

export const dynamic = 'force-dynamic';

/** GET /api/reservations/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const options = await getReservationOptions(params.id);
  return NextResponse.json({ success: true, data: { ...reservation, options } });
}

/** PATCH /api/reservations/[id] - ステータス変更・備考・値引き更新 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    status?: ReservationStatus;
    note?: string;
    discountAmount?: number;
    discountReason?: string;
  };

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!reservation._rowNumber) return NextResponse.json({ error: 'Row number not found' }, { status: 500 });

  // ステータス変更
  if (body.status) {
    await updateReservationStatus(reservation._rowNumber, body.status);

    // キャンセル → カレンダーイベント削除（枠をリリース）
    if (body.status === 'キャンセル' && reservation.calendarEventId) {
      await deleteCalendarEvent(reservation.calendarEventId).catch((e) =>
        console.error('Calendar event deletion failed:', e)
      );
    }

    // 予約確定 → LINE通知
    if (body.status === '予約確定' && reservation.lineUserId) {
      const plans = await getPlans();
      const plan = plans.find((p) => p.id === reservation.planId);
      if (plan) {
        await sendLinePush(reservation.lineUserId, [
          buildConfirmMessage(reservation, plan.name, plan.price),
        ]).catch((e) => console.error('LINE push failed:', e));
      }
    }
  }

  // 備考・値引き更新（N, U, V 列）
  if (body.note !== undefined || body.discountAmount !== undefined || body.discountReason !== undefined) {
    const { getSheetsClient } = await import('@/lib/google-sheets');
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID ?? '';
    const row = reservation._rowNumber;

    const updates: { range: string; value: string | number }[] = [];
    if (body.note !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!M${row}`, value: body.note }); // M: 備考
    if (body.discountAmount !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!T${row}`, value: body.discountAmount }); // T: 値引額
    if (body.discountReason !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!U${row}`, value: body.discountReason }); // U: 値引理由

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map(({ range, value }) => ({ range, values: [[value]] })),
      },
    });
  }

  return NextResponse.json({ success: true });
}
