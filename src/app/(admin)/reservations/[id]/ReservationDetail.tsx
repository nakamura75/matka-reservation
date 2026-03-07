'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PencilSquareIcon, DocumentTextIcon, UserGroupIcon, CheckIcon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Reservation, Customer, Plan, ReservationOption, Staff, StaffAssignment, Product, Option } from '@/types';
import { formatDate, formatCurrency, isWeekend } from '@/lib/utils';
import { PLAN_STAFF_BREAKDOWN, HOLIDAY_FEE, STORE_STAFF_ID } from '@/lib/constants';

type OptionWithInfo = ReservationOption & { optionName: string; price: number };
type LinkedOrder = { id: string; orderDate: string; isPaid: boolean; total: number; itemCount: number };
type NewOrderItem = { productId: string; productName: string; price: number; quantity: number };

// ① 表示ラベル（DBの値 '予約済' は変えない）
const STATUS_LABEL: Record<Reservation['status'], string> = {
  '予約済': '仮予約',
  '予約確定': '予約確定',
  '見学': '見学',
  '完了': '完了',
  'キャンセル': 'キャンセル',
};

const STATUS_COLORS = {
  '予約済': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '予約確定': 'bg-blue-100 text-blue-800 border-blue-200',
  '見学': 'bg-purple-100 text-purple-700 border-purple-200',
  '完了': 'bg-green-100 text-green-800 border-green-200',
  'キャンセル': 'bg-gray-100 text-gray-500 border-gray-200',
} as const;

const NEXT_STATUS: Record<Reservation['status'], Reservation['status'] | null> = {
  '予約済': '予約確定',
  '予約確定': null, // 完了は予約日経過で自動
  '見学': null,
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
  allOptions: Option[];
  staff: Staff[];
  products: Product[];
  linkedOrders: LinkedOrder[];
}

