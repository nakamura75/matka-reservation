import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLocationShootDays, setLocationShootDay, removeLocationShootDay } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 撮影可能日の一覧（公開：ロケ予約フォームが使用）
// data: { date, am, pm }[] — am=午前 / pm=午後（時刻は LOC_SHOOT_TIMES）の公開可否
export async function GET() {
  try {
    const days = await getLocationShootDays();
    return NextResponse.json({ success: true, data: days });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

// 撮影可能日を保存（管理：認証必須）
// body: { date, am, pm } — 午前/午後を個別に指定。両方 false なら非公開（行を削除）
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { date, am, pm } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日付が不正です' }, { status: 400 });
    }
    // am/pm 未指定は従来どおり「終日公開」として扱う
    await setLocationShootDay(date, am !== false, pm !== false);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

// 撮影可能日を削除（管理：認証必須）
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const date = req.nextUrl.searchParams.get('date');
    if (!date) return NextResponse.json({ error: '日付が指定されていません' }, { status: 400 });
    await removeLocationShootDay(date);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
