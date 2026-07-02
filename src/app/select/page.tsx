'use client';

import { useRouter } from 'next/navigation';
import { CameraIcon, TruckIcon } from '@heroicons/react/24/outline';
import { MODE_COOKIE, type ShootMode } from '@/lib/mode';

export default function SelectModePage() {
  const router = useRouter();

  function choose(mode: ShootMode) {
    document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push('/reservations');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Matka<span className="text-brand">Studio</span>
      </h1>
      <p className="text-sm text-gray-500 mb-10">管理する区分を選択してください</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <button
          onClick={() => choose('studio')}
          className="group flex flex-col items-center gap-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-[#E8552B] hover:shadow-md transition-all p-10"
        >
          <div className="w-16 h-16 rounded-full bg-[#FDF0EB] flex items-center justify-center">
            <CameraIcon className="w-8 h-8 text-[#E8552B]" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">スタジオ</p>
            <p className="text-xs text-gray-400 mt-1">店舗での撮影</p>
          </div>
        </button>

        <button
          onClick={() => choose('location')}
          className="group flex flex-col items-center gap-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-emerald-600 hover:shadow-md transition-all p-10"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <TruckIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">ロケーション</p>
            <p className="text-xs text-gray-400 mt-1">出張・ロケ撮影</p>
          </div>
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-10">区分は後からサイドバー上部でいつでも切り替えできます。</p>
    </div>
  );
}
