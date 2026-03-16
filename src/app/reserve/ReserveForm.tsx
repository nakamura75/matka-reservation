'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Plan, Option, AvailableSlot, ShootingScene, TimeSlot } from '@/types';
import { SHOOTING_SCENES, SCENE_PLAN_MAP, LIFF_ID, LINE_OA_ID } from '@/lib/constants';
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
  const [otherSceneNote, setOtherSceneNote] = useState(''); // ① その他シーン詳細
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
    name: string; furigana: string; gender: string; birthday: string; clothingSize: string;
  }[]>([]);

  // STEP 4
  const [selectedOptions, setSelectedOptions] = useState<{ optionId: string; quantity: number }[]>([]);

  // STEP 5
  const [phoneCallPreference, setPhoneCallPreference] = useState('希望しない'); // ② 電話希望
  const [phoneCallTopics, setPhoneCallTopics] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Honeypot（Bot対策）— 人間には見えない入力欄
  const [honeypot, setHoneypot] = useState('');

  // LIFF 初期化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const liffId = LIFF_ID;
    if (!liffId) {
      console.warn('[LIFF] LIFF_ID が未設定です');
      return;
    }

    import('@line/liff').then((liff) => {
      liff.default.init({ liffId })
        .then(() => {
          if (liff.default.isInClient()) {
            setIsInLine(true);
            liff.default.getProfile().then((profile) => {
              setLineUserId(profile.userId);
              setLineName(profile.displayName);
            }).catch((e) => console.error('[LIFF] getProfile失敗:', e));
          }
        })
        .catch((e) => console.error('[LIFF] init失敗:', e));
    }).catch((e) => console.error('[LIFF] SDK読み込み失敗:', e));
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
    const holiday = selectedDate ? (isWeekend(selectedDate) || !!slots.find(s => s.date === selectedDate)?.isHoliday) : false;
    const match =
      plans.find((p) => p.name.includes(planType) && p.name.includes(selectedDate && holiday ? '休日' : '平日'))
      ?? plans.find((p) => p.name.includes(planType))
      ?? plans[0];
    if (match) setPlanId(match.id);
  }, [plans, scene, selectedDate, slots]);

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
    setOtherSceneNote('');
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
      const holiday = isWeekend(dateStr) || !!slots.find(s => s.date === dateStr)?.isHoliday;
      const match = plans.find((p) =>
        p.name.includes(planType) && (holiday ? p.name.includes('休日') : p.name.includes('平日'))
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
          otherSceneNote: scene === 'その他' ? otherSceneNote : '',
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
          childrenCount: Number(childrenCount) || 0,
          adultCount,
          childrenDetail: childrenDetails.length > 0
            ? childrenDetails.map((c, i) =>
                `${i + 1}人目: ${c.name}（${c.furigana}）（${c.gender}）${c.birthday} / ${c.clothingSize}`
              ).join('\n')
            : '',
          selectedOptions,
          phoneCallPreference: phoneCallPreference === '希望する' && phoneCallTopics.length > 0
            ? `希望する（${phoneCallTopics.join('、')}）`
            : phoneCallPreference,
          note,
          cancelPolicyAgreed: true,
          lineUserId,
          lineName,
          _hp: honeypot,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const resNumber = data.data.reservationNumber as string;
        setReservationNumber(resNumber);
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
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="font-bold mb-1" style={{ color: '#e53935', fontSize: '14px' }}>仮予約を受け付けました</h2>
          <p className="font-bold mb-2" style={{ color: '#e53935', fontSize: '20px' }}>※まだ予約は完了しておりません</p>
          <p className="text-sm text-gray-500 mb-6">
            3日以内に担当者よりご連絡いたします。
          </p>
          <div className="bg-brand-light rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">予約番号</p>
            <p className="font-bold text-brand tracking-wide" style={{ fontSize: '13px' }}>{reservationNumber}</p>
          </div>
          {!isInLine && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
              <p className="text-sm font-semibold text-green-800 mb-2">📲 LINEで予約番号を送信してください</p>
              <p className="text-xs text-green-700 mb-3">
                下のボタンを押すと、予約番号がLINEトーク内に表示されます。<br />
                予約内容の確認・通知をLINEで受け取るために、そのまま送信してください。
              </p>
              <div className="bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-800 border border-green-200 mb-3">
                matka予約: {reservationNumber}
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-3">
                <p className="text-xs font-semibold text-amber-800">⚠️ メッセージの内容は変更せずにそのまま送信してください</p>
              </div>
              {/* QRコード（常に表示） */}
              <div className="flex flex-col items-center bg-white rounded-xl border border-green-200 p-4 mb-3">
                <QRCodeSVG value={`https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(`matka予約: ${reservationNumber}`)}`} size={120} />
                <p className="text-xs text-gray-500 mt-2">カメラでスキャン または ボタンをタップ</p>
              </div>
              {/* ボタン（常に表示） */}
              <a
                href={`https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(`matka予約: ${reservationNumber}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2.5 bg-[#06C755] text-white text-sm font-medium rounded-lg hover:bg-[#05a847] transition-colors"
              >
                LINEで予約番号を送信する
              </a>
            </div>
          )}
          {isInLine && (
            <p className="text-sm text-green-600 bg-green-50 rounded-xl p-3">
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
          <p className="text-xs text-gray-500 mb-2">※七五三とバースデーを同時に撮影される場合は「七五三」をお選びください。</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SHOOTING_SCENES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSceneChange(s as ShootingScene)}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors
                  ${scene === s
                    ? 'border-brand bg-brand-light text-brand-dark'
                    : 'border-gray-300 text-gray-600 hover:border-brand-light hover:bg-brand-light'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ① その他選択時：説明文変更＋入力フォーム */}
        {scene === 'その他' && (
          <div>
            <p className="text-xs text-red-500 mb-2">
              ※「その他」を選んだ方は、撮影したいシーンについて記入してください。
            </p>
            <textarea
              value={otherSceneNote}
              onChange={(e) => setOtherSceneNote(e.target.value)}
              rows={3}
              placeholder="撮影したいシーンをご記入ください..."
              className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
            />
          </div>
        )}

        {scene && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-3">撮影日を選択</h2>
            {loadingSlots ? (
              <div className="text-center py-8 text-gray-400 text-sm">空き枠を確認中...</div>
            ) : (
              <div className="border border-gray-200 rounded-2xl p-3">
                {(() => {
                  const today = new Date();
                  const minY = today.getFullYear(), minM = today.getMonth();
                  const future = new Date(today); future.setDate(today.getDate() + 180);
                  const maxY = future.getFullYear(), maxM = future.getMonth();
                  const { year, month } = calendarYM;
                  const canPrev = year > minY || month > minM;
                  const canNext = year < maxY || (year === maxY && month < maxM);
                  return (
                    <div className="flex items-center justify-between mb-3">
                      <button type="button" onClick={() => setCalendarYM(({ year: y, month: m }) => { const d = new Date(y, m - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} disabled={!canPrev} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed">
                        <ChevronLeftIcon className="w-4 h-4 text-gray-500" />
                      </button>
                      <span className="text-sm font-semibold text-gray-700">{year}年{month + 1}月</span>
                      <button type="button" onClick={() => setCalendarYM(({ year: y, month: m }) => { const d = new Date(y, m + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} disabled={!canNext} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed">
                        <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-7 mb-1">
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
                  ))}
                </div>
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
                      const isTelOnly = slot?.telOnly === true;
                      const isSelected = selectedDate === dateStr;
                      const dow = new Date(dateStr + 'T00:00:00').getDay();
                      const isRed = dow === 0 || !!slot?.isHoliday;
                      const isBlue = dow === 6;
                      if (!isAvailable || isTelOnly) {
                        return (
                          <div key={dateStr} className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg ${isTelOnly ? 'bg-orange-50 text-orange-400' : isPast ? 'text-gray-200' : 'text-gray-300'}`}>
                            <span>{day}</span>
                            {isTelOnly && <span className="text-[8px] font-bold leading-none">TEL</span>}
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
                {slots.filter(s => s.date.startsWith(`${calendarYM.year}-${String(calendarYM.month + 1).padStart(2, '0')}`)).length === 0 && (
                  <p className="text-center text-xs text-gray-400 mt-3">この月に空き枠がありません</p>
                )}
                {slots.some(s => s.telOnly) && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-orange-700">
                      <span className="font-bold">TEL</span> の日程は直近のためWeb予約を受け付けておりません。<br />
                      お電話でご予約ください（TEL: <a href="tel:052-846-2378" className="underline">052-846-2378</a>）
                    </p>
                  </div>
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
                      : 'border-gray-300 text-gray-600 hover:border-brand-light'
                    }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
            {selectedPlan && selectedTime && (
              <div className="mt-4 space-y-3">
                <div className="bg-brand-light border border-brand-light rounded-xl p-4 flex justify-between items-center">
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
                  <p>※ 所要時間は約3時間です。<br />　来店時刻・所要時間は撮影シーンによって変更になります。</p>
                  <p>※ 来店いただく確定時刻は予約確定LINEに記載します。</p>
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
              className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand"
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

        <div>
          <label className="block text-sm text-gray-600 mb-1">お子様 *</label>
          <select
            value={childrenCount}
            onChange={(e) => handleChildrenCountChange(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5'].map((v) => (
              <option key={v} value={v}>{v}名</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">大人の方 *</label>
          <select
            value={adultCount}
            onChange={(e) => setAdultCount(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5以上'].map((v) => (
              <option key={v} value={v}>{v === '5以上' ? '5名以上' : `${v}名`}</option>
            ))}
          </select>
        </div>

        {childrenDetails.map((child, i) => (
          <div key={i} className="border border-brand rounded-xl p-4 space-y-3 bg-brand-light/40">
            <p className="text-sm font-semibold text-brand">お子様 {i + 1}人目</p>

            <div>
              <label className="block text-xs text-gray-600 mb-1">お名前 *</label>
              <input
                type="text"
                value={child.name}
                onChange={(e) => updateChildDetail(i, 'name', e.target.value)}
                placeholder="例：さくら"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">フリガナ *</label>
              <input
                type="text"
                value={child.furigana}
                onChange={(e) => updateChildDetail(i, 'furigana', e.target.value)}
                placeholder="例：サクラ"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand"
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
                        : 'border-gray-300 text-gray-600 hover:border-brand-light'
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
                className="w-full max-w-full box-border text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">洋服サイズ *</label>
              <input
                type="text"
                value={child.clothingSize}
                onChange={(e) => updateChildDetail(i, 'clothingSize', e.target.value)}
                placeholder="例：100cm / 3歳用"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand"
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
                  ${selected ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-brand-light'}`}
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
                    className="w-14 text-center text-sm border border-brand rounded-lg px-2 py-1"
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
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">撮影シーン</span>
            <span className="font-medium">{scene}</span>
          </div>
          {scene === 'その他' && otherSceneNote && (
            <div className="flex justify-between">
              <span className="text-gray-500">シーン詳細</span>
              <span className="font-medium text-right max-w-[60%]">{otherSceneNote}</span>
            </div>
          )}
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
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>合計（税込）</span>
            <span className="text-brand">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* お客様情報 */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
          <p className="font-medium text-gray-900">{name}（{furigana}）</p>
          <p className="text-gray-500">📞 {phone}</p>
          {email && <p className="text-gray-500">✉️ {email}</p>}
          <p className="text-gray-500">📍 {zip} {address}</p>
          <p className="text-gray-500">お子様: {childrenCount}名　大人の方: {adultCount === '5以上' ? '5名以上' : adultCount + '名'}</p>
          <p className="text-gray-500">📞 お電話: {phoneCallPreference === '希望する' && phoneCallTopics.length > 0
            ? `希望する（${phoneCallTopics.join('、')}）`
            : phoneCallPreference}</p>
        </div>

        {/* ③ お子様詳細を確認画面に表示 */}
        {childrenDetails.length > 0 && (
          <div className="space-y-3">
            {childrenDetails.map((child, i) => (
              <div key={i} className="bg-brand-light border border-brand-light rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-brand">お子様 {i + 1}人目</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">お名前</span>
                  <span className="font-medium">{child.name}（{child.furigana}）</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">性別</span>
                  <span>{child.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">生年月日</span>
                  <span>{child.birthday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">洋服サイズ</span>
                  <span>{child.clothingSize}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Honeypot — Botのみが入力する非表示フィールド */}
        <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* 備考 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">備考（任意）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="持ち込み小物があればご記入ください"
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
        </div>

        {/* ② お電話の希望 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">仮予約後のお電話について <span className="text-red-500">*</span></h3>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-3">
              仮予約確定後、担当者からのお電話をご希望されますか？<br />
              ご要望・ご不明点がある方は「希望する」をお選びください。
            </p>
            <div className="flex gap-4">
              {['希望する', '希望しない'].map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="phoneCallPreference"
                    value={option}
                    checked={phoneCallPreference === option}
                    onChange={(e) => {
                      setPhoneCallPreference(e.target.value);
                      if (e.target.value === '希望しない') setPhoneCallTopics([]);
                    }}
                    className="w-4 h-4 accent-brand"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
            {phoneCallPreference === '希望する' && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-600 font-medium">お電話で確認したい内容を教えてください（複数選択可）</p>
                {[
                  '撮影当日の流れや準備について',
                  '料金・プランの詳細について',
                  '衣装・ヘアメイクについて',
                  'お子様の体調・状況の相談',
                  'その他（備考欄にご記入ください）',
                ].map((topic) => (
                  <label key={topic} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phoneCallTopics.includes(topic)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPhoneCallTopics((prev) => [...prev, topic]);
                        } else {
                          setPhoneCallTopics((prev) => prev.filter((t) => t !== topic));
                        }
                      }}
                      className="w-4 h-4 accent-brand"
                    />
                    <span className="text-xs text-gray-700">{topic}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* キャンセルポリシー */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">キャンセルポリシー</h3>
          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 whitespace-pre-line max-h-40 overflow-y-auto">
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
      case 0:
        if (!scene || !selectedDate || !selectedTime) return false;
        if (scene === 'その他' && !otherSceneNote.trim()) return false; // ① その他は入力必須
        return true;
      case 1: return !!(name && furigana && phone && zip && address);
      case 2: {
        if (!childrenCount || !adultCount) return false;
        const n = parseInt(childrenCount) || 0;
        if (n > 0) {
          return childrenDetails.every((c) => c.name && c.furigana && c.gender && c.birthday && c.clothingSize);
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
    <div className="max-w-lg mx-auto px-4 py-4">

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <StepIndicator current={step} />

        <div className="px-4 pb-4">
          {stepRenderers[step]?.()}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-4 py-3 border border-gray-400 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
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
              className="flex-1 py-3 bg-brand-green text-white text-sm font-medium rounded-xl hover:bg-brand-green-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
}


