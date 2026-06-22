'use client';

import { useState, useEffect } from 'react';
import { TruckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

// ============================================================
// 定数（ダミー：7月の金・日を本番撮影日に。月8日想定）
// ============================================================
const SHOOT_DATES = [
  '2026-07-03', '2026-07-05', '2026-07-10', '2026-07-12',
  '2026-07-17', '2026-07-19', '2026-07-24', '2026-07-26', '2026-07-31',
];
const SHOOT_TIMES = [
  { value: '9:10', label: '午前の部　9:10〜12:00' },
  { value: '13:00', label: '午後の部　13:00〜16:00' },
];
const VISIT_TIME = '16:30';        // 見学はWEB予約だと16:30固定
const VISIT_LEAD_DAYS = 8;          // 本番日は見学日の8日後以降

// ============================================================
// 日付ヘルパー
// ============================================================
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return fmt(d);
}
function jpDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

// ============================================================
// バリデーション（スタジオと同じ）
// ============================================================
function validateName(v: string): string | null { const t = v.trim(); if (!t) return null; if (t.length < 2) return '2文字以上で入力してください'; return null; }
function validateFurigana(v: string): string | null { const t = v.trim(); if (!t) return null; if (t.length < 2) return '2文字以上で入力してください'; if (!/^[぀-ゟ゠-ヿ｡-ﾟ ー　\s]+$/.test(t)) return 'カタカナまたはひらがなで入力してください'; return null; }
function validatePhone(v: string): string | null { const t = v.trim(); if (!t) return null; if (!/^[\d\-－ー\s]+$/.test(t)) return '半角数字とハイフンで入力してください'; const d = t.replace(/\D/g, ''); if (d.length < 10 || d.length > 11) return '電話番号は10〜11桁で入力してください'; return null; }
function validateEmail(v: string): string | null { const t = v.trim(); if (!t) return null; if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'メールアドレスの形式が正しくありません'; return null; }
function validateZip(v: string): string | null { const t = v.trim(); if (!t) return null; if (!/^\d{3}-?\d{4}$/.test(t)) return '郵便番号は7桁（例: 123-4567）で入力してください'; return null; }
function validateAddress(v: string): string | null { const t = v.trim(); if (!t) return null; if (t.length < 5) return '住所を正しく入力してください'; return null; }

