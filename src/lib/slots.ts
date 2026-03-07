import { createAdminClient } from './supabase/admin';
import { BOOKING_DAYS, ALL_TIME_SLOTS, SHICHIGOSAN_TIME_SLOTS } from './constants';
import type { AvailableSlot, ShootingScene, TimeSlot } from '@/types';

// ============================================================
// JST ヘルパー
// ============================================================
function toJSTDateStr(dt: Date): string {
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function getJSTDayOfWeek(dt: Date): number {
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCDay();
}

/** 今日から60日分の空き枠を取得 */
export async function getAvailableSlots(scene?: ShootingScene): Promise<AvailableSlot[]> {
  const supabase = createAdminClient();
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + BOOKING_DAYS);

  const todayStr = toJSTDateStr(today);
  const endStr = toJSTDateStr(end);

  const blockedDates = new Set<string>(); // 終日ブロック
  const blockedSlots = new Map<string, Set<string>>(); // 日付 -> 時間枠Set
  const holidayDates = new Set<string>();

  // --- Supabase からブロック情報・祝日・予約を一括取得 ---
  const [blockedRes, holidaysRes, reservationsRes] = await Promise.all([
    supabase
      .from('blocked_slots')
      .select('date, time_slot')
      .gte('date', todayStr)
      .lte('date', endStr),
    supabase
      .from('holidays')
      .select('date, name, type')
      .gte('date', todayStr)
      .lte('date', endStr),
    supabase
      .from('reservations')
      .select('date, time_slot, status')
      .gte('date', todayStr)
      .lte('date', endStr)
      .not('status', 'in', '("キャンセル","見学")'),
  ]);

  // ブロック情報
  for (const row of blockedRes.data ?? []) {
    const dateStr = row.date as string;
    if (!row.time_slot) {
      // time_slot が NULL = 終日ブロック
      blockedDates.add(dateStr);
    } else {
      if (!blockedSlots.has(dateStr)) blockedSlots.set(dateStr, new Set());
      blockedSlots.get(dateStr)!.add(row.time_slot);
    }
  }

  // 祝日・定休日・臨時休業
  for (const row of holidaysRes.data ?? []) {
    const dateStr = row.date as string;
    const type = row.type as string;
    if (type === 'closed' || type === 'temporary') {
      // 定休日・臨時休業は終日ブロック（予約不可）
      blockedDates.add(dateStr);
    } else {
      // 祝日は予約可（休日料金適用のためフラグのみ）
      holidayDates.add(dateStr);
    }
  }

  // 既存予約からブロック
  for (const row of reservationsRes.data ?? []) {
    if (!row.date || !row.time_slot) continue;
    const dateStr = row.date as string;
    if (!blockedSlots.has(dateStr)) blockedSlots.set(dateStr, new Set());
    blockedSlots.get(dateStr)!.add(row.time_slot);
  }

  // シーンに応じた利用可能時間枠（七五三・マタニティは9時不可）
  const availableTimes = (scene === '七五三' || scene === 'マタニティ')
    ? SHICHIGOSAN_TIME_SLOTS
    : ALL_TIME_SLOTS;

  // 60日分の空き枠を生成
  const result: AvailableSlot[] = [];
  for (let i = 1; i <= BOOKING_DAYS; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = toJSTDateStr(date);
    const dayOfWeek = getJSTDayOfWeek(date);

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);

    // 終日ブロックは全スロット不可
    if (blockedDates.has(dateStr)) continue;

    const slots = availableTimes.map((time) => ({
      time: time as TimeSlot,
      available: !blockedSlots.get(dateStr)?.has(time),
    }));

    // 空き枠が1つでもあれば追加
    if (slots.some((s) => s.available)) {
      result.push({ date: dateStr, slots, isWeekend, isHoliday });
    }
  }

  return result;
}
