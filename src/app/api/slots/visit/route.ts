import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getActiveVisitTimes } from '@/lib/db';
import { VISIT_TIME_SLOTS, VISIT_DURATION_MIN } from '@/lib/constants';

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * GET /api/slots/visit?date=YYYY-MM-DD&exclude=ID
 * 指定日に「すでに埋まっている見学開始枠」を返す。
 * 見学1件は1時間占有するため、既存見学の前後30分の枠もまとめて不可になる。
 * exclude は編集中の予約IDを除外したいとき（自分自身を埋まり扱いにしない）。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const exclude = searchParams.get('exclude') ?? undefined;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, error: '日付が不正です' }, { status: 400 });
    }

    const visitTimes = (await getActiveVisitTimes(date, exclude)).map(hhmmToMin);
    const occupiedSlots = VISIT_TIME_SLOTS.filter((slot) => {
      const s = hhmmToMin(slot);
      return visitTimes.some((v) => Math.abs(v - s) < VISIT_DURATION_MIN);
    });

    return NextResponse.json({ success: true, data: { occupiedSlots } });
  } catch (err) {
    console.error('[/api/slots/visit] error:', err);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
