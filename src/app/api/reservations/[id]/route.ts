import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReservationById,
  getReservationOptions,
  updateReservationStatus,
  updateReservation,
  deleteReservation,
  getPlans,
} from '@/lib/db';
import { sendLinePush, buildConfirmMessage } from '@/lib/line';
import type { ReservationStatus } from '@/types';

export const dynamic = 'force-dynamic';

/** GET /api/reservations/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    status?: ReservationStatus;
    note?: string;
    totalAmount?: number;
    staffAssignment?: string;
    checkInTime?: string;
    checkOutTime?: string;
    paymentStatus?: boolean;
    paymentDate?: string;
    paymentMethod?: string;
    lineUserId?: string;
    chatLineUserId?: string;
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

  // ステータス変更
  if (body.status) {
    await updateReservationStatus(reservation.id, body.status);

    // 予約確定 → 来店時間・終了時間を保存 → LINE通知
    if (body.status === '予約確定') {
      const timeFields: Record<string, unknown> = {};
      if (body.checkInTime) timeFields.checkInTime = body.checkInTime;
      if (body.checkOutTime) timeFields.checkOutTime = body.checkOutTime;
      if (Object.keys(timeFields).length > 0) {
        await updateReservation(reservation.id, timeFields);
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
  const updates: Record<string, unknown> = {};
  if (body.note !== undefined) updates.note = body.note;
  if (body.totalAmount !== undefined) updates.discountAmount = body.totalAmount;
  if (body.staffAssignment !== undefined) updates.staffAssignmentJson = body.staffAssignment;
  if (body.paymentStatus !== undefined) updates.paymentStatus = body.paymentStatus;
  if (body.paymentDate !== undefined) updates.paymentDate = body.paymentDate;
  if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
  if (body.date !== undefined) updates.date = body.date;
  if (body.timeSlot !== undefined) updates.timeSlot = body.timeSlot;
  if (body.scene !== undefined) updates.scene = body.scene;
  if (body.otherSceneNote !== undefined) updates.otherSceneNote = body.otherSceneNote;
  if (body.childrenCount !== undefined) updates.childrenCount = body.childrenCount;
  if (body.adultCount !== undefined) updates.adultCount = body.adultCount;
  if (body.familyNote !== undefined) updates.familyNote = body.familyNote;
  if (body.customerNote !== undefined) updates.customerNote = body.customerNote;
  if (body.phonePreference !== undefined) updates.phonePreference = body.phonePreference;
  if (body.lineUserId !== undefined) updates.lineUserId = body.lineUserId;
  if (body.chatLineUserId !== undefined) updates.chatLineUserId = body.chatLineUserId;

  if (Object.keys(updates).length > 0) {
    await updateReservation(reservation.id, updates);
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/reservations/[id] - 予約削除 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await deleteReservation(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
