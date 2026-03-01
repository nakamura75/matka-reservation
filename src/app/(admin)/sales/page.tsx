import { getSalesRecords, getStaff } from '@/lib/google-sheets';
import SalesSummary from './SalesSummary';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [salesRecords, staff] = await Promise.all([
    getSalesRecords().catch(() => []),
    getStaff().catch(() => []),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">売上集計</h1>
      </div>
      <SalesSummary salesRecords={salesRecords} staff={staff} />
    </div>
  );
}
