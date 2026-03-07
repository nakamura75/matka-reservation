'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

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

      {/* 右側：通知・ログアウト */}
      <div className="flex items-center gap-3">
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
