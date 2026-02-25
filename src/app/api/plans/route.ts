import { NextResponse } from 'next/server';
import { getPlans } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const plans = await getPlans();
  return NextResponse.json({ success: true, data: plans });
}
