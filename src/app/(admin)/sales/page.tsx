import { getReservations, getStaff } from '@/lib/google-sheets';
import SalesSummary from './SalesSummary';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [reservations, staff] = await Promise.all([
    getReservations().catch(() => []),
    getStaff().catch(() => []),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">売上集計</h1>
      </div>
      <SalesSummary reservations={reservations} staff={staff} />
    </div>
  );
}
