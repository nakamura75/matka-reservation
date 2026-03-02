import { getReservations, getStaff, getPlans, getOptions, getReservationOptions, getOrders, getOrderItems, getProducts } from '@/lib/google-sheets';
import SalesSummary from './SalesSummary';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [reservations, staff, plans, options, reservationOptions, orders, orderItems, products] = await Promise.all([
    getReservations().catch(() => []),
    getStaff().catch(() => []),
    getPlans().catch(() => []),
    getOptions().catch(() => []),
    getReservationOptions().catch(() => []),
    getOrders().catch(() => []),
    getOrderItems().catch(() => []),
    getProducts().catch(() => []),
  ]);

  // プランIDとオプションIDの価格マップ
  const planPriceMap: Record<string, number> = Object.fromEntries(plans.map((p) => [p.id, p.price]));
  const optionPriceMap: Record<string, number> = Object.fromEntries(options.map((o) => [o.id, o.price]));

  // 予約IDごとのオプション合計
  const optionTotalByReservation: Record<string, number> = {};
  for (const ro of reservationOptions) {
    const price = optionPriceMap[ro.optionId] ?? 0;
    optionTotalByReservation[ro.reservationId] = (optionTotalByReservation[ro.reservationId] ?? 0) + price * ro.quantity;
  }

  // 各予約に total を付与（T列に手動設定値があればそれを優先）
  const enrichedReservations = reservations.map((r) => {
    const planPrice = planPriceMap[r.planId] ?? 0;
    const optionTotal = optionTotalByReservation[r.id] ?? 0;
    const total = (r.discountAmount != null && r.discountAmount > 0)
      ? r.discountAmount
      : planPrice + optionTotal;
    return { ...r, planPrice, optionTotal, total };
  });

  // 商品の単価マップ
  const productPriceMap: Record<string, number> = Object.fromEntries(products.map((p) => [p.id, p.price]));

  // 注文に明細（価格付き）を付与
  const enrichedOrders = orders.map((o) => ({
    ...o,
    items: orderItems
      .filter((i) => i.orderId === o.id)
      .map((i) => ({ ...i, productPrice: productPriceMap[i.productId] ?? 0 })),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">売上集計</h1>
      </div>
      <SalesSummary reservations={enrichedReservations} staff={staff} orders={enrichedOrders} />
    </div>
  );
}
