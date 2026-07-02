import { NextRequest, NextResponse } from 'next/server';
import { getPlans } from '@/lib/db';
import { isValidMode } from '@/lib/mode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const m = req.nextUrl.searchParams.get('mode');
    const mode = isValidMode(m) ? m : 'studio';
    const plans = await getPlans(mode);
    return NextResponse.json({ success: true, data: plans });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
