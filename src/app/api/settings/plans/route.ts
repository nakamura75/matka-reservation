import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPlans, createPlan, updatePlan } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const plans = await getPlans();
  return NextResponse.json({ success: true, data: plans });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const plan = {
      id: generateId(),
      name: body.name,
      price: Number(body.price),
      duration: Number(body.duration) || 90,
      description: body.description ?? '',
      isActive: body.isActive ?? true,
      commissionPrice: Number(body.commissionPrice) || 0,
    };
    await createPlan(plan);
    return NextResponse.json({ success: true, data: plan });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await updatePlan(body);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
