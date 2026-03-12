'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Reservation, ReservationStatus } from '@/types';
import { formatDate } from '@/lib/utils';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  '予約済': '仮予約',
  '予約確定': '予約確定',
  '見学': '見学',
  '保留': '保留',
  '完了': '完了',
  'キャンセル': 'キャンセル',
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  '予約済': 'bg-yellow-100 text-yellow-800',
  '予約確定': 'bg-blue-100 text-blue-800',
  '見学': 'bg-purple-100 text-purple-700',
  '保留': 'bg-orange-100 text-orange-700',
  '完了': 'bg-green-100 text-green-800',
  'キャンセル': 'bg-gray-100 text-gray-500',
};

const TAB_ORDER: ReservationStatus[] = ['予約済', '予約確定', '見学', '保留', '完了', 'キャンセル'];

// 「完了」「キャンセル」のカウントは非表示
const TABS_WITH_COUNT = new Set<ReservationStatus>(['予約済', '予約確定', '見学', '保留']);

const PAGE_SIZE = 20;

type SortKey = 'date' | 'createdAt';
type SortDir = 'asc' | 'desc';

function stripSeconds(time: string) {
  return time ? time.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1') : time;
}

export default function ReservationList({ reservations }: { reservations: Reservation[] }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ReservationStatus>('予約済');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    return reservations
      .filter((r) => {
        const matchesSearch =
          !search ||
          r.customerName?.includes(search) ||
          r.reservationNumber?.includes(search) ||
          (r.date && r.date.includes(search));
        return matchesSearch && r.status === activeTab;
      })
      .sort((a, b) => {
        let va: number, vb: number;
        if (sortKey === 'date') {
          va = a.date ? new Date(a.date).getTime() : 0;
          vb = b.date ? new Date(b.date).getTime() : 0;
        } else {
          va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        }
        return sortDir === 'asc' ? va - vb : vb - va;
      });
  }, [reservations, search, activeTab, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const countByStatus = useMemo(() => {
    const counts: Partial<Record<ReservationStatus, number>> = {};
    for (const r of reservations) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [reservations]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronUpIcon className="w-3 h-3 text-gray-300 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUpIcon className="w-3 h-3 text-brand ml-1 inline" />
      : <ChevronDownIcon className="w-3 h-3 text-brand ml-1 inline" />;
  }

  return (
    <div className="bg-white rounded-xl border border-cream-dark overflow-hidden">
      {/* 検索バー */}
      <div className="p-4 border-b border-cream-dark">
        <input
          type="text"
          placeholder="顧客名・予約番号・日付で検索..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {/* ステータスタブ */}
      <div className="flex border-b border-cream-dark overflow-x-auto">
        {TAB_ORDER.map((status) => (
          <button
            key={status}
            onClick={() => { setActiveTab(status); setPage(1); }}
            className={`flex-1 min-w-max px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors
              ${activeTab === status
                ? 'border-b-2 border-brand text-brand bg-cream/40'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            {STATUS_LABEL[status]}
            {TABS_WITH_COUNT.has(status) && (
              <span className={`ml-2 inline-block text-xs rounded-full px-2 py-0.5 font-normal
                ${activeTab === status ? STATUS_COLORS[status] : 'bg-gray-100 text-gray-400'}`}>
                {countByStatus[status] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">予約番号</th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('date')}>
                予約日<SortIcon column="date" />
              </th>
              <th className="px-4 py-3 text-left">時間</th>
              <th className="px-4 py-3 text-left">顧客名</th>
              <th className="px-4 py-3 text-left">シーン</th>
              <th className="px-4 py-3 text-left">ステータス</th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('createdAt')}>
                登録日<SortIcon column="createdAt" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  予約が見つかりません
                </td>
              </tr>
            ) : (
              paginated.map((r) => (
                <tr key={r.id} className="hover:bg-cream/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/reservations/${r.id}`}
                      className="text-brand hover:text-brand-dark font-medium"
                    >
                      {r.reservationNumber || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.date ? formatDate(r.date) : <span className="text-gray-400">未定</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{r.timeSlot ? stripSeconds(r.timeSlot) : <span className="text-gray-400">未定</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{r.customerName || r.customerId}</td>
                  <td className="px-4 py-3 text-gray-500">{r.scene}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-row flex-nowrap items-center gap-1.5">
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="引継ぎPDFを開く"
                          className="text-white text-xs font-medium bg-green-500 hover:bg-green-600 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                        >
                          PDF
                        </a>
                      )}
                      <span className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('ja-JP') : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            全{filtered.length}件中 {(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, filtered.length)}件
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              前へ
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded ${p === currentPage ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
