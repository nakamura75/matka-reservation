'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Customer, Reservation, Order } from '@/types';
import { formatDate } from '@/lib/utils';
import { LINE_OA_BOT_ID, STATUS_LABEL, STATUS_COLORS } from '@/lib/constants';

interface Props {
  customer: Customer;
  reservations: (Reservation & { planName?: string })[];
  orders: Order[];
  isRepeater: boolean;
  linkTargetReservationId: string | null;
}

export default function CustomerDetail({ customer, reservations, orders, isRepeater }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [chatLineIdInput, setChatLineIdInput] = useState(customer.chatLineUserId ?? '');
  const [chatLineIdSaving, setChatLineIdSaving] = useState(false);
  const [form, setForm] = useState({
    name: customer.name,
    furigana: customer.furigana ?? '',
    phone: customer.phone,
    email: customer.email ?? '',
    zipCode: customer.zipCode ?? '',
    address: customer.address ?? '',
    note: customer.note ?? '',
  });

  async function handleDelete() {
    const msg = reservations.length > 0
      ? `「${customer.name}」を削除しますか？\n\n⚠️ この顧客に紐づく予約${reservations.length}件・注文データもすべて削除されます。\n\nこの操作は取り消せません。`
      : `「${customer.name}」を削除しますか？この操作は取り消せません。`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        router.push('/customers');
      } else {
        alert(data.error ?? '削除に失敗しました');
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
          <ArrowLeftIcon className="w-4 h-4" />
          顧客一覧
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {customer.name}
          {isRepeater && (
            <span className="ml-2 text-sm bg-brand-light text-brand px-2 py-0.5 rounded-full font-normal">
              リピーター
            </span>
          )}
        </h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="顧客を削除"
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
          {deleting ? '削除中...' : '削除'}
        </button>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          <PencilSquareIcon className="w-4 h-4" />
          編集
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 顧客基本情報 */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">基本情報</h2>
            {editing ? (
              <div className="space-y-3">
                {[
                  { label: '氏名', key: 'name', type: 'text' },
                  { label: 'フリガナ', key: 'furigana', type: 'text' },
                  { label: '電話番号', key: 'phone', type: 'tel' },
                  { label: 'メール', key: 'email', type: 'email' },
                  { label: '郵便番号', key: 'zipCode', type: 'text' },
                  { label: '住所', key: 'address', type: 'text' },
                  { label: '備考', key: 'note', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-400 text-xs">フリガナ</dt>
                  <dd className="text-gray-700 mt-0.5">{customer.furigana || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">電話番号</dt>
                  <dd className="text-gray-700 mt-0.5">{customer.phone}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">メール</dt>
                  <dd className="text-gray-700 mt-0.5">{customer.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">住所</dt>
                  <dd className="text-gray-700 mt-0.5">
                    {customer.zipCode ? `〒${customer.zipCode} ` : ''}{customer.address || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">LINE連携</dt>
                  <dd className="mt-0.5">
                    {customer.lineUserId || customer.chatLineUserId ? (
                      <span className="text-green-700 text-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        {customer.lineName ?? '連携済み'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">未連携</span>
                    )}
                  </dd>
                  {customer.chatLineUserId && (
                    <dd className="mt-2">
                      <a
                        href={`https://chat.line.biz/${LINE_OA_BOT_ID}/chat/${customer.chatLineUserId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: '#06C755' }}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C6.477 2 2 6.032 2 11c0 2.99 1.566 5.634 3.988 7.32-.175.614-.635 2.22-.728 2.566-.115.42.154.414.323.302.133-.089 2.11-1.43 2.967-2.012.444.062.898.094 1.45.094 5.523 0 10-4.032 10-9S17.523 2 12 2zm-3.5 12.5h-1.25a.25.25 0 0 1-.25-.25v-4.5a.25.25 0 0 1 .25-.25H8.5a.25.25 0 0 1 .25.25v4.5a.25.25 0 0 1-.25.25zm2.5 0h-1.25a.25.25 0 0 1-.25-.25v-2.5l-1.5-2.087A.25.25 0 0 1 8.2 9.5H9.5a.25.25 0 0 1 .2.1l.8 1.114.8-1.114a.25.25 0 0 1 .2-.1h1.3a.25.25 0 0 1 .2.413L11.5 11.75v2.5a.25.25 0 0 1-.25.25zm5.25 0H13a.25.25 0 0 1-.25-.25v-4.5A.25.25 0 0 1 13 9.5h2.75a.25.25 0 0 1 0 .5H13.5v1.25h2.25a.25.25 0 0 1 0 .5H13.5v1.25h2.75a.25.25 0 0 1 0 .5z"/>
                        </svg>
                        LINEトークを開く
                      </a>
                    </dd>
                  )}
                  <dd className="mt-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={chatLineIdInput}
                        onChange={(e) => setChatLineIdInput(e.target.value)}
                        placeholder="LINE OAチャットユーザーIDを入力"
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-0"
                      />
                      <button
                        onClick={async () => {
                          const id = chatLineIdInput.trim();
                          if (!id) return;
                          setChatLineIdSaving(true);
                          try {
                            await fetch(`/api/customers/${customer.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ chatLineUserId: id }),
                            });
                            router.refresh();
                          } finally {
                            setChatLineIdSaving(false);
                          }
                        }}
                        disabled={chatLineIdSaving || !chatLineIdInput.trim()}
                        className="shrink-0 text-xs px-2.5 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 whitespace-nowrap"
                      >
                        {chatLineIdSaving ? '保存中...' : customer.chatLineUserId ? '更新' : '登録'}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">LINE OA ManagerのチャットURLから /chat/ 以降のIDをコピー</p>
                  </dd>
                </div>
                {customer.note && (
                  <div>
                    <dt className="text-gray-400 text-xs">備考</dt>
                    <dd className="text-gray-700 mt-0.5">{customer.note}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-400 text-xs">登録日</dt>
                  <dd className="text-gray-700 mt-0.5">{customer.createdAt ? customer.createdAt.slice(0, 10).replace(/-/g, '/') : '—'}</dd>
                </div>
              </dl>
            )}
          </section>

          {/* 統計 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">統計</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{reservations.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">予約回数</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                <p className="text-xs text-gray-400 mt-0.5">注文数</p>
              </div>
            </div>
          </section>
        </div>

        {/* 予約履歴・注文履歴 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 予約履歴 */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">予約履歴</h2>
            </div>
            {reservations.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-6">予約なし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">予約番号</th>
                    <th className="px-4 py-2 text-left">撮影日</th>
                    <th className="px-4 py-2 text-left">プラン</th>
                    <th className="px-4 py-2 text-left">ステータス</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/reservations/${r.id}`} className="text-brand hover:text-brand-dark">
                          {r.reservationNumber || r.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(r.date)}</td>
                      <td className="px-4 py-3 text-gray-500">{r.planName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 注文履歴 */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">注文履歴</h2>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-400 px-6 py-6">注文なし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left">注文日</th>
                    <th className="px-4 py-2 text-left">商品</th>
                    <th className="px-4 py-2 text-left">入金</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${o.id}`} className="text-brand hover:text-brand-dark">
                          {o.orderDate}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {o.items && o.items.length > 0
                          ? o.items.map((i) => `${i.productName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('、')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${o.isPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {o.isPaid ? '入金済' : '未入金'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
