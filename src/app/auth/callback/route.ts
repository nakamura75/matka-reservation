import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Supabase Auth のメールリンク（パスワードリセット等）を処理
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/reservations';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // パスワードリセットの場合はリセットページへ
      const type = searchParams.get('type');
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // トークン交換失敗 → ログインページへ
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
