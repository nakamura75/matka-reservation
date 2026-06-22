'use client';

import { useState, useEffect } from 'react';
import type { Reservation } from '@/types';
import ReservationList from './ReservationList';
import { useShootBg } from '@/components/layout/ShootBgContext';

export default function ReservationsClient({ reservations }: { reservations: Reservation[] }) {
  const [shootTab, setShootTab] = useState<'studio' | 'location'>('studio');
  const isLoc = shootTab === 'location';
  const setMainBg = useShootBg();
  useEffect(() => {
    setMainBg(isLoc ? 'bg-emerald-50/60' : null);
    return () => setMainBg(null);
  }, [isLoc, setMainBg]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">予約管理</h1>
        <a
          href="/reservations/new"
          className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${isLoc ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand hover:bg-brand-dark'}`}
        >
          + 新規予約
        </a>
      </div>
      <ReservationList reservations={reservations} shootTab={shootTab} setShootTab={setShootTab} />
    </div>
  );
}
