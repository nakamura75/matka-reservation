import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReservationById, getPlans, getOptions, getReservationOptions } from '@/lib/db';
import { sendLinePush, buildConfirmMessage } from '@/lib/line';

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

  const [plans, allOptions, reservationOptions] = await Promise.all([
    getPlans(),
    getOptions(),
    getReservationOptions(reservation.id),
  ]);

  const plan = plans.find((p) => p.id === reservation.planId);
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = allOptions.find((o) => o.id === ro.optionId);
    return opt ? { name: opt.name, price: opt.price, quantity: ro.quantity } : null;
  }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);

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
