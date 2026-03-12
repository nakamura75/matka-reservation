import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

// GET /api/auth-debug?email=xxx — ユーザーの認証状態を診断（デバッグ用・本番では削除）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ユーザー一覧からemailで検索
  const { data: users, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = users.users.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: 'User not found', email });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    confirmed_at: user.confirmed_at,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    banned_until: user.banned_until,
    role: user.role,
    app_metadata: user.app_metadata,
  });
}

// POST /api/auth-debug — パスワードでサインインを試行して詳細エラーを返す
export async function POST(request: Request) {
  const { email, password } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({
      success: false,
      errorMessage: error.message,
      errorStatus: error.status,
      errorCode: (error as Record<string, unknown>).code,
    });
  }

  return NextResponse.json({
    success: true,
    userId: data.user?.id,
    email: data.user?.email,
  });
}
