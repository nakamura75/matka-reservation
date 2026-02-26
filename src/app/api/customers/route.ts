import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomers, createCustomer } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** GET /api/customers */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const customers = await getCustomers();
    return NextResponse.json({ success: true, data: customers });
  } catch (err) {
    console.error('GET /api/customers error:', err);
    return NextResponse.json({ success: true, data: [] });
  }
}

/** POST /api/customers */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const customer = {
      id: generateId(),
      name: body.name,
      furigana: body.furigana ?? '',
      phone: body.phone,
      email: body.email ?? '',
      zipCode: body.zipCode ?? '',
      address: body.address ?? '',
      lineName: body.lineName ?? '',
      note: body.note ?? '',
      createdAt: new Date().toLocaleDateString('ja-JP'),
    };
    await createCustomer(customer);
    return NextResponse.json({ success: true, data: customer });
  } catch (err) {
    console.error('POST /api/customers error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
