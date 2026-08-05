import { getReservations, getCustomers, getHolidays, getBlockedSlots, getLocationShootDays } from '@/lib/db';
import TimelineCalendar from './TimelineCalendar';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  // 予約は全期間を取得する。以前は「3ヶ月前〜9ヶ月先」に絞っていたが、
  // 過去月のカレンダーが空に見える（5月より前が表示されない等）ため撤廃。
  // 件数規模（数百〜数千件）では性能上の問題はない。
  const [reservations, customers, holidays, blockedSlots, locShootDays] = await Promise.all([
    getReservations().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getCustomers().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getHolidays().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getBlockedSlots().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
    getLocationShootDays().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; }),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  // キャンセルはタイムラインに表示しない（枠を解放する）。データ自体は削除しない
  const enriched = reservations
    .filter((r) => r.status !== 'キャンセル')
    .map((r) => ({
      ...r,
      customerName: customerMap[r.customerId] ?? r.customerId,
    }));

  // 終日ブロック日: holidays(closed/temporary) + blocked_slots(time_slot=null)
  const blockedDates = new Map<string, string>();
  const blockedTimeSlots = new Map<string, Map<string, string>>();

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">タイムライン</h1>
      <TimelineCalendar
        reservations={enriched}
        blockedDates={Object.fromEntries(blockedDates)}
        blockedTimeSlots={Object.fromEntries(Array.from(blockedTimeSlots.entries()).map(([k, v]) => [k, Object.fromEntries(v)]))}
        holidayDates={Array.from(holidayDates)}
        locationShootDays={Object.fromEntries(locShootDays.map((d) => [d.date, { am: d.am, pm: d.pm }]))}
      />
    </div>
  );
}
