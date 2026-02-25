import { google } from 'googleapis';
import { SPREADSHEET_ID, SHEET_NAMES } from './constants';
import type {
  Customer,
  Plan,
  Option,
  Staff,
  Reservation,
  ReservationOption,
  Order,
  OrderItem,
} from '@/types';

// ============================================================
// 認証
// ============================================================
function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');

  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
}

export function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

export function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

// ============================================================
// 汎用 読み書き
// ============================================================

/** シートの全データを取得（1行目=ヘッダー、2行目以降=データ） */
export async function getSheetData(sheetName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  return (res.data.values ?? []) as string[][];
}

/** シートに行を追記 */
export async function appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

/** 特定の行を更新（rowIndex: スプレッドシートの実際の行番号、1始まり） */
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: (string | number | boolean | null)[]
): Promise<void> {
  const sheets = getSheetsClient();
  const colCount = values.length;
  const endCol = String.fromCharCode(64 + colCount); // A=1, Z=26
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:${endCol}${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

/** 特定セルを更新 */
export async function updateCell(
  sheetName: string,
  cell: string,
  value: string | number | boolean | null
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// ============================================================
// 顧客
// ============================================================

/** 顧客一覧取得 */
export async function getCustomers(): Promise<Customer[]> {
  const rows = await getSheetData(SHEET_NAMES.CUSTOMERS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => rowToCustomer(r, i + 2));
}

/** ID顧客で顧客取得 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const customers = await getCustomers();
  return customers.find((c) => c.id === id) ?? null;
}

/** 顧客追加 → 追加した顧客を返す */
export async function createCustomer(data: Omit<Customer, '_rowNumber'>): Promise<Customer> {
  const values = customerToRow(data);
  await appendRow(SHEET_NAMES.CUSTOMERS, values);
  return data as Customer;
}

/** 顧客更新 */
export async function updateCustomer(data: Customer): Promise<void> {
  if (!data._rowNumber) throw new Error('rowNumber is required');
  await updateRow(SHEET_NAMES.CUSTOMERS, data._rowNumber, customerToRow(data));
}

function rowToCustomer(r: string[], rowNumber: number): Customer {
  return {
    _rowNumber: rowNumber,
    id: r[1] ?? '',       // B: ID顧客
    name: r[2] ?? '',     // C: 顧客名
    furigana: r[3],       // D: フリガナ
    phone: r[4] ?? '',    // E: 電話番号
    email: r[5],          // F: メールアドレス
    zipCode: r[6],        // G: 郵便番号
    address: r[7],        // H: 住所
    lineName: r[8],       // I: LINE名
    note: r[9],           // J: 備考
    createdAt: r[10],     // K: 登録日 (0-indexed from col A)
  };
  // Note: スプレッドシートの列は A=0, B=1, ...（配列インデックス）
}

function customerToRow(c: Omit<Customer, '_rowNumber'>): (string | number | boolean | null)[] {
  // A: _RowNumber（システム） → 空欄
  return [
    '',           // A: _RowNumber
    c.id,         // B: ID顧客
    c.name,       // C: 顧客名
    c.furigana ?? '',  // D: フリガナ
    c.phone,      // E: 電話番号
    c.email ?? '', // F: メールアドレス
    c.zipCode ?? '', // G: 郵便番号
    c.address ?? '', // H: 住所
    c.lineName ?? '', // I: LINE名
    c.note ?? '', // J: 備考
    c.createdAt ?? new Date().toLocaleDateString('ja-JP'), // K: 登録日
  ];
}

// ============================================================
// プラン
// ============================================================

export async function getPlans(): Promise<Plan[]> {
  const rows = await getSheetData(SHEET_NAMES.PLANS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => rowToPlan(r, i + 2));
}

function rowToPlan(r: string[], rowNumber: number): Plan {
  return {
    _rowNumber: rowNumber,
    id: r[1] ?? '',
    name: r[2] ?? '',
    price: Number(r[3]) || 0,
    duration: Number(r[4]) || 90,
    description: r[5],
    isActive: r[6] === 'TRUE' || r[6] === '1' || r[6] === 'true',
    commissionPrice: Number(r[7]) || 0,
  };
}

// ============================================================
// オプション
// ============================================================

export async function getOptions(): Promise<Option[]> {
  const rows = await getSheetData(SHEET_NAMES.OPTIONS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => rowToOption(r, i + 2));
}

function rowToOption(r: string[], rowNumber: number): Option {
  return {
    _rowNumber: rowNumber,
    id: r[1] ?? '',
    name: r[2] ?? '',
    price: Number(r[3]) || 0,
    description: r[4],
    isActive: r[5] === 'TRUE' || r[5] === '1' || r[5] === 'true',
    externalCode: r[6],
    commissionPrice: Number(r[7]) || 0,
  };
}

// ============================================================
// スタッフ
// ============================================================

export async function getStaff(): Promise<Staff[]> {
  const rows = await getSheetData(SHEET_NAMES.STAFF);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[1] ?? '',
    name: r[2] ?? '',
    isActive: r[3],
  }));
}

