import { getReservations, getCustomers, getPlans } from '@/lib/db';
import ReservationList from './ReservationList';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const [reservations, customers, plans] = await Promise.all([
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getPlans().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

  const enriched = reservations.map((r) => ({
    ...r,
    customerName: customerMap[r.customerId] ?? r.customerId,
    planName: planMap[r.planId],
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
        <a
          href="/reservations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
        >
          + 新規予約
        </a>
      </div>
      <ReservationList reservations={enriched} />
    </div>
  );
}
