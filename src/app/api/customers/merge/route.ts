import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCustomers, getReservations, deleteCustomer, updateReservation } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customers/merge
 * primaryId の顧客にすべての予約を統合し、duplicateIds の顧客を削除する
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { primaryId, duplicateIds } = await req.json() as {
    primaryId: string;
    duplicateIds: string[];
  };

  if (!primaryId || !duplicateIds?.length) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const [customers, reservations] = await Promise.all([
    getCustomers(),
    getReservations(),
  ]);

  const primary = customers.find((c) => c.id === primaryId);
  if (!primary) return NextResponse.json({ error: 'Primary customer not found' }, { status: 404 });

  // 1. 重複顧客に紐づく予約の customerId を primaryId に書き換え
  const reservationsToUpdate = reservations.filter((r) => duplicateIds.includes(r.customerId));
  for (const r of reservationsToUpdate) {
    await updateReservation(r.id, { customerId: primaryId });
  }

  // 2. 重複顧客を削除
  for (const dupId of duplicateIds) {
    await deleteCustomer(dupId);
  }

  return NextResponse.json({ success: true });
}
