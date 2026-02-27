import ReserveForm from './ReserveForm';

export const metadata = {
  title: '撮影予約 | Matka Photo Studio',
  description: 'Matka Photo Studio のオンライン撮影予約フォームです。',
};

export default function ReservePage() {
  return (
    <div className="min-h-screen bg-brand-light">
      <header className="bg-white border-b border-cream-dark px-4 py-4 text-center">
        <img src="https://matka-photostudio.jp/wp-content/uploads/2025/03/%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97-5474@2x.png" alt="Matka Studio" className="h-8 w-auto mx-auto" />
        <p className="text-sm text-gray-400 mt-0.5">撮影予約フォーム</p>
      </header>
      <ReserveForm />
    </div>
  );
}
