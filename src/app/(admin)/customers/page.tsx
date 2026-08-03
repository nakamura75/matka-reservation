import { getCustomers, getReservations } from '@/lib/db';
import { buildRepeaterIndex } from '@/lib/repeater';
import CustomerList from './CustomerList';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const [customers, reservations] = await Promise.all([
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const repeaters = buildRepeaterIndex(customers, reservations);

  // 顧客IDごとの chatLineUserId（予約テーブル側のフォールバック用・最新で上書き）
  const chatLineIdByCustomerId: Record<string, string> = {};
  for (const r of reservations) {
    const chatLineId = r.chatLineUserId?.trim();
    if (chatLineId && r.customerId) chatLineIdByCustomerId[r.customerId] = chatLineId;
  }

  const enriched = customers.map((c) => {
    const reservationCount = repeaters.reservationCountOf(c.id);
    const isRepeater = repeaters.isRepeater(c.id);
    const lineUserId = repeaters.lineUserIdsOf(c.id)[0] ?? undefined;
    const chatLineUserId = c.chatLineUserId?.trim() || chatLineIdByCustomerId[c.id] || undefined;
    const duplicateCustomerIds = c.phone?.trim()
      ? repeaters.customerIdsWithSamePhone(c.id).filter((id) => id !== c.id)
      : [];
    return { ...c, reservationCount, isRepeater, lineUserId, chatLineUserId, duplicateCustomerIds };
  }).sort((a, b) => {
    const fa = a.furigana ?? '';
    const fb = b.furigana ?? '';
    if (!fa && !fb) return 0;
    if (!fa) return 1;
    if (!fb) return -1;
    return fa.localeCompare(fb, 'ja');
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
