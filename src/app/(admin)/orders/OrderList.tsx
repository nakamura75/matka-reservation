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
      {/* ステータスタブ */}
      <div className="flex border-b border-gray-200">
        {([
          { value: 'all', label: 'すべて' },
          { value: 'unpaid', label: '未入金' },
          { value: 'paid', label: '入金済' },
        ] as const).map((tab) => {
          const count =
            tab.value === 'all'
              ? orders.length
              : orders.filter((o) => (tab.value === 'paid' ? o.isPaid : !o.isPaid)).length;
          return (
            <button
              key={tab.value}
              onClick={() => setPaidFilter(tab.value)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                paidFilter === tab.value
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                paidFilter === tab.value ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="p-3">
          <input
            type="text"
            placeholder="顧客名・備考で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 w-52"
          />
        </div>
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
