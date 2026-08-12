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
  getCustomers,
  getReservations,
  getReservationPhotos,
  RESERVATION_PHOTO_BUCKET,
} from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOptionPrice } from '@/lib/reservation-options';
import { isSetPlanAutoOrder } from '@/lib/location';
import { buildRepeaterIndex } from '@/lib/repeater';
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

  const [customer, reservationOptions, allCustomers, allReservations] = await Promise.all([
    getCustomerById(reservation.customerId),
    getReservationOptions(reservation.id),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  // リピーター判定は顧客一覧・顧客詳細と同じ共通ロジックを使う
  const isRepeater = customer
    ? buildRepeaterIndex(allCustomers, allReservations).isRepeater(customer.id)
    : false;

  const plan = plans.find((p) => p.id === reservation.planId);

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return { ...ro, optionName: opt?.name ?? '', price: resolveOptionPrice(ro, opt?.price ?? 0) };
  });

  // この予約に紐づく注文を集計
  const productPriceMap = Object.fromEntries(products.map((p) => [p.id, p.price]));
  const productNameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const linkedOrders = allOrders
    .filter((o) => o.reservationId === reservation.id)
    .map((order) => {
      const items = allOrderItems.filter((i) => i.orderId === order.id);
      // unit_price 上書き（セット掛け値等）があればそれを使う
      const total = items.reduce((sum, i) => sum + (i.unitPrice ?? productPriceMap[i.productId] ?? 0) * i.quantity, 0);
      const itemDetails = items.map((i) => ({
        productName: productNameMap[i.productId] ?? '不明な商品',
        price: i.unitPrice ?? productPriceMap[i.productId] ?? 0,
        quantity: i.quantity,
      }));
      // セットプラン内訳の自動作成注文はプラン料金に含まれるため、支払合計には足さない
      return { id: order.id, orderDate: order.orderDate, isPaid: order.isPaid, total, itemCount: items.length, items: itemDetails, isSetPlanAuto: isSetPlanAutoOrder(order.note) };
    });

  // 予約に紐づく画像（非公開バケットのため署名付きURLで渡す。有効期限1時間）
  const photoRows = await getReservationPhotos(reservation.id).catch((e) => {
    console.error('[DB Error]', e.message ?? e);
    return [];
  });
  const adminStorage = createAdminClient().storage.from(RESERVATION_PHOTO_BUCKET);
  const photos = (
    await Promise.all(
      photoRows.map(async (p) => {
        const { data } = await adminStorage.createSignedUrl(p.path, 60 * 60);
        return data?.signedUrl ? { id: p.id, fileName: p.fileName, url: data.signedUrl } : null;
      })
    )
  ).filter((p): p is { id: string; fileName: string | undefined; url: string } => p !== null);

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
      isRepeater={isRepeater}
      photos={photos}
    />
  );
}
