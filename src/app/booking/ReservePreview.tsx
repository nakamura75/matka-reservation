'use client';

import { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CameraIcon } from '@heroicons/react/24/outline';
import StudioForm from './StudioForm';
import LocationForm from './LocationForm';
import { LIFF_ID, LINE_OA_ID } from '@/lib/constants';

// 入口をLINE必須にするか。
// true  = LINE外(PC/Web)は予約不可（誘導画面で停止）
// false = LINE外でも予約可（現状 /reserve と同じ挙動。完了画面で予約番号のLINE送信へ誘導）
// ※先方が「入口は現状のまま（LINE任意）」で確定したら false のままGo。仕様が戻ったら true に。
const REQUIRE_LINE = false;

type Mode = '' | 'studio' | 'location';

// 木のアイコン（輪郭線のみ・塗りなし。雲形の樹冠＋中央を貫く一本線の幹＋
// 左右対称2段の45°枝。線の太さ均一1.5、枝先は角（丸めない）。ピクトグラム）
function TreeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* 丸く高さのある雲形の樹冠（下部中央に浅いくぼみ＝幹の出口） */}
      <path d="M4 14.5 a3.5 3.5 0 0 1 0.4 -6.6 a2.7 2.7 0 0 1 3.6 -2.2 a4 4 0 0 1 8 0 a2.7 2.7 0 0 1 3.6 2.2 a3.5 3.5 0 0 1 0.4 6.6 C19 16.5 16.5 17.5 14 16.8 C13 16.5 11 16.5 10 16.8 C7.5 17.5 5 16.5 4 14.5 Z" />
      {/* 幹（中央を垂直に貫く一本線・下に少し突き抜け）＋ 樹冠内の左右対称2段45°枝（枝先は角） */}
      <path d="M12 8 V22 M12 12 L8.8 8.8 M12 12 L15.2 8.8 M12 15 L8.8 11.8 M12 15 L15.2 11.8" />
    </svg>
  );
}

