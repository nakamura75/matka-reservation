'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(errorParam ? 'ログインに失敗しました。' : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ローカル開発用バイパス（Supabase未接続時）
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
      document.cookie = 'dev-auth=true; path=/';
      router.refresh();
      router.push('/reservations');
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // デバッグ用に実際のエラーメッセージも表示
      console.error('Auth error:', authError.message, authError.status);
      const errorMessages: Record<string, string> = {
        'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません。',
        'Email not confirmed': 'メールアドレスが確認されていません。確認メールをご確認ください。',
        'User banned': 'このアカウントは無効化されています。',
        'Too many requests': 'ログイン試行回数が多すぎます。しばらくしてからお試しください。',
      };
      setError(errorMessages[authError.message] || `ログインエラー: ${authError.message}`);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push('/reservations');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Matka<span className="text-brand">Studio</span>
      </h1>
      <p className="text-sm text-gray-500 mb-8">予約管理システム</p>

      {error && (
        <p className="text-sm text-red-500 mb-4 bg-red-50 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polyline points="2,4 12,13 22,4" />
          </svg>
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-6">
        スタッフ専用システムです。<br />許可されたアカウントのみログイン可能です。
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
