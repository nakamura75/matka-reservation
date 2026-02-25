import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getReservationById,
  getReservationOptions,
  updateReservationStatus,
} from '@/lib/google-sheets';
import { sendLinePush, buildConfirmMessage } from '@/lib/line';
import { getPlans } from '@/lib/google-sheets';
import type { ReservationStatus } from '@/types';

/** GET /api/reservations/[id] */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const options = await getReservationOptions(params.id);
  return NextResponse.json({ success: true, data: { ...reservation, options } });
}

/** PATCH /api/reservations/[id] - ステータス変更など */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { status } = body as { status: ReservationStatus };

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!reservation._rowNumber) return NextResponse.json({ error: 'Row number not found' }, { status: 500 });

  await updateReservationStatus(reservation._rowNumber, status);

  // 予約確定 → LINE通知
  if (status === '予約確定' && reservation.lineUserId) {
    const plans = await getPlans();
    const plan = plans.find((p) => p.id === reservation.planId);
    if (plan) {
      await sendLinePush(reservation.lineUserId, [
        buildConfirmMessage(reservation, plan.name, plan.price),
      ]).catch((e) => console.error('LINE push failed:', e));
    }
  }

  return NextResponse.json({ success: true });
}