const STEPS = ['日程', 'お客様情報', '来店人数', '確認・送信'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="py-3 px-4">
      <div className="flex items-center justify-center">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
              ${i < current ? 'bg-emerald-700 text-white' : i === current ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {i < current ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`w-5 h-px ${i < current ? 'bg-emerald-700' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-emerald-700 font-medium mt-1">{STEPS[current]}</p>
    </div>
  );
}

export default function LocationForm() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');

  const [today] = useState(() => fmt(new Date()));

  // 本番撮影日
  const [shootDate, setShootDate] = useState('');
  const [shootTime, setShootTime] = useState('');
  // カレンダー表示月（初期は最初の撮影日の月）
  const [calYM, setCalYM] = useState(() => {
    const [y, m] = SHOOT_DATES[0].split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  // 見学カレンダーの表示月（初期は今月）
  const [visitCalYM, setVisitCalYM] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });
  // 日程タブ（本番 / 見学）
  const [scheduleTab, setScheduleTab] = useState<'shoot' | 'visit'>('shoot');

  // 見学日（16:30固定）
  const [visitDate, setVisitDate] = useState('');
  const [visitStatus, setVisitStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  // 表示中の月で16:30が既に埋まっている日（カレンダーで選択不可にする）
  const [takenVisitDates, setTakenVisitDates] = useState<Set<string>>(new Set());

  // お客様情報
  const [name, setName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [zip, setZip] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // 来店人数
  const [childrenCount, setChildrenCount] = useState('');
  const [adultCount, setAdultCount] = useState('');
  const [childrenDetails, setChildrenDetails] = useState<{ name: string; furigana: string; gender: string; birthday: string; clothingSize: string }[]>([]);

  // 確認
  const [insurance, setInsurance] = useState<'' | '加入する' | '加入しない'>('');
  const [acknowledged, setAcknowledged] = useState(false);

  // 本番日の8日前まで（見学日の最大値）
  const maxVisitDate = shootDate ? addDays(shootDate, -VISIT_LEAD_DAYS) : '';

  // 本番日を変えたら、範囲外になった見学日はリセット
  useEffect(() => {
    if (visitDate && maxVisitDate && visitDate > maxVisitDate) {
      setVisitDate('');
      setVisitStatus('idle');
    }
  }, [shootDate, maxVisitDate, visitDate]);

  // 見学日の16:30が空いているか確認
  useEffect(() => {
    if (!visitDate) { setVisitStatus('idle'); return; }
    let cancelled = false;
    setVisitStatus('checking');
    fetch(`/api/slots/visit?date=${visitDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const taken = d.success && (d.data.occupiedSlots ?? []).includes(VISIT_TIME);
        setVisitStatus(taken ? 'taken' : 'free');
      })
      .catch(() => { if (!cancelled) setVisitStatus('free'); });
    return () => { cancelled = true; };
  }, [visitDate]);

  // 表示中の月で「16:30が埋まっている日」を取得（カレンダーで選択不可にする）
  useEffect(() => {
    const mm = String(visitCalYM.month + 1).padStart(2, '0');
    const last = new Date(visitCalYM.year, visitCalYM.month + 1, 0).getDate();
    const from = `${visitCalYM.year}-${mm}-01`;
    const to = `${visitCalYM.year}-${mm}-${String(last).padStart(2, '0')}`;
    let cancelled = false;
    fetch(`/api/slots/visit-dates?from=${from}&to=${to}&time=${VISIT_TIME}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.success) setTakenVisitDates(new Set(d.data.takenDates ?? [])); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visitCalYM]);

  function handleChildrenCountChange(val: string) {
    setChildrenCount(val);
    const n = parseInt(val) || 0;
    setChildrenDetails((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ name: '', furigana: '', gender: '', birthday: '', clothingSize: '' });
      return next.slice(0, n);
    });
  }
  function updateChildDetail(i: number, field: string, value: string) {
    setChildrenDetails((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  }

  const visitValid = visitDate && visitDate >= today && (!maxVisitDate || visitDate <= maxVisitDate) && visitStatus === 'free';
  const scheduleValid = shootDate && shootTime && visitValid;
  const customerValid = name.trim() && furigana.trim() && phone.trim() && zip.trim() && address.trim()
    && !validateName(name) && !validateFurigana(furigana) && !validatePhone(phone) && !validateZip(zip) && !validateAddress(address) && !validateEmail(email);
  const peopleValid = childrenCount !== '' && adultCount !== '';
  const canNext = (step === 0 && scheduleValid) || (step === 1 && customerValid) || (step === 2 && peopleValid);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const shootLabel = SHOOT_TIMES.find((t) => t.value === shootTime)?.label ?? shootTime;
    const childrenDetail = childrenDetails.length > 0
      ? childrenDetails.map((c, i) => `${i + 1}人目: ${c.name}（${c.furigana}）（${c.gender}）${c.birthday} / ${c.clothingSize}`).join('\n')
      : '';
    const base = {
      shootType: 'location',
      scene: 'その他',
      planId: '',
      customerName: name,
      furigana,
      zipCode: zip,
      address,
      phone,
      email,
      peopleCount: `お子様${childrenCount || 0}名・大人の方${adultCount === '5以上' ? '5名以上' : (adultCount || 0) + '名'}`,
      childrenCount: Number(childrenCount) || 0,
      adultCount,
      childrenDetail,
      selectedOptions: [],
      cancelPolicyAgreed: true,
    };
    const headers = { 'Content-Type': 'application/json' };
    // ローカルは開発DB。見学(16:30)＋本番撮影の2件を作成（どちらも shoot_type=location）。
    try {
      // ① 見学（16:30・重複チェックあり）
      const visitRes = await fetch('/api/reservations', {
        method: 'POST', headers,
        body: JSON.stringify({ ...base, isVisit: true, date: visitDate, timeSlot: VISIT_TIME, note: `【ロケ見学】本番: ${jpDate(shootDate)} ${shootLabel}` }),
      });
      const visitData = await visitRes.json();
      if (!visitData.success) { setError(visitData.error ?? '見学枠の登録に失敗しました'); return; }

      // ② 本番撮影（仮予約）
      const shootRes = await fetch('/api/reservations', {
        method: 'POST', headers,
        body: JSON.stringify({ ...base, isVisit: false, date: shootDate, timeSlot: shootTime, note: `【ロケ本番】見学: ${jpDate(visitDate)} ${VISIT_TIME} / キャンセル保険: ${insurance}` }),
      });
      const shootData = await shootRes.json();
      if (!shootData.success) { setError(shootData.error ?? '本番予約の登録に失敗しました'); return; }

      setReservationNumber(shootData.data.reservationNumber as string);
      setSubmitted(true);
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // 完了画面
  // ============================================================
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <CheckCircleIcon className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="font-bold text-emerald-800 mb-1">ロケーション撮影のお申し込みを受け付けました</h2>
          <p className="text-sm text-gray-500 mb-4">担当者よりご連絡いたします。</p>
          {reservationNumber && (
            <div className="bg-emerald-50 rounded-xl p-4 inline-block">
              <p className="text-xs text-gray-500 mb-1">予約番号</p>
              <p className="font-bold text-emerald-800">{reservationNumber}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">（開発DBに保存されました・本番には影響しません）</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 各ステップ
  // ============================================================
  // 共通カレンダー描画（本番・見学で共用）
  function calendarGrid(
    ym: { year: number; month: number },
    setYM: (fn: (c: { year: number; month: number }) => { year: number; month: number }) => void,
    isSelectable: (dateStr: string) => boolean,
    selectedDate: string,
    onSelect: (dateStr: string) => void,
  ) {
    const firstWeekday = new Date(ym.year, ym.month, 1).getDay();
    const daysInMonth = new Date(ym.year, ym.month + 1, 0).getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym.year}-${String(ym.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    const prev = () => setYM((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
    const next = () => setYM((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
    return (
      <div className="border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={prev} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ChevronLeftIcon className="w-5 h-5" /></button>
          <span className="text-sm font-bold text-gray-900">{ym.year}年 {ym.month + 1}月</span>
          <button type="button" onClick={next} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><ChevronRightIcon className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((w, i) => (
            <div key={w} className={`text-center text-[11px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`e${idx}`} />;
            const day = Number(dateStr.slice(-2));
            const selectable = isSelectable(dateStr);
            const selected = selectedDate === dateStr;
            return (
              <button key={dateStr} type="button" disabled={!selectable} onClick={() => onSelect(dateStr)}
                className={`aspect-square rounded-lg text-sm flex items-center justify-center transition-colors
                  ${selected ? 'bg-emerald-700 text-white font-bold'
                    : selectable ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-medium'
                    : 'text-gray-300 cursor-not-allowed'}`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSchedule() {
    const shootSet = new Set(SHOOT_DATES);
    const shootSummary = shootDate ? `${jpDate(shootDate)}${shootTime ? ` ${shootTime}〜` : ''}` : '未選択';
    const visitSummary = visitDate ? `${jpDate(visitDate)} ${VISIT_TIME}` : '未選択';
    return (
      <div className="space-y-4">
        {/* タブ */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {([
            { key: 'shoot', no: '①', label: '本番撮影日', summary: shootSummary },
            { key: 'visit', no: '②', label: '見学日', summary: visitSummary },
          ] as const).map((t, i) => (
            <button key={t.key} type="button" onClick={() => setScheduleTab(t.key)}
              className={`flex-1 px-3 py-2 text-left transition-colors ${i === 0 ? 'border-r border-gray-200' : ''}
                ${scheduleTab === t.key ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'}`}>
              <div className={`text-sm font-semibold ${scheduleTab === t.key ? 'text-emerald-800' : 'text-gray-500'}`}>{t.no} {t.label}</div>
              <div className="text-[11px] text-gray-500 truncate">{t.summary}</div>
            </button>
          ))}
        </div>

        {/* タブ内容 */}
        {scheduleTab === 'shoot' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">カレンダーから撮影日（緑の日）と時間帯をお選びください。</p>
            {calendarGrid(calYM, setCalYM, (d) => shootSet.has(d), shootDate, setShootDate)}
            <div className="flex gap-2">
              {SHOOT_TIMES.map((t) => (
                <button key={t.value} type="button" onClick={() => setShootTime(t.value)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors
                    ${shootTime === t.value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-700 hover:border-emerald-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {shootDate && shootTime && (
              <button type="button" onClick={() => setScheduleTab('visit')}
                className="w-full py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800">
                見学日の選択へ →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!shootDate ? (
              <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-400">
                先に「① 本番撮影日」を選択してください
              </div>
            ) : (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
                  ロケ撮影は事前の見学が必須です。見学はマトカスタジオにて <strong>{VISIT_TIME}</strong> から承ります。<br />
                  本番撮影（{jpDate(shootDate)}）の<strong>1週間以上前</strong>＝<strong>{jpDate(maxVisitDate)}まで</strong>の緑の日をお選びください。
                </div>
                {calendarGrid(
                  visitCalYM,
                  setVisitCalYM,
                  (d) => d >= today && (!maxVisitDate || d <= maxVisitDate) && !takenVisitDates.has(d),
                  visitDate,
                  setVisitDate,
                )}
                {visitDate && <p className="text-xs text-emerald-700 font-medium">見学：{jpDate(visitDate)} {VISIT_TIME}</p>}
                {visitStatus === 'checking' && <p className="text-xs text-gray-400">空き状況を確認中...</p>}
                {visitStatus === 'taken' && <p className="text-xs text-red-600">この日の見学（{VISIT_TIME}）は既に予約が入っています。別の日をお選びください。</p>}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderCustomer() {
    const fields: { label: string; value: string; onChange: (v: string) => void; type: string; placeholder: string; error: string | null }[] = [
      { label: 'お名前 *', value: name, onChange: setName, type: 'text', placeholder: '山田 花子', error: validateName(name) },
      { label: 'フリガナ *', value: furigana, onChange: setFurigana, type: 'text', placeholder: 'ヤマダ ハナコ', error: validateFurigana(furigana) },
      { label: '電話番号 *', value: phone, onChange: setPhone, type: 'tel', placeholder: '090-0000-0000', error: validatePhone(phone) },
      { label: 'メールアドレス', value: email, onChange: setEmail, type: 'email', placeholder: 'example@email.com', error: validateEmail(email) },
      { label: '郵便番号 *', value: zip, onChange: setZip, type: 'text', placeholder: '123-4567', error: validateZip(zip) },
      { label: '住所 *', value: address, onChange: setAddress, type: 'text', placeholder: '東京都渋谷区...', error: validateAddress(address) },
    ];
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">お客様情報</h2>
        {fields.map(({ label, value, onChange, type, placeholder, error }) => (
          <div key={label}>
            <label className="block text-sm text-gray-600 mb-1">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${error ? 'border-red-400 bg-red-50/30' : 'border-gray-400'}`} />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        ))}
      </div>
    );
  }

  function renderPeople() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">来店人数</h2>
        <div>
          <label className="block text-sm text-gray-600 mb-1">お子様 *</label>
          <select value={childrenCount} onChange={(e) => handleChildrenCountChange(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600">
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5'].map((v) => (<option key={v} value={v}>{v}名</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">大人の方 *</label>
          <select value={adultCount} onChange={(e) => setAdultCount(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600">
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5以上'].map((v) => (<option key={v} value={v}>{v === '5以上' ? '5名以上' : `${v}名`}</option>))}
          </select>
        </div>
        {childrenDetails.map((child, i) => (
          <div key={i} className="border border-emerald-300 rounded-xl p-4 space-y-3 bg-emerald-50/50">
            <p className="text-sm font-semibold text-emerald-700">お子様 {i + 1}人目</p>
            <div><label className="block text-xs text-gray-600 mb-1">お名前 *</label>
              <input type="text" value={child.name} onChange={(e) => updateChildDetail(i, 'name', e.target.value)} placeholder="例：さくら"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">フリガナ *</label>
              <input type="text" value={child.furigana} onChange={(e) => updateChildDetail(i, 'furigana', e.target.value)} placeholder="例：サクラ"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">性別 *</label>
              <div className="flex gap-3">{['男の子', '女の子'].map((g) => (
                <button key={g} type="button" onClick={() => updateChildDetail(i, 'gender', g)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${child.gender === g ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600 hover:border-emerald-200'}`}>{g}</button>
              ))}</div></div>
            <div><label className="block text-xs text-gray-600 mb-1">生年月日 *</label>
              <input type="date" value={child.birthday} onChange={(e) => updateChildDetail(i, 'birthday', e.target.value)}
                className="w-full max-w-full box-border text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">洋服サイズ *</label>
              <input type="text" value={child.clothingSize} onChange={(e) => updateChildDetail(i, 'clothingSize', e.target.value)} placeholder="例：100cm / 3歳用"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" /></div>
          </div>
        ))}
      </div>
    );
  }

  function renderConfirm() {
    const shootLabel = SHOOT_TIMES.find((t) => t.value === shootTime)?.label ?? shootTime;
    return (
      <div className="space-y-5">
        <h2 className="text-base font-bold text-gray-900">確認・送信</h2>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">本番撮影日</span><span className="text-gray-800 text-right">{jpDate(shootDate)}　{shootLabel}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">見学日</span><span className="text-gray-800">{jpDate(visitDate)}　{VISIT_TIME}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">お名前</span><span className="text-gray-800">{name}（{furigana}）</span></div>
          <div className="flex justify-between"><span className="text-gray-500">電話番号</span><span className="text-gray-800">{phone}</span></div>
          {email && <div className="flex justify-between"><span className="text-gray-500">メール</span><span className="text-gray-800">{email}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">住所</span><span className="text-gray-800 text-right">{zip} {address}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">来店人数</span><span className="text-gray-800">お子様{childrenCount || 0}名・大人{adultCount === '5以上' ? '5名以上' : `${adultCount || 0}名`}</span></div>
        </div>

        {/* キャンセル保険 */}
        <div className="border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-1">キャンセル保険（5,500円）<span className="text-red-500"> *</span></p>
          <p className="text-xs text-gray-500 mb-3">ご加入いただくと、万が一キャンセルされた際にキャンセル料の請求がございません。ご加入の場合はプラン料金とともに事前振込をお願いします。</p>
          <div className="flex gap-3">
            {(['加入する', '加入しない'] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => setInsurance(opt)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${insurance === opt ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600 hover:border-emerald-200'}`}>{opt}</button>
            ))}
          </div>
        </div>

        {/* 注意事項 */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">ご予約前のご確認事項</p>
          <div>
            <p className="text-xs font-semibold text-emerald-700 mb-1">■ 撮影について</p>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              <li>撮影は1家族様ごとのご案内です（限られたスペースのため大人数での撮影はお受けできません）。</li>
              <li>主役のお子様のソロカット中心です。ご家族・ご兄弟写真は数カット程度撮影可能です。</li>
              <li>撮影開始後のお着替え・再撮影はできません。</li>
              <li>荒天時は屋外撮影を中止し、室内撮影のみとなる場合がございます。</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 mb-1">■ お着付けについて</p>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5"><li>お子様のコンディション等でお支度時間を超過した場合、撮影を中止させていただく可能性がございます。</li></ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 mb-1">■ 駐車場について</p>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              <li>東山荘駐車場の開放時間は9:00です。9:10のご予約で早く到着されても駐車できない場合がございます。</li>
              <li>駐車場は現地10台分です。満車の場合は近隣のコインパーキング（お客様負担）をご利用ください。</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-700 mb-1">■ お支払いについて</p>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5"><li>お支払いは撮影日2週間前までに銀行振込をお願いします。</li></ul>
          </div>
          <label className="flex items-start gap-2 pt-1 cursor-pointer">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-700" />
            <span className="text-sm text-gray-700">上記のご確認事項を確認・了承しました</span>
          </label>
        </div>

        <p className="text-xs text-gray-400">※ キャンセル規定は別途、承諾書にてご確認いただきます。</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      </div>
    );
  }

  const renderers = [renderSchedule, renderCustomer, renderPeople, renderConfirm];

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-700 text-white p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TruckIcon className="w-5 h-5" />
          <span className="text-sm tracking-widest font-medium">matka. Location</span>
        </div>
        <h2 className="text-xl font-bold">ロケーション撮影 予約</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <StepIndicator current={step} />
        <div className="px-4 pb-4">{renderers[step]()}</div>
        <div className="border-t border-gray-100 px-4 py-3 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-4 py-3 border border-gray-400 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
              <ChevronLeftIcon className="w-4 h-4" />戻る
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-3 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed">次へ</button>
          ) : (
            <button type="button" disabled={submitting || insurance === '' || !acknowledged} onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? '送信中...' : '送信する'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
