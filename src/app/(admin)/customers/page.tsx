import { getCustomers, getReservations } from '@/lib/google-sheets';
import CustomerList from './CustomerList';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const [customers, reservations] = await Promise.all([
    getCustomers().catch(() => []),
    getReservations().catch(() => []),
  ]);

  // 電話番号 → 顧客IDリスト のマップ（同一人物判定用）
  const phoneToCustomerIds: Record<string, string[]> = {};
  for (const c of customers) {
    const phone = c.phone?.trim();
    if (phone) {
      if (!phoneToCustomerIds[phone]) phoneToCustomerIds[phone] = [];
      phoneToCustomerIds[phone].push(c.id);
    }
  }

  // 顧客IDごとの予約件数 & LINE UserID の集計
  const reservationCountByCustomerId: Record<string, number> = {};
  const lineIdsByCustomerId: Record<string, Set<string>> = {};
  const reservationCountByLineId: Record<string, number> = {};
  const chatLineIdByCustomerId: Record<string, string> = {};

  for (const r of reservations) {
    if (r.customerId) {
      reservationCountByCustomerId[r.customerId] = (reservationCountByCustomerId[r.customerId] ?? 0) + 1;
    }
    const lineId = r.lineUserId?.trim();
    if (lineId) {
      reservationCountByLineId[lineId] = (reservationCountByLineId[lineId] ?? 0) + 1;
      if (r.customerId) {
        if (!lineIdsByCustomerId[r.customerId]) lineIdsByCustomerId[r.customerId] = new Set();
        lineIdsByCustomerId[r.customerId].add(lineId);
      }
    }
    const chatLineId = r.chatLineUserId?.trim();
    if (chatLineId && r.customerId && !chatLineIdByCustomerId[r.customerId]) {
      chatLineIdByCustomerId[r.customerId] = chatLineId;
    }
  }

  const enriched = customers.map((c) => {
    const reservationCount = reservationCountByCustomerId[c.id] ?? 0;

    // 電話番号が同じ顧客の予約合計 > 1 ならリピーター
    const samePhoneIds = c.phone?.trim() ? (phoneToCustomerIds[c.phone.trim()] ?? [c.id]) : [c.id];
    const totalByPhone = samePhoneIds.reduce((sum, id) => sum + (reservationCountByCustomerId[id] ?? 0), 0);

    // この顧客の予約に紐づくLINE IDが他の予約にも使われていればリピーター
    const lineIds = lineIdsByCustomerId[c.id] ?? new Set<string>();
    const isRepeaterByLine = Array.from(lineIds).some((lineId) => (reservationCountByLineId[lineId] ?? 0) > 1);

    const isRepeater = totalByPhone > 1 || isRepeaterByLine;

    const lineUserId = Array.from(lineIds)[0] ?? undefined;
    const chatLineUserId = chatLineIdByCustomerId[c.id] ?? undefined;
    const duplicateCustomerIds = c.phone?.trim()
      ? (phoneToCustomerIds[c.phone.trim()] ?? []).filter((id) => id !== c.id)
      : [];
    return { ...c, reservationCount, isRepeater, lineUserId, chatLineUserId, duplicateCustomerIds };
  }).sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
        <span className="text-sm text-gray-400">{customers.length}名</span>
      </div>
      <CustomerList customers={enriched} />
    </div>
  );
}
