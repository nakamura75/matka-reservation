import ReserveForm from './ReserveForm';

export const metadata = {
  title: '撮影予約 | Matka Photo Studio',
  description: 'Matka Photo Studio のオンライン撮影予約フォームです。',
};

export default function ReservePage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-cream-dark px-4 py-4 text-center">
        <img src="/logo.svg" alt="Matka Studio" className="h-8 w-auto mx-auto" />
        <p className="text-sm text-gray-400 mt-0.5">撮影予約フォーム</p>
      </header>
      <ReserveForm />
    </div>
  );
}
