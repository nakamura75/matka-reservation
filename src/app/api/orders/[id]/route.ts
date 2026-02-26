import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getOrders,
  getCustomers,
  getOrderItems,
  getProducts,
  updateOrder,
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/** GET /api/orders/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [orders, customers, items, products] = await Promise.all([
      getOrders(),
      getCustomers(),
      getOrderItems(params.id),
      getProducts(),
    ]);

    const order = orders.find((o) => o.id === params.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const enrichedItems = items.map((item) => {
      const product = productMap[item.productId];
      return {
        ...item,
        productName: product?.name ?? item.productId,
        subtotal: (product?.price ?? 0) * item.quantity,
      };
    });

    const total = enrichedItems.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        customerName: customerMap[order.customerId] ?? order.customerId,
        items: enrichedItems,
        total,
      },
    });
  } catch (err) {
    console.error('GET /api/orders/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** PATCH /api/orders/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const orders = await getOrders();
    const order = orders.find((o) => o.id === params.id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!order._rowNumber) return NextResponse.json({ error: 'Row not found' }, { status: 500 });

    await updateOrder(order._rowNumber, {
      isPaid: body.isPaid,
      paidDate: body.paidDate,
      note: body.note,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/orders/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
