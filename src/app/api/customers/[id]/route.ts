import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomers, updateCustomer, deleteCustomer, getReservations, getOrders } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

/** GET /api/customers/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [customers, reservations, orders] = await Promise.all([
      getCustomers(),
      getReservations(),
      getOrders(),
    ]);
    const customer = customers.find((c) => c.id === params.id);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const customerReservations = reservations.filter((r) => r.customerId === params.id);
    const customerOrders = orders.filter((o) => o.customerId === params.id);

    return NextResponse.json({
      success: true,
      data: { customer, reservations: customerReservations, orders: customerOrders },
    });
  } catch (err) {
    console.error('GET /api/customers/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** PATCH /api/customers/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const customers = await getCustomers();
    const customer = customers.find((c) => c.id === params.id);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = { ...customer, ...body };
    await updateCustomer(updated);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('PATCH /api/customers/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** DELETE /api/customers/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [customers, reservations] = await Promise.all([
      getCustomers(),
      getReservations(),
    ]);
    const customer = customers.find((c) => c.id === params.id);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!customer._rowNumber) return NextResponse.json({ error: 'rowNumber missing' }, { status: 500 });

    const linked = reservations.filter((r) => r.customerId === params.id);
    if (linked.length > 0) {
      return NextResponse.json(
        { error: `この顧客には${linked.length}件の予約があるため削除できません` },
        { status: 409 }
      );
    }

    await deleteCustomer(customer._rowNumber);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/customers/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
