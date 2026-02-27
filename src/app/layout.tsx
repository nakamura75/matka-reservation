import type { Metadata } from 'next';
import { Zen_Maru_Gothic } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/layout/SessionProvider';

const zenMaruGothic = Zen_Maru_Gothic({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-zen-maru-gothic',
});

export const metadata: Metadata = {
  title: 'Matka Photo Studio - 予約管理',
  description: 'Matka Photo Studio 予約管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${zenMaruGothic.variable} ${zenMaruGothic.className} antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
