'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Reservation, ReservationStatus } from '@/types';
import { formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<ReservationStatus, string> = {
  '予約済': 'bg-yellow-100 text-yellow-800',
  '予約確定': 'bg-blue-100 text-blue-800',
  '完了': 'bg-green-100 text-green-800',
  'キャンセル': 'bg-gray-100 text-gray-500',
};

export default function ReservationList({ reservations }: { reservations: Reservation[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const matchesSearch =
        !search ||
        r.customerName?.includes(search) ||
        r.reservationNumber?.includes(search) ||
        r.date.includes(search);
      const matchesStatus =
        statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reservations, search, statusFilter]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* フィルターバー */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="顧客名・予約番号・日付で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          <option value="all">すべてのステータス</option>
          <option value="予約済">予約済</option>
          <option value="予約確定">予約確定</option>
          <option value="完了">完了</option>
          <option value="キャンセル">キャンセル</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length}件</span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">予約番号</th>
              <th className="px-4 py-3 text-left">予約日</th>
              <th className="px-4 py-3 text-left">時間</th>
              <th className="px-4 py-3 text-left">顧客名</th>
              <th className="px-4 py-3 text-left">シーン</th>
              <th className="px-4 py-3 text-left">ステータス</th>
              <th className="px-4 py-3 text-left">登録日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  予約が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/reservations/${r.id}`}
                      className="text-pink-600 hover:text-pink-800 font-medium"
                    >
                      {r.reservationNumber || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.timeSlot}</td>
                  <td className="px-4 py-3 text-gray-700">{r.customerName || r.customerId}</td>
                  <td className="px-4 py-3 text-gray-500">{r.scene}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
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
    </div>
  );
}
