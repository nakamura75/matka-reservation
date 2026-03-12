import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/layout/SessionProvider';

export const metadata: Metadata = {
  title: 'Matka Photo Studio - 予約管理',
  description: 'Matka Photo Studio 予約管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap"
        />
      </head>
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
