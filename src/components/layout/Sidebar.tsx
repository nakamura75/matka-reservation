'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDaysIcon,
  UsersIcon,
  ShoppingBagIcon,
  Cog6ToothIcon,
  XMarkIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { href: '/reservations', label: '予約一覧', icon: TableCellsIcon, exact: true },
  { href: '/reservations/calendar', label: 'カレンダー', icon: CalendarDaysIcon },
  { href: '/customers', label: '顧客管理', icon: UsersIcon },
  { href: '/orders', label: '注文管理', icon: ShoppingBagIcon },
  { href: '/settings', label: '設定', icon: Cog6ToothIcon },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* モバイル overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-cream-dark flex flex-col transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* ロゴ */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
          <img src="https://matka-photostudio.jp/wp-content/uploads/2025/03/%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97-5474@2x.png" alt="Matka Studio" className="h-8 w-auto" />
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-brand-light text-brand-dark'
                    : 'text-gray-600 hover:bg-cream hover:text-gray-900'
                  }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
