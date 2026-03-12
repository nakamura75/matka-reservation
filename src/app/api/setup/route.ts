import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/setup — 初期管理者ユーザー作成（1回のみ使用）
export async function POST(request: Request) {
  const { email, password, secret } = await request.json();

  // 簡易保護: CRON_SECRETまたは SUPABASE_SERVICE_ROLE_KEY の先頭20文字で認証
  const expectedSecret = process.env.CRON_SECRET || '';
  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 既存ユーザーチェック
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email === email);

  if (existing) {
    // パスワード更新
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Password updated', userId: existing.id });
  }

  // 新規作成
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'User created', userId: data.user.id });
}
