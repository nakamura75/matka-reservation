import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getReservationById, getPlans } from '@/lib/db';
import { sendLinePush, buildReminderMessage } from '@/lib/line';

export const dynamic = 'force-dynamic';

/** POST /api/reservations/[id]/remind - 前日リマインドLINE送信 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!reservation.lineUserId) return NextResponse.json({ error: 'LINE UserID not set' }, { status: 400 });

  const body = await req.json() as { checkInTime?: string; checkOutTime?: string };

  const plans = await getPlans();
  const plan = plans.find((p) => p.id === reservation.planId);
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  await sendLinePush(reservation.lineUserId, [
    buildReminderMessage(reservation, plan.name, body.checkInTime ?? reservation.checkInTime ?? '', body.checkOutTime ?? reservation.checkOutTime ?? ''),
  ]);

  return NextResponse.json({ success: true });
}
