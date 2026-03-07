import { getReservations, getCustomers } from '@/lib/google-sheets';
import ReservationCalendar from './ReservationCalendar';

export const dynamic = 'force-dynamic';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  // カレンダーは3ヶ月前〜9ヶ月後の範囲のみ取得（全件ロードを避ける）
  const now = new Date();
  const fromDate = new Date(now); fromDate.setMonth(fromDate.getMonth() - 3);
  const toDate = new Date(now); toDate.setMonth(toDate.getMonth() + 9);

  const [reservations, customers] = await Promise.all([
    getReservations({ fromDate: toDateStr(fromDate), toDate: toDateStr(toDate) }).catch(() => []),
    getCustomers().catch(() => []),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const enriched = reservations.map((r) => ({
    ...r,
    customerName: customerMap[r.customerId] ?? r.customerId,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">予約カレンダー</h1>
      <ReservationCalendar reservations={enriched} />
    </div>
  );
}
