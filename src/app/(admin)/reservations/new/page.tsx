import { getPlans, getOptions, getCustomers, getHolidays, getBlockedSlots } from '@/lib/db';
import { getMode } from '@/lib/mode.server';
import NewReservationForm from './NewReservationForm';

export const dynamic = 'force-dynamic';

export default async function NewReservationPage() {
  const mode = getMode() ?? 'studio';
  const [plans, options, customers, holidays, blockedSlots] = await Promise.all([
    getPlans(mode),
    getOptions(mode),
    getCustomers(),
    getHolidays().catch(() => []),
    getBlockedSlots().catch(() => []),
  ]);

  const activePlans = plans.filter((p) => p.isActive);
  const activeOptions = options.filter((o) => o.isActive);

  // 終日ブロック日
  const blockedDates: string[] = [];
  const holidayDates: string[] = [];
  const blockedTimeSlotsMap: Record<string, string[]> = {};

  for (const h of holidays) {
    if (h.type === 'closed' || h.type === 'temporary') {
      blockedDates.push(h.date);
    } else if (h.type === 'holiday') {
      holidayDates.push(h.date);
    }
  }
  for (const s of blockedSlots) {
    if (!s.timeSlot) {
      if (!blockedDates.includes(s.date)) blockedDates.push(s.date);
    } else {
      if (!blockedTimeSlotsMap[s.date]) blockedTimeSlotsMap[s.date] = [];
      blockedTimeSlotsMap[s.date].push(s.timeSlot);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">手動予約入力{mode === 'location' ? '（ロケ）' : ''}</h1>
      <NewReservationForm
        mode={mode}
        plans={activePlans}
        options={activeOptions}
        customers={customers}
        blockedDates={blockedDates}
        blockedTimeSlots={blockedTimeSlotsMap}
        holidayDates={holidayDates}
      />
    </div>
  );
}
