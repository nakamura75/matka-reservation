'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { Reservation } from '@/types';
import { STATUS_LABEL } from '@/lib/constants';

const STATUS_DOT: Record<Reservation['status'], string> = {
  '予約済': 'bg-yellow-400',
  '予約確定': 'bg-blue-400',
  '見学': 'bg-purple-400',
  '保留': 'bg-orange-400',
  '完了': 'bg-green-400',
  'キャンセル': 'bg-gray-300',
};

/** 時間文字列を分に変換してソート用の数値を返す */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

interface Props {
  reservations: Reservation[];
  blockedDates?: Record<string, string>;        // 終日ブロック日 (YYYY-MM-DD -> 理由)
  blockedTimeSlots?: Record<string, Record<string, string>>; // 日付 -> (時間帯 -> 理由)
  holidayDates?: string[];        // 祝日（予約可能、料金異なる）
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // 日曜始まり
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ReservationCalendar({ reservations, blockedDates = {}, blockedTimeSlots = {}, holidayDates = [] }: Props) {
  const blockedDateMap = useMemo(() => new Map(Object.entries(blockedDates)), [blockedDates]);
  const holidayDateSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [view, setView] = useState<'month' | 'week'>('month');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function prevWeek() { setWeekStart(d => addDays(d, -7)); }
  function nextWeek() { setWeekStart(d => addDays(d, 7)); }

  // カレンダーの日付グリッドを生成（月表示）
  const { days, startWeekday } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    return { days: daysInMonth, startWeekday };
  }, [year, month]);

  // 週表示の7日間
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // 予約を日付でインデックス化（月表示）
  const reservationMap = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (!r.date) continue;
      const dateStr = r.date.slice(0, 10);
      const [y, m] = dateStr.split('-').map(Number);
      if (y === year && m === month + 1) {
        const existing = map.get(dateStr) ?? [];
        map.set(dateStr, [...existing, r]);
      }
    }
    return map;
  }, [reservations, year, month]);

  // 予約を日付でインデックス化（週表示）
  const weekReservationMap = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (!r.date) continue;
      const dateStr = r.date.slice(0, 10);
      const existing = map.get(dateStr) ?? [];
      map.set(dateStr, [...existing, r]);
    }
    return map;
  }, [reservations]);

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const weekStartMonth = weekStart.getMonth() + 1;
  const weekEndMonth = addDays(weekStart, 6).getMonth() + 1;
  const weekLabel = weekStartMonth === weekEndMonth
    ? `${weekStart.getFullYear()}年 ${weekStartMonth}月 ${weekStart.getDate()}日〜${addDays(weekStart, 6).getDate()}日`
    : `${weekStart.getFullYear()}年 ${weekStartMonth}月${weekStart.getDate()}日〜${weekEndMonth}月${addDays(weekStart, 6).getDate()}日`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {/* 月/週 切り替えタブ */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 ${view === 'month' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              月
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 border-l border-gray-200 ${view === 'week' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              週
            </button>
          </div>
          <button
            onClick={view === 'month' ? prevMonth : prevWeek}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 min-w-[200px] text-center">
            {view === 'month' ? `${year}年 ${month + 1}月` : weekLabel}
          </h2>
          <button
            onClick={view === 'month' ? nextMonth : nextWeek}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* 新規予約ボタン */}
        <Link
          href="/reservations/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          新規予約
        </Link>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 px-6 py-2 border-b border-gray-50 text-xs text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {STATUS_LABEL[status as Reservation['status']]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-gray-200" />
          休業日
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] text-green-600 font-medium">祝</span>
          祝日
        </span>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {weekdays.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {view === 'month' ? (
        /* 月表示グリッド */
        <div className="grid grid-cols-7">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-r border-gray-50 min-h-24 p-1" />
          ))}

          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayReservations = reservationMap.get(dateStr) ?? [];
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            const weekday = (startWeekday + i) % 7;
            const isSunday = weekday === 0;
            const isSaturday = weekday === 6;
            const isBlocked = blockedDateMap.has(dateStr);
            const isHoliday = holidayDateSet.has(dateStr);
            const partialBlocked = blockedTimeSlots[dateStr];

            // ブロック枠と予約を統合して時系列順にソート
            type CalItem = { kind: 'reservation'; time: string; r: Reservation } | { kind: 'blocked'; time: string; reason: string };
            const calItems: CalItem[] = [
              ...dayReservations.map((r) => ({ kind: 'reservation' as const, time: r.timeSlot, r })),
              ...(partialBlocked
                ? Object.entries(partialBlocked).map(([time, reason]) => ({ kind: 'blocked' as const, time, reason }))
                : []),
            ].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

            return (
              <div
                key={day}
                className={`border-b border-r border-gray-100 min-h-24 p-1.5
                  ${isBlocked ? 'bg-gray-100' : isToday ? 'bg-brand-light' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <div
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-brand text-white' : isSunday || isHoliday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-gray-700'}`}
                  >
                    {day}
                  </div>
                  {isBlocked && (
                    <span className="text-[10px] text-red-500 font-medium">休</span>
                  )}
                  {isHoliday && !isBlocked && (
                    <span className="text-[10px] text-green-600 font-medium">祝</span>
                  )}
                </div>

                {isBlocked ? (
                  <p className="text-[10px] text-gray-400 mt-1 text-center">予約不可{blockedDateMap.get(dateStr) ? ` - ${blockedDateMap.get(dateStr)}` : ''}</p>
                ) : (
                  <div className="space-y-0.5 mt-0.5">
                    {calItems.slice(0, 5).map((item, idx) =>
                      item.kind === 'blocked' ? (
                        <p key={`b-${idx}`} className="text-[10px] text-red-400 truncate">
                          {item.time.replace(/^(\d):/, '0$1:')} 不可{item.reason ? ` - ${item.reason}` : ''}
                        </p>
                      ) : (
                        <Link
                          key={item.r.id}
                          href={`/reservations/${item.r.id}`}
                          className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity
                            ${item.r.status === 'キャンセル' ? 'bg-gray-50 text-gray-400' :
                              item.r.status === '完了' ? 'bg-green-50 text-green-700' :
                              item.r.status === '予約確定' ? 'bg-blue-50 text-blue-700' :
                              item.r.status === '見学' ? 'bg-purple-50 text-purple-700' :
                              'bg-yellow-50 text-yellow-700'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.r.status]}`} />
                          <span className="truncate">
                            {item.r.timeSlot} {item.r.customerName ?? ''}
                          </span>
                        </Link>
                      )
                    )}
                    {calItems.length > 5 && (
                      <p className="text-xs text-gray-400 pl-1">+{calItems.length - 5}件</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 週表示グリッド */
        <div className="grid grid-cols-7 divide-x divide-gray-100">
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day);
            const dayReservations = weekReservationMap.get(dateStr) ?? [];
            const isToday = toDateStr(today) === dateStr;
            const isSunday = i === 0;
            const isSaturday = i === 6;
            const isBlocked = blockedDateMap.has(dateStr);
            const isHoliday = holidayDateSet.has(dateStr);
            const partialBlocked = blockedTimeSlots[dateStr];

            // ブロック枠と予約を統合して時系列順にソート
            type WeekCalItem = { kind: 'reservation'; time: string; r: Reservation } | { kind: 'blocked'; time: string; reason: string };
            const weekCalItems: WeekCalItem[] = [
              ...dayReservations.map((r) => ({ kind: 'reservation' as const, time: r.timeSlot, r })),
              ...(partialBlocked
                ? Object.entries(partialBlocked).map(([time, reason]) => ({ kind: 'blocked' as const, time, reason }))
                : []),
            ].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

            return (
              <div
                key={dateStr}
                className={`min-h-64 p-2 ${isBlocked ? 'bg-gray-100' : isToday ? 'bg-brand-light' : ''}`}
              >
                <div className="flex items-center gap-1 mb-2">
                  <div
                    className={`text-xs font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-brand text-white' : isSunday || isHoliday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-gray-700'}`}
                  >
                    {day.getDate()}
                  </div>
                  {isBlocked && (
                    <span className="text-[10px] text-red-500 font-medium">休</span>
                  )}
                  {isHoliday && !isBlocked && (
                    <span className="text-[10px] text-green-600 font-medium">祝</span>
                  )}
                </div>

                {isBlocked ? (
                  <p className="text-xs text-gray-400 text-center mt-8">予約不可{blockedDateMap.get(dateStr) ? ` - ${blockedDateMap.get(dateStr)}` : ''}</p>
                ) : (
                  <div className="space-y-1">
                    {weekCalItems.map((item, idx) =>
                      item.kind === 'blocked' ? (
                        <p key={`b-${idx}`} className="text-[10px] text-red-400">
                          {item.time.replace(/^(\d):/, '0$1:')} 不可{item.reason ? ` - ${item.reason}` : ''}
                        </p>
                      ) : (
                        <Link
                          key={item.r.id}
                          href={`/reservations/${item.r.id}`}
                          className={`flex items-center gap-1 text-xs px-1.5 py-1 rounded hover:opacity-80 transition-opacity
                            ${item.r.status === 'キャンセル' ? 'bg-gray-50 text-gray-400' :
                              item.r.status === '完了' ? 'bg-green-50 text-green-700' :
                              item.r.status === '予約確定' ? 'bg-blue-50 text-blue-700' :
                              item.r.status === '見学' ? 'bg-purple-50 text-purple-700' :
                              'bg-yellow-50 text-yellow-700'}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.r.status]}`} />
                          <span className="truncate">
                            {item.r.timeSlot} {item.r.customerName ?? ''}
                          </span>
                        </Link>
                      )
                    )}
                    {weekCalItems.length === 0 && (
                      <p className="text-xs text-gray-300 text-center mt-4">—</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
