import { google } from 'googleapis';
import { SPREADSHEET_ID, SHEET_NAMES } from './constants';
import type {
  Customer,
  Plan,
  Option,
  Product,
  Staff,
  Reservation,
  ReservationOption,
  Order,
  OrderItem,
  SalesRecord,
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
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });
    return (res.data.values ?? []) as string[][];
  } catch {
    return [];
  }
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
    id: r[0] ?? '',       // A: ID顧客
    name: r[1] ?? '',     // B: 顧客名
    furigana: r[2],       // C: フリガナ
    phone: r[3] ?? '',    // D: 電話番号
    email: r[4],          // E: メールアドレス
    zipCode: r[5],        // F: 郵便番号
    address: r[6],        // G: 住所
    lineName: r[7],       // H: LINE名
    note: r[8],           // I: 備考
    createdAt: r[9],      // J: 登録日
  };
}

function customerToRow(c: Omit<Customer, '_rowNumber'>): (string | number | boolean | null)[] {
  return [
    c.id,         // A: ID顧客
    c.name,       // B: 顧客名
    c.furigana ?? '',  // C: フリガナ
    c.phone,      // D: 電話番号
    c.email ?? '', // E: メールアドレス
    c.zipCode ?? '', // F: 郵便番号
    c.address ?? '', // G: 住所
    c.lineName ?? '', // H: LINE名
    c.note ?? '', // I: 備考
    c.createdAt ?? new Date().toLocaleDateString('ja-JP'), // J: 登録日
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
    id: r[0] ?? '',         // A: IDプラン
    name: r[1] ?? '',       // B: プラン名
    price: Number(r[2]) || 0, // C: 単価
    duration: Number(r[3]) || 90, // D: 所要時間
    description: r[4],      // E: 説明
    isActive: r[5] === 'TRUE' || r[5] === '1' || r[5] === 'true', // F: 有効
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
    id: r[0] ?? '',         // A: IDオプション
    name: r[1] ?? '',       // B: オプション名
    price: Number(r[2]) || 0, // C: 単価
    description: r[3],      // D: 説明
    isActive: r[4] === 'TRUE' || r[4] === '1' || r[4] === 'true', // E: 有効
    externalCode: r[5],     // F: 外部コード
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
    id: r[0] ?? '',       // A: IDスタッフ
    name: r[1] ?? '',     // B: スタッフ名
    isActive: r[2],       // C: 有効
    role: r[3],           // D: 担当
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
    range: `${SHEET_NAMES.RESERVATIONS}!K${rowNumber}`,
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

/** カレンダーイベントIDを予約に保存（X列） */
export async function updateCalendarEventId(rowNumber: number, calendarEventId: string): Promise<void> {
  await updateCell(SHEET_NAMES.RESERVATIONS, `X${rowNumber}`, calendarEventId);
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
  // 列対応(0-indexed, _RowNumberはシートに存在しない):
  // 0=A(ID予約), 1=B(ID顧客), 2=C(IDプラン),
  // 3=D(支払ステータス), 4=E(支払日), 5=F(予約日), 6=G(予約時間帯),
  // 7=H(お子様人数), 8=I(大人人数), 9=J(構成メモ), 10=K(ステータス),
  // 11=L(参考写真), 12=M(備考), 13=N(登録日), 14=O(LINE_UserID),
  // 15=P(フラグ), 16=Q(電話希望), 17=R(撮影シーン), 18=S(予約番号),
  // 19=T(値引額), 20=U(値引理由), 21=V(入店時間), 22=W(退店時間),
  // 23=X(GoogleカレンダーイベントID), 24=Y(担当割り当てJSON)
  return {
    _rowNumber: rowNumber,
    id: r[0] ?? '',             // A: ID予約
    customerId: r[1] ?? '',     // B: ID顧客
    planId: r[2] ?? '',         // C: IDプラン
    paymentStatus: r[3] === 'TRUE' || r[3] === '1', // D: 支払ステータス
    paymentDate: r[4],          // E: 支払日
    date: r[5] ?? '',           // F: 予約日
    timeSlot: (r[6] ?? '9:00') as Reservation['timeSlot'], // G: 予約時間帯
    childrenCount: Number(r[7]) || undefined, // H: お子様人数
    adultCount: r[8],           // I: 大人人数
    familyNote: r[9],           // J: 構成メモ
    status: (() => {
      const s = (r[10] ?? '予約済') as Reservation['status'];
      // 予約確定済で予約日が過ぎていたら自動的に完了扱い
      if (s === '予約確定' && r[5]) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (new Date(r[5]) < today) return '完了' as Reservation['status'];
      }
      return s;
    })(), // K: ステータス（予約日過去なら自動完了）
    referencePhoto: r[11],      // L: 参考写真
    note: r[12],                // M: 備考
    createdAt: r[13],           // N: 登録日
    lineUserId: r[14],          // O: LINE_UserID
    flag: r[15] === 'TRUE',     // P: フラグ
    phonePreference: r[16],     // Q: 電話希望
    scene: r[17] as Reservation['scene'], // R: 撮影シーン
    reservationNumber: r[18],   // S: 予約番号
    discountAmount: Number(r[19]) || 0, // T: 値引額
    discountReason: r[20],      // U: 値引理由
    checkInTime: r[21],         // V: 入店時間
    checkOutTime: r[22],        // W: 退店時間
    calendarEventId: r[23],     // X: GoogleカレンダーイベントID
    pdfUrl: r[23]?.startsWith('http') ? r[23] : undefined, // X: 引継ぎPDF URL（matka_V6）
    staffAssignmentJson: r[24], // Y: 担当割り当てJSON
  };
}

function reservationToRow(r: Omit<Reservation, '_rowNumber'>): (string | number | boolean | null)[] {
  return [
    r.id,                            // A: ID予約
    r.customerId,                    // B: ID顧客
    r.planId,                        // C: IDプラン
    r.paymentStatus ? 'TRUE' : 'FALSE', // D: 支払ステータス
    r.paymentDate ?? '',             // E: 支払日
    r.date,                          // F: 予約日
    r.timeSlot,                      // G: 予約時間帯
    r.childrenCount ?? '',           // H: お子様人数
    r.adultCount ?? '',              // I: 大人人数
    r.familyNote ?? '',              // J: 構成メモ
    r.status,                        // K: ステータス
    r.referencePhoto ?? '',          // L: 参考写真
    r.note ?? '',                    // M: 備考
    r.createdAt ?? new Date().toISOString(), // N: 登録日
    r.lineUserId ?? '',              // O: LINE_UserID
    r.flag ? 'TRUE' : 'FALSE',       // P: フラグ
    r.phonePreference ?? '',         // Q: 電話希望
    r.scene ?? '',                   // R: 撮影シーン
    r.reservationNumber ?? '',       // S: 予約番号
    r.discountAmount ?? 0,           // T: 値引額
    r.discountReason ?? '',          // U: 値引理由
    r.checkInTime ?? '',             // V: 入店時間
    r.checkOutTime ?? '',            // W: 退店時間
    r.calendarEventId ?? '',         // X: GoogleカレンダーイベントID
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
    id: r[0] ?? '',             // A: ID予約オプション
    reservationId: r[1] ?? '',  // B: ID予約
    optionId: r[2] ?? '',       // C: IDオプション
    quantity: Number(r[3]) || 1, // D: 数量
    note: r[4],                 // E: 備考
  } as ReservationOption));
  return reservationId ? all.filter((o) => o.reservationId === reservationId) : all;
}

