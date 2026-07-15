import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '撮影予約 | Matka Photo Studio',
  description: 'Matka Photo Studio のオンライン撮影予約フォームです。',
};

// 旧予約URL。新しいLINE予約フォーム（/booking）へ全員を集約するためリダイレクト。
// ※ 旧フォーム本体は ./ReserveForm.tsx に残置（元に戻す場合はこのファイルを差し替え）。
export default function ReservePage() {
  redirect('/booking');
}
