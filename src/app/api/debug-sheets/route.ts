import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { SPREADSHEET_ID, SHEET_NAMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result: Record<string, unknown> = {
    spreadsheetId: SPREADSHEET_ID || '(未設定)',
    sheetName: SHEET_NAMES.PLANS,
  };

  if (!SPREADSHEET_ID) {
    return NextResponse.json({ ...result, error: 'GOOGLE_SPREADSHEET_ID が未設定です' });
  }

  try {
    const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '';
    if (!keyRaw) {
      return NextResponse.json({ ...result, error: 'GOOGLE_SERVICE_ACCOUNT_KEY が未設定です' });
    }
    const key = JSON.parse(keyRaw);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAMES.PLANS,
    });
    const values = res.data.values ?? [];
    result.rowCount = values.length;
    result.rows = values.slice(0, 5); // 最大5行まで表示
    return NextResponse.json(result);
  } catch (e: unknown) {
    result.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(result);
  }
}
