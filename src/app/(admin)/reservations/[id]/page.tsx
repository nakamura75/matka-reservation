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
  getHolidays,
} from '@/lib/db';
import { notFound } from 'next/navigation';
import ReservationDetail from './ReservationDetail';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const reservation = await getReservationById(params.id);
  if (!reservation) notFound();

  // 予約の撮影区分に合わせてプラン/オプション/商品/スタッフを取得
  // （ロケ予約ではロケ設定のもののみ＝商品・担当もロケ設定から選択）
  const mode = reservation.shootType === 'location' ? 'location' : 'studio';

  const [plans, options, staff, allOrders, allOrderItems, products, holidays] = await Promise.all([
    getPlans(mode),
    getOptions(mode), // マスターオプション一覧（予約オプション選択肢＆enrichに使用）
    getStaff(mode),
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts(mode).catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getHolidays().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

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
  const productNameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const linkedOrders = allOrders
    .filter((o) => o.reservationId === reservation.id)
    .map((order) => {
      const items = allOrderItems.filter((i) => i.orderId === order.id);
      const total = items.reduce((sum, i) => sum + (productPriceMap[i.productId] ?? 0) * i.quantity, 0);
      const itemDetails = items.map((i) => ({
        productName: productNameMap[i.productId] ?? '不明な商品',
        price: productPriceMap[i.productId] ?? 0,
        quantity: i.quantity,
      }));
      return { id: order.id, orderDate: order.orderDate, isPaid: order.isPaid, total, itemCount: items.length, items: itemDetails };
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
      holidays={holidays}
    />
  );
}
