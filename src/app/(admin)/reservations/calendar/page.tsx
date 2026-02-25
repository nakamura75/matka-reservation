import { getReservations, getCustomers } from '@/lib/google-sheets';
import ReservationCalendar from './ReservationCalendar';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const [reservations, customers] = await Promise.all([
    getReservations().catch(() => []),
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
