'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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

const STATUS_BG: Record<Reservation['status'], string> = {
  '予約済': 'bg-yellow-100 border-yellow-300 text-yellow-800',
  '予約確定': 'bg-blue-100 border-blue-300 text-blue-800',
  '見学': 'bg-purple-100 border-purple-300 text-purple-800',
  '保留': 'bg-orange-100 border-orange-300 text-orange-800',
  '完了': 'bg-green-100 border-green-300 text-green-800',
  'キャンセル': 'bg-gray-100 border-gray-300 text-gray-500',
};

// ロケ本番の所要時間（開始時刻 → 終了時刻）
const LOCATION_SHOOT_END: Record<string, string> = {
  '9:10': '12:00',
  '13:00': '16:00',
};

/** 時間文字列を分に変換 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 分を HH:MM に変換 */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${String(min).padStart(2, '0')}`;
}

interface Props {
  reservations: Reservation[];
  blockedDates?: Record<string, string>;
  blockedTimeSlots?: Record<string, Record<string, string>>;
  holidayDates?: string[];
  /** ロケ撮影可能日（公開日）。日付 → 午前/午後の公開状況。無い日は非公開 */
  locationShootDays?: Record<string, { am: boolean; pm: boolean }>;
}

// タイムラインの時間範囲
const TIMELINE_START = 8; // 8:00
const TIMELINE_END = 20;  // 20:00
const HOUR_HEIGHT = 60;   // px per hour
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;

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

export default function TimelineCalendar({ reservations, blockedDates = {}, blockedTimeSlots = {}, holidayDates = [], locationShootDays = {} }: Props) {
  const blockedDateMap = useMemo(() => new Map(Object.entries(blockedDates)), [blockedDates]);
  const holidayDateSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const locShootDayMap = useMemo(() => new Map(Object.entries(locationShootDays)), [locationShootDays]);
  const today = new Date();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialYear = Number(searchParams.get('year')) || today.getFullYear();
  const initialMonth = searchParams.get('month') != null ? Number(searchParams.get('month')) : today.getMonth();
  const initialView = (searchParams.get('view') as 'month' | 'week') || 'week';
  const initialWeekParam = searchParams.get('week');
  const initialWeekStart = initialWeekParam ? new Date(initialWeekParam) : getWeekStart(today);

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<'month' | 'week'>(initialView);
  const [weekStart, setWeekStart] = useState(() => initialWeekStart);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateURL = useCallback((y: number, m: number, v: string, ws: Date) => {
    const params = new URLSearchParams();
    params.set('year', String(y));
    params.set('month', String(m));
    params.set('view', v);
    params.set('week', toDateStr(ws));
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname]);

  // 週表示の初期スクロールを9:00に合わせる
  useEffect(() => {
    if (view === 'week' && scrollRef.current) {
      scrollRef.current.scrollTop = (9 - TIMELINE_START) * HOUR_HEIGHT;
    }
  }, [view, weekStart]);

  function prevMonth() {
    const newMonth = month === 0 ? 11 : month - 1;
    const newYear = month === 0 ? year - 1 : year;
    setYear(newYear); setMonth(newMonth);
    updateURL(newYear, newMonth, view, weekStart);
  }
  function nextMonth() {
    const newMonth = month === 11 ? 0 : month + 1;
    const newYear = month === 11 ? year + 1 : year;
    setYear(newYear); setMonth(newMonth);
    updateURL(newYear, newMonth, view, weekStart);
  }
  function prevWeek() {
    const newWeek = addDays(weekStart, -7);
    setWeekStart(newWeek);
    updateURL(year, month, view, newWeek);
  }
  function nextWeek() {
    const newWeek = addDays(weekStart, 7);
    setWeekStart(newWeek);
    updateURL(year, month, view, newWeek);
  }

  // 月表示のグリッド計算
  const { days, startWeekday } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return { days: lastDay.getDate(), startWeekday: firstDay.getDay() };
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

  /** タイムラインブロックのtopとheightを計算 */
  function getBlockPosition(startTime: string, endTime: string) {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const startOffset = Math.max(0, startMin - TIMELINE_START * 60);
    const endOffset = Math.min(TOTAL_HOURS * 60, endMin - TIMELINE_START * 60);
    const top = (startOffset / 60) * HOUR_HEIGHT;
    const height = Math.max(((endOffset - startOffset) / 60) * HOUR_HEIGHT, 20); // 最小20px
    return { top, height };
  }

  /** 重複する予約のレーン計算 */
  function computeLanes(items: { top: number; height: number; id: string }[]) {
    const sorted = [...items].sort((a, b) => a.top - b.top || a.height - b.height);
    const lanes: { top: number; height: number; id: string }[][] = [];
    for (const item of sorted) {
      let placed = false;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        if (last.top + last.height <= item.top) {
          lane.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([item]);
    }
    const laneMap = new Map<string, { laneIndex: number; totalLanes: number }>();
    for (let i = 0; i < lanes.length; i++) {
      for (const item of lanes[i]) {
        laneMap.set(item.id, { laneIndex: i, totalLanes: lanes.length });
      }
    }
    return laneMap;
  }

  // 区分ごとの色（見学はスタジオ=紫 / ロケ=緑 で色分け）
  function blockBg(r: Reservation): string {
    if (r.status === '見学') {
      return r.shootType === 'location'
        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
        : 'bg-purple-100 border-purple-300 text-purple-800';
    }
    return STATUS_BG[r.status];
  }
  function blockDot(r: Reservation): string {
    if (r.status === '見学') return r.shootType === 'location' ? 'bg-emerald-500' : 'bg-purple-400';
    return STATUS_DOT[r.status];
  }

  // 1つの小列（スタジオ/ロケ/見学）に予約ブロックを配置。
  // closedRegions: 予約を解放していない時間帯（スタジオ休業/ロケ非公開）。背面にグレー表示する
  function renderSubColumn(reservations: Reservation[], blocked?: { time: string; reason: string }[], closedRegions?: { top: number; height: number; label?: string }[]) {
    const resBlocks = reservations
      .filter((r) => r.checkInTime && r.checkOutTime)
      .map((r) => ({ ...getBlockPosition(r.checkInTime!, r.checkOutTime!), id: r.id, reservation: r }));
    const fallbackBlocks = reservations
      .filter((r) => !r.checkInTime || !r.checkOutTime)
      .map((r) => {
        const s = timeToMinutes(r.timeSlot);
        // ロケ本番は所要時間（9:10→12:00 / 13:00→16:00）でブロック長を決める。他は1時間
        let endMin = s + 60;
        if (r.shootType === 'location' && r.status !== '見学') {
          const end = LOCATION_SHOOT_END[r.timeSlot];
          if (end) endMin = timeToMinutes(end);
        }
        return { ...getBlockPosition(minutesToTime(s), minutesToTime(endMin)), id: r.id, reservation: r };
      });
    const allBlocks = [...resBlocks, ...fallbackBlocks];
    const laneMap = computeLanes(allBlocks.map((b) => ({ top: b.top, height: b.height, id: b.id })));
    return (
      <div className="relative border-r border-gray-100 last:border-r-0 h-full">
        {(closedRegions ?? []).map((c, idx) => (
          <div key={`c-${idx}`} className="absolute left-0 right-0 bg-gray-100/80 pointer-events-none flex items-start justify-center" style={{ top: `${c.top}px`, height: `${c.height}px` }}>
            {c.label && <span className="text-[9px] text-gray-400 font-medium mt-1">{c.label}</span>}
          </div>
        ))}
        {(blocked ?? []).map((b, idx) => {
          const s = timeToMinutes(b.time);
          const pos = getBlockPosition(minutesToTime(s), minutesToTime(s + 60));
          return (
            <div key={`b-${idx}`} className="absolute left-0.5 right-0.5 bg-red-50 border border-red-200 border-dashed rounded z-10 px-1 overflow-hidden" style={{ top: `${pos.top}px`, height: `${pos.height}px` }}>
              <p className="text-[9px] text-red-400 font-medium truncate">{b.time.replace(/^(\d):/, '0$1:')} 不可</p>
            </div>
          );
        })}
        {allBlocks.map((block) => {
          const r = block.reservation;
          const lane = laneMap.get(block.id);
          const tot = lane?.totalLanes ?? 1;
          const overlap = tot > 1;
          // 重なっても幅・位置は通常の枠と同じ（横/縦のずらしはしない）。
          // 前面/背面は重なり順だけで制御：開始が遅い枠ほど前面、同じ開始なら短い枠を前面に。
          // 高さの最大値(TOTAL_HOURS*HOUR_HEIGHT)分の下駄を履かせて z が負にならないようにする。
          // （朝早くチェックインした長時間の予約で z が負になると背景の裏に隠れて見えなくなる）
          const z = 100 + TOTAL_HOURS * HOUR_HEIGHT + Math.round(block.top) * 4 - Math.round(block.height);
          return (
            <Link
              key={block.id}
              href={`/reservations/${r.id}`}
              className={`absolute rounded border text-[10px] leading-tight overflow-hidden hover:opacity-90 transition-opacity px-1 py-0.5 ${blockBg(r)} ${overlap ? 'shadow-md ring-1 ring-white' : ''}`}
              style={{ top: `${block.top}px`, height: `${block.height}px`, left: '0.5px', right: '2px', zIndex: z }}
              title={`${r.checkInTime ?? r.timeSlot}〜${r.checkOutTime ?? ''} ${r.customerName ?? ''}${overlap ? `（この時間帯に${tot}件重複）` : ''}`}
            >
              <div className="flex items-start gap-0.5">
                <span className={`w-1.5 h-1.5 mt-0.5 rounded-full flex-shrink-0 ${blockDot(r)}`} />
                <span className="font-medium break-all whitespace-normal leading-[1.15]">{r.customerName ?? ''}</span>
              </div>
              {block.height >= 34 && <p className="text-[9px] opacity-70 truncate">{r.checkInTime ?? r.timeSlot}</p>}
            </Link>
          );
        })}
      </div>
    );
  }

  // 時間ラベル配列
  const timeLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => TIMELINE_START + i);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => { setView('week'); updateURL(year, month, 'week', weekStart); }}
              className={`px-3 py-1.5 ${view === 'week' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              週
            </button>
            <button
              onClick={() => { setView('month'); updateURL(year, month, 'month', weekStart); }}
              className={`px-3 py-1.5 border-l border-gray-200 ${view === 'month' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              月
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
        {Object.entries(STATUS_DOT).filter(([status]) => status !== 'キャンセル').map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {status === '見学' ? '見学（スタジオ）' : STATUS_LABEL[status as Reservation['status']]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          見学（ロケ）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-gray-200" />
          休業日（スタジオ休業＋ロケ非公開）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-gray-100 border border-gray-200" />
          解放していない枠（週表示）
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] text-green-600 font-medium">祝</span>
          祝日
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-red-200" />
          予約不可枠
        </span>
      </div>

      {view === 'week' ? (
        <div className="overflow-x-auto">
          <div style={{ minWidth: '920px' }}>
            <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
            {/* 週表示：曜日ヘッダー＋3小列ラベル（sticky で本体と同じスクロール領域に入れて列を揃える） */}
            <div className="grid border-b border-gray-100 sticky top-0 bg-white z-30" style={{ gridTemplateColumns: '56px repeat(7, minmax(150px, 1fr))' }}>
              <div className="border-r border-gray-100" />
              {weekDays.map((day, i) => {
                const dateStr = toDateStr(day);
                const isToday = toDateStr(today) === dateStr;
                const isSunday = i === 0;
                const isSaturday = i === 6;
                const isBlocked = blockedDateMap.has(dateStr);
                const isHoliday = holidayDateSet.has(dateStr);
                const hLocDay = locShootDayMap.get(dateStr);
                const hFullyClosed = isBlocked && !(hLocDay && (hLocDay.am || hLocDay.pm));
                return (
                  <div key={dateStr} className={`border-r border-gray-100 ${hFullyClosed ? 'bg-gray-50' : ''}`}>
                    <div className="text-center py-1.5">
                      <div className={`text-xs font-medium ${isSunday || isHoliday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-gray-500'}`}>{weekdays[i]}</div>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand text-white' : isSunday || isHoliday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-gray-800'}`}>{day.getDate()}</span>
                        {isBlocked && <span className="text-[10px] text-red-500 font-medium">休</span>}
                        {isHoliday && !isBlocked && <span className="text-[10px] text-green-600 font-medium">祝</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-t border-gray-100 text-[10px] font-medium">
                      <div className="text-center py-0.5 border-r border-gray-100 text-blue-500">スタジオ</div>
                      <div className="text-center py-0.5 border-r border-gray-100 text-emerald-600">ロケ</div>
                      <div className="text-center py-0.5 text-purple-500">見学</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 週表示：タイムライングリッド */}
              <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, minmax(150px, 1fr))' }}>
                {/* 時間ラベル列 */}
                <div className="relative border-r border-gray-100" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                  {timeLabels.slice(0, -1).map((hour) => (
                    <div key={hour} className="absolute right-2 text-[11px] text-gray-400 leading-none" style={{ top: `${(hour - TIMELINE_START) * HOUR_HEIGHT - 6}px` }}>
                      {hour}:00
                    </div>
                  ))}
                </div>

                {/* 各日：スタジオ / ロケ / 見学 の3小列 */}
                {weekDays.map((day) => {
                  const dateStr = toDateStr(day);
                  const dayReservations = weekReservationMap.get(dateStr) ?? [];
                  const isBlocked = blockedDateMap.has(dateStr);
                  const locDay = locShootDayMap.get(dateStr);
                  const locOpen = !!locDay && (locDay.am || locDay.pm);
                  // スタジオ休業かつロケ非公開＝その日は何も解放していない（完全休み）
                  const fullyClosed = isBlocked && !locOpen;
                  const partialBlocked = blockedTimeSlots[dateStr];
                  const blockedEntries = partialBlocked ? Object.entries(partialBlocked).map(([time, reason]) => ({ time, reason })) : [];
                  const studio = dayReservations.filter((r) => r.status !== '見学' && r.shootType !== 'location');
                  const location = dayReservations.filter((r) => r.status !== '見学' && r.shootType === 'location');
                  const visit = dayReservations.filter((r) => r.status === '見学');

                  // 小列ごとのグレー領域：スタジオ＝休業日は全時間帯／ロケ＝非公開の時間帯（午前・午後単位）
                  const studioClosed = isBlocked ? [{ top: 0, height: TOTAL_HOURS * HOUR_HEIGHT, label: '休業' }] : [];
                  const locClosed: { top: number; height: number; label?: string }[] = [];
                  if (!locDay) {
                    locClosed.push({ top: 0, height: TOTAL_HOURS * HOUR_HEIGHT, label: '非公開' });
                  } else {
                    if (!locDay.am) locClosed.push({ ...getBlockPosition('9:10', '12:00'), label: '非公開' });
                    if (!locDay.pm) locClosed.push({ ...getBlockPosition('13:00', '16:00'), label: '非公開' });
                  }

                  return (
                    <div key={dateStr} className={`relative border-r border-gray-100 ${fullyClosed ? 'bg-gray-50' : ''}`} style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
                      {/* 時間グリッド線 */}
                      {timeLabels.slice(0, -1).map((hour) => (
                        <div key={hour} className="absolute w-full border-t border-gray-100 pointer-events-none" style={{ top: `${(hour - TIMELINE_START) * HOUR_HEIGHT}px` }} />
                      ))}

                      {/* 3小列（完全休みの日でも予約があれば表示する） */}
                      {(!fullyClosed || dayReservations.length > 0) && (
                        <div className="grid grid-cols-3 h-full">
                          {renderSubColumn(studio, blockedEntries, studioClosed)}
                          {renderSubColumn(location, undefined, locClosed)}
                          {renderSubColumn(visit)}
                        </div>
                      )}

                      {/* 終日ブロック表示（予約が無い完全休みの日のみ中央表示） */}
                      {fullyClosed && dayReservations.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="bg-gray-200/60 rounded-lg px-3 py-2 text-center">
                            <p className="text-xs font-medium text-gray-500">予約不可</p>
                            {blockedDateMap.get(dateStr) && <p className="text-[10px] text-gray-400 mt-0.5">{blockedDateMap.get(dateStr)}</p>}
                          </div>
                        </div>
                      )}
                      {/* 予約がある完全休みの日は上部に休業ラベルを小さく表示 */}
                      {fullyClosed && dayReservations.length > 0 && (
                        <div className="absolute top-0.5 left-0.5 z-10 bg-gray-200/70 rounded px-1.5 py-0.5 pointer-events-none">
                          <p className="text-[9px] font-medium text-gray-500">休業日{blockedDateMap.get(dateStr) ? `（${blockedDateMap.get(dateStr)}）` : ''}</p>
                        </div>
                      )}

                      {/* 現在時刻の線 */}
                      {toDateStr(today) === dateStr && (() => {
                        const nowMin = today.getHours() * 60 + today.getMinutes();
                        const offset = nowMin - TIMELINE_START * 60;
                        if (offset < 0 || offset > TOTAL_HOURS * 60) return null;
                        const top = (offset / 60) * HOUR_HEIGHT;
                        return (
                          <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${top}px` }}>
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                              <div className="flex-1 h-[2px] bg-red-500" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====== 月表示（既存カレンダーと同じUI） ====== */
        <>
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
          <div className="grid grid-cols-7">
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-gray-50 min-h-24 p-1" />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayReservations = reservationMap.get(dateStr) ?? [];
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const weekday = (startWeekday + i) % 7;
              const isSunday = weekday === 0;
              const isSaturday = weekday === 6;
              const isBlocked = blockedDateMap.has(dateStr);
              const isHoliday = holidayDateSet.has(dateStr);
              const mLocDay = locShootDayMap.get(dateStr);
              const mLocOpen = !!mLocDay && (mLocDay.am || mLocDay.pm);
              // スタジオ休業かつロケ非公開＝何も解放していない日（完全休み）だけ背景をグレーにする
              const fullyClosed = isBlocked && !mLocOpen;
              const partialBlocked = blockedTimeSlots[dateStr];

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
                    ${fullyClosed ? 'bg-gray-100' : isToday ? 'bg-brand-light' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <div
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-brand text-white' : isSunday || isHoliday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-gray-700'}`}
                    >
                      {day}
                    </div>
                    {isBlocked && <span className="text-[10px] text-red-500 font-medium">休</span>}
                    {isHoliday && !isBlocked && <span className="text-[10px] text-green-600 font-medium">祝</span>}
                  </div>
                  {fullyClosed && dayReservations.length === 0 ? (
                    <p className="text-[10px] text-gray-400 mt-1 text-center">予約不可{blockedDateMap.get(dateStr) ? ` - ${blockedDateMap.get(dateStr)}` : ''}</p>
                  ) : (
                    <div className="space-y-0.5 mt-0.5">
                      {isBlocked && (
                        <p className="text-[10px] text-gray-400 truncate">
                          {/* スタジオ休業でもロケ公開日なら「ロケのみ」と分かるようにする */}
                          {mLocOpen ? 'スタジオ休業（ロケのみ）' : `休業日${blockedDateMap.get(dateStr) ? ` - ${blockedDateMap.get(dateStr)}` : ''}`}
                        </p>
                      )}
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
                                item.r.status === '見学' ? (item.r.shootType === 'location' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700') :
                                'bg-yellow-50 text-yellow-700'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${blockDot(item.r)}`} />
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
        </>
      )}
    </div>
  );
}
