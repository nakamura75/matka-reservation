import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReservationById,
  getReservationOptions,
  createReservationOption,
  deleteReservationOption,
  updateReservationOption,
  getOptions,
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

/** PATCH /api/reservations/[id]/options - ご主役のお支度を指定行に入れ替え */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { mainPrepReservationOptionId: string };
  const rows = await getReservationOptions(params.id);
  const target = rows.find((o) => o.id === body.mainPrepReservationOptionId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const masters = await getOptions();
  const master = masters.find((o) => o.id === target.optionId);
  // 日本髪はご主役でも課金対象（予約フォームと同じ扱い）
  const isNihongami = target.optionId === 'loc-opt-nihongami' || (master?.name ?? '').includes('日本髪');

  // 既存のご主役行を通常料金（マスター価格）に戻す
  for (const row of rows) {
    if (row.id !== target.id && row.isMainPrep) {
      await updateReservationOption(row.id, { isMainPrep: false, unitPrice: null });
    }
  }
  // 指定行をご主役にする（日本髪以外はプラン込み¥0）
  await updateReservationOption(target.id, { isMainPrep: true, unitPrice: isNihongami ? null : 0 });

  const updated = await getReservationOptions(params.id);
  return NextResponse.json({ success: true, data: updated });
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
