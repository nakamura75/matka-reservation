'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, Option, Customer } from '@/types';
import { ALL_TIME_SLOTS, SHICHIGOSAN_TIME_SLOTS, SHOOTING_SCENES, SCENE_PLAN_MAP } from '@/lib/constants';
import { isWeekend, formatCurrency } from '@/lib/utils';

interface Props {
  plans: Plan[];
  options: Option[];
  customers: Customer[];
}

interface SelectedOption {
  optionId: string;
  quantity: number;
}

export default function NewReservationForm({ plans, options, customers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // フォーム状態
  const [isVisit, setIsVisit] = useState(false);
  const [scene, setScene] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [planId, setPlanId] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [note, setNote] = useState('');

  // 顧客選択 or 新規入力
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [childrenCount, setChildrenCount] = useState('');
  const [adultCount, setAdultCount] = useState('');
  const [familyNote, setFamilyNote] = useState('');

  // シーン変更時にプランを自動設定
  function handleSceneChange(s: string) {
    setScene(s);
    const planType = SCENE_PLAN_MAP[s];
    if (planType) {
      const matchingPlan = plans.find((p) =>
        p.name.includes(planType) &&
        (date ? (isWeekend(date) ? p.name.includes('休日') : p.name.includes('平日')) : true)
      );
      if (matchingPlan) setPlanId(matchingPlan.id);
    }
    setTimeSlot('');
  }

  // 日付変更時にプランを再評価
  function handleDateChange(d: string) {
    setDate(d);
    if (scene) {
      const planType = SCENE_PLAN_MAP[scene];
      if (planType) {
        const weekend = isWeekend(d);
        const matchingPlan = plans.find((p) =>
          p.name.includes(planType) &&
          (weekend ? p.name.includes('休日') : p.name.includes('平日'))
        );
        if (matchingPlan) setPlanId(matchingPlan.id);
      }
    }
  }

  // オプション変更
  function toggleOption(optionId: string) {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.optionId === optionId);
      if (exists) return prev.filter((o) => o.optionId !== optionId);
      return [...prev, { optionId, quantity: 1 }];
    });
  }

  function setOptionQty(optionId: string, quantity: number) {
    setSelectedOptions((prev) =>
      prev.map((o) => (o.optionId === optionId ? { ...o, quantity } : o))
    );
  }

  // 料金計算
  const selectedPlan = plans.find((p) => p.id === planId);
  const optionTotal = selectedOptions.reduce((sum, so) => {
    const opt = options.find((o) => o.id === so.optionId);
    return sum + (opt?.price ?? 0) * so.quantity;
  }, 0);
  const total = (selectedPlan?.price ?? 0) + optionTotal;

  const timeSlots = scene === '七五三' ? SHICHIGOSAN_TIME_SLOTS : ALL_TIME_SLOTS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isVisit && (!scene || !date || !timeSlot || !planId)) {
      setError('撮影シーン、日付、時間帯、プランは必須です');
      return;
    }
    if (isVisit && (!date || !timeSlot)) {
      setError('日付、時間帯は必須です');
      return;
    }

    const customer =
      customerMode === 'existing'
        ? customers.find((c) => c.id === selectedCustomerId)
        : null;

    if (customerMode === 'existing' && !customer) {
      setError('顧客を選択してください');
      return;
    }
    if (customerMode === 'new' && !customerName) {
      setError('顧客名は必須です');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        scene,
        planId,
        date,
        timeSlot,
        customerName: customer?.name ?? customerName,
        furigana: customer?.furigana ?? furigana,
        zipCode: customer?.zipCode ?? zipCode,
        address: customer?.address ?? address,
        phone: customer?.phone ?? phone,
        email: customer?.email ?? email,
        peopleCount: adultCount,
        childrenDetail: familyNote,
        selectedOptions,
        note,
        cancelPolicyAgreed: true,
        isVisit,
        existingCustomerId: customerMode === 'existing' ? selectedCustomerId : undefined,
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/reservations/${data.data.reservationId}`);
      } else {
        setError(data.error ?? '予約の登録に失敗しました');
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 予約種別トグル */}
      <div className="flex items-center gap-3">
        <div className="flex text-sm rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsVisit(false)}
            className={`px-4 py-2 transition-colors ${!isVisit ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            撮影予約
          </button>
          <button
            type="button"
            onClick={() => setIsVisit(true)}
            className={`px-4 py-2 transition-colors ${isVisit ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            見学
          </button>
        </div>
        {isVisit && (
          <span className="text-sm text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
            カレンダーに紫色で表示・枠ブロックなし
          </span>
        )}
      </div>

      {/* 撮影情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">{isVisit ? '見学情報' : '撮影情報'}</h2>

        {!isVisit && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">撮影シーン *</label>
              <select
                value={scene}
                onChange={(e) => handleSceneChange(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">選択...</option>
                {SHOOTING_SCENES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">プラン *</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">選択...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}（{formatCurrency(p.price)}）</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">撮影日 *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
            />
            {date && (
              <p className="text-xs mt-1 text-gray-400">
                {isWeekend(date) ? '🏖 休日料金' : '📅 平日料金'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">時間帯 *</label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
              required
            >
              <option value="">選択...</option>
              {timeSlots.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">お子様人数</label>
            <input
              type="number"
              value={childrenCount}
              onChange={(e) => setChildrenCount(e.target.value)}
              min={0}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">大人人数</label>
            <input
              type="number"
              value={adultCount}
              onChange={(e) => setAdultCount(e.target.value)}
              min={0}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">家族構成メモ</label>
          <textarea
            value={familyNote}
            onChange={(e) => setFamilyNote(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
            placeholder="例: 長男5歳・長女7歳"
          />
        </div>
      </section>

      {/* オプション（見学時は非表示） */}
      {!isVisit && <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-700">オプション</h2>
        <div className="space-y-2">
          {options.map((opt) => {
            const selected = selectedOptions.find((so) => so.optionId === opt.id);
            return (
              <div key={opt.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`opt-${opt.id}`}
                  checked={!!selected}
                  onChange={() => toggleOption(opt.id)}
                  className="w-4 h-4 accent-brand"
                />
                <label htmlFor={`opt-${opt.id}`} className="flex-1 text-sm text-gray-700 cursor-pointer">
                  {opt.name}
                  <span className="text-gray-400 ml-2">{formatCurrency(opt.price)}</span>
                </label>
                {selected && (
                  <input
                    type="number"
                    min={1}
                    value={selected.quantity}
                    onChange={(e) => setOptionQty(opt.id, Number(e.target.value))}
                    className="w-16 text-sm text-center border border-gray-200 rounded px-2 py-1"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>}

      {/* 顧客情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-700">顧客情報</h2>
          <div className="flex text-sm rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setCustomerMode('new')}
              className={`px-3 py-1.5 transition-colors ${customerMode === 'new' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              新規
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode('existing')}
              className={`px-3 py-1.5 transition-colors ${customerMode === 'existing' ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              既存顧客
            </button>
          </div>
        </div>

        {customerMode === 'existing' ? (
          <div className="relative">
            <label className="block text-sm text-gray-500 mb-1">顧客を検索・選択</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomerId('');
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
              placeholder="名前・電話番号で検索..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {showCustomerDropdown && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                {customers
                  .filter((c) =>
                    customerSearch === '' ||
                    c.name.includes(customerSearch) ||
                    (c.furigana ?? '').includes(customerSearch) ||
                    (c.phone ?? '').includes(customerSearch)
                  )
                  .map((c) => (
                    <li
                      key={c.id}
                      onMouseDown={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch(`${c.name}（${c.phone}）`);
                        setShowCustomerDropdown(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-brand-light ${selectedCustomerId === c.id ? 'bg-brand-light font-medium' : ''}`}
                    >
                      {c.name}
                      <span className="text-gray-400 ml-2">{c.phone}</span>
                    </li>
                  ))}
                {customers.filter((c) =>
                  customerSearch === '' ||
                  c.name.includes(customerSearch) ||
                  (c.furigana ?? '').includes(customerSearch) ||
                  (c.phone ?? '').includes(customerSearch)
                ).length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-400">該当する顧客が見つかりません</li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">氏名 *</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">フリガナ</label>
              <input type="text" value={furigana} onChange={(e) => setFurigana(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">電話番号 *</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">メールアドレス</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">郵便番号</label>
              <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">住所</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        )}
      </section>

      {/* 備考 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">備考</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          placeholder="スタッフメモ..."
        />
      </section>

      {/* 合計・送信 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
        {!isVisit ? (
          <div className="text-sm">
            <span className="text-gray-400">合計（税込）</span>
            <span className="text-xl font-bold text-gray-900 ml-3">{formatCurrency(total)}</span>
          </div>
        ) : (
          <span className="text-sm text-purple-600 font-medium">見学として登録</span>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`px-8 py-2.5 font-medium rounded-lg disabled:opacity-50 transition-colors text-white
            ${isVisit ? 'bg-purple-500 hover:bg-purple-600' : 'bg-brand hover:bg-brand-dark'}`}
        >
          {loading ? '登録中...' : isVisit ? '見学を登録する' : '予約を登録する'}
        </button>
      </div>
    </form>
  );
}
