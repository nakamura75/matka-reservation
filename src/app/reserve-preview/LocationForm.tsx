'use client';

import { useState } from 'react';
import { TruckIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

// ============================================================
// バリデーション（スタジオフォームと同じルール）
// ============================================================
function validateName(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < 2) return '2文字以上で入力してください';
  return null;
}
function validateFurigana(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < 2) return '2文字以上で入力してください';
  if (!/^[぀-ゟ゠-ヿ｡-ﾟ ー　\s]+$/.test(t)) return 'カタカナまたはひらがなで入力してください';
  return null;
}
function validatePhone(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!/^[\d\-－ー\s]+$/.test(t)) return '半角数字とハイフンで入力してください';
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return '電話番号は10〜11桁で入力してください';
  return null;
}
function validateEmail(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'メールアドレスの形式が正しくありません';
  return null;
}
function validateZip(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{3}-?\d{4}$/.test(t)) return '郵便番号は7桁（例: 123-4567）で入力してください';
  return null;
}
function validateAddress(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < 5) return '住所を正しく入力してください';
  return null;
}

// ============================================================
// ステップ（ロケ：プラン/オプション/キャンセルポリシーなし）
// 見学日・本番撮影日の選択は受付ルール確定後に前段へ追加予定
// ============================================================
const STEPS = ['お客様情報', '来店人数', '確認・送信'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="py-3 px-4">
      <div className="flex items-center justify-center">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors
                ${i < current ? 'bg-emerald-700 text-white' :
                  i === current ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600' :
                  'bg-gray-100 text-gray-400'}`}
            >
              {i < current ? <CheckCircleIcon className="w-5 h-5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px ${i < current ? 'bg-emerald-700' : 'bg-gray-200'}`} />
            )}
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
  const [childrenDetails, setChildrenDetails] = useState<{
    name: string; furigana: string; gender: string; birthday: string; clothingSize: string;
  }[]>([]);

  // 確認画面：キャンセル保険の加入選択・注意事項の確認
  const [insurance, setInsurance] = useState<'' | '加入する' | '加入しない'>('');
  const [acknowledged, setAcknowledged] = useState(false);

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

  // ステップごとの「次へ」可否
  const step0Valid =
    name.trim() && furigana.trim() && phone.trim() && zip.trim() && address.trim() &&
    !validateName(name) && !validateFurigana(furigana) && !validatePhone(phone) &&
    !validateZip(zip) && !validateAddress(address) && !validateEmail(email);
  const step1Valid = childrenCount !== '' && adultCount !== '';
  const canNext = (step === 0 && step0Valid) || (step === 1 && step1Valid);

  async function handleSubmit() {
    setSubmitting(true);
    // 【プレビュー専用】本番DBには保存しません
    try {
      console.log('[reserve-preview / location] 送信内容（保存しません）:', {
        type: 'location', name, furigana, zip, address, phone, email,
        childrenCount: Number(childrenCount) || 0, adultCount, childrenDetails,
        insurance,
      });
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSubmitted(true);
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
          <h2 className="font-bold text-emerald-800 mb-2">ロケーション撮影のお申し込みを受け付けました</h2>
          <p className="text-sm text-gray-500">
            （これはプレビューです。実際には保存されていません）
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 各ステップ
  // ============================================================
  function renderStep0() {
    const fields: {
      label: string; value: string; onChange: (v: string) => void; type: string; placeholder: string; error: string | null;
    }[] = [
      { label: 'お名前 *',       value: name,     onChange: setName,     type: 'text',  placeholder: '山田 花子',         error: validateName(name) },
      { label: 'フリガナ *',     value: furigana, onChange: setFurigana, type: 'text',  placeholder: 'ヤマダ ハナコ',     error: validateFurigana(furigana) },
      { label: '電話番号 *',     value: phone,    onChange: setPhone,    type: 'tel',   placeholder: '090-0000-0000',     error: validatePhone(phone) },
      { label: 'メールアドレス', value: email,    onChange: setEmail,    type: 'email', placeholder: 'example@email.com', error: validateEmail(email) },
      { label: '郵便番号 *',     value: zip,      onChange: setZip,      type: 'text',  placeholder: '123-4567',          error: validateZip(zip) },
      { label: '住所 *',         value: address,  onChange: setAddress,  type: 'text',  placeholder: '東京都渋谷区...',   error: validateAddress(address) },
    ];
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">お客様情報</h2>
        {fields.map(({ label, value, onChange, type, placeholder, error }) => (
          <div key={label}>
            <label className="block text-sm text-gray-600 mb-1">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                error ? 'border-red-400 bg-red-50/30' : 'border-gray-400'
              }`}
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        ))}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900">来店人数</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">お子様 *</label>
          <select
            value={childrenCount}
            onChange={(e) => handleChildrenCountChange(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5'].map((v) => (<option key={v} value={v}>{v}名</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">大人の方 *</label>
          <select
            value={adultCount}
            onChange={(e) => setAdultCount(e.target.value)}
            className="w-full text-sm border border-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="">選択...</option>
            {['0', '1', '2', '3', '4', '5以上'].map((v) => (
              <option key={v} value={v}>{v === '5以上' ? '5名以上' : `${v}名`}</option>
            ))}
          </select>
        </div>

        {childrenDetails.map((child, i) => (
          <div key={i} className="border border-emerald-300 rounded-xl p-4 space-y-3 bg-emerald-50/50">
            <p className="text-sm font-semibold text-emerald-700">お子様 {i + 1}人目</p>
            <div>
              <label className="block text-xs text-gray-600 mb-1">お名前 *</label>
              <input type="text" value={child.name} onChange={(e) => updateChildDetail(i, 'name', e.target.value)} placeholder="例：さくら"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">フリガナ *</label>
              <input type="text" value={child.furigana} onChange={(e) => updateChildDetail(i, 'furigana', e.target.value)} placeholder="例：サクラ"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">性別 *</label>
              <div className="flex gap-3">
                {['男の子', '女の子'].map((g) => (
                  <button key={g} type="button" onClick={() => updateChildDetail(i, 'gender', g)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors
                      ${child.gender === g ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600 hover:border-emerald-200'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">生年月日 *</label>
              <input type="date" value={child.birthday} onChange={(e) => updateChildDetail(i, 'birthday', e.target.value)}
                className="w-full max-w-full box-border text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">洋服サイズ *</label>
              <input type="text" value={child.clothingSize} onChange={(e) => updateChildDetail(i, 'clothingSize', e.target.value)} placeholder="例：100cm / 3歳用"
                className="w-full text-sm border border-gray-400 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <h2 className="text-base font-bold text-gray-900">確認・送信</h2>

        {/* 入力内容サマリ */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">お名前</span><span className="text-gray-800">{name}（{furigana}）</span></div>
          <div className="flex justify-between"><span className="text-gray-500">電話番号</span><span className="text-gray-800">{phone}</span></div>
          {email && <div className="flex justify-between"><span className="text-gray-500">メール</span><span className="text-gray-800">{email}</span></div>}
          <div className="flex justify-between"><span className="text-gray-500">郵便番号</span><span className="text-gray-800">{zip}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">住所</span><span className="text-gray-800 text-right">{address}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">来店人数</span><span className="text-gray-800">お子様{childrenCount || 0}名・大人{adultCount === '5以上' ? '5名以上' : `${adultCount || 0}名`}</span></div>
        </div>

        {/* キャンセル保険の加入選択（必須） */}
        <div className="border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-1">キャンセル保険（5,500円）<span className="text-red-500"> *</span></p>
          <p className="text-xs text-gray-500 mb-3">
            ご加入いただくと、万が一キャンセルされた際にキャンセル料の請求がございません。ご加入の場合はプラン料金とともに事前振込をお願いします。
          </p>
          <div className="flex gap-3">
            {(['加入する', '加入しない'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setInsurance(opt)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors
                  ${insurance === opt ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-600 hover:border-emerald-200'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 注意事項（読んで確認） */}
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
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              <li>お子様のコンディション等でお支度時間を超過した場合、撮影を中止させていただく可能性がございます。</li>
            </ul>
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
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              <li>お支払いは撮影日2週間前までに銀行振込をお願いします。</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-700"
            />
            <span className="text-sm text-gray-700">上記のご確認事項を確認・了承しました</span>
          </label>
        </div>

        <p className="text-xs text-gray-400">
          ※ キャンセル規定は別途、承諾書にてご確認いただきます。
        </p>
      </div>
    );
  }

  // ============================================================
  // レイアウト
  // ============================================================
  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* ロケのイメージカラー（緑） */}
      <div className="rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-700 text-white p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <TruckIcon className="w-5 h-5" />
          <span className="text-sm tracking-widest font-medium">matka. Location</span>
        </div>
        <h2 className="text-xl font-bold">ロケーション撮影 予約</h2>
      </div>

      {/* 白キャンバス（スタジオと同じく、格子背景の上に白カードを重ねる） */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <StepIndicator current={step} />

        <div className="px-4 pb-4">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        {/* ナビゲーション */}
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
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-3 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || insurance === '' || !acknowledged}
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '送信中...' : '送信する'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