export async function createReservationOption(data: Omit<ReservationOption, '_rowNumber' | 'subtotal' | 'commissionAmount'>): Promise<void> {
  await appendRow(SHEET_NAMES.RESERVATION_OPTIONS, [
    data.id,              // A: ID予約オプション
    data.reservationId,   // B: ID予約
    data.optionId,        // C: IDオプション
    data.quantity,        // D: 数量
    data.note ?? '',      // E: 備考
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
    id: r[0] ?? '',             // A: ID注文
    customerId: r[1] ?? '',     // B: ID顧客
    reservationId: r[2],        // C: ID予約
    orderDate: r[3] ?? '',      // D: 注文日
    isPaid: r[4] === 'TRUE',    // E: 入金済
    paidDate: r[5],             // F: 入金日
    note: r[6],                 // G: 備考
    flag: r[7] === 'TRUE',      // H: フラグ
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
    id: r[0] ?? '',             // A: ID注文詳細
    orderId: r[1] ?? '',        // B: ID注文
    productId: r[2] ?? '',      // C: ID商品
    customerId: r[3],           // D: ID顧客（VC）
    quantity: Number(r[4]) || 1, // E: 数量
    status: (r[5] ?? '受注') as OrderItem['status'], // F: ステータス
    completedDate: r[6],        // G: 制作完了日
    orderedDate: r[7],          // H: 発注日
    arrivedDate: r[8],          // I: 入荷日
    shippedDate: r[9],          // J: 発送日
    trackingNumber: r[10],      // K: 追跡番号
    note: r[11],                // L: 備考
  } as OrderItem));
  return orderId ? all.filter((item) => item.orderId === orderId) : all;
}

