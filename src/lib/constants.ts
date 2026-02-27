export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';
export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? '';
export const LINE_OA_ID = '@671kcyek';
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? '2008978937-JCk8uXQU';

// 予約可能な最大日数（今日から60日後まで）
export const BOOKING_DAYS = 60;

// 時間枠
export const ALL_TIME_SLOTS = ['9:00', '12:00', '15:00'] as const;

// 七五三は9:00不可
export const SHICHIGOSAN_TIME_SLOTS = ['12:00', '15:00'] as const;

// 撮影シーン
export const SHOOTING_SCENES = ['七五三', 'マタニティ', 'バースデー', 'ベビー', 'その他'] as const;

// シーン → プラン種別マッピング
export const SCENE_PLAN_MAP: Record<string, 'Discovery' | 'Maternity'> = {
  '七五三': 'Discovery',
  'バースデー': 'Discovery',
  'ベビー': 'Discovery',
  'その他': 'Discovery',
  'マタニティ': 'Maternity',
};

// スプレッドシート シート名
export const SHEET_NAMES = {
  CUSTOMERS: '顧客',
  PLANS: 'プラン',
  OPTIONS: 'オプション',
  PRODUCTS: '商品',
  STAFF: 'スタッフ',
  RESERVATIONS: '予約',
  RESERVATION_OPTIONS: '予約オプション',
  ORDERS: '注文',
  ORDER_ITEMS: '注文詳細',
  SALES: '売上明細',
} as const;

// 予約ステータス
export const RESERVATION_STATUSES = ['予約済', '予約確定', '完了', 'キャンセル'] as const;

// 注文詳細ステータス
export const ORDER_ITEM_STATUSES = ['受注', '発注済', '制作完了', '入荷', '発送済'] as const;

// 担当割り当て：店舗売上のスタッフID
export const STORE_STAFF_ID = 'matka.';

// 休日料金（税込）
export const HOLIDAY_FEE = 5500;

// プラン種別ごとの売上内訳（税込）
export const PLAN_STAFF_BREAKDOWN: Record<'Discovery' | 'Maternity', {
  photo: number;
  assistant: number;
  hair: number;
  makeup: number;
}> = {
  Discovery: { photo: 20350, assistant: 20350, hair: 4400, makeup: 4400 },
  Maternity: { photo: 12100, assistant: 12100, hair: 4400, makeup: 4400 },
};
