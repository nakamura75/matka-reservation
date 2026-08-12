import { getReservations, getStaff, getPlans, getOptions, getReservationOptions, getOrders, getOrderItems, getProducts, getHolidays } from '@/lib/db';
import { isWeekend } from '@/lib/utils';
import { resolveOptionPrice } from '@/lib/reservation-options';
import { setPlanIncludedProduct } from '@/lib/location';
import SalesSummary from './SalesSummary';

export const dynamic = 'force-dynamic';

// ロケの料金（src/app/api/reservations/[id]/route.ts と揃える）
const LOC_HOLIDAY_SURCHARGE = 5500;
const LOC_INSURANCE = 5500;

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
    const price = resolveOptionPrice(ro, optionPriceMap[ro.optionId] ?? 0);
    optionTotalByReservation[ro.reservationId] = (optionTotalByReservation[ro.reservationId] ?? 0) + price * ro.quantity;
  }

  // 各予約に total を付与（割引率があればそれを適用）
  const enrichedReservations = reservations.map((r) => {
    const planPrice = planPriceMap[r.planId] ?? 0;
    const optionTotal = optionTotalByReservation[r.id] ?? 0;

    // ロケは「プラン＋オプション＋キャンセル保険」を合計（割引なし）
    if (r.shootType === 'location') {
      // 休日料金はプラン自体（〜（休日）プラン）に含まれているため加算しない。
      // プランIDが無い（旧データ等）場合のみ日付ベースで休日料金を加算する
      const holidaySurcharge = !r.planId && r.date && isWeekend(r.date) ? LOC_HOLIDAY_SURCHARGE : 0;
      const insurance = r.cancelInsurance === '加入する' ? LOC_INSURANCE : 0;
      // セットプラン込みの商品（Crystal Book / Walnut Frame 8×10）は
      // 注文（商品売上）側でセット掛け値を計上するため、プラン側から差し引く
      const includedProductAmount = setPlanIncludedProduct(r.planId)?.unitPrice ?? 0;
      const total = planPrice - includedProductAmount + holidaySurcharge + optionTotal + insurance;
      return { ...r, planPrice, optionTotal, total };
    }

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

  // 注文に明細（価格付き）を付与（unit_price 上書きがあればそれを使う＝セット掛け値対応）
  const enrichedOrders = orders.map((o) => ({
    ...o,
    items: orderItems
      .filter((i) => i.orderId === o.id)
      .map((i) => ({ ...i, productPrice: i.unitPrice ?? productPriceMap[i.productId] ?? 0 })),
  }));

  return (
    <SalesSummary reservations={enrichedReservations} staff={staff} orders={enrichedOrders} holidays={holidays} reservationOptions={reservationOptions} optionPriceMap={optionPriceMap} />
  );
}
