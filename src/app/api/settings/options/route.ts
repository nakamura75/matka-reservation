import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOptions, createOption, updateOption } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const options = await getOptions();
  return NextResponse.json({ success: true, data: options });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const option = {
      id: generateId(),
      name: body.name,
      price: Number(body.price),
      description: body.description ?? '',
      isActive: body.isActive ?? true,
      externalCode: body.externalCode ?? '',
      commissionPrice: Number(body.commissionPrice) || 0,
    };
    await createOption(option);
    return NextResponse.json({ success: true, data: option });
  } catch (err) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    await updateOption(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
