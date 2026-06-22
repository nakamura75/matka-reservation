'use client';

import { useState } from 'react';
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import OrderList from './OrderList';
import OrderBoard from './OrderBoard';
import type { Order, OrderItem } from '@/types';

type EnrichedOrder = Order & { customerName: string; shootType: 'studio' | 'location' };
type EnrichedItem = OrderItem & {
  productName: string;
  unitPrice: number;
  subtotal: number;
  customerName: string;
  orderDate: string;
  deadline: string;
  shootType: 'studio' | 'location';
};

interface Props {
  orders: EnrichedOrder[];
  boardItems: EnrichedItem[];
}

export default function OrdersView({ orders, boardItems }: Props) {
  const [view, setView] = useState<'list' | 'board'>('board');
  const [shootTab, setShootTab] = useState<'studio' | 'location'>('studio');
  const isLoc = shootTab === 'location';

  const filteredOrders = orders.filter((o) => (isLoc ? o.shootType === 'location' : o.shootType !== 'location'));
  const filteredBoardItems = boardItems.filter((i) => (isLoc ? i.shootType === 'location' : i.shootType !== 'location'));

  return (
    <div>
      {/* スタジオ / ロケ 切替 */}
      <div className={`flex rounded-xl border overflow-hidden mb-4 ${isLoc ? 'border-emerald-200' : 'border-gray-200'}`}>
        {([['studio', 'スタジオ'], ['location', 'ロケーション']] as const).map(([key, label]) => {
          const active = shootTab === key;
          const locTab = key === 'location';
          return (
            <button
              key={key}
              onClick={() => setShootTab(key)}
              className={`flex-1 px-5 py-2.5 text-sm font-bold transition-colors
                ${active ? (locTab ? 'bg-emerald-600 text-white' : 'bg-brand text-white') : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 表示切り替え */}
      <div className="flex justify-end mb-4">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              view === 'list' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ListBulletIcon className="w-4 h-4" />
            リスト
          </button>
          <button
            onClick={() => setView('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              view === 'board' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Squares2X2Icon className="w-4 h-4" />
            ボード
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <OrderList orders={filteredOrders} />
      ) : (
        <OrderBoard items={filteredBoardItems} />
      )}
    </div>
  );
}
