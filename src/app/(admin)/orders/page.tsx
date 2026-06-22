import { getOrders, getCustomers, getOrderItems, getProducts, getOrderItemComponents, getReservations } from '@/lib/db';
import OrdersView from './OrdersView';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [orders, customers, items, products, allComponents, reservations] = await Promise.all([
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItemComponents().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, { name: p.name, price: p.price }]));

  // 予約の撮影区分を注文に紐付け（予約に紐づかない注文はスタジオ扱い）
  const shootTypeByReservation: Record<string, 'studio' | 'location'> = {};
  for (const r of reservations) shootTypeByReservation[r.id] = r.shootType === 'location' ? 'location' : 'studio';
  const orderShoot = (reservationId?: string): 'studio' | 'location' =>
    (reservationId && shootTypeByReservation[reservationId]) ? shootTypeByReservation[reservationId] : 'studio';

  const enrichedOrders = orders
    .map((o) => ({ ...o, customerName: customerMap[o.customerId] ?? o.customerId, shootType: orderShoot(o.reservationId) }))
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
      deadline: order?.deadline ?? '',
      shootType: orderShoot(order?.reservationId),
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

  return <OrdersView orders={enrichedOrders} boardItems={boardItems} />;
}