// ============================================================
// 予約
// ============================================================

export async function getReservations(): Promise<Reservation[]> {
  const rows = await getSheetData(SHEET_NAMES.RESERVATIONS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => rowToReservation(r, i + 2));
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const list = await getReservations();
  return list.find((r) => r.id === id) ?? null;
}

export async function createReservation(data: Omit<Reservation, '_rowNumber'>): Promise<void> {
  await appendRow(SHEET_NAMES.RESERVATIONS, reservationToRow(data));
}

export async function updateReservationStatus(
  rowNumber: number,
  status: Reservation['status'],
  lineUserId?: string
): Promise<void> {
  const sheets = getSheetsClient();
  // K列 (index 10) = ステータス
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAMES.RESERVATIONS}!L${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
  if (lineUserId) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.RESERVATIONS}!O${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[lineUserId]] },
    });
  }
}

/** 予約番号で予約を検索（LINE紐づけ用） */
export async function getReservationByNumber(reservationNumber: string): Promise<Reservation | null> {
  const list = await getReservations();
  return list.find((r) => r.reservationNumber === reservationNumber) ?? null;
}

/** LINE_UserID を予約に紐づけ */
export async function linkLineUserId(rowNumber: number, lineUserId: string): Promise<void> {
  // O列 = LINE_UserID
  await updateCell(SHEET_NAMES.RESERVATIONS, `O${rowNumber}`, lineUserId);
  // P列 = フラグ を TRUE に
  await updateCell(SHEET_NAMES.RESERVATIONS, `P${rowNumber}`, 'TRUE');
}

function rowToReservation(r: string[], rowNumber: number): Reservation {
  return {
    _rowNumber: rowNumber,
    id: r[1] ?? '',             // B: ID予約
    customerId: r[2] ?? '',     // C: ID顧客
    planId: r[3] ?? '',         // D: IDプラン
    paymentStatus: r[4] === 'TRUE' || r[4] === '1',
    paymentDate: r[5],          // F
    date: r[6] ?? '',           // G: 予約日
    timeSlot: (r[7] ?? '9:00') as Reservation['timeSlot'], // H
    childrenCount: Number(r[8]) || undefined,
    adultCount: r[9],
    familyNote: r[10],
    status: (r[11] ?? '予約済') as Reservation['status'], // L
    referencePhoto: r[12],
    note: r[13],
    createdAt: r[14],
    lineUserId: r[15],          // P: LINE_UserID (0-index 15 = col P? let me recount)
    flag: r[16] === 'TRUE',
    phonePreference: r[17],
    scene: r[18] as Reservation['scene'],
    reservationNumber: r[19],   // T: 予約番号 (0-index 19 = col T)
    discountAmount: Number(r[20]) || 0,
    discountReason: r[21],
    checkInTime: r[22],
    checkOutTime: r[23],
  };
  // 列対応(0-indexed):
  // 0=A(_RowNumber), 1=B(ID予約), 2=C(ID顧客), 3=D(IDプラン),
  // 4=E(支払ステータス), 5=F(支払日), 6=G(予約日), 7=H(予約時間帯),
  // 8=I(お子様人数), 9=J(大人人数), 10=K(構成メモ), 11=L(ステータス),
  // 12=M(参考写真), 13=N(備考), 14=O(登録日), 15=P(LINE_UserID),
  // 16=Q(フラグ), 17=R(電話希望), 18=S(撮影シーン), 19=T(予約番号), ...
}

