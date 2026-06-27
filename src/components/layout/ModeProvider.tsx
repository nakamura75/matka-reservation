'use client';

import { createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { MODE_COOKIE, type ShootMode } from '@/lib/mode';

const ModeContext = createContext<ShootMode>('studio');

export function ModeProvider({ mode, children }: { mode: ShootMode; children: React.ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

/** 現在のモード（'studio' | 'location'）を取得 */
export function useMode(): ShootMode {
  return useContext(ModeContext);
}

/** モードを切り替える（cookie を更新してサーバーコンポーネントを再取得） */
export function useSetMode(): (mode: ShootMode) => void {
  const router = useRouter();
  return (mode: ShootMode) => {
    document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}`;
    // 予約詳細を開いた状態でモードを切り替えたら一覧へ戻す
    // （別モードの内容を引き継いで表示してしまうのを防ぐ。タイムライン/新規/一覧自体は対象外）
    const seg = window.location.pathname.split('/'); // ['', 'reservations', '<id>', ...]
    if (seg[1] === 'reservations' && seg[2] && seg[2] !== 'timeline' && seg[2] !== 'new') {
      router.push('/reservations');
    } else {
      router.refresh();
    }
  };
}
