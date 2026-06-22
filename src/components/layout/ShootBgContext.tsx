'use client';

import { createContext, useContext } from 'react';

// ページ（クライアント）から <main> の背景色クラスを設定するためのコンテキスト。
// ロケーション表示中は薄緑にするのに使う。
export const ShootBgContext = createContext<(bg: string | null) => void>(() => {});

export const useShootBg = () => useContext(ShootBgContext);
