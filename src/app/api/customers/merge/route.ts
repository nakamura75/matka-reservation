import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCustomers, getReservations } from '@/lib/google-sheets';
import { SHEET_NAMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customers/merge
 * primaryId の顧客にすべての予約を統合し、duplicateIds の顧客行を削除する
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { primaryId, duplicateIds } = await req.json() as {
    primaryId: string;
    duplicateIds: string[];
  };

  if (!primaryId || !duplicateIds?.length) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const [customers, reservations] = await Promise.all([
    getCustomers(),
    getReservations(),
  ]);

  const primary = customers.find((c) => c.id === primaryId);
  if (!primary) return NextResponse.json({ error: 'Primary customer not found' }, { status: 404 });

  const { getSheetsClient } = await import('@/lib/google-sheets');
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID ?? '';

  // 1. 重複顧客に紐づく予約の customerId を primaryId に書き換え
  const reservationsToUpdate = reservations.filter((r) => duplicateIds.includes(r.customerId));
  if (reservationsToUpdate.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: reservationsToUpdate.map((r) => ({
          range: `${SHEET_NAMES.RESERVATIONS}!B${r._rowNumber}`,
          values: [[primaryId]],
        })),
      },
    });
  }

  // 2. 顧客シートの sheetId を取得
  const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const customersSheetMeta = spreadsheetMeta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAMES.CUSTOMERS
  );
  const sheetId = customersSheetMeta?.properties?.sheetId;
  if (sheetId == null) {
    return NextResponse.json({ error: 'Customers sheet not found' }, { status: 500 });
  }

  // 3. 重複顧客の行を削除（行番号大→小の順に削除してインデックスズレを防ぐ）
  const duplicatesToDelete = customers
    .filter((c): c is typeof c & { _rowNumber: number } => duplicateIds.includes(c.id) && !!c._rowNumber)
    .sort((a, b) => b._rowNumber - a._rowNumber);

  for (const dup of duplicatesToDelete) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: dup._rowNumber - 1, // 0-indexed
              endIndex: dup._rowNumber,
            },
          },
        }],
      },
    });
  }

  return NextResponse.json({ success: true });
}
