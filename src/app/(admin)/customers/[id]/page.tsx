import { notFound } from 'next/navigation';
import { getCustomers, getReservations, getOrders, getPlans } from '@/lib/google-sheets';
import CustomerDetail from './CustomerDetail';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [customers, reservations, orders, plans] = await Promise.all([
    getCustomers().catch(() => []),
    getReservations().catch(() => []),
    getOrders().catch(() => []),
    getPlans().catch(() => []),
  ]);

  const customer = customers.find((c) => c.id === params.id);
  if (!customer) notFound();

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

  const customerReservations = reservations
    .filter((r) => r.customerId === params.id)
    .map((r) => ({ ...r, planName: planMap[r.planId] ?? r.planId }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const customerOrders = orders
    .filter((o) => o.customerId === params.id)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  return (
    <CustomerDetail
      customer={customer}
      reservations={customerReservations}
      orders={customerOrders}
    />
  );
}
