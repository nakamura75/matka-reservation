'use client';

import { useState, useEffect } from 'react';
import { TruckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { QRCodeSVG } from 'qrcode.react';
import type { Option, Plan } from '@/types';
import { formatCurrency, isWeekend } from '@/lib/utils';
import { LINE_OA_ID } from '@/lib/constants';

// ============================================================
// 定数
// ============================================================
const SHOOT_TIMES = [
  { value: '9:10', label: '午前の部　9:10〜12:00' },
  { value: '13:00', label: '午後の部　13:00〜16:00' },
];
const VISIT_TIME = '16:30';        // 見学はWEB予約だと16:30固定
const VISIT_LEAD_DAYS = 8;          // 本番日は見学日の8日後以降

// プラン料金は設定（DB）のロケ用プランから取得し、平日/休日は撮影日で自動選択する。
const CANCEL_INSURANCE = 5500;

// プラン説明（DBのdescriptionが空のときのフォールバック表示。ベース名で照合）
const PLAN_DESC: Record<string, string> = {
  'Basic Plan': '撮影データのみ',
  'Frame Plan': '撮影データ ＋ Walnut Frame 8×10',
  'Album Plan': '撮影データ ＋ Crystal Book（アルバム）',
};
const PLAN_NOTE: Record<string, string> = {
  'Frame Plan': 'フレーム単品注文より7,700円お得／フレーム用のお写真を1枚お選びいただけます',
  'Album Plan': 'アルバム単品注文より9,900円お得／アルバムデザインはお任せください',
};

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

const STEPS = ['日程', 'お客様情報', '来店人数', 'ご主役のお支度', 'オプション', '確認・送信'];

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

export default function LocationForm({ lineUserId = '', lineName = '', isInLine }: { lineUserId?: string; lineName?: string; isInLine?: boolean }) {
  // LINE内アクセスか。明示指定が無ければ lineUserId の有無で判定。
  // LINE外(Web)は完了画面で予約番号のLINE送信へ誘導する。
  const inLine = isInLine ?? !!lineUserId;
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');

  const [today] = useState(() => fmt(new Date()));

  // 本番撮影日
  const [shootDate, setShootDate] = useState('');
  const [shootTime, setShootTime] = useState('');
  // 撮影可能日（設定で登録された日）／見学NG日／本番の予約済み枠（date|timeSlot）
  const [shootDays, setShootDays] = useState<string[]>([]);
  const [visitNgDates, setVisitNgDates] = useState<Set<string>>(new Set());
  const [bookedShoots, setBookedShoots] = useState<Set<string>>(new Set());
  // カレンダー表示月（初期は今月。撮影可能日が読み込めたら最も近い日へ移動）
  const [calYM, setCalYM] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
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

  // オプション（子供向けのみ）
  const [options, setOptions] = useState<Option[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<{ optionId: string; quantity: number }[]>([]);
  // 主役のお子様のお支度（着付け＋ヘアメイクはプラン込み＝¥0、日本髪のみ別途¥2,200）
  const [mainPrep, setMainPrep] = useState<string[]>([]);
  // ロケ用プラン（設定から取得）。planTier は平日/休日を除いたベース名（例: "Basic Plan"）
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planTier, setPlanTier] = useState('');

  // お電話の希望
  const [phoneCallPreference, setPhoneCallPreference] = useState('');

  // 確認
  const [insurance, setInsurance] = useState<'' | '加入する' | '加入しない'>('');
  const [acknowledged, setAcknowledged] = useState(false);

  // ステップ切替時は必ずページ先頭から表示する（確認ページ等が中盤から始まるのを防ぐ）
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [step]);

  // オプション・プラン取得（ロケ用を設定から取得）
  useEffect(() => {
    fetch('/api/options?mode=location')
      .then((r) => r.json())
      .then((d) => setOptions((d.data ?? []).filter((o: Option) => o.showInForm !== false)))
      .catch(() => {});
    fetch('/api/plans?mode=location')
      .then((r) => r.json())
      .then((d) => setPlans((d.data ?? []).filter((p: Plan) => p.showInForm !== false)))
      .catch(() => {});
  }, []);

  // 撮影可能日・見学NG日・予約済み枠を取得（設定/予約から）
  useEffect(() => {
    // 撮影日は「見学を1週間以上前に済ませる」必要があるため、最短でも今日+リードタイム以降のみ
    const minShootDate = addDays(today, VISIT_LEAD_DAYS);
    fetch('/api/location/shoot-days')
      .then((r) => r.json())
      .then((d) => {
        const days: string[] = (d.data ?? []).filter((x: string) => x >= minShootDate);
        setShootDays(days);
        // 直近の撮影可能日の月へカレンダーを移動
        const next = days.slice().sort()[0];
        if (next) {
          const [y, m] = next.split('-').map(Number);
          setCalYM({ year: y, month: m - 1 });
        }
      })
      .catch(() => {});
    fetch('/api/location/visit-ng')
      .then((r) => r.json())
      .then((d) => setVisitNgDates(new Set(d.data ?? [])))
      .catch(() => {});
    fetch('/api/location/booked-shoots')
      .then((r) => r.json())
      .then((d) => setBookedShoots(new Set((d.data ?? []).map((s: { date: string; timeSlot: string }) => `${s.date}|${s.timeSlot}`))))
      .catch(() => {});
  }, [today]);

  // 選択中の時間帯が予約済みになったら選択解除
  useEffect(() => {
    if (shootDate && shootTime && bookedShoots.has(`${shootDate}|${shootTime}`)) setShootTime('');
  }, [shootDate, shootTime, bookedShoots]);

  function toggleOption(optionId: string) {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.optionId === optionId);
      if (exists) return prev.filter((o) => o.optionId !== optionId);
      return [...prev, { optionId, quantity: 1 }];
    });
  }
  function setOptionQty(optionId: string, quantity: number) {
    setSelectedOptions((prev) => prev.map((o) => (o.optionId === optionId ? { ...o, quantity: Math.max(1, quantity) } : o)));
  }
  const optionTotal = selectedOptions.reduce((sum, so) => {
    const opt = options.find((o) => o.id === so.optionId);
    return sum + (opt ? opt.price * so.quantity : 0);
  }, 0);

  // 主役のお子様のお支度：着付け＋ヘアメイクはプラン込み（¥0表示）、日本髪のみ別途料金
  function isNihongami(o: Option) { return o.id === 'loc-opt-nihongami' || o.name.includes('日本髪'); }
  const mainPrepOptions = options.filter((o) => !o.name.includes('ヘアメイクのみ'));
  const mainPrepPrice = (o: Option) => (isNihongami(o) ? o.price : 0);
  function toggleMainPrep(id: string) {
    setMainPrep((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const mainPrepFee = mainPrep.reduce((sum, id) => {
    const o = options.find((x) => x.id === id);
    return sum + (o ? mainPrepPrice(o) : 0);
  }, 0);

  // 本番撮影日の土日で平日/休日を自動判定
  const isHolidayShoot = shootDate ? isWeekend(shootDate) : false;
  // ロケ用プランを「（平日）／（休日）」を除いたベース名でまとめ、撮影日に応じた金額を出す
  const planTiers = (() => {
    const map = new Map<string, { base: string; weekday?: Plan; holiday?: Plan }>();
    for (const p of plans) {
      const base = p.name.replace(/（平日）|（休日）/g, '').trim();
      const e = map.get(base) ?? { base };
      if (p.name.includes('休日')) e.holiday = p; else e.weekday = p;
      map.set(base, e);
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.weekday?.price ?? a.holiday?.price ?? 0) - (b.weekday?.price ?? b.holiday?.price ?? 0),
    );
  })();
  const selectedTier = planTiers.find((t) => t.base === planTier);
  const selectedPlan = selectedTier ? (isHolidayShoot ? selectedTier.holiday : selectedTier.weekday) : undefined;
  const planLabel = selectedPlan?.name ?? '';
  const planPrice = selectedPlan?.price ?? 0;
  const insuranceFee = insurance === '加入する' ? CANCEL_INSURANCE : 0;
  const grandTotal = planPrice + optionTotal + insuranceFee + mainPrepFee;

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

  const visitValid = visitDate && visitDate >= today && (!maxVisitDate || visitDate <= maxVisitDate) && visitStatus === 'free' && !visitNgDates.has(visitDate);
  // 日程（本番＋見学）が揃ったらプラン選択を表示。次へ進むにはプラン選択も必須。
  const datesValid = shootDate && shootTime && visitValid;
  const scheduleValid = datesValid && !!planTier;
  const customerValid = name.trim() && furigana.trim() && phone.trim() && zip.trim() && address.trim() && phoneCallPreference
    && !validateName(name) && !validateFurigana(furigana) && !validatePhone(phone) && !validateZip(zip) && !validateAddress(address) && !validateEmail(email);
  const peopleValid = childrenCount !== '' && adultCount !== '';
  const canNext = (step === 0 && scheduleValid) || (step === 1 && customerValid) || (step === 2 && peopleValid) || step === 3 || step === 4;

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const childrenDetail = childrenDetails.length > 0
      ? childrenDetails.map((c, i) => `${i + 1}人目: ${c.name}（${c.furigana}）（${c.gender}）${c.birthday} / ${c.clothingSize}`).join('\n')
      : '';
    // 主役のお子様のお支度を備考に記録（管理画面の「お客様備考」で把握）。日本髪のみ+料金を明記
    const mainPrepNote = mainPrep.length
      ? '【ご主役のお子様のお支度】' + mainPrep
          .map((id) => { const o = options.find((x) => x.id === id); if (!o) return null; return isNihongami(o) ? `${o.name}（＋${formatCurrency(o.price)}）` : o.name; })
          .filter(Boolean).join('、')
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
      selectedOptions,
      phoneCallPreference,
      cancelPolicyAgreed: true,
      lineUserId,
      lineName,
    };
    const headers = { 'Content-Type': 'application/json' };
    // ローカルは開発DB。見学(16:30)＋本番撮影の2件を作成（どちらも shoot_type=location）。
    // プラン/オプション/見学日/保険はそれぞれの正規項目に保存し、備考には詰め込まない。
    try {
      // ① 見学（16:30・重複チェックあり）。見学レコードにも見学日を持たせる
      const visitRes = await fetch('/api/reservations', {
        method: 'POST', headers,
        body: JSON.stringify({ ...base, isVisit: true, date: visitDate, timeSlot: VISIT_TIME, visitDate, note: '' }),
      });
      const visitData = await visitRes.json();
      if (!visitData.success) { setError(visitData.error ?? '見学枠の登録に失敗しました'); return; }

      // ② 本番撮影（仮予約）：プランは正規項目(planId)、見学日/保険も専用項目に
      const shootRes = await fetch('/api/reservations', {
        method: 'POST', headers,
        body: JSON.stringify({ ...base, isVisit: false, planId: selectedPlan?.id ?? '', date: shootDate, timeSlot: shootTime, visitDate, cancelInsurance: insurance, note: mainPrepNote }),
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
          <h2 className="font-bold mb-1" style={{ color: '#e53935', fontSize: '14px' }}>仮予約を受け付けました</h2>
          <p className="font-bold mb-2" style={{ color: '#e53935', fontSize: '20px' }}>※まだ予約は確定しておりません</p>
          <p className="text-sm text-gray-500 mb-6">
            担当者より見学・お振込のご案内をご連絡いたします。
          </p>
          {reservationNumber && (
            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 mb-1">予約番号</p>
              <p className="font-bold text-emerald-800 tracking-wide" style={{ fontSize: '13px' }}>{reservationNumber}</p>
            </div>
          )}
          {!inLine && reservationNumber && (
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
              <div className="flex flex-col items-center bg-white rounded-xl border border-green-200 p-4 mb-3">
                <QRCodeSVG value={`https://line.me/R/oaMessage/${LINE_OA_ID}/?${encodeURIComponent(`matka予約: ${reservationNumber}`)}`} size={120} />
                <p className="text-xs text-gray-500 mt-2">カメラでスキャン または ボタンをタップ</p>
              </div>
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
          {inLine && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">
              ✅ ご予約内容をLINEアカウントと連携しました
            </p>
          )}
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
    const shootSet = new Set(shootDays);
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
            {calendarGrid(calYM, setCalYM, (d) => shootSet.has(d) && SHOOT_TIMES.some((t) => !bookedShoots.has(`${d}|${t.value}`)), shootDate, setShootDate)}
            {shootDate && (() => {
              const avail = SHOOT_TIMES.filter((t) => !bookedShoots.has(`${shootDate}|${t.value}`));
              return (
                <div className="flex gap-2">
                  {avail.map((t) => (
                    <button key={t.value} type="button" onClick={() => setShootTime(t.value)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors
                        ${shootTime === t.value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-700 hover:border-emerald-200'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              );
            })()}
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
                  (d) => d >= today && (!maxVisitDate || d <= maxVisitDate) && !takenVisitDates.has(d) && !visitNgDates.has(d),
                  visitDate,
                  setVisitDate,
                )}
                {visitDate && <p className="text-xs text-emerald-700 font-medium">見学：{jpDate(visitDate)} {VISIT_TIME}</p>}
                {visitStatus === 'checking' && <p className="text-xs text-gray-400">空き状況を確認中...</p>}
                {visitStatus === 'taken' && <p className="text-xs text-red-600">この日の見学（{VISIT_TIME}）は既に予約が入っています。別の日をお選びください。</p>}

                {/* プラン選択（撮影日の平日/休日で金額を自動切替。金額はDBのロケ用プランを使用） */}
                {datesValid && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-bold text-gray-900">プランをお選びください <span className="text-red-500">*</span></p>
                    <p className="text-xs text-gray-400">
                      撮影日（{jpDate(shootDate)}）は<strong>{isHolidayShoot ? '休日料金' : '平日料金'}</strong>が適用されます。全プランにご主役のお子様1名様分のお支度料金・施設利用料が含まれます。
                    </p>
                    <div className="space-y-2">
                      {planTiers.map((tier) => {
                        const p = isHolidayShoot ? tier.holiday : tier.weekday;
                        if (!p) return null;
                        const sel = planTier === tier.base;
                        const desc = p.description || PLAN_DESC[tier.base];
                        const note = PLAN_NOTE[tier.base];
                        return (
                          <button key={tier.base} type="button" onClick={() => setPlanTier(tier.base)}
                            className={`w-full flex justify-between items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors
                              ${sel ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300 hover:border-emerald-200'}`}>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900">{tier.base}</p>
                              {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
                              {note && <p className="text-xs text-emerald-700 mt-0.5">※ {note}</p>}
                            </div>
                            <p className="text-lg font-bold text-emerald-700 flex-shrink-0 whitespace-nowrap">{formatCurrency(p.price)}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-red-600 space-y-1 leading-relaxed">
                      <p>※ お得なセットプランの料金は、事前お振込時のみの適用となります。</p>
                      <p>※ オプション・日本髪・キャンセル保険は次のステップ以降でお選びいただけます。</p>
                    </div>
                  </div>
                )}
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

        {/* お電話の希望 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">仮予約後のお電話について <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-400 mb-2">担当者からのお電話をご希望されますか？ご要望・ご不明点がある方は「希望する」をお選びください。</p>
          <div className="flex gap-3">
            {['希望する', '希望しない'].map((opt) => (
              <button key={opt} type="button" onClick={() => setPhoneCallPreference(opt)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${phoneCallPreference === opt ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600 hover:border-emerald-200'}`}>{opt}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderPeople() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">来店人数</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">お子様 *</label>
            <select value={childrenCount} onChange={(e) => handleChildrenCountChange(e.target.value)}
              className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="">選択...</option>
              {['1', '2', '3', '4', '5'].map((v) => (<option key={v} value={v}>{v}名</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">大人の方 *</label>
            <select value={adultCount} onChange={(e) => setAdultCount(e.target.value)}
              className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600">
              <option value="">選択...</option>
              {['1', '2', '3', '4', '5以上'].map((v) => (<option key={v} value={v}>{v === '5以上' ? '5名以上' : `${v}名`}</option>))}
            </select>
          </div>
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

  function renderMainPrep() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">ご主役のお子様のお支度</h2>
        <p className="text-xs text-gray-400">ご主役のお子様のお支度内容をご選択ください。</p>
        {mainPrepOptions.length === 0 ? (
          <p className="text-sm text-gray-400">選択可能な項目はありません。</p>
        ) : (
          <div className="space-y-3">
            {mainPrepOptions.map((opt) => {
              const selected = mainPrep.includes(opt.id);
              return (
                <div key={opt.id} onClick={() => toggleMainPrep(opt.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                    ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${selected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                    {selected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{opt.name}</p>
                    {opt.description && (
                      <p className={`text-xs mt-0.5 ${opt.description.startsWith('※') ? 'text-red-500' : 'text-gray-400'}`}>{opt.description}</p>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 flex-shrink-0">{formatCurrency(mainPrepPrice(opt))}</p>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-400">※ ご主役のお子様のお支度料金はプラン料金に含まれております（日本髪をご希望の場合のみ別途2,200円）。</p>
      </div>
    );
  }

  function renderOptions() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">オプション選択</h2>
        <p className="text-xs text-gray-400">他のお子様のお着付け・ヘアメイクをご希望の方はこちらでお選びください（任意・複数選択可）。</p>
        {options.length === 0 ? (
          <p className="text-sm text-gray-400">選択可能なオプションはありません。</p>
        ) : (
          <div className="space-y-3">
            {options.map((opt) => {
              const selected = selectedOptions.find((so) => so.optionId === opt.id);
              return (
                <div key={opt.id} onClick={() => toggleOption(opt.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                    ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${selected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                    {selected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{opt.name}</p>
                    {opt.description && (
                      <p className={`text-xs mt-0.5 ${opt.description.startsWith('※') ? 'text-red-500' : 'text-gray-400'}`}>{opt.description}</p>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 flex-shrink-0">{formatCurrency(opt.price)}</p>
                  {selected && (
                    <input type="number" min={1} value={selected.quantity}
                      onChange={(e) => { e.stopPropagation(); setOptionQty(opt.id, Number(e.target.value)); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-14 text-center text-sm border border-emerald-600 rounded-lg px-2 py-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {optionTotal > 0 && (
          <div className="flex justify-between text-sm font-semibold text-emerald-800 border-t border-gray-100 pt-3">
            <span>オプション小計</span><span>{formatCurrency(optionTotal)}</span>
          </div>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800"><span className="font-semibold">注意事項</span>　※お着付けをご希望の場合はヘアメイクもセットのご案内となります。</p>
        </div>
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
          <div className="flex justify-between pt-2 border-t border-gray-200"><span className="text-gray-500">{planLabel}</span><span className="text-gray-800">{formatCurrency(planPrice)}</span></div>
          {mainPrep.length > 0 && (
            <div className="space-y-1">
              <p className="text-gray-500">ご主役のお子様のお支度</p>
              {mainPrep.map((id) => {
                const opt = options.find((o) => o.id === id);
                if (!opt) return null;
                return (
                  <div key={id} className="flex justify-between text-gray-500">
                    <span>　{opt.name}</span><span>{isNihongami(opt) ? formatCurrency(opt.price) : 'プラン内'}</span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedOptions.length > 0 && (
            <div className="space-y-1">
              {selectedOptions.map((so) => {
                const opt = options.find((o) => o.id === so.optionId);
                if (!opt) return null;
                return (
                  <div key={so.optionId} className="flex justify-between text-gray-500">
                    <span>　{opt.name} ×{so.quantity}</span><span>{formatCurrency(opt.price * so.quantity)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {insuranceFee > 0 && (
            <div className="flex justify-between text-gray-500"><span>　キャンセル保険</span><span>{formatCurrency(insuranceFee)}</span></div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200"><span>合計（税込）</span><span className="text-emerald-700">{formatCurrency(grandTotal)}</span></div>
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
              <li>ご主役のお子様のソロカット中心です。ご家族・ご兄弟写真は数カット程度撮影可能です。</li>
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

  const renderers = [renderSchedule, renderCustomer, renderPeople, renderMainPrep, renderOptions, renderConfirm];

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
