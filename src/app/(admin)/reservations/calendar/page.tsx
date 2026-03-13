import { getReservations, getCustomers, getHolidays, getBlockedSlots } from '@/lib/db';
import ReservationCalendar from './ReservationCalendar';

export const dynamic = 'force-dynamic';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  // カレンダーは3ヶ月前〜9ヶ月後の範囲のみ取得（全件ロードを避ける）
  const now = new Date();
  const fromDate = new Date(now); fromDate.setMonth(fromDate.getMonth() - 3);
  const toDate = new Date(now); toDate.setMonth(toDate.getMonth() + 9);

  const [reservations, customers, holidays, blockedSlots] = await Promise.all([
    getReservations({ fromDate: toDateStr(fromDate), toDate: toDateStr(toDate) }).catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getHolidays().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getBlockedSlots().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const enriched = reservations.map((r) => ({
    ...r,
    customerName: customerMap[r.customerId] ?? r.customerId,
  }));

  // 終日ブロック日: holidays(closed/temporary) + blocked_slots(time_slot=null)
  const blockedDates = new Map<string, string>(); // date -> reason
  const blockedTimeSlots = new Map<string, Map<string, string>>(); // date -> (time -> reason)

  for (const h of holidays) {
    if (h.type === 'closed' || h.type === 'temporary') {
      blockedDates.set(h.date, h.name);
    }
  }
  for (const s of blockedSlots) {
    if (!s.timeSlot) {
      blockedDates.set(s.date, s.reason ?? '');
    } else {
      if (!blockedTimeSlots.has(s.date)) blockedTimeSlots.set(s.date, new Map());
      blockedTimeSlots.get(s.date)!.set(s.timeSlot, s.reason ?? '');
    }
  }

  // 祝日（予約可能、料金異なる）
  const holidayDates = new Set<string>();
  for (const h of holidays) {
    if (h.type === 'holiday') holidayDates.add(h.date);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">予約カレンダー</h1>
      <ReservationCalendar
        reservations={enriched}
        blockedDates={Object.fromEntries(blockedDates)}
        blockedTimeSlots={Object.fromEntries(Array.from(blockedTimeSlots.entries()).map(([k, v]) => [k, Object.fromEntries(v)]))}
        holidayDates={Array.from(holidayDates)}
      />
    </div>
  );
}
