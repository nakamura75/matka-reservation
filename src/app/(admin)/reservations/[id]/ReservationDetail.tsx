'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PencilSquareIcon, DocumentTextIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import type { Reservation, Customer, Plan, ReservationOption, Staff, StaffAssignment } from '@/types';
import { formatDate, formatCurrency, isWeekend } from '@/lib/utils';
import { PLAN_STAFF_BREAKDOWN, HOLIDAY_FEE, STORE_STAFF_ID } from '@/lib/constants';

type OptionWithInfo = ReservationOption & { optionName: string; price: number };

// ① 表示ラベル（DBの値 '予約済' は変えない）
const STATUS_LABEL: Record<Reservation['status'], string> = {
  '予約済': '仮予約',
  '予約確定': '予約確定',
  '完了': '完了',
  'キャンセル': 'キャンセル',
};

const STATUS_COLORS = {
  '予約済': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '予約確定': 'bg-blue-100 text-blue-800 border-blue-200',
  '完了': 'bg-green-100 text-green-800 border-green-200',
  'キャンセル': 'bg-gray-100 text-gray-500 border-gray-200',
} as const;

const NEXT_STATUS: Record<Reservation['status'], Reservation['status'] | null> = {
  '予約済': '予約確定',
  '予約確定': null, // 完了は予約日経過で自動
  '完了': null,
  'キャンセル': null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  '予約確定': '予約確定にする',
};

// ④ 税計算ヘルパー（税込前提、消費税10%）
function taxExcluded(amount: number) {
  return Math.round(amount / 1.1);
}

// ② 時間の秒を削除（H:MM:SS → H:MM のみ変換。H:MM はそのまま）
function stripSeconds(time: string) {
  return time ? time.replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1') : time;
}

interface Props {
  reservation: Reservation;
  customer: Customer | null;
  plan: Plan | null;
  options: OptionWithInfo[];
  staff: Staff[];
}

