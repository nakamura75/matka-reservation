'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';

type OrderWithCustomer = Order & { customerName: string };

export default function OrderList({ orders }: { orders: OrderWithCustomer[] }) {
  const [search, setSearch] = useState('');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch = !search || o.customerName.includes(search) || (o.note ?? '').includes(search);
      const matchesPaid =
        paidFilter === 'all' ||
        (paidFilter === 'paid' && o.isPaid) ||
        (paidFilter === 'unpaid' && !o.isPaid);
      return matchesSearch && matchesPaid;
    });
  }, [orders, search, paidFilter]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="顧客名・備考で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select
          value={paidFilter}
          onChange={(e) => setPaidFilter(e.target.value as typeof paidFilter)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="all">すべて</option>
          <option value="paid">入金済</option>
          <option value="unpaid">未入金</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length}件</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">注文日</th>
              <th className="px-4 py-3 text-left">顧客名</th>
              <th className="px-4 py-3 text-left">備考</th>
              <th className="px-4 py-3 text-left">入金状況</th>
              <th className="px-4 py-3 text-left">入金日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
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
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${o.isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {o.isPaid ? '入金済' : '未入金'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{o.paidDate || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
