'use client';

import { useState, useEffect } from 'react';
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import OrderList from './OrderList';
import OrderBoard from './OrderBoard';
import type { Order, OrderItem } from '@/types';
import { useShootBg } from '@/components/layout/ShootBgContext';

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
  const setMainBg = useShootBg();
  useEffect(() => {
    setMainBg(isLoc ? 'bg-emerald-50/60' : null);
    return () => setMainBg(null);
  }, [isLoc, setMainBg]);

  const filteredOrders = orders.filter((o) => (isLoc ? o.shootType === 'location' : o.shootType !== 'location'));
  const filteredBoardItems = boardItems.filter((i) => (isLoc ? i.shootType === 'location' : i.shootType !== 'location'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">注文管理</h1>
        <span className="text-sm text-gray-400">{orders.length}件</span>
      </div>
      {/* スタジオ / ロケ 切替（コンパクト） */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([['studio', 'スタジオ'], ['location', 'ロケーション']] as const).map(([key, label]) => {
            const active = shootTab === key;
            const locTab = key === 'location';
            return (
              <button
                key={key}
                onClick={() => setShootTab(key)}
                className={`px-4 py-1.5 font-medium transition-colors ${key === 'studio' ? 'border-r border-gray-200' : ''}
                  ${active ? (locTab ? 'bg-emerald-600 text-white' : 'bg-brand text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
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
