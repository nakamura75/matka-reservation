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
                    {c.lineUserId ? (
                      <a
                        href={`https://manager.line.biz/account/%40671kcyek/chat/${c.lineUserId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: '#06C755' }}
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C6.477 2 2 6.032 2 11c0 2.99 1.566 5.634 3.988 7.32-.175.614-.635 2.22-.728 2.566-.115.42.154.414.323.302.133-.089 2.11-1.43 2.967-2.012.444.062.898.094 1.45.094 5.523 0 10-4.032 10-9S17.523 2 12 2zm-3.5 12.5h-1.25a.25.25 0 0 1-.25-.25v-4.5a.25.25 0 0 1 .25-.25H8.5a.25.25 0 0 1 .25.25v4.5a.25.25 0 0 1-.25.25zm2.5 0h-1.25a.25.25 0 0 1-.25-.25v-2.5l-1.5-2.087A.25.25 0 0 1 8.2 9.5H9.5a.25.25 0 0 1 .2.1l.8 1.114.8-1.114a.25.25 0 0 1 .2-.1h1.3a.25.25 0 0 1 .2.413L11.5 11.75v2.5a.25.25 0 0 1-.25.25zm5.25 0H13a.25.25 0 0 1-.25-.25v-4.5A.25.25 0 0 1 13 9.5h2.75a.25.25 0 0 1 0 .5H13.5v1.25h2.25a.25.25 0 0 1 0 .5H13.5v1.25h2.75a.25.25 0 0 1 0 .5z"/>
                        </svg>
                        トーク
                      </a>
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
