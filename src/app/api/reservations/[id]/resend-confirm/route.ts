import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReservationById, getPlans, getOptions, getReservationOptions } from '@/lib/db';
import { sendLinePush, buildConfirmMessage, buildLocationVisitConfirmMessage, buildLocationShootConfirmMessage } from '@/lib/line';
import { locationPlanPrice, locationShootTotal, isLocationVisit } from '@/lib/location';

export const dynamic = 'force-dynamic';

/** POST /api/reservations/[id]/resend-confirm - 予約確定LINEを再送信 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!reservation.lineUserId) return NextResponse.json({ error: 'LINE UserID not set' }, { status: 400 });

  // ロケ見学（16:30枠）：プラン不要
  if (isLocationVisit(reservation)) {
    await sendLinePush(reservation.lineUserId, [buildLocationVisitConfirmMessage(reservation)]);
    return NextResponse.json({ success: true });
  }

  const [plans, allOptions, reservationOptions] = await Promise.all([
    getPlans(),
    getOptions(),
    getReservationOptions(reservation.id),
  ]);

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = allOptions.find((o) => o.id === ro.optionId);
    return opt ? { name: opt.name, price: opt.price, quantity: ro.quantity } : null;
  }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);

  const plan = plans.find((p) => p.id === reservation.planId);

  // ロケ撮影
  if (reservation.shootType === 'location') {
    const planPrice = plan?.price ?? locationPlanPrice(reservation.date);
    const total = locationShootTotal(reservation, optionsWithInfo, planPrice);
    await sendLinePush(reservation.lineUserId, [
      buildLocationShootConfirmMessage(reservation, plan?.name ?? 'ロケーション撮影', planPrice, optionsWithInfo, total),
    ]);
    return NextResponse.json({ success: true });
  }

  // スタジオ撮影
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  await sendLinePush(reservation.lineUserId, [
    buildConfirmMessage(
      reservation,
      plan.name,
      plan.price,
      optionsWithInfo,
      reservation.checkInTime ?? '',
      reservation.checkOutTime ?? '',
    ),
  ]);

  return NextResponse.json({ success: true });
}
