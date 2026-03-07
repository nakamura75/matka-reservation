import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAvailableSlots } from '@/lib/google-calendar';
import type { ShootingScene } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scene = searchParams.get('scene') as ShootingScene | null;

    const slots = await getAvailableSlots(scene ?? undefined);
    return NextResponse.json({ success: true, data: slots });
  } catch (err) {
    console.error('[/api/slots] error:', err);
    return NextResponse.json({ success: false, data: [], error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
