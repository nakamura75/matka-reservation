import { getCalendarClient, getReservations } from './google-sheets';
import { CALENDAR_ID, BOOKING_DAYS, ALL_TIME_SLOTS, SHICHIGOSAN_TIME_SLOTS } from './constants';
import type { AvailableSlot, ShootingScene, TimeSlot } from '@/types';

/** 祝日判定（Google Calendar の日本の祝日カレンダーを使用） */
const HOLIDAYS_CALENDAR_ID = 'ja.japanese#holiday@group.v.calendar.google.com';

// ============================================================
// JST ヘルパー
// ============================================================
function toJSTDateStr(dt: Date): string {
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function getJSTHour(dt: Date): number {
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCHours();
}

function getJSTDayOfWeek(dt: Date): number {
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCDay();
}

/** 今日から60日分の空き枠を取得 */
export async function getAvailableSlots(scene?: ShootingScene): Promise<AvailableSlot[]> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('[getAvailableSlots] GOOGLE_SERVICE_ACCOUNT_KEY is not set');
    return [];
  }

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + BOOKING_DAYS);

  const blockedDates = new Set<string>(); // 終日ブロック
  const blockedSlots = new Map<string, Set<string>>(); // 日付 -> 時間枠Set
  const holidayDates = new Set<string>();

  // --- Google Calendar からブロック情報取得（IDが設定されている場合のみ）---
  if (process.env.GOOGLE_CALENDAR_ID) {
    try {
      const calendar = getCalendarClient();
      const [studioEvents, holidays] = await Promise.all([
        calendar.events.list({
          calendarId: CALENDAR_ID,
          timeMin: today.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        }),
        calendar.events.list({
          calendarId: HOLIDAYS_CALENDAR_ID,
          timeMin: today.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        }).catch(() => ({ data: { items: [] } })),
      ]);

      for (const event of studioEvents.data.items ?? []) {
        if (event.start?.date) {
          // 終日イベント = 定休日などのブロック
          blockedDates.add(event.start.date);
        } else if (event.start?.dateTime) {
          const dt = new Date(event.start.dateTime);
          const dateStr = toJSTDateStr(dt);
          const hour = getJSTHour(dt);
          const timeStr = `${hour}:00` as TimeSlot;
          if (!blockedSlots.has(dateStr)) blockedSlots.set(dateStr, new Set());
          blockedSlots.get(dateStr)!.add(timeStr);
        }
      }

      for (const event of holidays.data.items ?? []) {
        if (event.start?.date) holidayDates.add(event.start.date);
      }
    } catch (e) {
      console.error('[getAvailableSlots] Calendar error:', e);
    }
  }

  // --- スプレッドシートの既存予約からブロック ---
  try {
    const reservations = await getReservations();
    for (const r of reservations) {
      if (r.status === 'キャンセル') continue;
      if (!r.date || !r.timeSlot) continue;
      if (!blockedSlots.has(r.date)) blockedSlots.set(r.date, new Set());
      blockedSlots.get(r.date)!.add(r.timeSlot);
    }
  } catch (e) {
    console.error('[getAvailableSlots] Sheets reservation error:', e);
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

/** Google Calendar にイベントを作成 */
export async function createCalendarEvent(params: {
  title: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  description?: string;
}): Promise<string | null | undefined> {
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: params.title,
      description: params.description,
      start: { dateTime: params.startDateTime, timeZone: 'Asia/Tokyo' },
      end: { dateTime: params.endDateTime, timeZone: 'Asia/Tokyo' },
    },
  });
  return res.data.id;
}

/** Google Calendar イベント削除 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
}
