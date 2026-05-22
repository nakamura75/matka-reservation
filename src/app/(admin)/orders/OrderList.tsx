'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Order } from '@/types';

type OrderWithCustomer = Order & { customerName: string };

type SortKey = 'orderDate' | 'deadline';
type SortDir = 'asc' | 'desc';

export default function OrderList({ orders }: { orders: OrderWithCustomer[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('orderDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'deadline' ? 'asc' : 'desc');
    }
  }

  const filtered = useMemo(() => {
    return orders
      .filter((o) => !search || o.customerName.includes(search) || (o.note ?? '').includes(search))
      .sort((a, b) => {
        const va = (sortKey === 'deadline' ? a.deadline : a.orderDate) || '';
        const vb = (sortKey === 'deadline' ? b.deadline : b.orderDate) || '';
        // 値が空のものは常に末尾
        if (!va && !vb) return 0;
        if (!va) return 1;
        if (!vb) return -1;
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [orders, search, sortKey, sortDir]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronUpIcon className="w-3 h-3 text-gray-300 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUpIcon className="w-3 h-3 text-brand ml-1 inline" />
      : <ChevronDownIcon className="w-3 h-3 text-brand ml-1 inline" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 検索バー */}
      <div className="flex items-center border-b border-gray-200 px-4 py-3">
        <span className="text-sm text-gray-500 mr-3">全 {orders.length} 件</span>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="顧客名・備考で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 w-52"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th
                className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort('orderDate')}
              >
                注文日<SortIcon column="orderDate" />
              </th>
              <th className="px-4 py-3 text-left">顧客名</th>
              <th className="px-4 py-3 text-left">備考</th>
              <th
                className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-700"
                onClick={() => handleSort('deadline')}
              >
                納期<SortIcon column="deadline" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  注文が見つかりません
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="text-brand hover:text-brand-dark font-medium">
                      {o.orderDate}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <Link href={`/customers/${o.customerId}`} className="hover:text-brand">
                      {o.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.note || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.deadline || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
