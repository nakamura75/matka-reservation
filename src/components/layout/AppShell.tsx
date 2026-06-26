'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { ModeProvider } from './ModeProvider';
import type { ShootMode } from '@/lib/mode';

export default function AppShell({ mode, children }: { mode: ShootMode; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoc = mode === 'location';

  return (
    <ModeProvider mode={mode}>
      {/* data-mode 配下の brand-* が CSS変数でモード色に切替（globals.css 参照） */}
      <div data-mode={mode} className="flex h-screen overflow-hidden bg-cream">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className={`flex-1 overflow-y-auto p-4 md:p-6 transition-colors ${isLoc ? 'bg-emerald-50/60' : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </ModeProvider>
  );
}
