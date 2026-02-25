import { getPlans, getOptions, getCustomers } from '@/lib/google-sheets';
import NewReservationForm from './NewReservationForm';

export const dynamic = 'force-dynamic';

export default async function NewReservationPage() {
  const [plans, options, customers] = await Promise.all([
    getPlans(),
    getOptions(),
    getCustomers(),
  ]);

  const activePlans = plans.filter((p) => p.isActive);
  const activeOptions = options.filter((o) => o.isActive);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">手動予約入力</h1>
      <NewReservationForm
        plans={activePlans}
        options={activeOptions}
        customers={customers}
      />
    </div>
  );
}
