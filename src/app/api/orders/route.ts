import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrders, getCustomers, createOrder } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** GET /api/orders */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [orders, customers] = await Promise.all([getOrders(), getCustomers()]);
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
    const enriched = orders.map((o) => ({
      ...o,
      customerName: customerMap[o.customerId] ?? o.customerId,
    }));
    return NextResponse.json({ success: true, data: enriched });
  } catch (err) {
    console.error('GET /api/orders error:', err);
    return NextResponse.json({ success: true, data: [] });
  }
}

/** POST /api/orders */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const order = {
      id: generateId(),
      customerId: body.customerId,
      reservationId: body.reservationId ?? '',
      orderDate: new Date().toLocaleDateString('ja-JP'),
      isPaid: false,
      flag: false,
      note: body.note ?? '',
    };
    await createOrder(order);
    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('POST /api/orders error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
