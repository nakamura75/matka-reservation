import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/admin';
import { VISIT_DURATION_MIN } from '@/lib/constants';

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * GET /api/slots/visit-dates?from=YYYY-MM-DD&to=YYYY-MM-DD&time=16:30
 * 指定期間で、その time の見学枠が既に埋まっている日付の一覧を返す。
 * （見学1件=1時間占有。time の前後60分未満に既存見学があればその日は不可）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const time = searchParams.get('time') ?? '16:30';
    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'from/to が必要です' }, { status: 400 });
    }

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('reservations')
      .select('date, time_slot')
      .eq('status', '見学')
      .gte('date', from)
      .lte('date', to);
    if (error) throw error;

    const target = toMin(time);
    const taken = new Set<string>();
    for (const r of data ?? []) {
      const d = r.date as string | null;
      const ts = r.time_slot as string | null;
      if (!d || !ts) continue;
      if (Math.abs(toMin(ts) - target) < VISIT_DURATION_MIN) taken.add(d);
    }

    return NextResponse.json({ success: true, data: { takenDates: Array.from(taken) } });
  } catch (err) {
    console.error('[/api/slots/visit-dates] error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