export default function ReservePreview() {
  const [mode, setMode] = useState<Mode>('');
  // LIFF 判定状態: checking=初期化中 / in-line=LINE内 / outside=LINE外（予約不可・誘導画面）
  const [liffState, setLiffState] = useState<'checking' | 'in-line' | 'outside'>('checking');
  const [lineUserId, setLineUserId] = useState('');
  const [lineName, setLineName] = useState('');

  // LIFF初期化（入口で判定）：LINE内なら userId を自動連携、LINE外なら誘導画面へ。
  // 開発環境(localhost)・?preview=1 はゲート回避（ダミー入力・PC確認用）。本番はLINE内限定。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isPreview = new URLSearchParams(window.location.search).has('preview');
    const isDev = process.env.NODE_ENV === 'development';
    if (isPreview || isDev) {
      setLiffState('in-line');
      return;
    }
    const liffId = LIFF_ID;
    if (!liffId) {
      console.warn('[LIFF] LIFF_ID が未設定です');
      setLiffState('outside');
      return;
    }
    import('@line/liff').then((liff) => {
      liff.default.init({ liffId })
        .then(() => {
          if (liff.default.isInClient()) {
            setLiffState('in-line');
            liff.default.getProfile().then((profile) => {
              setLineUserId(profile.userId);
              setLineName(profile.displayName);
            }).catch((e) => console.error('[LIFF] getProfile失敗:', e));
          } else {
            setLiffState('outside');
          }
        })
        .catch((e) => {
          console.error('[LIFF] init失敗:', e);
          setLiffState('outside');
        });
    }).catch((e) => {
      console.error('[LIFF] SDK読み込み失敗:', e);
      setLiffState('outside');
    });
  }, []);

  // ============================================================
  // LIFF 判定中のローディング
  // ============================================================
  if (liffState === 'checking') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    );
  }

  // ============================================================
  // 入口：LINEアプリ外からのアクセス → 予約はLINE内のみ（誘導画面）
  // ※ REQUIRE_LINE=false のときはこの壁をスキップし、LINE外でもフォームへ進める
  // ============================================================
  if (REQUIRE_LINE && liffState === 'outside') {
    const liffUrl = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : '';
    const addFriendUrl = `https://line.me/R/ti/p/${encodeURIComponent(LINE_OA_ID)}`;
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-16 h-16 rounded-full bg-[#06C755]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">ご予約はLINEから</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            ご予約には公式LINEの友だち登録が必要です。<br />
            下のボタンからLINEアプリで予約フォームを開いてください。
          </p>
          {liffUrl ? (
            <a
              href={liffUrl}
              className="block w-full text-center py-3 bg-[#06C755] text-white text-sm font-bold rounded-xl hover:bg-[#05a847] transition-colors mb-4"
            >
              LINEで予約をはじめる
            </a>
          ) : (
            <a
              href={addFriendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 bg-[#06C755] text-white text-sm font-bold rounded-xl hover:bg-[#05a847] transition-colors mb-4"
            >
              公式LINEを友だち追加する
            </a>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">
            ※スマートフォンにLINEアプリがインストールされている必要があります。<br />
            PCからはご予約いただけません。
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LINE内（または開発/プレビュー）：撮影タイプ選択 → 各フォーム
  // ============================================================
  return (
    <>
      {/* 開発用の注意書き（本番では非表示。ローカル/プレビューのみ＝実際に開発DBに接続する環境） */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-xs text-center py-1.5 px-4">
          ⚠️ 開発用フォームです。入力は<strong>開発DBに保存されます</strong>（本番DBには影響しません）。
        </div>
      )}

      {/* 撮影タイプを選び直す（分岐後のみ表示） */}
      {mode !== '' && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <button
            type="button"
            onClick={() => setMode('')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            撮影タイプを選び直す
          </button>
        </div>
      )}

      {/* ① 入口：スタジオ / ロケ の選択 */}
      {mode === '' && (
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.2em] text-gray-400 font-medium">RESERVATION</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">撮影タイプを選択</h2>
            <p className="text-sm text-gray-400 mt-2">ご希望の撮影スタイルをお選びください</p>
          </div>

          <div className="space-y-5">
            {/* スタジオ撮影（淡いブランド色を維持・遊び感のある装飾） */}
            <button
              type="button"
              onClick={() => setMode('studio')}
              className="group relative w-full overflow-hidden flex items-center gap-4 rounded-3xl border-2 border-[#E8552B]/30 bg-brand-light p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand transition-all"
            >
              {/* 装飾シェイプ（透明度を効かせるため hex 指定） */}
              <CameraIcon strokeWidth={1.5} className="absolute -right-3 -bottom-4 w-24 h-24 text-[#E8552B]/10 group-hover:rotate-12 transition-transform duration-300 pointer-events-none" />
              <span className="absolute right-6 top-4 w-2.5 h-2.5 rounded-full bg-[#E8552B]/20 group-hover:scale-150 transition-transform" />
              <span className="absolute right-11 top-7 w-1.5 h-1.5 rounded-full bg-[#E8552B]/15" />

              <span className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                <CameraIcon className="w-7 h-7" />
              </span>
              <div className="relative flex-1 min-w-0">
                <span className="block text-base font-bold text-gray-900">スタジオ撮影</span>
                <span className="block text-xs text-gray-500 mt-0.5">店舗スタジオでの撮影予約</span>
              </div>
              <ChevronRightIcon className="relative w-5 h-5 text-brand group-hover:translate-x-1.5 transition-transform flex-shrink-0" />
            </button>

            {/* ロケーション撮影（淡い緑を維持・遊び感のある装飾） */}
            <button
              type="button"
              onClick={() => setMode('location')}
              className="group relative w-full overflow-hidden flex items-center gap-4 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-600 transition-all"
            >
              {/* 装飾シェイプ */}
              <TreeIcon className="absolute -right-3 -bottom-4 w-24 h-24 text-emerald-600/10 group-hover:translate-x-1 transition-transform duration-300 pointer-events-none" />
              <span className="absolute right-6 top-4 w-2.5 h-2.5 rounded-full bg-emerald-500/25 group-hover:scale-150 transition-transform" />
              <span className="absolute right-11 top-7 w-1.5 h-1.5 rounded-full bg-emerald-500/15" />

              <span className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-700 text-white flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                <TreeIcon className="w-7 h-7" />
              </span>
              <div className="relative flex-1 min-w-0">
                <span className="block text-base font-bold text-gray-900">ロケーション撮影</span>
                <span className="block text-xs text-gray-500 mt-0.5">文化財などでの撮影（見学必須）</span>
              </div>
              <ChevronRightIcon className="relative w-5 h-5 text-emerald-600 group-hover:translate-x-1.5 transition-transform flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* ② 分岐（LINE連携情報を各フォームへ引き継ぎ） */}
      {mode === 'studio' && <StudioForm lineUserId={lineUserId} lineName={lineName} isInLine={liffState === 'in-line'} />}
      {mode === 'location' && <LocationForm lineUserId={lineUserId} lineName={lineName} isInLine={liffState === 'in-line'} />}
    </>
  );
}
