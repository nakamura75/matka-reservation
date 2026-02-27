'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Matka<span className="text-brand">Studio</span>
      </h1>
      <p className="text-sm text-gray-500 mb-8">予約管理システム</p>

      {error && (
        <p className="text-sm text-red-500 mb-4 bg-red-50 rounded-lg px-4 py-2">
          ログインに失敗しました。許可されたアカウントでお試しください。
        </p>
      )}

      <button
        onClick={() => signIn('google', { callbackUrl: '/reservations' })}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="2,4 12,13 22,4" />
        </svg>
        メールでログイン
      </button>

      <p className="text-xs text-gray-400 mt-6">
        スタッフ専用システムです。<br />許可されたメールアドレスのみログイン可能です。
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <Suspense fallback={<div className="text-gray-400">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
