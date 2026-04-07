import { getOrders, getCustomers, getOrderItems, getProducts, getOrderItemComponents } from '@/lib/db';
import OrdersView from './OrdersView';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [orders, customers, items, products, allComponents] = await Promise.all([
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItemComponents().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, { name: p.name, price: p.price }]));

  const enrichedOrders = orders
    .map((o) => ({ ...o, customerName: customerMap[o.customerId] ?? o.customerId }))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  const enrichedItems = items.map((item) => {
    const order = orders.find((o) => o.id === item.orderId);
    const product = productMap[item.productId];
    return {
      ...item,
      productName: product?.name ?? item.productId,
      unitPrice: product?.price ?? 0,
      subtotal: (product?.price ?? 0) * item.quantity,
      customerName: order ? (customerMap[order.customerId] ?? order.customerId) : '',
      orderDate: order?.orderDate ?? '',
    };
  });

  // ボード用：コンポーネントがある場合は展開してカード化
  type BoardItem = typeof enrichedItems[number];
  const boardItems: BoardItem[] = enrichedItems.flatMap((item) => {
    const components = allComponents.filter((c) => c.orderItemId === item.id);
    if (components.length > 0) {
      return components.map((comp) => ({
        ...item,
        id: comp.id,
        productName: `${item.productName} / ${comp.name}`,
        quantity: comp.quantity,
        status: comp.status as BoardItem['status'],
        trackingNumber: comp.trackingNumber ?? undefined,
      }));
    }
    return [item];
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">注文管理</h1>
        <span className="text-sm text-gray-400">{orders.length}件</span>
      </div>
      <OrdersView orders={enrichedOrders} items={enrichedItems} boardItems={boardItems} />
    </div>
  );
}
