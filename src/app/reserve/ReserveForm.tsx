'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Plan, Option, AvailableSlot, ShootingScene, TimeSlot } from '@/types';
import { SHOOTING_SCENES, SCENE_PLAN_MAP, LIFF_ID } from '@/lib/constants';
import { formatCurrency, formatDate, isWeekend } from '@/lib/utils';

// ============================================================
// キャンセルポリシー全文
// ============================================================
const CANCEL_POLICY = `※本予約確定後のキャンセルにつきましては、
下記の通りキャンセル料を頂戴いたします。

・撮影日2日前まで：無料
・撮影日前日：ご予約料金の50％
・撮影日当日：ご予約料金の100％
・無断キャンセル：ご予約料金の100％

※日程変更後の撮影キャンセルにつきましては、
理由を問わずご予約料金の100％をキャンセル料として頂戴いたします。

※撮影日前日および当日に日程変更をご希望の場合は、
原則として【1か月以内】の日程にて変更をお願いいたします。

※オプション内容や点数の変更により、
撮影時間やお日にちの調整をお願いする場合がございます。`;

// ============================================================
// ステップインジケーター
// ============================================================
const STEPS = ['シーン・日時', 'お客様情報', '撮影情報', 'オプション', '確認・送信'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="py-3 px-4">
      {/* 丸とライン */}
      <div className="flex items-center justify-center">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
              ${i < current ? 'bg-brand text-white' :
                i === current ? 'bg-brand-light text-brand ring-2 ring-brand' :
                'bg-gray-100 text-gray-400'}`}
            >
              {i < current ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < current ? 'bg-brand' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      {/* 現在のステップ名 */}
      <p className="text-center text-xs text-brand font-medium mt-1">
        {STEPS[current]}
      </p>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function ReserveForm() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [reservationNumber, setReservationNumber] = useState('');
  const [isInLine, setIsInLine] = useState(false);
  const [lineUserId, setLineUserId] = useState('');
  const [lineName, setLineName] = useState('');

  // マスタデータ
  const [plans, setPlans] = useState<Plan[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarYM, setCalendarYM] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  // STEP 1
  const [scene, setScene] = useState<ShootingScene | ''>('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<TimeSlot | ''>('');
  const [planId, setPlanId] = useState('');

  // STEP 2
  const [name, setName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [zip, setZip] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // STEP 3
  const [childrenCount, setChildrenCount] = useState('');
  const [adultCount, setAdultCount] = useState('');
  const [childrenDetails, setChildrenDetails] = useState<{
    name: string; gender: string; birthday: string; clothingSize: string;
  }[]>([]);

  // STEP 4
  const [selectedOptions, setSelectedOptions] = useState<{ optionId: string; quantity: number }[]>([]);

  // STEP 5
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // LIFF 初期化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const liffId = LIFF_ID;
    if (!liffId) return;

    import('@line/liff').then((liff) => {
      liff.default.init({ liffId })
        .then(() => {
          if (liff.default.isInClient()) {
            setIsInLine(true);
            liff.default.getProfile().then((profile) => {
              setLineUserId(profile.userId);
              setLineName(profile.displayName);
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }).catch(() => {});
  }, []);

  // マスタデータ取得
  useEffect(() => {
    fetch('/api/plans').then(r => r.json()).then(d => setPlans(d.data ?? []));
    fetch('/api/options').then(r => r.json()).then(d => setOptions(d.data ?? []));
  }, []);

  // plans ロード後（またはシーン・日付変更後）に planId を再評価
  useEffect(() => {
    if (plans.length === 0 || !scene) return;
    const planType = SCENE_PLAN_MAP[scene];
    const weekend = selectedDate ? isWeekend(selectedDate) : false;
    const match =
      plans.find((p) => p.name.includes(planType) && p.name.includes(selectedDate && weekend ? '休日' : '平日'))
      ?? plans.find((p) => p.name.includes(planType))
      ?? plans[0];
    if (match) setPlanId(match.id);
  }, [plans, scene, selectedDate]);

  // 空き枠取得
  const fetchSlots = useCallback(async (s: ShootingScene) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/slots?scene=${encodeURIComponent(s)}`);
      const data = await res.json();
      setSlots(data.data ?? []);
      if (!data.success) {
        console.error('[fetchSlots] API error:', data.error);
      }
    } catch (err) {
      console.error('[fetchSlots] fetch error:', err);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  function handleSceneChange(s: ShootingScene) {
    setScene(s);
    setSelectedDate('');
    setSelectedTime('');
    const t = new Date();
    setCalendarYM({ year: t.getFullYear(), month: t.getMonth() });
    const planType = SCENE_PLAN_MAP[s];
    const match = plans.find((p) => p.name.includes(planType) && p.name.includes('平日'))
      ?? plans.find((p) => p.name.includes(planType))
      ?? plans[0];
    if (match) setPlanId(match.id);
    fetchSlots(s);
  }

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime('');
    if (scene) {
      const planType = SCENE_PLAN_MAP[scene];
      const weekend = isWeekend(dateStr);
      const match = plans.find((p) =>
        p.name.includes(planType) && (weekend ? p.name.includes('休日') : p.name.includes('平日'))
      ) ?? plans.find((p) => p.name.includes(planType)) ?? plans[0];
      if (match) setPlanId(match.id);
    }
  }

  function toggleOption(optionId: string) {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.optionId === optionId);
      if (exists) return prev.filter((o) => o.optionId !== optionId);
      return [...prev, { optionId, quantity: 1 }];
    });
  }

  function handleChildrenCountChange(val: string) {
    setChildrenCount(val);
    const n = parseInt(val) || 0;
    setChildrenDetails((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ name: '', gender: '', birthday: '', clothingSize: '' });
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

  function setOptionQty(optionId: string, quantity: number) {
    setSelectedOptions((prev) =>
      prev.map((o) => (o.optionId === optionId ? { ...o, quantity } : o))
    );
  }

  // 選択済みスロット情報
  const selectedSlot = slots.find((s) => s.date === selectedDate);
  const availableTimesForDate = selectedSlot?.slots.filter((s) => s.available) ?? [];
  const selectedPlan = plans.find((p) => p.id === planId);
  const optionTotal = selectedOptions.reduce((sum, so) => {
    const opt = options.find((o) => o.id === so.optionId);
    return sum + (opt?.price ?? 0) * so.quantity;
  }, 0);
  const total = (selectedPlan?.price ?? 0) + optionTotal;

  async function handleSubmit() {
    if (!agreed) { setError('キャンセルポリシーへの同意が必要です'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene,
          planId,
          date: selectedDate,
          timeSlot: selectedTime,
          customerName: name,
          furigana,
          zipCode: zip,
          address,
          phone,
          email,
          peopleCount: `お子様${childrenCount}名・大人の方${adultCount === '5以上' ? '5名以上' : adultCount + '名'}`,
          childrenDetail: childrenDetails.length > 0
            ? childrenDetails.map((c, i) =>
                `${i + 1}人目: ${c.name}（${c.gender}）${c.birthday} ${c.clothingSize}`
              ).join('\n')
            : '',
          selectedOptions,
          note,
          cancelPolicyAgreed: true,
          lineUserId,
          lineName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReservationNumber(data.data.reservationNumber);
        setSubmitted(true);
      } else {
        setError(data.error ?? '送信に失敗しました');
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // 送信完了画面
  // ============================================================
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-cream-dark p-8">
          <CheckCircleIcon className="w-16 h-16 text-brand-green mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">仮予約を受け付けました</h2>
          <p className="text-sm text-gray-500 mb-6">
            3日以内に担当者よりご連絡いたします。
          </p>

          <div className="bg-brand-light rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">予約番号</p>
            <p className="text-2xl font-bold text-brand tracking-wide">{reservationNumber}</p>
          </div>

          {!isInLine && (
            <div className="bg-brand-green-light border border-brand-green/30 rounded-xl p-4 text-left">
              <p className="text-sm font-semibold text-brand-green mb-2">📲 LINEで予約番号を送信してください</p>
              <p className="text-xs text-brand-green/80 mb-3">
                予約内容の確認・通知をLINEで受け取るために、友だち追加後に以下のメッセージを送信してください。
              </p>
              <div className="bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-800 border border-brand-green/20 mb-3">
                matka予約: {reservationNumber}
              </div>
              <a
                href={`https://line.me/R/ti/p/@671kcyek`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 bg-[#06C755] text-white text-sm font-medium rounded-lg hover:bg-[#05a847] transition-colors"
              >
                LINE友だち追加
              </a>
            </div>
          )}

          {isInLine && (
            <p className="text-sm text-brand-green bg-brand-green-light rounded-xl p-3">
              ✅ LINEで予約確認メッセージをお送りしました
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // STEP 1: シーン・日時選択
  // ============================================================
  function renderStep0() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">撮影シーンを選択</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SHOOTING_SCENES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSceneChange(s as ShootingScene)}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors
                  ${scene === s
                    ? 'border-brand bg-brand-light text-brand-dark'
                    : 'border-gray-200 text-gray-600 hover:border-brand/30 hover:bg-brand-light'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {scene && (
          <div>
            {scene === 'その他' && (
              <p className="text-xs text-red-500 mb-2">※「その他」を選んだ方は、備考欄にて撮影したいシーンをお知らせください。</p>
            )}
            <h2 className="text-base font-bold text-gray-900 mb-3">撮影日を選択</h2>
            {loadingSlots ? (
              <div className="text-center py-8 text-gray-400 text-sm">空き枠を確認中...</div>
            ) : (
              <div className="border border-cream-dark rounded-2xl p-3 bg-white">
                {/* 月ナビゲーション */}
                {(() => {
                  const today = new Date();
                  const minY = today.getFullYear(), minM = today.getMonth();
                  const future = new Date(today); future.setDate(today.getDate() + 60);
                  const maxY = future.getFullYear(), maxM = future.getMonth();
                  const { year, month } = calendarYM;
                  const canPrev = year > minY || month > minM;
                  const canNext = year < maxY || (year === maxY && month < maxM);
                  return (
                    <div className="flex items-center justify-between mb-3">
                      <button type="button" onClick={() => setCalendarYM(({ year: y, month: m }) => { const d = new Date(y, m - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} disabled={!canPrev} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-20 disabled:cursor-not-allowed">
                        <ChevronLeftIcon className="w-4 h-4 text-gray-500" />
                      </button>
                      <span className="text-sm font-semibold text-gray-700">{calendarYM.year}年{calendarYM.month + 1}月</span>
                      <button type="button" onClick={() => setCalendarYM(({ year: y, month: m }) => { const d = new Date(y, m + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} disabled={!canNext} className="p-1.5 rounded-lg hover:bg-cream disabled:opacity-20 disabled:cursor-not-allowed">
                        <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  );
                })()}
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 mb-1">
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
                  ))}
                </div>
                {/* カレンダーグリッド */}
                <div className="grid grid-cols-7 gap-0.5">
                  {(() => {
                    const { year, month } = calendarYM;
                    const slotMap = new Map(slots.map(s => [s.date, s]));
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                    const firstDow = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const cells: (string | null)[] = Array(firstDow).fill(null);
                    for (let d = 1; d <= daysInMonth; d++) {
                      cells.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
                    }
                    while (cells.length % 7 !== 0) cells.push(null);
                    return cells.map((dateStr, idx) => {
                      if (!dateStr) return <div key={`e${idx}`} />;
                      const day = parseInt(dateStr.slice(8));
                      const slot = slotMap.get(dateStr);
                      const isPast = dateStr <= todayStr;
                      const isAvailable = !isPast && !!slot;
                      const isSelected = selectedDate === dateStr;
                      const dow = new Date(dateStr + 'T00:00:00').getDay();
                      const isRed = dow === 0 || !!slot?.isHoliday;
                      const isBlue = dow === 6;
                      if (!isAvailable) {
                        return (
                          <div key={dateStr} className={`aspect-square flex items-center justify-center text-xs rounded-lg ${isPast ? 'text-gray-200' : 'text-gray-300'}`}>
                            {day}
                          </div>
                        );
                      }
                      return (
                        <button key={dateStr} type="button" onClick={() => handleDateSelect(dateStr)}
                          className={`aspect-square flex items-center justify-center text-xs font-medium rounded-lg transition-colors
                            ${isSelected ? 'bg-brand text-white shadow-sm' :
                              isRed ? 'text-red-500 hover:bg-red-50' :
                              isBlue ? 'text-blue-500 hover:bg-blue-50' :
                              'text-gray-700 hover:bg-brand-light'}`}
                        >
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
                {slots.length === 0 && (
                  <p className="text-center text-xs text-gray-400 mt-3">この月に空き枠がありません</p>
                )}
              </div>
            )}
          </div>
        )}

        {selectedDate && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">時間帯を選択</h2>
            <div className="flex gap-3">
              {availableTimesForDate.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => setSelectedTime(s.time)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors
                    ${selectedTime === s.time
                      ? 'border-brand bg-brand-light text-brand-dark'
                      : 'border-gray-200 text-gray-600 hover:border-brand/30'
                    }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
            {selectedPlan && selectedTime && (
              <div className="mt-4 space-y-3">
                <div className="bg-brand-light border border-brand/20 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">適用プラン</p>
                    <p className="text-sm font-medium text-gray-800">{selectedPlan.name}</p>
                    {selectedPlan.duration && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedPlan.duration}分</p>
                    )}
                  </div>
                  <p className="text-xl font-bold text-brand">{formatCurrency(selectedPlan.price)}</p>
                </div>
                <div className="text-xs text-red-600 space-y-1 leading-relaxed">
                  <p>※ {selectedTime}は撮影開始時刻の目安です。お支度時間が別途必要となります。</p>
                  <p>※ 所要時間は約3時間でございます。来店時刻・所要時間はご撮影内容によって変更になる場合もございます。</p>
                  <p>※ 来店いただく確定時刻は本予約確定LINEに記載します。</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // STEP 2: お客様情報
  // ============================================================
  function renderStep1() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">お客様情報</h2>
        {[
          { label: 'お名前 *', value: name, onChange: setName, type: 'text', placeholder: '山田 花子' },
          { label: 'フリガナ *', value: furigana, onChange: setFurigana, type: 'text', placeholder: 'ヤマダ ハナコ' },
          { label: '電話番号 *', value: phone, onChange: setPhone, type: 'tel', placeholder: '090-0000-0000' },
          { label: 'メールアドレス', value: email, onChange: setEmail, type: 'email', placeholder: 'example@email.com' },
          { label: '郵便番号 *', value: zip, onChange: setZip, type: 'text', placeholder: '123-4567' },
          { label: '住所 *', value: address, onChange: setAddress, type: 'text', placeholder: '東京都渋谷区...' },
        ].map(({ label, value, onChange, type, placeholder }) => (
          <div key={label}>
            <label className="block text-sm text-gray-600 mb-1">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
            />
          </div>
        ))}
      </div>
    );
  }

  // ============================================================
  // STEP 3: 撮影情報
  // ============================================================
  function renderStep2() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">撮影情報</h2>

        {/* お子様人数 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">お子様 *</label>
          <select
            value={childrenCount}
            onChange={(e) => handleChildrenCountChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5'].map((v) => (
              <option key={v} value={v}>{v}名</option>
            ))}
          </select>
        </div>

        {/* 大人の方人数 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">大人の方 *</label>
          <select
            value={adultCount}
            onChange={(e) => setAdultCount(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5以上'].map((v) => (
              <option key={v} value={v}>{v === '5以上' ? '5名以上' : `${v}名`}</option>
            ))}
          </select>
        </div>

        {/* お子様詳細フォーム（人数分） */}
        {childrenDetails.map((child, i) => (
          <div key={i} className="border border-brand/20 rounded-xl p-4 space-y-3 bg-brand-light/40">
            <p className="text-sm font-semibold text-brand">お子様 {i + 1}人目</p>

            <div>
              <label className="block text-xs text-gray-600 mb-1">お名前 *</label>
              <input
                type="text"
                value={child.name}
                onChange={(e) => updateChildDetail(i, 'name', e.target.value)}
                placeholder="例：さくら"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">性別 *</label>
              <div className="flex gap-3">
                {['男の子', '女の子'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => updateChildDetail(i, 'gender', g)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors
                      ${child.gender === g
                        ? 'border-brand bg-brand-light text-brand-dark'
                        : 'border-gray-200 text-gray-600 hover:border-brand/30'
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">生年月日 *</label>
              <input
                type="date"
                value={child.birthday}
                onChange={(e) => updateChildDetail(i, 'birthday', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">洋服サイズ *</label>
              <input
                type="text"
                value={child.clothingSize}
                onChange={(e) => updateChildDetail(i, 'clothingSize', e.target.value)}
                placeholder="例：100cm / 3歳用"
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ============================================================
  // STEP 4: オプション選択
  // ============================================================
  function renderStep3() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">オプション選択</h2>
        <p className="text-xs text-gray-400">ヘアセット料金はプラン料金に含まれています。複数選択可能です。</p>
        <div className="space-y-3">
          {options.map((opt) => {
            const selected = selectedOptions.find((so) => so.optionId === opt.id);
            return (
              <div
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                  ${selected ? 'border-brand bg-brand-light' : 'border-gray-200 bg-white hover:border-brand/30'}`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                  ${selected ? 'border-brand bg-brand' : 'border-gray-300'}`}>
                  {selected && <span className="text-white text-xs">✓</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{opt.name}</p>
                  {opt.description && (
                    <p className={`text-xs mt-0.5 ${opt.description.startsWith('※') ? 'text-red-500' : 'text-gray-400'}`}>
                      {opt.description}
                    </p>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700 flex-shrink-0">{formatCurrency(opt.price)}</p>
                {selected && (
                  <input
                    type="number"
                    min={1}
                    value={selected.quantity}
                    onChange={(e) => { e.stopPropagation(); setOptionQty(opt.id, Number(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-14 text-center text-sm border border-brand/30 rounded-lg px-2 py-1"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================
  // STEP 5: 確認・送信
  // ============================================================
  function renderStep4() {
    return (
      <div className="space-y-6">
        <h2 className="text-base font-bold text-gray-900">ご予約内容の確認</h2>

        {/* 予約サマリー */}
        <div className="bg-white rounded-xl border border-cream-dark p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">撮影シーン</span>
            <span className="font-medium">{scene}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">撮影日時</span>
            <span className="font-medium">{formatDate(selectedDate)} {selectedTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">プラン</span>
            <span className="font-medium">{selectedPlan?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">プラン料金</span>
            <span>{formatCurrency(selectedPlan?.price ?? 0)}</span>
          </div>
          {selectedOptions.map((so) => {
            const opt = options.find((o) => o.id === so.optionId);
            if (!opt) return null;
            return (
              <div key={so.optionId} className="flex justify-between text-gray-500">
                <span>　{opt.name} ×{so.quantity}</span>
                <span>{formatCurrency(opt.price * so.quantity)}</span>
              </div>
            );
          })}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-cream-dark">
            <span>合計（税込）</span>
            <span className="text-brand">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* お客様情報サマリー */}
        <div className="bg-white rounded-xl border border-cream-dark p-4 text-sm space-y-1">
          <p className="font-medium text-gray-900">{name}（{furigana}）</p>
          <p className="text-gray-500">📞 {phone}</p>
          {email && <p className="text-gray-500">✉️ {email}</p>}
          <p className="text-gray-500">📍 {zip} {address}</p>
          <p className="text-gray-500">お子様: {childrenCount}名　大人の方: {adultCount === '5以上' ? '5名以上' : adultCount + '名'}</p>
        </div>

        {/* 備考 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">備考（任意）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="ご要望・ご質問があればご記入ください..."
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />
        </div>

        {/* キャンセルポリシー */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">キャンセルポリシー</h3>
          <div className="bg-white rounded-xl border border-cream-dark p-4 text-xs text-gray-500 whitespace-pre-line max-h-40 overflow-y-auto">
            {CANCEL_POLICY}
          </div>
          <label className="flex items-start gap-3 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand"
            />
            <span className="text-sm text-gray-700">
              キャンセルポリシーに同意します <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
        )}
      </div>
    );
  }

  // ============================================================
  // バリデーション
  // ============================================================
  function canProceed(): boolean {
    switch (step) {
      case 0: return !!(scene && selectedDate && selectedTime);
      case 1: return !!(name && furigana && phone && zip && address);
      case 2: {
        if (!childrenCount || !adultCount) return false;
        const n = parseInt(childrenCount) || 0;
        if (n > 0) {
          return childrenDetails.every((c) => c.name && c.gender && c.birthday && c.clothingSize);
        }
        return true;
      }
      case 3: return true;
      case 4: return agreed;
      default: return false;
    }
  }

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div className="max-w-lg mx-auto px-4 pb-28">
      <StepIndicator current={step} />

      <div className="mt-2">
        {stepRenderers[step]?.()}
      </div>

      {/* ナビゲーションボタン */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark px-4 py-3 flex gap-3 max-w-lg mx-auto`}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1 px-4 py-3 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-cream transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            戻る
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex-1 py-3 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            次へ
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canProceed()}
            className="flex-1 py-3 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '送信中...' : '予約を送信する'}
          </button>
        )}
      </div>
    </div>
  );
}
