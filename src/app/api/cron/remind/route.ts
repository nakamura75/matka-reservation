import { NextRequest, NextResponse } from 'next/server';
import { getReservations, getPlans } from '@/lib/google-sheets';
import { sendLinePush, buildReminderMessage } from '@/lib/line';

export const dynamic = 'force-dynamic';

/** GET /api/cron/remind - 翌日の予約確定にリマインドLINEを送信（毎日9:00 JST実行） */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 翌日の日付をJST（UTC+9）で計算
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(jstNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

  const [reservations, plans] = await Promise.all([getReservations(), getPlans()]);

  const targets = reservations.filter(
    (r) => r.date === tomorrowStr && r.status === '予約確定' && r.lineUserId
  );

  const results = await Promise.allSettled(
    targets.map(async (r) => {
      const plan = plans.find((p) => p.id === r.planId);
      if (!plan) throw new Error(`Plan not found for reservation ${r.id}`);
      await sendLinePush(r.lineUserId!, [
        buildReminderMessage(r, plan.name, r.checkInTime ?? '', r.checkOutTime ?? ''),
      ]);
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ sent, failed, date: tomorrowStr });
}
