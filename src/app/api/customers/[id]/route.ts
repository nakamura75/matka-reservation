import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCustomers, updateCustomer, deleteCustomer, getReservations, getOrders } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/customers/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const customers = await getCustomers();
    const customer = customers.find((c) => c.id === params.id);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await deleteCustomer(customer.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/customers/[id] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