function reservationToRow(r: Omit<Reservation, '_rowNumber'>): (string | number | boolean | null)[] {
  return [
    '',                              // A: _RowNumber
    r.id,                            // B: ID予約
    r.customerId,                    // C: ID顧客
    r.planId,                        // D: IDプラン
    r.paymentStatus ? 'TRUE' : 'FALSE', // E
    r.paymentDate ?? '',             // F
    r.date,                          // G: 予約日
    r.timeSlot,                      // H: 予約時間帯
    r.childrenCount ?? '',           // I
    r.adultCount ?? '',              // J
    r.familyNote ?? '',              // K
    r.status,                        // L: ステータス
    r.referencePhoto ?? '',          // M
    r.note ?? '',                    // N: 備考
    r.createdAt ?? new Date().toISOString(), // O: 登録日
    r.lineUserId ?? '',              // P: LINE_UserID
    r.flag ? 'TRUE' : 'FALSE',       // Q: フラグ
    r.phonePreference ?? '',         // R
    r.scene ?? '',                   // S: 撮影シーン
    r.reservationNumber ?? '',       // T: 予約番号
    r.discountAmount ?? 0,           // U
    r.discountReason ?? '',          // V
    r.checkInTime ?? '',             // W
    r.checkOutTime ?? '',            // X
  ];
}

// ============================================================
// 予約オプション
// ============================================================

export async function getReservationOptions(reservationId?: string): Promise<ReservationOption[]> {
  const rows = await getSheetData(SHEET_NAMES.RESERVATION_OPTIONS);
  if (rows.length < 2) return [];
  const all = rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[1] ?? '',
    reservationId: r[2] ?? '',
    optionId: r[3] ?? '',
    quantity: Number(r[4]) || 1,
    note: r[5],
  } as ReservationOption));
  return reservationId ? all.filter((o) => o.reservationId === reservationId) : all;
}

export async function createReservationOption(data: Omit<ReservationOption, '_rowNumber' | 'subtotal' | 'commissionAmount'>): Promise<void> {
  await appendRow(SHEET_NAMES.RESERVATION_OPTIONS, [
    '',
    data.id,
    data.reservationId,
    data.optionId,
    data.quantity,
    data.note ?? '',
  ]);
}

// ============================================================
// 注文
// ============================================================

export async function getOrders(): Promise<Order[]> {
  const rows = await getSheetData(SHEET_NAMES.ORDERS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[1] ?? '',
    customerId: r[2] ?? '',
    reservationId: r[3],
    orderDate: r[4] ?? '',
    isPaid: r[5] === 'TRUE',
    paidDate: r[6],
    note: r[7],
    flag: r[8] === 'TRUE',
  } as Order));
}

// ============================================================
// 注文詳細
// ============================================================

export async function getOrderItems(orderId?: string): Promise<OrderItem[]> {
  const rows = await getSheetData(SHEET_NAMES.ORDER_ITEMS);
  if (rows.length < 2) return [];
  const all = rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[1] ?? '',
    orderId: r[2] ?? '',
    productId: r[3] ?? '',
    customerId: r[4],
    quantity: Number(r[5]) || 1,
    status: (r[6] ?? '受注') as OrderItem['status'],
    completedDate: r[7],
    orderedDate: r[8],
    arrivedDate: r[9],
    shippedDate: r[10],
    trackingNumber: r[11],
    note: r[12],
  } as OrderItem));
  return orderId ? all.filter((item) => item.orderId === orderId) : all;
}
