import { NextResponse } from 'next/server';
import { getLocationBookedShoots } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ロケ本番の予約済み枠（公開：フォームで選択不可にするため）。
// キャンセル・見学は除外（＝有効な本番予約の date+timeSlot）。
export async function GET() {
  try {
    const slots = await getLocationBookedShoots();
    return NextResponse.json({ success: true, data: slots });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
