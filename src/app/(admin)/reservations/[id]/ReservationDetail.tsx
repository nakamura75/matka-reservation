'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { Reservation, Customer, Plan, ReservationOption } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

type OptionWithInfo = ReservationOption & { optionName: string; price: number };

const STATUS_COLORS = {
  '予約済': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '予約確定': 'bg-blue-100 text-blue-800 border-blue-200',
  '完了': 'bg-green-100 text-green-800 border-green-200',
  'キャンセル': 'bg-gray-100 text-gray-500 border-gray-200',
} as const;

const NEXT_STATUS: Record<Reservation['status'], Reservation['status'] | null> = {
  '予約済': '予約確定',
  '予約確定': '完了',
  '完了': null,
  'キャンセル': null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  '予約確定': '予約確定にする',
  '完了': '完了にする',
};

interface Props {
  reservation: Reservation;
  customer: Customer | null;
  plan: Plan | null;
  options: OptionWithInfo[];
}

export default function ReservationDetail({ reservation, customer, plan, options }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(reservation.status);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(reservation.note ?? '');
  const [discount, setDiscount] = useState(reservation.discountAmount ?? 0);
  const [discountReason, setDiscountReason] = useState(reservation.discountReason ?? '');
  const [saving, setSaving] = useState(false);

  const optionTotal = options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const planPrice = plan?.price ?? 0;
  const total = planPrice + optionTotal - discount;

  async function changeStatus(newStatus: Reservation['status']) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      } else {
        alert('ステータスの更新に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    setSaving(true);
    try {
      await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, discountAmount: discount, discountReason }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const nextStatus = NEXT_STATUS[status];

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/reservations"
          className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          一覧に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          予約詳細
          <span className="text-base text-gray-400 font-normal ml-3">
            {reservation.reservationNumber}
          </span>
        </h1>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[status]}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* 予約情報 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">予約情報</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-gray-400">撮影日</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{formatDate(reservation.date)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">時間帯</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{reservation.timeSlot}</dd>
              </div>
              <div>
                <dt className="text-gray-400">撮影シーン</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{reservation.scene ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400">プラン</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {plan?.name ?? reservation.planId}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">お子様人数</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{reservation.childrenCount ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400">大人人数</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{reservation.adultCount ?? '—'}</dd>
              </div>
              {reservation.familyNote && (
                <div className="col-span-2">
                  <dt className="text-gray-400">家族構成メモ</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{reservation.familyNote}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400">電話希望</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{reservation.phonePreference ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400">LINE連携</dt>
                <dd className="mt-0.5">
                  {reservation.lineUserId ? (
                    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      紐づけ済み
                    </span>
                  ) : (
                    <span className="text-gray-400">未連携</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">登録日</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {reservation.createdAt
                    ? new Date(reservation.createdAt).toLocaleDateString('ja-JP')
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* オプション */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">オプション</h2>
            {options.length === 0 ? (
              <p className="text-sm text-gray-400">オプションなし</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-400 text-xs">
                  <tr>
                    <th className="text-left pb-2">オプション名</th>
                    <th className="text-right pb-2">単価</th>
                    <th className="text-right pb-2">数量</th>
                    <th className="text-right pb-2">小計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {options.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 text-gray-700">{o.optionName}</td>
                      <td className="py-2 text-right text-gray-600">{formatCurrency(o.price)}</td>
                      <td className="py-2 text-right text-gray-600">×{o.quantity}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(o.price * o.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 備考・値引き（編集可能） */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <PencilSquareIcon className="w-4 h-4" />
              備考・値引き
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                  placeholder="スタッフ向けメモ..."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">値引額</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    min={0}
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-xs text-gray-400 mb-1">値引理由</label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    placeholder="例: スタッフ紹介、リピーター割引"
                  />
                </div>
              </div>
              <button
                onClick={saveNote}
                disabled={saving}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
        </div>

        {/* 右カラム */}
        <div className="space-y-6">
          {/* 顧客情報 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">顧客情報</h2>
            {customer ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-lg font-bold text-gray-900">{customer.name}</p>
                  {customer.furigana && (
                    <p className="text-xs text-gray-400">{customer.furigana}</p>
                  )}
                </div>
                <div className="space-y-1 text-gray-600">
                  <p>📞 {customer.phone}</p>
                  {customer.email && <p>✉️ {customer.email}</p>}
                  {customer.address && (
                    <p className="text-xs">📍 {customer.zipCode} {customer.address}</p>
                  )}
                </div>
                <Link
                  href={`/customers/${customer.id}`}
                  className="block text-center text-xs text-pink-600 hover:text-pink-800 border border-pink-200 rounded-lg px-3 py-2 hover:bg-pink-50 transition-colors"
                >
                  顧客詳細を見る →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">顧客情報なし</p>
            )}
          </section>

          {/* 料金サマリー */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">料金</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>プラン料金</span>
                <span>{formatCurrency(planPrice)}</span>
              </div>
              {optionTotal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>オプション合計</span>
                  <span>{formatCurrency(optionTotal)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>値引き</span>
                  <span>−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-100">
                <span>合計（税込）</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">支払状況</span>
                <span className={reservation.paymentStatus ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {reservation.paymentStatus ? `支払済 (${reservation.paymentDate ?? ''})` : '未払い'}
                </span>
              </div>
            </div>
          </section>

          {/* ステータス操作 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">ステータス変更</h2>
            {nextStatus && (
              <button
                onClick={() => changeStatus(nextStatus)}
                disabled={loading}
                className="w-full py-2.5 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors"
              >
                {loading ? '処理中...' : NEXT_STATUS_LABEL[nextStatus]}
              </button>
            )}
            {status !== 'キャンセル' && status !== '完了' && (
              <button
                onClick={() => {
                  if (confirm('キャンセルにしますか？')) changeStatus('キャンセル');
                }}
                disabled={loading}
                className="w-full py-2 text-gray-400 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                キャンセルにする
              </button>
            )}
            {status === '予約確定' && reservation.lineUserId && (
              <p className="text-xs text-blue-500 text-center">
                ※ 予約確定にすると LINE に通知が送信されます
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
