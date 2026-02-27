import {
  getReservationById,
  getReservationOptions,
  getCustomerById,
  getPlans,
  getOptions,
  getStaff,
} from '@/lib/google-sheets';
import { notFound } from 'next/navigation';
import ReservationDetail from './ReservationDetail';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [reservation, plans, options, staff] = await Promise.all([
    getReservationById(params.id),
    getPlans(),
    getOptions(),
    getStaff(),
  ]);

  if (!reservation) notFound();

  const [customer, reservationOptions] = await Promise.all([
    getCustomerById(reservation.customerId),
    getReservationOptions(reservation.id),
  ]);

  const plan = plans.find((p) => p.id === reservation.planId);

  const optionsWithInfo = reservationOptions.map((ro) => {
    const opt = options.find((o) => o.id === ro.optionId);
    return { ...ro, optionName: opt?.name ?? '', price: opt?.price ?? 0 };
  });

  return (
    <ReservationDetail
      reservation={reservation}
      customer={customer}
      plan={plan ?? null}
      options={optionsWithInfo}
      staff={staff}
    />
  );
}
