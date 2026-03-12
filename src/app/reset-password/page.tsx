'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError('パスワードの更新に失敗しました。もう一度お試しください。');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/reservations');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Matka<span className="text-brand">Studio</span>
        </h1>
        <p className="text-sm text-gray-500 mb-8">パスワード再設定</p>

        {success ? (
          <div className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-3">
            パスワードを更新しました。リダイレクトします...
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-500 mb-4 bg-red-50 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="新しいパスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <input
                type="password"
                placeholder="パスワード確認"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? '更新中...' : 'パスワードを更新'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
