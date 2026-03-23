export const LINE_OA_ID = '@082mluna';
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? '';

// LINE Official Account の Bot User ID（LINE Chat BizのURL生成に使用）
export const LINE_OA_BOT_ID = 'U982d65770fb7074d43e2338084865ff7';

// 予約可能な最大日数（今日から90日後まで）
export const BOOKING_DAYS = 90;

// 中3営業日以内はWeb予約不可（TEL案内）
export const TEL_ONLY_BUSINESS_DAYS = 3;

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

// 予約ステータス
export const RESERVATION_STATUSES = ['予約済', '予約確定', '見学', '完了', 'キャンセル'] as const;

// ステータス表示ラベル（DB値 → 画面表示）
export const STATUS_LABEL: Record<string, string> = {
  '予約済': '仮予約',
  '予約確定': '予約確定',
  '見学': '見学',
  '保留': '保留',
  '完了': '完了',
  'キャンセル': 'キャンセル',
};

// ステータス色（Tailwind クラス）
export const STATUS_COLORS: Record<string, string> = {
  '予約済': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '予約確定': 'bg-blue-100 text-blue-800 border-blue-200',
  '見学': 'bg-purple-100 text-purple-700 border-purple-200',
  '保留': 'bg-orange-100 text-orange-700 border-orange-200',
  '完了': 'bg-green-100 text-green-800 border-green-200',
  'キャンセル': 'bg-gray-100 text-gray-500 border-gray-200',
};

// 注文詳細ステータス
export const ORDER_ITEM_STATUSES = ['受注', 'セレクト済', 'レイアウト済', '発注済', '梱包済', '発送済'] as const;

// 割引率の選択肢
export const DISCOUNT_RATES = [0, 5, 10] as const;

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