function parseAssignment(json?: string): StaffAssignment {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export default function ReservationDetail({ reservation, customer, plan, options, staff }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(reservation.status);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(reservation.note ?? '');
  const [checkInTime, setCheckInTime] = useState(reservation.checkInTime ?? '');
  const [checkOutTime, setCheckOutTime] = useState(reservation.checkOutTime ?? '');
  const [saving, setSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(reservation.paymentStatus);
  const [paymentDate, setPaymentDate] = useState(reservation.paymentDate ?? '');
  const [paymentSaving, setPaymentSaving] = useState(false);

  // 担当割り当て
  const photographers = staff.filter((s) => s.role === 'フォトグラファー' && s.isActive !== 'FALSE');
  const hairMakeupStaff = staff.filter((s) => s.role === 'ヘアメイク' && s.isActive !== 'FALSE');
  const planType: 'Discovery' | 'Maternity' = reservation.scene === 'マタニティ' ? 'Maternity' : 'Discovery';
  const breakdown = PLAN_STAFF_BREAKDOWN[planType];
  const hasHolidayFee = isWeekend(reservation.date);
  const [assignment, setAssignment] = useState<StaffAssignment>(
    parseAssignment(reservation.staffAssignmentJson)
  );
  const [assignSaving, setAssignSaving] = useState(false);

  async function saveAssignment() {
    setAssignSaving(true);
    try {
      await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffAssignment: JSON.stringify(assignment) }),
      });
      router.refresh();
    } finally {
      setAssignSaving(false);
    }
  }

  // ③ 合計金額を直接編集（値引き額フィールドを廃止し、T列を合計金額として再利用）
  const optionTotal = options.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const planPrice = plan?.price ?? 0;
  const computedTotal = planPrice + optionTotal;
  const [customTotal, setCustomTotal] = useState(
    reservation.discountAmount != null && reservation.discountAmount > 0
      ? reservation.discountAmount
      : computedTotal
  );

  async function changeStatus(newStatus: Reservation['status']) {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === '予約確定') {
        payload.checkInTime = checkInTime;
        payload.checkOutTime = checkOutTime;
      }
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        body: JSON.stringify({ note, totalAmount: customTotal }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function togglePayment() {
    const newStatus = !paymentStatus;
    const newDate = newStatus ? new Date().toLocaleDateString('ja-JP') : '';
    setPaymentSaving(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus, paymentDate: newDate }),
      });
      if (res.ok) {
        setPaymentStatus(newStatus);
        setPaymentDate(newDate);
      }
    } finally {
      setPaymentSaving(false);
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
        {/* ① 表示ラベル変更 */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[status]}`}>
          {STATUS_LABEL[status]}
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
                {/* ② 秒を削除 */}
                <dd className="font-medium text-gray-900 mt-0.5">{stripSeconds(reservation.timeSlot)}</dd>
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

          {/* 担当割り当て */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <UserGroupIcon className="w-4 h-4" />
              担当割り当て
            </h2>
            <div className="space-y-3">
              {/* フォト */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">フォト</p>
                  <p className="text-xs text-gray-400">{formatCurrency(breakdown.photo)}</p>
                </div>
                <select
                  value={assignment.photo ?? ''}
                  onChange={(e) => setAssignment((a) => ({ ...a, photo: e.target.value || undefined }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[140px]"
                >
                  <option value="">未選択</option>
                  {photographers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* アシスタント */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">アシスタント</p>
                  <p className="text-xs text-gray-400">{formatCurrency(breakdown.assistant)}</p>
                </div>
                <select
                  value={assignment.assistant ?? ''}
                  onChange={(e) => setAssignment((a) => ({ ...a, assistant: e.target.value || undefined }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[140px]"
                >
                  <option value="">未選択</option>
                  {photographers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* ヘア */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">ヘア</p>
                  <p className="text-xs text-gray-400">{formatCurrency(breakdown.hair)}</p>
                </div>
                <select
                  value={assignment.hair ?? ''}
                  onChange={(e) => setAssignment((a) => ({ ...a, hair: e.target.value || undefined }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[140px]"
                >
                  <option value="">未選択</option>
                  {hairMakeupStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* メイク */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">メイク</p>
                  <p className="text-xs text-gray-400">{formatCurrency(breakdown.makeup)}</p>
                </div>
                <select
                  value={assignment.makeup ?? ''}
                  onChange={(e) => setAssignment((a) => ({ ...a, makeup: e.target.value || undefined }))}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[140px]"
                >
                  <option value="">未選択</option>
                  {hairMakeupStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* 休日料金（土日のみ表示） */}
              {hasHolidayFee && (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">休日料金</p>
                    <p className="text-xs text-gray-400">{formatCurrency(HOLIDAY_FEE)}</p>
                  </div>
                  <span className="text-sm text-gray-500 min-w-[140px] px-2">{STORE_STAFF_ID}</span>
                </div>
              )}

              {/* オプション（各自選択） */}
              {options.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700">{o.optionName}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(o.price * o.quantity)}</p>
                  </div>
                  <select
                    value={assignment.options?.[o.optionId] ?? ''}
                    onChange={(e) =>
                      setAssignment((a) => ({
                        ...a,
                        options: { ...(a.options ?? {}), [o.optionId]: e.target.value || '' },
                      }))
                    }
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-[140px]"
                  >
                    <option value="">未選択</option>
                    {hairMakeupStaff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ))}

              <button
                onClick={saveAssignment}
                disabled={assignSaving}
                className="mt-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {assignSaving ? '保存中...' : '担当を保存'}
              </button>
            </div>
          </section>

          {/* ③ 備考・合計金額（値引きフィールド削除、合計直接編集） */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <PencilSquareIcon className="w-4 h-4" />
              備考・合計金額
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                  placeholder="スタッフ向けメモ..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">合計金額（税込）</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={customTotal}
                    onChange={(e) => setCustomTotal(Number(e.target.value))}
                    className="w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    min={0}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomTotal(computedTotal)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    自動計算に戻す
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">自動計算: {formatCurrency(computedTotal)}</p>
              </div>
              <button
                onClick={saveNote}
                disabled={saving}
                className="px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
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
                  className="block text-center text-xs text-brand hover:text-brand-dark border border-brand/20 rounded-lg px-3 py-2 hover:bg-brand-light transition-colors"
                >
                  顧客詳細を見る →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">顧客情報なし</p>
            )}
          </section>

          {/* ④ 料金サマリー（税抜・税込の両方表示） */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">料金</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>プラン料金</span>
                <div className="text-right">
                  <div>{formatCurrency(planPrice)}</div>
                  <div className="text-xs text-gray-400">税抜 {formatCurrency(taxExcluded(planPrice))}</div>
                </div>
              </div>
              {optionTotal > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>オプション合計</span>
                  <div className="text-right">
                    <div>{formatCurrency(optionTotal)}</div>
                    <div className="text-xs text-gray-400">税抜 {formatCurrency(taxExcluded(optionTotal))}</div>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>税抜合計</span>
                  <span>{formatCurrency(taxExcluded(customTotal))}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>消費税（10%）</span>
                  <span>{formatCurrency(customTotal - taxExcluded(customTotal))}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                  <span>合計（税込）</span>
                  <span className="text-brand">{formatCurrency(customTotal)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">支払状況</span>
                <button
                  onClick={togglePayment}
                  disabled={paymentSaving}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50
                    ${paymentStatus
                      ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                >
                  {paymentSaving ? '...' : paymentStatus ? `支払済 (${paymentDate})` : '未払い → 支払済にする'}
                </button>
              </div>
            </div>
          </section>

          {/* ⑤ 領収書ボタン */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">書類</h2>
            <div className="space-y-2">
              <a
                href={`/reservations/${reservation.id}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                <DocumentTextIcon className="w-4 h-4" />
                領収書を開く（PDF印刷）
              </a>
              {reservation.pdfUrl && (
                <a
                  href={reservation.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 border border-blue-200 text-blue-700 text-sm rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  引継ぎPDFを開く
                </a>
              )}
            </div>
          </section>

          {/* ステータス操作 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">ステータス変更</h2>
            {/* 予約確定への遷移時のみ来店・終了時間を入力 */}
            {nextStatus === '予約確定' && (
              <div className="space-y-2 pb-1">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">来店時間（例: 8:00）</label>
                  <input
                    type="text"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    placeholder="8:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">終了時間（例: 11:00）</label>
                  <input
                    type="text"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    placeholder="11:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            )}
            {nextStatus && (
              <button
                onClick={() => changeStatus(nextStatus)}
                disabled={loading || (nextStatus === '予約確定' && (!checkInTime || !checkOutTime))}
                className="w-full py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '処理中...' : NEXT_STATUS_LABEL[nextStatus]}
              </button>
            )}
            {nextStatus === '予約確定' && (!checkInTime || !checkOutTime) && (
              <p className="text-xs text-amber-600 text-center">来店時間・終了時間を入力してください</p>
            )}
            {status !== 'キャンセル' && (
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
            {status === '予約済' && reservation.lineUserId && checkInTime && checkOutTime && (
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
