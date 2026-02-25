import { NextResponse } from 'next/server';
import { getOptions } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const options = await getOptions();
    const active = options.filter((o) => o.isActive);
    return NextResponse.json({ success: true, data: active });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
