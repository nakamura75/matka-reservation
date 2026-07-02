import { NextRequest, NextResponse } from 'next/server';
import { getOptions } from '@/lib/db';
import { isValidMode } from '@/lib/mode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const m = req.nextUrl.searchParams.get('mode');
    const mode = isValidMode(m) ? m : 'studio';
    const options = await getOptions(mode);
    const active = options.filter((o) => o.isActive);
    return NextResponse.json({ success: true, data: active });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
