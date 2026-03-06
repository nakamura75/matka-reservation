'use client';

import { signOut, useSession } from 'next-auth/react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

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

      {/* 右側：通知・ユーザー */}
      <div className="flex items-center gap-3">
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded">
          <BellIcon className="w-5 h-5" />
        </button>

        {session?.user && (
          <div className="flex items-center gap-2">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? ''}
                className="w-8 h-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="hidden sm:block text-sm text-gray-700 font-medium">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-gray-400 hover:text-brand px-2 py-1 rounded border border-cream-dark hover:border-brand/30 transition-colors"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
