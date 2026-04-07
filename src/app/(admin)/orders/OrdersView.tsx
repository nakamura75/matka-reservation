'use client';

import { useState } from 'react';
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import OrderList from './OrderList';
import OrderBoard from './OrderBoard';
import type { Order, OrderItem } from '@/types';

type EnrichedOrder = Order & { customerName: string };
type EnrichedItem = OrderItem & {
  productName: string;
  unitPrice: number;
  subtotal: number;
  customerName: string;
  orderDate: string;
};

interface Props {
  orders: EnrichedOrder[];
  boardItems: EnrichedItem[];
}

export default function OrdersView({ orders, boardItems }: Props) {
  const [view, setView] = useState<'list' | 'board'>('board');

  return (
    <div>
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
        <OrderList orders={orders} />
      ) : (
        <OrderBoard items={boardItems} />
      )}
    </div>
  );
}
