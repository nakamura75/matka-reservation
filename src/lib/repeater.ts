import type { Customer, Reservation } from '@/types';

/**
 * リピーター判定の共通ロジック。
 *
 * 判定条件（どちらか一方を満たせばリピーター）:
 *   A. 電話番号が一致する顧客レコードの予約合計が2件以上
 *      （同一人物が別の顧客レコードで重複登録されているケースをまとめて数える）
 *   B. その顧客の予約に紐づく LINE UserID が、他の予約にも使われている
 *      （電話番号を変えて再予約したケースを拾う）
 *
 * 顧客一覧のように全顧客を判定する画面でも O(n^2) にならないよう、
 * 集計マップを一度だけ組んでから顧客IDで引く形にしている。
 */
export type RepeaterIndex = {
  /** リピーターかどうか */
  isRepeater: (customerId: string) => boolean;
  /** その顧客の予約件数 */
  reservationCountOf: (customerId: string) => number;
  /** その顧客の予約に紐づく LINE UserID 一覧 */
  lineUserIdsOf: (customerId: string) => string[];
  /** 電話番号が一致する顧客IDの一覧（自分自身を含む） */
  customerIdsWithSamePhone: (customerId: string) => string[];
};

type CustomerKey = Pick<Customer, 'id' | 'phone'>;
type ReservationKey = Pick<Reservation, 'customerId' | 'lineUserId'>;

export function buildRepeaterIndex(
  customers: CustomerKey[],
  reservations: ReservationKey[],
): RepeaterIndex {
  // 電話番号 → 顧客IDリスト（同一人物判定用）
  const idsByPhone = new Map<string, string[]>();
  const phoneByCustomerId = new Map<string, string>();
  for (const c of customers) {
    const phone = c.phone?.trim();
    if (!phone) continue;
    phoneByCustomerId.set(c.id, phone);
    const ids = idsByPhone.get(phone);
    if (ids) ids.push(c.id);
    else idsByPhone.set(phone, [c.id]);
  }

  // 顧客IDごとの予約件数 / LINE UserIDごとの予約件数 / 顧客IDごとのLINE UserID
  const countByCustomerId = new Map<string, number>();
  const countByLineId = new Map<string, number>();
  const lineIdsByCustomerId = new Map<string, Set<string>>();
  for (const r of reservations) {
    if (r.customerId) {
      countByCustomerId.set(r.customerId, (countByCustomerId.get(r.customerId) ?? 0) + 1);
    }
    const lineId = r.lineUserId?.trim();
    if (!lineId) continue;
    countByLineId.set(lineId, (countByLineId.get(lineId) ?? 0) + 1);
    if (!r.customerId) continue;
    const set = lineIdsByCustomerId.get(r.customerId);
    if (set) set.add(lineId);
    else lineIdsByCustomerId.set(r.customerId, new Set([lineId]));
  }

  const customerIdsWithSamePhone = (customerId: string) => {
    const phone = phoneByCustomerId.get(customerId);
    return phone ? idsByPhone.get(phone) ?? [customerId] : [customerId];
  };

  return {
    customerIdsWithSamePhone,
    reservationCountOf: (customerId) => countByCustomerId.get(customerId) ?? 0,
    lineUserIdsOf: (customerId) => Array.from(lineIdsByCustomerId.get(customerId) ?? []),
    isRepeater(customerId) {
      const totalByPhone = customerIdsWithSamePhone(customerId)
        .reduce((sum, id) => sum + (countByCustomerId.get(id) ?? 0), 0);
      if (totalByPhone > 1) return true;
      const lineIds = Array.from(lineIdsByCustomerId.get(customerId) ?? []);
      return lineIds.some((lineId) => (countByLineId.get(lineId) ?? 0) > 1);
    },
  };
}
