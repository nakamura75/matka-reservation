import { NextResponse } from 'next/server';
import { getCalendarClient } from '@/lib/google-sheets';
import { CALENDAR_ID } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const calendar = getCalendarClient();
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 30);

  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: today.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = (res.data.items ?? []).map((e) => ({
    summary: e.summary,
    startDate: e.start?.date,
    startDateTime: e.start?.dateTime,
  }));

  return NextResponse.json({ calendarId: CALENDAR_ID, events });
}
