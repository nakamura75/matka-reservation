import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrderItems, createOrderItem, updateOrderItem, getOrders } from '@/lib/google-sheets';
import { generateId } from '@/lib/utils';
import type { OrderItem } from '@/types';

export const dynamic = 'force-dynamic';

/** POST /api/orders/[id]/items - 注文詳細を追加 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // customerId を注文から取得
    const orders = await getOrders();
    const order = orders.find((o) => o.id === params.id);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const item: Omit<OrderItem, '_rowNumber' | 'subtotal' | 'commissionAmount'> = {
      id: generateId(),
      orderId: params.id,
      productId: body.productId,
      customerId: order.customerId,
      quantity: body.quantity ?? 1,
      status: '受注',
      note: body.note ?? '',
    };
    await createOrderItem(item);
    return NextResponse.json({ success: true, data: item });
  } catch (err) {
    console.error('POST /api/orders/[id]/items error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** PATCH /api/orders/[id]/items - 注文詳細のステータス更新 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { itemId, ...fields } = body;

    const items = await getOrderItems(params.id);
    const item = items.find((i) => i.id === itemId);
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    if (!item._rowNumber) return NextResponse.json({ error: 'Row not found' }, { status: 500 });

    await updateOrderItem(item._rowNumber, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/orders/[id]/items error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
