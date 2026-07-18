import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReservationById,
  getReservationOptions,
  updateReservation,
  deleteReservation,
  getPlans,
  getOptions,
  checkVisitSlotConflict,
  getLocationPairSibling,
  getCustomerById,
} from '@/lib/db';
import { sendLinePush, buildConfirmMessage, buildLocationVisitConfirmMessage, buildLocationShootConfirmMessage } from '@/lib/line';
import { locationPlanPrice, locationShootTotal, isLocationVisit } from '@/lib/location';
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
    discountRate?: number;
    productDiscountRate?: number;
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
    planId?: string;
    snsPermission?: string;
    photoDelivered?: boolean;
    visitDate?: string;
    cancelInsurance?: string;
  } & Record<string, unknown>;

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ステータスバリデーション
  const VALID_STATUSES = new Set(['予約済', '予約確定', '見学', '保留', '完了', 'キャンセル']);
  if (body.status && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // 全フィールドを単一のupdatesオブジェクトに集約
  const updates: Record<string, unknown> = {};

  // ステータス変更
  if (body.status) {
    updates.status = body.status;

    // 予約確定 → 来店時間・終了時間も含めてまとめて更新 → LINE通知
    if (body.status === '予約確定') {
      if (body.checkInTime) updates.checkInTime = body.checkInTime;
      if (body.checkOutTime) updates.checkOutTime = body.checkOutTime;
    }
  }

  // 備考・合計金額・担当割り当て・支払ステータス・予約情報更新
  if (body.note !== undefined) updates.note = body.note;
  if (body.totalAmount !== undefined) updates.discountAmount = body.totalAmount;
  if (body.discountRate !== undefined) updates.discountRate = body.discountRate;
  if (body.productDiscountRate !== undefined) updates.productDiscountRate = body.productDiscountRate;
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
  if (body.planId !== undefined) updates.planId = body.planId;
  if (body.snsPermission !== undefined) updates.snsPermission = body.snsPermission;
  if (body.photoDelivered !== undefined) updates.photoDelivered = body.photoDelivered;
  if (body.visitDate !== undefined) updates.visitDate = body.visitDate;
  if (body.cancelInsurance !== undefined) updates.cancelInsurance = body.cancelInsurance;

  // 見学の日時を変更する場合、他の見学との重複を防止（見学1件=1時間占有・撮影枠とは独立）
  const effectiveStatus = (body.status ?? reservation.status) as ReservationStatus;
  if (effectiveStatus === '見学' && (body.date !== undefined || body.timeSlot !== undefined)) {
    const effectiveDate = body.date ?? reservation.date;
    const effectiveTime = body.timeSlot ?? reservation.timeSlot;
    if (effectiveDate && effectiveTime) {
      const visitConflict = await checkVisitSlotConflict(effectiveDate, effectiveTime, reservation.id);
      if (visitConflict) {
        return NextResponse.json({ error: 'この時間帯はすでに見学予約が入っています（前後1時間は重複できません）。別の時間をお選びください。' }, { status: 409 });
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await updateReservation(reservation.id, updates);
    } catch (err) {
      console.error('updateReservation failed:', err);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // 予約確定 → LINE通知（DB更新後に送信）
  if (body.status === '予約確定' && reservation.lineUserId && reservation.shootType === 'location') {
    // ロケ：見学/撮影で確定メッセージを出し分け（見分け＝変更前ステータス「見学」or 16:30枠）
    const [plans, allOptions, reservationOptions, updatedReservation, customer] = await Promise.all([
      getPlans(),
      getOptions(),
      getReservationOptions(reservation.id),
      getReservationById(reservation.id),
      getCustomerById(reservation.customerId),
    ]);
    // 予約行に代表者名が無いため顧客マスタから補完する（空「代表者様　様」対策）
    const cname = customer?.name ?? reservation.customerName ?? '';
    const target = { ...(updatedReservation ?? reservation), customerName: cname };
    if (reservation.status === '見学' || isLocationVisit(reservation)) {
      // 見学の確定（金額・振込なし）
      await sendLinePush(reservation.lineUserId, [
        buildLocationVisitConfirmMessage(target),
      ]).catch((e) => console.error('LINE push failed:', e));
    } else {
      // 撮影の確定（振込案内つき）＋ 対の見学確定も一緒に送る（見学→撮影の順）
      const optionsWithInfo = reservationOptions.map((ro) => {
        const opt = allOptions.find((o) => o.id === ro.optionId);
        return opt ? { name: opt.name, price: opt.price, quantity: ro.quantity } : null;
      }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);
      const plan = plans.find((p) => p.id === target.planId);
      const planPrice = plan?.price ?? locationPlanPrice(target.date);
      const total = locationShootTotal(target, optionsWithInfo, planPrice);
      const shootMsg = buildLocationShootConfirmMessage(target, plan?.name ?? 'ロケーション撮影', planPrice, optionsWithInfo, total);
      const visit = await getLocationPairSibling(reservation);
      const messages = visit
        ? [buildLocationVisitConfirmMessage({ ...visit, customerName: cname }), shootMsg]
        : [shootMsg];
      await sendLinePush(reservation.lineUserId, messages).catch((e) => console.error('LINE push failed:', e));
    }
  } else if (body.status === '予約確定' && reservation.lineUserId) {
    const [plans, allOptions, reservationOptions] = await Promise.all([
      getPlans(),
      getOptions(),
      getReservationOptions(reservation.id),
    ]);
    const updatedPlanId = body.planId ?? reservation.planId;
    const plan = plans.find((p) => p.id === updatedPlanId);
    if (plan) {
      // 最新のDB状態を再取得（金額修正やオプション追加が反映済み）
      const updatedReservation = await getReservationById(reservation.id);
      const optionsWithInfo = reservationOptions.map((ro) => {
        const opt = allOptions.find((o) => o.id === ro.optionId);
        return opt ? { name: opt.name, price: opt.price, quantity: ro.quantity } : null;
      }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);

      await sendLinePush(reservation.lineUserId, [
        buildConfirmMessage(updatedReservation ?? reservation, plan.name, plan.price, optionsWithInfo, body.checkInTime ?? '', body.checkOutTime ?? ''),
      ]).catch((e) => console.error('LINE push failed:', e));
    }
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
    // ロケは「見学＋撮影」の2件で1予約。相方も一緒に削除して両方の枠を解放する。
    const reservation = await getReservationById(params.id);
    const sibling = reservation?.shootType === 'location'
      ? await getLocationPairSibling(reservation)
      : null;
    await deleteReservation(params.id);
    if (sibling) await deleteReservation(sibling.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
