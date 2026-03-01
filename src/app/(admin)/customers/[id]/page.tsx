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

  // リピーター判定: 電話番号またはLINE IDが一致する予約が複数あるか
  const samePhoneIds = customer.phone?.trim()
    ? customers.filter((c) => c.phone?.trim() === customer.phone?.trim()).map((c) => c.id)
    : [customer.id];
  const totalByPhone = samePhoneIds.reduce(
    (sum, id) => sum + reservations.filter((r) => r.customerId === id).length,
    0,
  );
  const customerLineIds = new Set(
    reservations
      .filter((r) => r.customerId === customer.id && r.lineUserId?.trim())
      .map((r) => r.lineUserId!.trim()),
  );
  const isRepeaterByLine = Array.from(customerLineIds).some(
    (lineId) => reservations.filter((r) => r.lineUserId?.trim() === lineId).length > 1,
  );
  const isRepeater = totalByPhone > 1 || isRepeaterByLine;

  // 予約シートのO列からlineUserIdを取得してcustomerに付与
  const lineUserId = Array.from(customerLineIds)[0] ?? undefined;
  const customerWithLine = { ...customer, lineUserId };

  return (
    <CustomerDetail
      customer={customerWithLine}
      reservations={customerReservations}
      orders={customerOrders}
      isRepeater={isRepeater}
    />
  );
}