export async function createOrder(data: Omit<Order, '_rowNumber' | 'items'>): Promise<void> {
  await appendRow(SHEET_NAMES.ORDERS, [
    data.id,                            // A: ID注文
    data.customerId,                    // B: ID顧客
    data.reservationId ?? '',           // C: ID予約
    data.orderDate,                     // D: 注文日
    data.isPaid ? 'TRUE' : 'FALSE',     // E: 入金済
    data.paidDate ?? '',                // F: 入金日
    data.note ?? '',                    // G: 備考
    data.flag ? 'TRUE' : 'FALSE',       // H: フラグ
  ]);
}

export async function updateOrder(
  rowNumber: number,
  fields: { isPaid?: boolean; paidDate?: string; note?: string }
): Promise<void> {
  const sheets = getSheetsClient();
  const updates: { range: string; value: string | number | boolean }[] = [];
  if (fields.isPaid !== undefined) {
    updates.push({ range: `${SHEET_NAMES.ORDERS}!E${rowNumber}`, value: fields.isPaid ? 'TRUE' : 'FALSE' });
    if (fields.isPaid && fields.paidDate) {
      updates.push({ range: `${SHEET_NAMES.ORDERS}!F${rowNumber}`, value: fields.paidDate });
    }
  }
  if (fields.note !== undefined) updates.push({ range: `${SHEET_NAMES.ORDERS}!G${rowNumber}`, value: fields.note });
  if (updates.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map(({ range, value }) => ({ range, values: [[value]] })),
    },
  });
}

export async function createOrderItem(
  data: Omit<OrderItem, '_rowNumber' | 'subtotal' | 'commissionAmount'>
): Promise<void> {
  await appendRow(SHEET_NAMES.ORDER_ITEMS, [
    data.id,               // A: ID注文詳細
    data.orderId,          // B: ID注文
    data.productId,        // C: ID商品
    data.customerId ?? '', // D: ID顧客
    data.quantity,         // E: 数量
    data.status,           // F: ステータス
    data.completedDate ?? '', // G: 制作完了日
    data.orderedDate ?? '',   // H: 発注日
    data.arrivedDate ?? '',   // I: 入荷日
    data.shippedDate ?? '',   // J: 発送日
    data.trackingNumber ?? '', // K: 追跡番号
    data.note ?? '',          // L: 備考
  ]);
}

export async function updateOrderItem(
  rowNumber: number,
  fields: {
    status?: OrderItem['status'];
    completedDate?: string;
    orderedDate?: string;
    arrivedDate?: string;
    shippedDate?: string;
    trackingNumber?: string;
    note?: string;
  }
): Promise<void> {
  const sheets = getSheetsClient();
  const col: Record<string, string> = {
    status:         `${SHEET_NAMES.ORDER_ITEMS}!F${rowNumber}`,
    completedDate:  `${SHEET_NAMES.ORDER_ITEMS}!G${rowNumber}`,
    orderedDate:    `${SHEET_NAMES.ORDER_ITEMS}!H${rowNumber}`,
    arrivedDate:    `${SHEET_NAMES.ORDER_ITEMS}!I${rowNumber}`,
    shippedDate:    `${SHEET_NAMES.ORDER_ITEMS}!J${rowNumber}`,
    trackingNumber: `${SHEET_NAMES.ORDER_ITEMS}!K${rowNumber}`,
    note:           `${SHEET_NAMES.ORDER_ITEMS}!L${rowNumber}`,
  };
  const updates = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ range: col[key], values: [[value]] }));
  if (updates.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
}

