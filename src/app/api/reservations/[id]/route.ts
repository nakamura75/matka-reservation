import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getReservationById,
  getReservationOptions,
  updateReservationStatus,
} from '@/lib/google-sheets';
import { sendLinePush, buildConfirmMessage } from '@/lib/line';
import { getPlans } from '@/lib/google-sheets';
import { deleteCalendarEvent, createCalendarEvent } from '@/lib/google-calendar';
import { toJSTDatetime } from '@/lib/utils';
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
    paymentMethod?: string;  // 支払方法（AC列に保存）
    lineUserId?: string;     // LINE UserID（O列）
    chatLineUserId?: string; // LINE ChatUserID（AB列）
    // 予約情報編集
    date?: string;
    timeSlot?: string;
    scene?: string;
    otherSceneNote?: string;
    childrenCount?: number | string;
    adultCount?: string;
    familyNote?: string;
    customerNote?: string;
    phonePreference?: string;
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

  // 備考・合計金額・担当割り当て・支払ステータス・予約情報更新
  if (body.note !== undefined || body.totalAmount !== undefined || body.staffAssignment !== undefined || body.paymentStatus !== undefined || body.paymentMethod !== undefined ||
      body.date !== undefined || body.timeSlot !== undefined || body.scene !== undefined || body.otherSceneNote !== undefined ||
      body.childrenCount !== undefined || body.adultCount !== undefined || body.familyNote !== undefined ||
      body.customerNote !== undefined || body.phonePreference !== undefined ||
      body.lineUserId !== undefined || body.chatLineUserId !== undefined) {
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
    if (body.paymentMethod !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!AC${row}`, value: body.paymentMethod }); // AC: 支払方法
    if (body.date !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!F${row}`, value: body.date }); // F: 予約日
    if (body.timeSlot !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!G${row}`, value: body.timeSlot }); // G: 予約時間帯

    // 日時変更時はGoogleカレンダーイベントを作り直す
    const dateChanged = body.date !== undefined && body.date !== reservation.date;
    const timeSlotChanged = body.timeSlot !== undefined && body.timeSlot !== reservation.timeSlot;
    if (dateChanged || timeSlotChanged) {
      const oldEventId = reservation.calendarEventId && !reservation.calendarEventId.startsWith('http')
        ? reservation.calendarEventId : null;
      if (oldEventId) {
        await deleteCalendarEvent(oldEventId).catch((e) => console.error('Calendar event deletion failed:', e));
      }
      const newDate = body.date ?? reservation.date;
      const newTimeSlot = body.timeSlot ?? reservation.timeSlot;
      const plans = await getPlans();
      const plan = plans.find((p) => p.id === reservation.planId);
      if (plan && newDate && newTimeSlot) {
        const startISO = toJSTDatetime(newDate, newTimeSlot);
        const endDate = new Date(startISO);
        endDate.setMinutes(endDate.getMinutes() + plan.duration);
        const endISO = endDate.toISOString().replace('Z', '+09:00');
        const newEventId = await createCalendarEvent({
          title: `【仮予約】${reservation.customerId} 様 (${body.scene ?? reservation.scene ?? ''})`,
          startDateTime: startISO,
          endDateTime: endISO,
          description: `予約番号: ${reservation.reservationNumber ?? ''}\nプラン: ${plan.name}`,
        }).catch((e) => { console.error('Calendar event creation failed:', e); return null; });
        if (newEventId) {
          updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!X${row}`, value: newEventId }); // X: カレンダーイベントID
        }
      }
    }
    if (body.scene !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!R${row}`, value: body.scene }); // R: 撮影シーン
    if (body.otherSceneNote !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!AA${row}`, value: body.otherSceneNote }); // AA: その他シーン詳細
    if (body.childrenCount !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!H${row}`, value: body.childrenCount }); // H: お子様人数
    if (body.adultCount !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!I${row}`, value: body.adultCount }); // I: 大人人数
    if (body.familyNote !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!J${row}`, value: body.familyNote }); // J: 家族構成メモ
    if (body.customerNote !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!Z${row}`, value: body.customerNote }); // Z: お客様備考
    if (body.phonePreference !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!Q${row}`, value: body.phonePreference }); // Q: 電話希望
    if (body.lineUserId !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!O${row}`, value: body.lineUserId }); // O: LINE UserID
    if (body.chatLineUserId !== undefined) updates.push({ range: `${SHEET_NAMES.RESERVATIONS}!AB${row}`, value: body.chatLineUserId }); // AB: LINE ChatUserID

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
