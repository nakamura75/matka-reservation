'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Customer } from '@/types';

type CustomerWithCount = Customer & { reservationCount: number; isRepeater: boolean };

export default function CustomerList({ customers }: { customers: CustomerWithCount[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.furigana ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex gap-3">
        <input
          type="text"
          placeholder="氏名・フリガナ・電話番号・メールで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <span className="text-sm text-gray-400 self-center">{filtered.length}件</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">氏名</th>
              <th className="px-4 py-3 text-left">フリガナ</th>
              <th className="px-4 py-3 text-left">電話番号</th>
              <th className="px-4 py-3 text-left">メール</th>
              <th className="px-4 py-3 text-left">LINE</th>
              <th className="px-4 py-3 text-center">予約数</th>
              <th className="px-4 py-3 text-left">登録日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  顧客が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-brand hover:text-brand-dark font-medium"
                    >
                      {c.name}
                    </Link>
                    {c.isRepeater && (
                      <span className="ml-2 text-xs bg-brand-light text-brand px-1.5 py-0.5 rounded-full">
                        リピーター
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.furigana ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.lineName ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        連携済
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">未連携</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.reservationCount}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
