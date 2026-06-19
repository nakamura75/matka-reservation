'use client';

import { useState } from 'react';
import { ChevronLeftIcon, CameraIcon, TruckIcon } from '@heroicons/react/24/outline';
import StudioForm from './StudioForm';
import LocationForm from './LocationForm';

type Mode = '' | 'studio' | 'location';

export default function ReservePreview() {
  const [mode, setMode] = useState<Mode>('');

  return (
    <>
      {/* プレビュー専用バナー（本番ではないことを明示） */}
      <div className="bg-amber-100 border-b border-amber-300 text-amber-800 text-xs text-center py-1.5 px-4">
        ⚠️ これは確認用プレビューです。入力しても<strong>本番には保存されません</strong>。
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
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* 白キャンバス（フォームと統一） */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-center text-lg font-bold text-gray-900 mb-1">撮影タイプを選択してください</h2>
            <p className="text-center text-sm text-gray-400 mb-8">ご希望の撮影をお選びください</p>

            <div className="space-y-4">
              {/* スタジオ撮影（イメージカラーは確定後に差し替え） */}
              <button
                type="button"
                onClick={() => setMode('studio')}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-brand/30 bg-brand-light hover:border-brand hover:shadow-sm transition-all p-5 text-left"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-brand text-white flex-shrink-0">
                  <CameraIcon className="w-6 h-6" />
                </span>
                <span>
                  <span className="block font-bold text-gray-900">スタジオ撮影</span>
                  <span className="block text-xs text-gray-500 mt-0.5">店舗スタジオでの撮影予約</span>
                </span>
              </button>

              {/* ロケーション撮影（緑） */}
              <button
                type="button"
                onClick={() => setMode('location')}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 hover:border-emerald-600 hover:shadow-sm transition-all p-5 text-left"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-700 text-white flex-shrink-0">
                  <TruckIcon className="w-6 h-6" />
                </span>
                <span>
                  <span className="block font-bold text-gray-900">ロケーション撮影</span>
                  <span className="block text-xs text-gray-500 mt-0.5">文化財などでの撮影（見学必須）</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ② 分岐 */}
      {mode === 'studio' && <StudioForm />}
      {mode === 'location' && <LocationForm />}
    </>
  );
}
