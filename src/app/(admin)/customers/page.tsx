import { getCustomers, getReservations } from '@/lib/google-sheets';
import CustomerList from './CustomerList';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const [customers, reservations] = await Promise.all([
    getCustomers().catch(() => []),
    getReservations().catch(() => []),
  ]);

  // 顧客ごとの予約件数を集計
  const reservationCountMap: Record<string, number> = {};
  for (const r of reservations) {
    if (r.customerId) {
      reservationCountMap[r.customerId] = (reservationCountMap[r.customerId] ?? 0) + 1;
    }
  }

  const enriched = customers.map((c) => ({
    ...c,
    reservationCount: reservationCountMap[c.id] ?? 0,
  }));

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
