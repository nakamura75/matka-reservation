import { getOrders, getCustomers } from '@/lib/google-sheets';
import OrderList from './OrderList';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [orders, customers] = await Promise.all([
    getOrders().catch(() => []),
    getCustomers().catch(() => []),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const enriched = orders
    .map((o) => ({ ...o, customerName: customerMap[o.customerId] ?? o.customerId }))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">注文管理</h1>
        <span className="text-sm text-gray-400">{orders.length}件</span>
      </div>
      <OrderList orders={enriched} />
    </div>
  );
}
