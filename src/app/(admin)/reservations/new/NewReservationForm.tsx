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
  blockedDates?: string[];
  blockedTimeSlots?: Record<string, string[]>;
  holidayDates?: string[];
}

interface SelectedOption {
  optionId: string;
  quantity: number;
}

export default function NewReservationForm({ plans, options, customers, blockedDates = [], blockedTimeSlots = {}, holidayDates = [] }: Props) {
  const blockedDateSet = new Set(blockedDates);
  const holidayDateSet = new Set(holidayDates);
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
  const [childrenDetails, setChildrenDetails] = useState<{
    name: string; furigana: string; gender: string; birthday: string; clothingSize: string;
  }[]>([]);

  // 祝日または土日かどうか
  function isHolidayOrWeekend(d: string) {
    return isWeekend(d) || holidayDateSet.has(d);
  }

  // シーン変更時にプランを自動設定
  function handleSceneChange(s: string) {
    setScene(s);
    const planType = SCENE_PLAN_MAP[s];
    if (planType) {
      const matchingPlan = plans.find((p) =>
        p.name.includes(planType) &&
        (date ? (isHolidayOrWeekend(date) ? p.name.includes('休日') : p.name.includes('平日')) : true)
      );
      if (matchingPlan) setPlanId(matchingPlan.id);
    }
    setTimeSlot('');
  }

  // 日付変更時にプランを再評価
  function handleDateChange(d: string) {
    setDate(d);
    setTimeSlot(''); // 日付変更時に時間帯をリセット
    if (scene) {
      const planType = SCENE_PLAN_MAP[scene];
      if (planType) {
        const holiday = isHolidayOrWeekend(d);
        const matchingPlan = plans.find((p) =>
          p.name.includes(planType) &&
          (holiday ? p.name.includes('休日') : p.name.includes('平日'))
        );
        if (matchingPlan) setPlanId(matchingPlan.id);
      }
    }
  }

  const isDateBlocked = date ? blockedDateSet.has(date) : false;
  const dateBlockedSlots = date ? (blockedTimeSlots[date] ?? []) : [];

  function handleChildrenCountChange(val: string) {
    setChildrenCount(val);
    const n = parseInt(val) || 0;
    setChildrenDetails((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ name: '', furigana: '', gender: '', birthday: '', clothingSize: '' });
      return next.slice(0, n);
    });
  }

  function updateChildDetail(index: number, field: string, value: string) {
    setChildrenDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
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
        peopleCount: `お子様${childrenCount || 0}名・大人の方${adultCount || 0}名`,
        childrenCount: Number(childrenCount) || 0,
        adultCount,
        childrenDetail: childrenDetails.length > 0
          ? childrenDetails.map((c, i) =>
              `${i + 1}人目: ${c.name}（${c.furigana}）（${c.gender}）${c.birthday} / ${c.clothingSize}`
            ).join('\n') + (familyNote ? `\n${familyNote}` : '')
          : familyNote,
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

        {isVisit ? (
          <div>
            <label className="block text-sm text-gray-500 mb-1">撮影シーン（任意）</label>
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
        ) : (
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
            {date && isDateBlocked && (
              <p className="text-xs mt-1 text-red-500 font-medium">
                この日は休業日です（予約不可）
              </p>
            )}
            {date && !isDateBlocked && (
              <p className="text-xs mt-1 text-gray-400">
                {isHolidayOrWeekend(date) ? '🏖 休日料金' : '📅 平日料金'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">時間帯 *</label>
            {isVisit ? (
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                required
                disabled={isDateBlocked}
              >
                <option value="">選択...</option>
                {['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map((t) => {
                  const slotBlocked = dateBlockedSlots.includes(t);
                  return (
                    <option key={t} value={t} disabled={slotBlocked}>
                      {t}{slotBlocked ? '（休業中）' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                required
                disabled={isDateBlocked}
              >
                <option value="">選択...</option>
                {timeSlots.map((t) => {
                  const slotBlocked = dateBlockedSlots.includes(t);
                  return (
                    <option key={t} value={t} disabled={slotBlocked}>
                      {t}{slotBlocked ? '（予約不可）' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">お子様人数</label>
            <input
              type="number"
              value={childrenCount}
              onChange={(e) => handleChildrenCountChange(e.target.value)}
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

        {childrenDetails.map((child, i) => (
          <div key={i} className="border border-brand rounded-xl p-4 space-y-3 bg-brand-light/40">
            <p className="text-sm font-semibold text-brand">お子様 {i + 1}人目</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">お名前</label>
                <input
                  type="text"
                  value={child.name}
                  onChange={(e) => updateChildDetail(i, 'name', e.target.value)}
                  placeholder="例：さくら"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">フリガナ</label>
                <input
                  type="text"
                  value={child.furigana}
                  onChange={(e) => updateChildDetail(i, 'furigana', e.target.value)}
                  placeholder="例：サクラ"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">生年月日</label>
                <input
                  type="date"
                  value={child.birthday}
                  onChange={(e) => updateChildDetail(i, 'birthday', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">性別</label>
                <div className="flex gap-2">
                  {['男の子', '女の子'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => updateChildDetail(i, 'gender', g)}
                      className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors
                        ${child.gender === g
                          ? 'border-brand bg-brand-light text-brand-dark font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">洋服サイズ</label>
                <input
                  type="text"
                  value={child.clothingSize}
                  onChange={(e) => updateChildDetail(i, 'clothingSize', e.target.value)}
                  placeholder="例：100cm"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>
          </div>
        ))}

        <div>
          <label className="block text-sm text-gray-500 mb-1">構成メモ</label>
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
          disabled={loading || isDateBlocked}
          className={`px-8 py-2.5 font-medium rounded-lg disabled:opacity-50 transition-colors text-white
            ${isVisit ? 'bg-purple-500 hover:bg-purple-600' : 'bg-brand hover:bg-brand-dark'}`}
        >
          {isDateBlocked ? '休業日のため登録不可' : loading ? '登録中...' : isVisit ? '見学を登録する' : '予約を登録する'}
        </button>
      </div>
    </form>
  );
}
