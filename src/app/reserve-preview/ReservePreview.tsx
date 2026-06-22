'use client';

import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CameraIcon, TruckIcon } from '@heroicons/react/24/outline';
import StudioForm from './StudioForm';
import LocationForm from './LocationForm';

type Mode = '' | 'studio' | 'location';

export default function ReservePreview() {
  const [mode, setMode] = useState<Mode>('');

  return (
    <>
      {/* 開発用フォーム（ローカルは開発DBに接続） */}
      <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-xs text-center py-1.5 px-4">
        ⚠️ 開発用フォームです。入力は<strong>開発DBに保存されます</strong>（本番DBには影響しません）。
      </div>

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
              className="group relative w-full overflow-hidden flex items-center gap-4 rounded-3xl border-2 border-brand/30 bg-brand-light p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-brand transition-all"
            >
              {/* 装飾シェイプ */}
              <CameraIcon className="absolute -right-3 -bottom-4 w-24 h-24 text-brand/10 group-hover:rotate-12 transition-transform duration-300 pointer-events-none" />
              <span className="absolute right-6 top-4 w-2.5 h-2.5 rounded-full bg-brand/20 group-hover:scale-150 transition-transform" />
              <span className="absolute right-11 top-7 w-1.5 h-1.5 rounded-full bg-brand/15" />

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
              <TruckIcon className="absolute -right-3 -bottom-4 w-24 h-24 text-emerald-600/10 group-hover:translate-x-1 transition-transform duration-300 pointer-events-none" />
              <span className="absolute right-6 top-4 w-2.5 h-2.5 rounded-full bg-emerald-500/25 group-hover:scale-150 transition-transform" />
              <span className="absolute right-11 top-7 w-1.5 h-1.5 rounded-full bg-emerald-500/15" />

              <span className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-700 text-white flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                <TruckIcon className="w-7 h-7" />
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

      {/* ② 分岐 */}
      {mode === 'studio' && <StudioForm />}
      {mode === 'location' && <LocationForm />}
    </>
  );
}
