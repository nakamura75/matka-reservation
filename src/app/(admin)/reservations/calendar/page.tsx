import { getReservations } from '@/lib/google-sheets';
import ReservationCalendar from './ReservationCalendar';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const reservations = await getReservations().catch(() => []);
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">予約カレンダー</h1>
      <ReservationCalendar reservations={reservations} />
    </div>
  );
}
