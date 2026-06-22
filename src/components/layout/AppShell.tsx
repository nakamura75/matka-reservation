'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { ShootBgContext } from './ShootBgContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mainBg, setMainBg] = useState<string | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className={`flex-1 overflow-y-auto p-4 md:p-6 transition-colors ${mainBg ?? ''}`}>
          <ShootBgContext.Provider value={setMainBg}>
            {children}
          </ShootBgContext.Provider>
        </main>
      </div>
    </div>
  );
}
