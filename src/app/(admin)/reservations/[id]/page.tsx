import {
  getReservationById,
  getReservationOptions,
  getCustomerById,
  getPlans,
  getOptions,
  getStaff,
  getOrders,
  getOrderItems,
  getProducts,
} from '@/lib/db';
import { notFound } from 'next/navigation';
import ReservationDetail from './ReservationDetail';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [reservation, plans, options, staff, allOrders, allOrderItems, products] = await Promise.all([
    getReservationById(params.id),
    getPlans(),
    getOptions(), // マスターオプション一覧（予約オプション選択肢＆enrichに使用）
    getStaff(),
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  if (!reservation) notFound();

  const [customer, reservationOptions] = await Promise.all([
    getCustomerById(reservation.customerId),
    getReservationOptions(reservation.id),
  ]);

  const plan = plans.find((p) => p.id === reservation.planId);

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return { ...ro, optionName: opt?.name ?? '', price: opt?.price ?? 0 };
  });

  // この予約に紐づく注文を集計
  const productPriceMap = Object.fromEntries(products.map((p) => [p.id, p.price]));
  const linkedOrders = allOrders
    .filter((o) => o.reservationId === reservation.id)
    .map((order) => {
      const items = allOrderItems.filter((i) => i.orderId === order.id);
      const total = items.reduce((sum, i) => sum + (productPriceMap[i.productId] ?? 0) * i.quantity, 0);
      return { id: order.id, orderDate: order.orderDate, isPaid: order.isPaid, total, itemCount: items.length };
    });

  return (
    <ReservationDetail
      reservation={reservation}
      customer={customer}
      plan={plan ?? null}
      allPlans={plans.filter((p) => p.isActive)}
      options={optionsWithInfo}
      allOptions={options.filter((o) => o.isActive)}
      staff={staff}
      products={products.filter((p) => p.isActive)}
      linkedOrders={linkedOrders}
    />
  );
}
