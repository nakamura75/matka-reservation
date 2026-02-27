'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Reservation } from '@/types';

const STATUS_DOT: Record<Reservation['status'], string> = {
  '予約済': 'bg-yellow-400',
  '予約確定': 'bg-blue-400',
  '完了': 'bg-green-400',
  'キャンセル': 'bg-gray-300',
};

const TIME_ORDER = ['9:00', '12:00', '15:00'];

interface Props {
  reservations: Reservation[];
}

export default function ReservationCalendar({ reservations }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // カレンダーの日付グリッドを生成
  const { days, startWeekday } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay(); // 0=日
    const daysInMonth = lastDay.getDate();
    return { days: daysInMonth, startWeekday };
  }, [year, month]);

  // 予約を日付→時間帯でインデックス化
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

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button
          onClick={prevMonth}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">
          {year}年 {month + 1}月
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 px-6 py-2 border-b border-gray-50 text-xs text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {status}
          </span>
        ))}
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

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7">
        {/* 先頭の空白 */}
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

          // 時間枠ごとにソート
          const sorted = [...dayReservations].sort(
            (a, b) => TIME_ORDER.indexOf(a.timeSlot) - TIME_ORDER.indexOf(b.timeSlot)
          );

          return (
            <div
              key={day}
              className={`border-b border-r border-gray-100 min-h-24 p-1.5 ${isToday ? 'bg-brand-light' : ''}`}
            >
              <div
                className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-brand text-white' : isSunday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-gray-700'}`}
              >
                {day}
              </div>

              {/* 予約バッジ */}
              <div className="space-y-0.5">
                {sorted.slice(0, 3).map((r) => (
                  <Link
                    key={r.id}
                    href={`/reservations/${r.id}`}
                    className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity
                      ${r.status === 'キャンセル' ? 'bg-gray-50 text-gray-400' :
                        r.status === '完了' ? 'bg-green-50 text-green-700' :
                        r.status === '予約確定' ? 'bg-blue-50 text-blue-700' :
                        'bg-yellow-50 text-yellow-700'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[r.status]}`} />
                    <span className="truncate">
                      {r.timeSlot} {r.customerName ?? ''}
                    </span>
                  </Link>
                ))}
                {sorted.length > 3 && (
                  <p className="text-xs text-gray-400 pl-1">+{sorted.length - 3}件</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
