import ReserveForm from './ReserveForm';

export const metadata = {
  title: '撮影予約 | Matka Photo Studio',
  description: 'Matka Photo Studio のオンライン撮影予約フォームです。',
};

export default function ReservePage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-cream-dark px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">
          Matka<span className="text-brand">Studio</span>
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">撮影予約フォーム</p>
      </header>
      <ReserveForm />
    </div>
  );
}
