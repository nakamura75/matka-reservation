import { getReservations, getStaff, getPlans, getOptions, getReservationOptions, getOrders, getOrderItems, getProducts, getHolidays } from '@/lib/db';
import SalesSummary from './SalesSummary';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [reservations, staff, plans, options, reservationOptions, orders, orderItems, products, holidays] = await Promise.all([
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getStaff().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getPlans().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOptions().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getReservationOptions().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getHolidays().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
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

  // 各予約に total を付与（割引率があればそれを適用）
  const enrichedReservations = reservations.map((r) => {
    const planPrice = planPriceMap[r.planId] ?? 0;
    const optionTotal = optionTotalByReservation[r.id] ?? 0;
    const shootingTotal = planPrice + optionTotal;
    const rate = r.discountRate ?? 0;
    const total = rate > 0
      ? Math.round(shootingTotal * (1 - rate / 100))
      : (r.discountAmount != null && r.discountAmount > 0)
        ? r.discountAmount
        : shootingTotal;
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
      <SalesSummary reservations={enrichedReservations} staff={staff} orders={enrichedOrders} holidays={holidays} reservationOptions={reservationOptions} optionPriceMap={optionPriceMap} />
    </div>
  );
}
