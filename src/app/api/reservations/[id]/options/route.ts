import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReservationById,
  getReservationOptions,
  createReservationOption,
  deleteReservationOption,
} from '@/lib/db';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** POST /api/reservations/[id]/options - オプションを予約に追加 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { optionId: string; quantity: number };
  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newOption = {
    id: generateId(),
    reservationId: params.id,
    optionId: body.optionId,
    quantity: body.quantity ?? 1,
    note: '',
  };
  await createReservationOption(newOption);
  return NextResponse.json({ success: true, data: newOption });
}

/** DELETE /api/reservations/[id]/options - オプションを予約から削除 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { reservationOptionId: string };
  const allOptions = await getReservationOptions(params.id);
  const target = allOptions.find((o) => o.id === body.reservationOptionId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteReservationOption(target.id);
  return NextResponse.json({ success: true });
}
