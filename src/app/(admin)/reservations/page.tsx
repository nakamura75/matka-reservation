import { getReservations } from '@/lib/google-sheets';
import ReservationList from './ReservationList';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const reservations = await getReservations().catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
        <a
          href="/reservations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 transition-colors"
        >
          + 新規予約
        </a>
      </div>
      <ReservationList reservations={reservations} />
    </div>
  );
}