function parseAssignment(json?: string): StaffAssignment {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export default function ReservationDetail({ reservation, customer, plan, options: initialOptions, allOptions, staff, products, linkedOrders: initialLinkedOrders }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(reservation.status);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(reservation.note ?? '');
  const [checkInTime, setCheckInTime] = useState(reservation.checkInTime ?? '');
  const [checkOutTime, setCheckOutTime] = useState(reservation.checkOutTime ?? '');
  const [saving, setSaving] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [lineIdInput, setLineIdInput] = useState('');
  const [lineIdSaving, setLineIdSaving] = useState(false);

  // 削除
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        router.push('/reservations');
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // 商品注文
  const [linkedOrders, setLinkedOrders] = useState(initialLinkedOrders);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
  const [addingProductId, setAddingProductId] = useState('');
  const [addingQty, setAddingQty] = useState(1);
  const [orderCreating, setOrderCreating] = useState(false);

  function handleAddToOrder() {
    if (!addingProductId) return;
    const product = products.find((p) => p.id === addingProductId);
    if (!product) return;
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.productId === addingProductId);
      if (existing) {
        return prev.map((i) => i.productId === addingProductId ? { ...i, quantity: i.quantity + addingQty } : i);
      }
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: addingQty }];
    });
    setAddingProductId('');
    setAddingQty(1);
  }

  async function handleCreateOrder() {
    if (orderItems.length === 0) return;
    setOrderCreating(true);
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: reservation.customerId, reservationId: reservation.id }),
      });
      const orderData = await orderRes.json();
      if (!orderData.success) return;
      const orderId = orderData.data.id as string;

      await Promise.all(
        orderItems.map((item) =>
          fetch(`/api/orders/${orderId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
          })
        )
      );

      const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      setLinkedOrders((prev) => [
        ...prev,
        { id: orderId, orderDate: new Date().toLocaleDateString('ja-JP'), isPaid: false, total, itemCount: orderItems.length },
      ]);
      // 自動計算モードなら合計を連動更新
      setGrandTotal((prev) => {
        const autoTotal = computedTotal + linkedOrders.reduce((s, o) => s + o.total, 0);
        return prev === autoTotal ? autoTotal + total : prev;
      });
      setShowOrderForm(false);
      setOrderItems([]);
    } finally {
      setOrderCreating(false);
    }
  }
  const [paymentStatus, setPaymentStatus] = useState(reservation.paymentStatus);
  const [paymentDate, setPaymentDate] = useState(reservation.paymentDate ?? '');
  const [paymentMethod, setPaymentMethod] = useState(reservation.paymentMethod ?? '');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  // 予約情報編集
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [editDate, setEditDate] = useState(reservation.date ?? '');
  const [editTimeSlot, setEditTimeSlot] = useState<Reservation['timeSlot']>(reservation.timeSlot ?? '9:00');
  const [editScene, setEditScene] = useState(reservation.scene ?? '');
  const [editOtherSceneNote, setEditOtherSceneNote] = useState(reservation.otherSceneNote ?? '');
  const [editChildrenCount, setEditChildrenCount] = useState(String(reservation.childrenCount ?? ''));
  const [editAdultCount, setEditAdultCount] = useState(reservation.adultCount ?? '');
  const [editFamilyNote, setEditFamilyNote] = useState(reservation.familyNote ?? '');
  const [editCustomerNote, setEditCustomerNote] = useState(reservation.customerNote ?? '');
  const [editPhonePreference, setEditPhonePreference] = useState(reservation.phonePreference ?? '');

  function cancelInfoEdit() {
    setEditDate(reservation.date ?? '');
    setEditTimeSlot(reservation.timeSlot ?? '9:00');
    setEditScene(reservation.scene ?? '');
    setEditOtherSceneNote(reservation.otherSceneNote ?? '');
    setEditChildrenCount(String(reservation.childrenCount ?? ''));
    setEditAdultCount(reservation.adultCount ?? '');
    setEditFamilyNote(reservation.familyNote ?? '');
    setEditCustomerNote(reservation.customerNote ?? '');
    setEditPhonePreference(reservation.phonePreference ?? '');
    setInfoEditing(false);
  }

  async function saveInfo() {
    setInfoSaving(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editDate,
          timeSlot: editTimeSlot,
          scene: editScene || undefined,
          otherSceneNote: editOtherSceneNote,
          childrenCount: editChildrenCount !== '' ? Number(editChildrenCount) : '',
          adultCount: editAdultCount,
          familyNote: editFamilyNote,
          customerNote: editCustomerNote,
          phonePreference: editPhonePreference,
        }),
      });
      if (res.ok) {
        setInfoEditing(false);
        router.refresh();
      } else {
        alert('保存に失敗しました');
      }
    } finally {
      setInfoSaving(false);
    }
  }

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

  // オプション state（追加・削除でリアクティブに更新）
  const [currentOptions, setCurrentOptions] = useState<OptionWithInfo[]>(initialOptions);
  const [addingOptionId, setAddingOptionId] = useState('');
  const [addingOptionQty, setAddingOptionQty] = useState(1);
  const [optionAdding, setOptionAdding] = useState(false);
  const [optionDeleting, setOptionDeleting] = useState<string | null>(null);

  async function handleAddOption() {
    if (!addingOptionId) return;
    const master = allOptions.find((o) => o.id === addingOptionId);
    if (!master) return;
    setOptionAdding(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: addingOptionId, quantity: addingOptionQty }),
      });
      const data = await res.json();
      if (!data.success) return;
      const newOpt: OptionWithInfo = {
        ...data.data,
        optionName: master.name,
        price: master.price,
      };
      setCurrentOptions((prev) => [...prev, newOpt]);
      setAddingOptionId('');
      setAddingOptionQty(1);
    } finally {
      setOptionAdding(false);
    }
  }

  async function handleDeleteOption(reservationOptionId: string) {
    const target = currentOptions.find((o) => o.id === reservationOptionId);
    if (!target) return;
    setOptionDeleting(reservationOptionId);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/options`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationOptionId }),
      });
      if (!(await res.json()).success) return;
      setCurrentOptions((prev) => prev.filter((o) => o.id !== reservationOptionId));
    } finally {
      setOptionDeleting(null);
    }
  }

  // 撮影合計（プラン＋オプション）※見学は料金0
  const isVisit = status === '見学';
  const optionTotal = isVisit ? 0 : currentOptions.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const planPrice = isVisit ? 0 : (plan?.price ?? 0);
  const computedTotal = planPrice + optionTotal;

  // 商品合計（linkedOrders の合計）
  const orderItemTotal = linkedOrders.reduce((sum, o) => sum + o.total, 0);
  // 全体合計（直接編集可、デフォルトは自動計算）
  const [grandTotal, setGrandTotal] = useState(computedTotal + orderItemTotal);

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
        body: JSON.stringify({ note, totalAmount: grandTotal }),
      });
      setIsEditingNote(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handlePayWithMethod(method: string) {
    const newDate = new Date().toLocaleDateString('ja-JP');
    setPaymentSaving(true);
    setShowMethodPicker(false);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: true, paymentDate: newDate, paymentMethod: method }),
      });
      if (res.ok) {
        setPaymentStatus(true);
        setPaymentDate(newDate);
        setPaymentMethod(method);
      }
    } finally {
      setPaymentSaving(false);
    }
  }

  async function togglePaymentOff() {
    setPaymentSaving(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: false, paymentDate: '', paymentMethod: '' }),
      });
      if (res.ok) {
        setPaymentStatus(false);
        setPaymentDate('');
        setPaymentMethod('');
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
        {/* 削除ボタン */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          削除
        </button>
        {/* ① 表示ラベル変更 */}
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">予約を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-1">
              {reservation.reservationNumber}
            </p>
            <p className="text-sm text-red-500 mb-4">
              この操作は取り消せません。関連するオプション情報も削除されます。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* 予約情報 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">予約情報</h2>
              {!infoEditing ? (
                <button
                  onClick={() => setInfoEditing(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5" />
                  編集
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveInfo}
                    disabled={infoSaving}
                    className="flex items-center gap-1 text-xs text-white bg-brand hover:bg-brand-dark px-2.5 py-1 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {infoSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={cancelInfoEdit}
                    disabled={infoSaving}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    キャンセル
                  </button>
                </div>
              )}
            </div>
            {infoEditing ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">撮影日</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">時間帯</label>
                  <select
                    value={editTimeSlot}
                    onChange={(e) => setEditTimeSlot(e.target.value as Reservation['timeSlot'])}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {(['9:00', '12:00', '15:00'] as const).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">撮影シーン</label>
                  <select
                    value={editScene}
                    onChange={(e) => setEditScene(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="">—</option>
                    {['七五三', 'マタニティ', 'バースデー', 'ベビー', 'その他'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {(editScene === 'その他' || editOtherSceneNote) && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">希望の撮影シーン（その他）</label>
                    <input
                      type="text"
                      value={editOtherSceneNote}
                      onChange={(e) => setEditOtherSceneNote(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">お子様人数</label>
                  <input
                    type="number"
                    min={0}
                    value={editChildrenCount}
                    onChange={(e) => setEditChildrenCount(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">大人人数</label>
                  <input
                    type="text"
                    value={editAdultCount}
                    onChange={(e) => setEditAdultCount(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">家族構成メモ（生年月日など）</label>
                  <textarea
                    value={editFamilyNote}
                    onChange={(e) => setEditFamilyNote(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">お客様備考</label>
                  <textarea
                    value={editCustomerNote}
                    onChange={(e) => setEditCustomerNote(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">電話希望</label>
                  <input
                    type="text"
                    value={editPhonePreference}
                    onChange={(e) => setEditPhonePreference(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-gray-400">撮影日</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{formatDate(reservation.date)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">時間帯</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{stripSeconds(reservation.timeSlot)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">撮影シーン</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{reservation.scene ?? '—'}</dd>
                </div>
                {reservation.otherSceneNote && (
                  <div className="col-span-2">
                    <dt className="text-gray-400">希望の撮影シーン（その他）</dt>
                    <dd className="font-medium text-gray-900 mt-0.5 whitespace-pre-wrap">{reservation.otherSceneNote}</dd>
                  </div>
                )}
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
                {reservation.customerNote && (
                  <div className="col-span-2">
                    <dt className="text-gray-400">お客様備考</dt>
                    <dd className="font-medium text-gray-900 mt-0.5 whitespace-pre-wrap">{reservation.customerNote}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-400">電話希望</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">{reservation.phonePreference ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">LINE連携</dt>
                  <dd className="mt-0.5">
                    {reservation.chatLineUserId ? (
                      <a
                        href={`https://chat.line.biz/U982d65770fb7074d43e2338084865ff7/chat/${reservation.chatLineUserId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: '#06C755' }}
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C6.477 2 2 6.032 2 11c0 2.99 1.566 5.634 3.988 7.32-.175.614-.635 2.22-.728 2.566-.115.42.154.414.323.302.133-.089 2.11-1.43 2.967-2.012.444.062.898.094 1.45.094 5.523 0 10-4.032 10-9S17.523 2 12 2zm-3.5 12.5h-1.25a.25.25 0 0 1-.25-.25v-4.5a.25.25 0 0 1 .25-.25H8.5a.25.25 0 0 1 .25.25v4.5a.25.25 0 0 1-.25.25zm2.5 0h-1.25a.25.25 0 0 1-.25-.25v-2.5l-1.5-2.087A.25.25 0 0 1 8.2 9.5H9.5a.25.25 0 0 1 .2.1l.8 1.114.8-1.114a.25.25 0 0 1 .2-.1h1.3a.25.25 0 0 1 .2.413L11.5 11.75v2.5a.25.25 0 0 1-.25.25zm5.25 0H13a.25.25 0 0 1-.25-.25v-4.5A.25.25 0 0 1 13 9.5h2.75a.25.25 0 0 1 0 .5H13.5v1.25h2.25a.25.25 0 0 1 0 .5H13.5v1.25h2.75a.25.25 0 0 1 0 .5z"/>
                        </svg>
                        LINEトークを開く
                      </a>
                    ) : reservation.lineUserId ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                        連携済み
                      </span>
                    ) : (
                      <span className="text-gray-400">未連携</span>
                    )}
                  </dd>
                  <dd className="mt-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={lineIdInput}
                        onChange={(e) => setLineIdInput(e.target.value)}
                        placeholder="LINE IDをペースト"
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-0"
                      />
                      <button
                        onClick={async () => {
                          const id = lineIdInput.trim();
                          if (!id) return;
                          setLineIdSaving(true);
                          try {
                            await fetch(`/api/reservations/${reservation.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ lineUserId: id }),
                            });
                            setLineIdInput('');
                            router.refresh();
                          } finally {
                            setLineIdSaving(false);
                          }
                        }}
                        disabled={lineIdSaving || !lineIdInput.trim()}
                        className="shrink-0 text-xs px-2.5 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 whitespace-nowrap"
                      >
                        {lineIdSaving ? '保存中...' : (reservation.lineUserId || reservation.chatLineUserId) ? '更新' : '登録'}
                      </button>
                    </div>
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
            )}
          </section>

          {/* オプション */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">オプション</h2>
            {currentOptions.length === 0 ? (
              <p className="text-sm text-gray-400 mb-3">オプションなし</p>
            ) : (
              <table className="w-full text-sm mb-3">
                <thead className="text-gray-400 text-xs">
                  <tr>
                    <th className="text-left pb-2">オプション名</th>
                    <th className="text-right pb-2">単価</th>
                    <th className="text-right pb-2">数量</th>
                    <th className="text-right pb-2">小計</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentOptions.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 text-gray-700">{o.optionName}</td>
                      <td className="py-2 text-right text-gray-600">{formatCurrency(o.price)}</td>
                      <td className="py-2 text-right text-gray-600">×{o.quantity}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(o.price * o.quantity)}</td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => handleDeleteOption(o.id)}
                          disabled={optionDeleting === o.id}
                          className="text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors"
                          title="削除"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* オプション追加フォーム */}
            <div className="flex gap-1.5 pt-2 border-t border-gray-100">
              <select
                value={addingOptionId}
                onChange={(e) => setAddingOptionId(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-0"
              >
                <option value="">オプションを追加...</option>
                {allOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}（¥{o.price.toLocaleString()}）</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={addingOptionQty}
                onChange={(e) => setAddingOptionQty(Math.max(1, Number(e.target.value)))}
                className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button
                onClick={handleAddOption}
                disabled={optionAdding || !addingOptionId}
                className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {optionAdding ? '追加中...' : '追加'}
              </button>
            </div>
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
              {currentOptions.map((o) => (
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
              {!isEditingNote && (
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className="ml-auto text-xs text-brand hover:text-brand-dark border border-brand/30 rounded px-2 py-0.5"
                >
                  編集
                </button>
              )}
            </h2>
            {isEditingNote ? (
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
                      value={grandTotal}
                      onChange={(e) => setGrandTotal(Number(e.target.value))}
                      className="w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                      min={0}
                    />
                    <button
                      type="button"
                      onClick={() => setGrandTotal(computedTotal + orderItemTotal)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      自動計算に戻す
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">自動計算: {formatCurrency(computedTotal + orderItemTotal)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    className="px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNote(reservation.note ?? '');
                      setGrandTotal(computedTotal + orderItemTotal);
                      setIsEditingNote(false);
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-gray-900">
                <div>
                  <p className="text-xs text-gray-400 mb-1">備考</p>
                  {note ? (
                    <p className="whitespace-pre-wrap">{note}</p>
                  ) : (
                    <p className="text-gray-400">なし</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">合計金額（税込）</p>
                  <p className="font-semibold">{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            )}
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
              {/* 撮影 */}
              <div className="flex justify-between text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                <span>撮影</span>
              </div>
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
              <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-2">
                <span>撮影合計</span>
                <span>{formatCurrency(computedTotal)}</span>
              </div>

              {/* 商品 */}
              {orderItemTotal > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-xs font-semibold uppercase tracking-wide mt-3 mb-1">
                    <span>商品</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-800">
                    <span>商品合計</span>
                    <span>{formatCurrency(orderItemTotal)}</span>
                  </div>
                </>
              )}

              {/* 全体合計 */}
              <div className="pt-3 mt-1 border-t border-gray-200 space-y-1">
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>税抜合計</span>
                  <span>{formatCurrency(taxExcluded(grandTotal))}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>消費税（10%）</span>
                  <span>{formatCurrency(grandTotal - taxExcluded(grandTotal))}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                  <span>合計（税込）</span>
                  <span className="text-brand">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">支払状況</span>
                {paymentStatus ? (
                  <button
                    onClick={togglePaymentOff}
                    disabled={paymentSaving}
                    className="px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200 hover:bg-green-200 disabled:opacity-50 transition-colors"
                  >
                    {paymentSaving ? '...' : `支払済 ${paymentMethod ? `(${paymentMethod})` : ''} ${paymentDate}`}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMethodPicker((v) => !v)}
                    disabled={paymentSaving}
                    className="px-3 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {paymentSaving ? '...' : '未払い → 支払済にする'}
                  </button>
                )}
              </div>
              {showMethodPicker && !paymentStatus && (
                <div className="flex gap-2 justify-end">
                  {['現金', 'カード', '振込'].map((method) => (
                    <button
                      key={method}
                      onClick={() => handlePayWithMethod(method)}
                      disabled={paymentSaving}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50"
                    >
                      {method}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 商品注文 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">商品注文</h2>
              {!showOrderForm && (
                <button
                  onClick={() => setShowOrderForm(true)}
                  className="flex items-center gap-1 text-xs text-brand hover:text-brand-dark"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  注文を追加
                </button>
              )}
            </div>

            {/* 既存の注文リスト */}
            {linkedOrders.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {linkedOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <span className="text-gray-600">{order.orderDate}（{order.itemCount}点）</span>
                      <div className="flex items-center gap-2">
                        {order.total > 0 && <span className="text-gray-700">¥{order.total.toLocaleString()}</span>}
                        <span className={`px-1.5 py-0.5 rounded-full ${order.isPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {order.isPaid ? '入金済' : '未入金'}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {linkedOrders.length === 0 && !showOrderForm && (
              <p className="text-sm text-gray-400">注文なし</p>
            )}

            {/* 新規注文フォーム */}
            {showOrderForm && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                {/* 商品選択行 */}
                <div className="flex gap-1.5">
                  <select
                    value={addingProductId}
                    onChange={(e) => setAddingProductId(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 min-w-0"
                  >
                    <option value="">商品を選択</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}（¥{p.price.toLocaleString()}）</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={addingQty}
                    onChange={(e) => setAddingQty(Math.max(1, Number(e.target.value)))}
                    className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <button
                    onClick={handleAddToOrder}
                    disabled={!addingProductId}
                    className="shrink-0 text-xs px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40"
                  >
                    追加
                  </button>
                </div>

                {/* 追加済みアイテム */}
                {orderItems.length > 0 && (
                  <ul className="space-y-1">
                    {orderItems.map((item, i) => (
                      <li key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-gray-50 rounded-lg">
                        <span className="text-gray-700">{item.productName} × {item.quantity}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">¥{(item.price * item.quantity).toLocaleString()}</span>
                          <button
                            onClick={() => setOrderItems((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                    <li className="flex justify-end text-xs font-medium text-gray-700 pt-1 pr-1">
                      合計 ¥{orderItems.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}
                    </li>
                  </ul>
                )}

                {/* 保存・キャンセル */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateOrder}
                    disabled={orderCreating || orderItems.length === 0}
                    className="flex-1 text-xs py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
                  >
                    {orderCreating ? '作成中...' : '注文として保存'}
                  </button>
                  <button
                    onClick={() => { setShowOrderForm(false); setOrderItems([]); setAddingProductId(''); setAddingQty(1); }}
                    className="px-3 py-2 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
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
            {/* 確定済みの場合は来店・終了時間を表示 */}
            {status !== '予約済' && (checkInTime || checkOutTime) && (
              <div className="space-y-1 text-sm pb-1">
                {checkInTime && (
                  <p className="text-gray-700"><span className="text-xs text-gray-400 mr-2">来店時間</span>{checkInTime}</p>
                )}
                {checkOutTime && (
                  <p className="text-gray-700"><span className="text-xs text-gray-400 mr-2">終了時間</span>{checkOutTime}</p>
                )}
              </div>
            )}
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
