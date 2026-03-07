import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStaff, createStaff, updateStaff } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const staff = await getStaff();
  return NextResponse.json({ success: true, data: staff });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const member = { id: generateId(), name: body.name, isActive: 'TRUE' };
    await createStaff(member);
    return NextResponse.json({ success: true, data: member });
  } catch (err) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await updateStaff(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