// ============================================================
// 商品
// ============================================================

export async function getProducts(): Promise<Product[]> {
  const rows = await getSheetData(SHEET_NAMES.PRODUCTS);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[0] ?? '',             // A: ID商品
    name: r[1] ?? '',           // B: 商品名
    price: Number(r[2]) || 0,   // C: 単価
    image: r[3],                // D: 商品画像
    description: r[4],          // E: 説明
    isActive: r[5] === 'TRUE' || r[5] === '1' || r[5] === 'true', // F: 有効
  } as Product));
}

export async function createProduct(data: Omit<Product, '_rowNumber'>): Promise<void> {
  await appendRow(SHEET_NAMES.PRODUCTS, [
    data.id,
    data.name,
    data.price,
    data.image ?? '',
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
  ]);
}

export async function updateProduct(data: Product): Promise<void> {
  if (!data._rowNumber) throw new Error('rowNumber is required');
  await updateRow(SHEET_NAMES.PRODUCTS, data._rowNumber, [
    data.id,
    data.name,
    data.price,
    data.image ?? '',
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
  ]);
}

// ============================================================
// プラン（設定用 CRUD）
// ============================================================

export async function createPlan(data: Omit<Plan, '_rowNumber'>): Promise<void> {
  await appendRow(SHEET_NAMES.PLANS, [
    data.id,
    data.name,
    data.price,
    data.duration,
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
  ]);
}

export async function updatePlan(data: Plan): Promise<void> {
  if (!data._rowNumber) throw new Error('rowNumber is required');
  await updateRow(SHEET_NAMES.PLANS, data._rowNumber, [
    data.id,
    data.name,
    data.price,
    data.duration,
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
  ]);
}

// ============================================================
// オプション（設定用 CRUD）
// ============================================================

export async function createOption(data: Omit<Option, '_rowNumber'>): Promise<void> {
  await appendRow(SHEET_NAMES.OPTIONS, [
    data.id,
    data.name,
    data.price,
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
    data.externalCode ?? '',
  ]);
}

export async function updateOption(data: Option): Promise<void> {
  if (!data._rowNumber) throw new Error('rowNumber is required');
  await updateRow(SHEET_NAMES.OPTIONS, data._rowNumber, [
    data.id,
    data.name,
    data.price,
    data.description ?? '',
    data.isActive ? 'TRUE' : 'FALSE',
    data.externalCode ?? '',
  ]);
}

// ============================================================
// スタッフ（設定用 CRUD）
// ============================================================

export async function createStaff(data: Omit<Staff, '_rowNumber'>): Promise<void> {
  await appendRow(SHEET_NAMES.STAFF, [
    data.id,
    data.name,
    data.isActive ?? 'TRUE',
    data.role ?? '',      // D: 担当
  ]);
}

export async function updateStaff(data: Staff): Promise<void> {
  if (!data._rowNumber) throw new Error('rowNumber is required');
  await updateRow(SHEET_NAMES.STAFF, data._rowNumber, [
    data.id,
    data.name,
    data.isActive ?? 'TRUE',
    data.role ?? '',      // D: 担当
  ]);
}

// ============================================================
// 売上明細
// ============================================================

export async function getSalesRecords(): Promise<SalesRecord[]> {
  const rows = await getSheetData(SHEET_NAMES.SALES);
  if (rows.length < 2) return [];
  return rows.slice(1).map((r, i) => ({
    _rowNumber: i + 2,
    id: r[0] ?? '',             // A: ID売上
    paymentId: r[1],            // B: 決済ID
    paymentDateTime: r[2],      // C: 決済日時
    reservationId: r[3] ?? '',  // D: ID予約
    productName: r[4] ?? '',    // E: 商品名
    category: r[5] ?? '',       // F: 区分
    amount: Number(r[6]) || 0,  // G: 金額
    staffId: r[7],              // H: 担当者
  } as SalesRecord));
}
