import { notFound } from 'next/navigation';
import { getCustomers, getReservations, getOrders, getPlans, getOrderItems, getProducts } from '@/lib/db';
import { buildRepeaterIndex } from '@/lib/repeater';
import CustomerDetail from './CustomerDetail';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [customers, reservations, orders, plans, orderItems, products] = await Promise.all([
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrders().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getPlans().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getOrderItems().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getProducts().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const customer = customers.find((c) => c.id === params.id);
  if (!customer) notFound();

  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

  const customerReservations = reservations
    .filter((r) => r.customerId === params.id)
    .map((r) => ({ ...r, planName: planMap[r.planId] ?? r.planId }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const customerOrders = orders
    .filter((o) => o.customerId === params.id)
    .map((o) => ({
      ...o,
      items: orderItems
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ ...i, productName: productMap[i.productId] ?? i.productId })),
    }))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  // リピーター判定: 電話番号またはLINE IDが一致する予約が複数あるか
  const repeaters = buildRepeaterIndex(customers, reservations);
  const isRepeater = repeaters.isRepeater(customer.id);

  // 予約シートのO列からlineUserIdを取得してcustomerに付与
  const lineUserId = repeaters.lineUserIdsOf(customer.id)[0] ?? undefined;
  // 顧客テーブルの chatLineUserId を優先、なければ予約テーブルから取得
  const chatLineUserId = customer.chatLineUserId?.trim() || customerReservations.find((r) => r.chatLineUserId?.trim())?.chatLineUserId || undefined;
  const customerWithLine = { ...customer, lineUserId, chatLineUserId };

  // LINE未連携の場合に紐づける先の予約（最新の非キャンセル予約）
  const linkTargetReservationId = !lineUserId
    ? customerReservations.find((r) => r.status !== 'キャンセル')?.id ?? null
    : null;

  return (
    <CustomerDetail
      customer={customerWithLine}
      reservations={customerReservations}
      orders={customerOrders}
      isRepeater={isRepeater}
      linkTargetReservationId={linkTargetReservationId}
    />
  );
}
