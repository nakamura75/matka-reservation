import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plans = await getPlans();
    return NextResponse.json({ success: true, data: plans });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
