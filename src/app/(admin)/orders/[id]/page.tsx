import { notFound } from 'next/navigation';
import {
  getOrders,
  getCustomers,
  getOrderItems,
  getProducts,
  getReservations,
} from '@/lib/google-sheets';
import OrderDetail from './OrderDetail';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const [orders, customers, items, products, reservations] = await Promise.all([
    getOrders().catch(() => []),
    getCustomers().catch(() => []),
    getOrderItems(params.id).catch(() => []),
    getProducts().catch(() => []),
    getReservations().catch(() => []),
  ]);

  const order = orders.find((o) => o.id === params.id);
  if (!order) notFound();

  const customer = customers.find((c) => c.id === order.customerId) ?? null;
  const reservation = order.reservationId
    ? reservations.find((r) => r.id === order.reservationId) ?? null
    : null;

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const enrichedItems = items.map((item) => {
    const product = productMap[item.productId];
    return {
      ...item,
      productName: product?.name ?? item.productId,
      unitPrice: product?.price ?? 0,
      subtotal: (product?.price ?? 0) * item.quantity,
    };
  });

  return (
    <OrderDetail
      order={order}
      customer={customer}
      reservation={reservation}
      items={enrichedItems}
      allProducts={products}
    />
  );
}
