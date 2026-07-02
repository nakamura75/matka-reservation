'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bars3Icon, BellIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { useMode, useSetMode } from './ModeProvider';
import { modeLabel } from '@/lib/mode';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const mode = useMode();
  const setMode = useSetMode();
  // 反対のモード（押すと切り替わる先）
  const other = mode === 'location' ? 'studio' : 'location';
  const otherIsLoc = other === 'location';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-cream-dark px-4 py-3 flex items-center justify-between">
      {/* ハンバーガー（モバイル） */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-900 p-1 rounded"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>

      {/* タイトル（デスクトップでは空欄） */}
      <div className="flex-1 lg:flex-none" />

      {/* 右側：モード切替・通知・ログアウト */}
      <div className="flex items-center gap-3">
        {/* 反対のモードへ直接切替（スタジオ画面→ロケ / ロケ画面→スタジオ） */}
        <button
          onClick={() => setMode(other)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors
            ${otherIsLoc
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-[#FDF0EB] text-[#D04420] border-[#E8552B]/20 hover:bg-[#FBE3D9]'}`}
          title={`${modeLabel(other)}に切り替える`}
        >
          <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
          {modeLabel(other)}へ切替
        </button>

        <button className="text-gray-400 hover:text-gray-600 p-1 rounded">
          <BellIcon className="w-5 h-5" />
        </button>

        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded border border-cream-dark hover:border-brand/30 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
