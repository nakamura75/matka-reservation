import { getReservations, getCustomers, getPlans } from '@/lib/db';
import ReservationsClient from './ReservationsClient';

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

  return <ReservationsClient reservations={enriched} />;
}
