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

/** PATCH /api/reservations/[id] - ステータス変更・備考・合計金額更新 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    status?: ReservationStatus;
    note?: string;
    totalAmount?: number; // ③ 合計金額（T列に保存）
    staffAssignment?: string; // 担当割り当てJSON（Y列に保存）
    checkInTime?: string;  // 来店時間（V列に保存）
    checkOutTime?: string; // 終了時間（W列に保存）
    paymentStatus?: boolean; // 支払ステータス（D列に保存）
    paymentDate?: string;    // 支払日（E列に保存）
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

    // 予約確定 → 来店時間・終了時間をシートに保存 → LINE通知
    if (body.status === '予約確定') {
      const { getSheetsClient } = await import('@/lib/google-sheets');
      const sheets = getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID ?? '';
      const row = reservation._rowNumber;
      const timeUpdates = [];
      if (body.checkInTime) timeUpdates.push({ range: `${SHEET_NAMES.RESERVATIONS}!V${row}`, values: [[body.checkInTime]] });
      if (body.checkOutTime) timeUpdates.push({ range: `${SHEET_NAMES.RESERVATIONS}!W${row}`, values: [[body.checkOutTime]] });
      if (timeUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: 'USER_ENTERED', data: timeUpdates },
        });
      }

      if (reservation.lineUserId) {
        const plans = await getPlans();
        const plan = plans.find((p) => p.id === reservation.planId);
        if (plan) {
          await sendLinePush(reservation.lineUserId, [
            buildConfirmMessage(reservation, plan.name, body.checkInTime ?? '', body.checkOutTime ?? ''),
          ]).catch((e) => console.error('LINE push failed:', e));
        }
      }
    }
  }

  // 備考・合計金額・担当割り当て・支払ステータス更新
  if (body.note !== undefined || body.totalAmount !== undefined || body.staffAssignment !== undefined || body.paymentStatus !== undefined) {
    const { getSheetsClient } = await import('@/lib/google-sheets');
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID ?? '';
    const row = reservation._rowNumber;

    const updates: { range: string; value: string | number }[] = [];
    if (body.note !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!M${row}`, value: body.note }); // M: 備考
    if (body.totalAmount !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!T${row}`, value: body.totalAmount }); // T: 合計金額（手動設定）
    if (body.staffAssignment !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!Y${row}`, value: body.staffAssignment }); // Y: 担当割り当てJSON
    if (body.paymentStatus !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!D${row}`, value: body.paymentStatus ? 'TRUE' : 'FALSE' }); // D: 支払ステータス
    if (body.paymentDate !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!E${row}`, value: body.paymentDate }); // E: 支払日

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
