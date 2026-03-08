import ReserveForm from './ReserveForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '撮影予約 | Matka Photo Studio',
  description: 'Matka Photo Studio のオンライン撮影予約フォームです。',
};

export default function ReservePage() {
  const isMaintenance = process.env.MAINTENANCE_MODE === 'true';

  return (
    <div className="min-h-screen bg-white bg-check-grid [background-size:60px_60px]">
      <header className="bg-white border-b border-cream-dark px-4 py-4 text-center">
        <img src="https://matka-photostudio.jp/wp-content/uploads/2025/03/%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97-5474@2x.png" alt="Matka Studio" className="h-8 w-auto mx-auto" />
        <p className="text-sm text-gray-400 mt-0.5">撮影予約フォーム</p>
      </header>
      {isMaintenance ? (
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <p className="text-4xl mb-4">🔧</p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              現在メンテナンス中です
            </h2>
            <p className="text-sm text-gray-500">
              申し訳ございません。<br />
              予約フォームは現在ご利用いただけません。<br />
              しばらくお待ちください。
            </p>
          </div>
        </div>
      ) : (
        <ReserveForm />
      )}
    </div>
  );
}
