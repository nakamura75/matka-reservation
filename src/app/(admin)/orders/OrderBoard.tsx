'use client';

import Link from 'next/link';
import type { OrderItem } from '@/types';
import { ORDER_ITEM_STATUSES } from '@/lib/constants';

type EnrichedItem = OrderItem & {
  productName: string;
  unitPrice: number;
  subtotal: number;
  customerName: string;
  orderDate: string;
};

const STATUS_STYLES: Record<OrderItem['status'], { col: string; badge: string; dot: string }> = {
  '受注':    { col: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400' },
  '発注済':  { col: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  '制作完了': { col: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  '入荷':    { col: 'bg-purple-50 border-purple-200', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  '発送済':  { col: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-400' },
};

export default function OrderBoard({ items }: { items: EnrichedItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {ORDER_ITEM_STATUSES.map((status) => {
        const colItems = items.filter((i) => i.status === status);
        const style = STATUS_STYLES[status];
        return (
          <div key={status} className="flex-shrink-0 w-64">
            {/* 列ヘッダー */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0 ${style.col}`}>
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className="text-sm font-semibold text-gray-700">{status}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
                {colItems.length}
              </span>
            </div>

            {/* カード一覧 */}
            <div className={`border rounded-b-xl ${style.col} p-2 space-y-2 min-h-[200px]`}>
              {colItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">なし</p>
              ) : (
                colItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/orders/${item.orderId}`}
                    className="block bg-white rounded-lg border border-gray-200 p-3 hover:border-brand/40 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.productName}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{item.orderDate}</span>
                      <span className="text-xs text-gray-500">×{item.quantity}</span>
                    </div>
                    {item.trackingNumber && (
                      <p className="text-xs text-gray-400 mt-1 truncate">追跡: {item.trackingNumber}</p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
