'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { Order, OrderItem, Customer, Reservation, Product } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

type EnrichedItem = OrderItem & { productName: string; unitPrice: number; subtotal: number };

const ITEM_STATUSES: OrderItem['status'][] = ['受注', '発注済', '制作完了', '入荷', '発送済'];
const STATUS_COLORS: Record<OrderItem['status'], string> = {
  '受注':    'bg-gray-100 text-gray-600',
  '発注済':  'bg-blue-100 text-blue-700',
  '制作完了': 'bg-yellow-100 text-yellow-700',
  '入荷':    'bg-purple-100 text-purple-700',
  '発送済':  'bg-green-100 text-green-700',
};

interface Props {
  order: Order;
  customer: Customer | null;
  reservation: Reservation | null;
  items: EnrichedItem[];
  allProducts: Product[];
}

export default function OrderDetail({ order, customer, reservation, items: initialItems, allProducts }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPaid, setIsPaid] = useState(order.isPaid);
  const [note, setNote] = useState(order.note ?? '');
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  async function saveOrder() {
    setSaving(true);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPaid,
          paidDate: isPaid ? new Date().toLocaleDateString('ja-JP') : '',
          note,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!newProductId) return;
    const product = allProducts.find((p) => p.id === newProductId);
    if (!product) return;

    const res = await fetch(`/api/orders/${order.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: newProductId, quantity: newQty }),
    });
    const data = await res.json();
    if (data.success) {
      setItems((prev) => [
        ...prev,
        {
          ...data.data,
          productName: product.name,
          unitPrice: product.price,
          subtotal: product.price * newQty,
        },
      ]);
      setNewProductId('');
      setNewQty(1);
      setAddingItem(false);
    }
  }

  async function updateItemStatus(item: EnrichedItem, status: OrderItem['status']) {
    setUpdatingItem(item.id);
    const today = new Date().toLocaleDateString('ja-JP');
    const dateFields: Partial<OrderItem> = {};
    if (status === '発注済') dateFields.orderedDate = today;
    if (status === '制作完了') dateFields.completedDate = today;
    if (status === '入荷') dateFields.arrivedDate = today;
    if (status === '発送済') dateFields.shippedDate = today;

    await fetch(`/api/orders/${order.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, status, ...dateFields }),
    });

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status, ...dateFields } : i))
    );
    setUpdatingItem(null);
  }

  async function updateTrackingNumber(item: EnrichedItem, trackingNumber: string) {
    await fetch(`/api/orders/${order.id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, trackingNumber }),
    });
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, trackingNumber } : i))
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/orders" className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeftIcon className="w-4 h-4" />
          注文一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          注文詳細
          <span className="text-base text-gray-400 font-normal ml-3">{order.orderDate}</span>
        </h1>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          {isPaid ? '入金済' : '未入金'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 注文詳細・商品 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 商品一覧 */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">注文商品</h2>
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1 text-sm text-pink-600 hover:text-pink-800"
              >
                <PlusIcon className="w-4 h-4" />
                商品追加
              </button>
            </div>

            {/* 商品追加フォーム */}
            {addingItem && (
              <div className="px-6 py-4 bg-pink-50 border-b border-pink-100 flex gap-3 flex-wrap">
                <select
                  value={newProductId}
                  onChange={(e) => setNewProductId(e.target.value)}
                  className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="">商品を選択...</option>
                  {allProducts.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}（{formatCurrency(p.price)}）</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                />
                <button onClick={addItem} className="px-4 py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600">
                  追加
                </button>
                <button onClick={() => setAddingItem(false)} className="px-4 py-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                  キャンセル
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-8 text-center">商品がありません</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatCurrency(item.unitPrice)} × {item.quantity} = {formatCurrency(item.subtotal)}
                        </p>
                        {item.orderedDate && (
                          <p className="text-xs text-gray-400 mt-1">発注日: {item.orderedDate}</p>
                        )}
                        {item.arrivedDate && (
                          <p className="text-xs text-gray-400">入荷日: {item.arrivedDate}</p>
                        )}
                        {item.shippedDate && (
                          <p className="text-xs text-gray-400">発送日: {item.shippedDate}</p>
                        )}
                        {item.status === '発送済' && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">追跡番号:</span>
                            <input
                              type="text"
                              defaultValue={item.trackingNumber ?? ''}
                              onBlur={(e) => updateTrackingNumber(item, e.target.value)}
                              placeholder="追跡番号を入力"
                              className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-pink-300"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                          {item.status}
                        </span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {ITEM_STATUSES.filter((s) => s !== item.status).map((s) => (
                            <button
                              key={s}
                              onClick={() => updateItemStatus(item, s)}
                              disabled={updatingItem === item.id}
                              className="text-xs text-gray-500 hover:text-pink-600 border border-gray-200 hover:border-pink-200 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
                            >
                              → {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between text-sm font-bold">
                <span className="text-gray-500">合計</span>
                <span className="text-gray-900">{formatCurrency(total)}</span>
              </div>
            )}
          </section>

          {/* 備考 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">備考</h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
              placeholder="スタッフメモ..."
            />
          </section>
        </div>

        {/* 右: 顧客・操作 */}
        <div className="space-y-6">
          {/* 顧客情報 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">顧客情報</h2>
            {customer ? (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-gray-900">{customer.name}</p>
                {customer.furigana && <p className="text-xs text-gray-400">{customer.furigana}</p>}
                <p className="text-gray-600">📞 {customer.phone}</p>
                {customer.email && <p className="text-gray-600">✉️ {customer.email}</p>}
                <Link href={`/customers/${customer.id}`}
                  className="block text-center text-xs text-pink-600 border border-pink-200 rounded-lg px-3 py-2 hover:bg-pink-50 mt-3">
                  顧客詳細 →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">顧客情報なし</p>
            )}
          </section>

          {/* 関連予約 */}
          {reservation && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">関連予約</h2>
              <div className="text-sm space-y-2">
                <p className="text-gray-700">{formatDate(reservation.date)} {reservation.timeSlot}</p>
                <p className="text-gray-500">{reservation.scene}</p>
                <Link href={`/reservations/${reservation.id}`}
                  className="block text-center text-xs text-pink-600 border border-pink-200 rounded-lg px-3 py-2 hover:bg-pink-50">
                  予約詳細 →
                </Link>
              </div>
            </section>
          )}

          {/* 入金管理 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">入金管理</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="w-4 h-4 accent-pink-500"
              />
              <span className="text-sm text-gray-700">入金済みにする</span>
            </label>
            <button
              onClick={saveOrder}
              disabled={saving}
              className="w-full py-2.5 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
