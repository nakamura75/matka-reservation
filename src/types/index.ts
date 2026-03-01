// ============================================================
// 顧客
// ============================================================
export interface Customer {
  _rowNumber?: number;
  id: string;          // ID顧客
  name: string;        // 顧客名
  furigana?: string;   // フリガナ
  phone: string;       // 電話番号
  email?: string;      // メールアドレス
  zipCode?: string;    // 郵便番号
  address?: string;    // 住所
  lineName?: string;      // LINE表示名
  lineUserId?: string;    // LINE UserID（LIFF）
  chatLineUserId?: string; // LINE ChatUserID（Messaging API・AB列）
  note?: string;          // 備考
  createdAt?: string;  // 登録日
}

// ============================================================
// プラン
// ============================================================
export interface Plan {
  _rowNumber?: number;
  id: string;          // IDプラン
  name: string;        // プラン名
  price: number;       // 単価
  duration: number;    // 所要時間（分）
  description?: string;
  isActive: boolean;   // 有効
}

// ============================================================
// オプション
// ============================================================
export interface Option {
  _rowNumber?: number;
  id: string;          // IDオプション
  name: string;        // オプション名
  price: number;       // 単価
  description?: string;
  isActive: boolean;   // 有効
  externalCode?: string; // 外部コード（Square連携用）
}

// ============================================================
// スタッフ
// ============================================================
export interface Staff {
  _rowNumber?: number;
  id: string;          // IDスタッフ
  name: string;        // スタッフ名
  isActive?: string;   // 有効
  role?: string;       // 担当（フォトグラファー | ヘアメイク）
}

// ============================================================
// 担当割り当て
// ============================================================
export interface StaffAssignment {
  photo?: string;      // フォト担当 staffId
  assistant?: string;  // アシスタント担当 staffId
  hair?: string;       // ヘア担当 staffId
  makeup?: string;     // メイク担当 staffId
  options?: Record<string, string>; // { optionId: staffId }
}

// ============================================================
// 予約
// ============================================================
export type ReservationStatus = '予約済' | '予約確定' | '完了' | 'キャンセル';
export type TimeSlot = '9:00' | '12:00' | '15:00';
export type ShootingScene = '七五三' | 'マタニティ' | 'バースデー' | 'ベビー' | 'その他';

export interface Reservation {
  _rowNumber?: number;
  id: string;              // ID予約
  customerId: string;      // ID顧客
  customerName?: string;   // 顧客名（Ref展開）
  planId: string;          // IDプラン
  planName?: string;       // プラン名（Ref展開）
  planPrice?: number;      // プラン単価（VC）
  paymentStatus: boolean;  // 支払ステータス
  paymentDate?: string;    // 支払日
  date: string;            // 予約日（YYYY-MM-DD）
  timeSlot: TimeSlot;      // 予約時間帯
  childrenCount?: number;  // お子様人数
  adultCount?: string;     // 大人人数
  familyNote?: string;     // 構成メモ
  status: ReservationStatus; // ステータス
  referencePhoto?: string; // 参考写真
  note?: string;           // 備考（スタッフメモ）
  customerNote?: string;   // お客様備考（フォーム入力）
  otherSceneNote?: string; // その他シーン詳細（フォーム入力）
  createdAt?: string;      // 登録日
  lineUserId?: string;     // LINE_UserID（LIFF）
  chatLineUserId?: string; // LINE_ChatUserID（Messaging API・AB列）
  flag?: boolean;          // フラグ
  phonePreference?: string;// 電話希望
  scene?: ShootingScene;   // 撮影シーン
  reservationNumber?: string; // 予約番号（M-YYYYMMDD-XXXX）
  discountAmount?: number; // 値引額
  discountReason?: string; // 値引理由
  checkInTime?: string;    // 入店時間
  checkOutTime?: string;   // 退店時間
  calendarEventId?: string; // GoogleカレンダーイベントID（X列）
  pdfUrl?: string;          // 引継ぎPDF URL（X列・matka_V6データ）
  staffAssignmentJson?: string; // 担当割り当てJSON（Y列）
  optionTotal?: number;    // オプション合計（VC）
  total?: number;          // 総計（VC）
  options?: ReservationOption[]; // 予約オプション一覧
}

// ============================================================
// 予約オプション
// ============================================================
export interface ReservationOption {
  _rowNumber?: number;
  id: string;              // ID予約オプション
  reservationId: string;   // ID予約
  optionId: string;        // IDオプション
  optionName?: string;     // オプション名（Ref展開）
  quantity: number;        // 数量
  note?: string;           // 備考
  subtotal?: number;       // 小計（VC）
}

// ============================================================
// 注文
// ============================================================
export interface Order {
  _rowNumber?: number;
  id: string;              // ID注文
  customerId: string;      // ID顧客
  customerName?: string;
  reservationId?: string;  // ID予約
  orderDate: string;       // 注文日
  isPaid: boolean;         // 入金済
  paidDate?: string;       // 入金日
  note?: string;           // 備考
  flag?: boolean;          // フラグ
  total?: number;          // 合計（VC）
  items?: OrderItem[];
}

// ============================================================
// 注文詳細
// ============================================================
export type OrderItemStatus = '受注' | '発注済' | '制作完了' | '入荷' | '発送済';

export interface OrderItem {
  _rowNumber?: number;
  id: string;              // ID注文詳細
  orderId: string;         // ID注文
  productId: string;       // ID商品
  productName?: string;
  customerId?: string;     // ID顧客（VC）
  quantity: number;        // 数量
  status: OrderItemStatus; // ステータス
  completedDate?: string;  // 制作完了日
  orderedDate?: string;    // 発注日
  arrivedDate?: string;    // 入荷日
  shippedDate?: string;    // 発送日
  trackingNumber?: string; // 追跡番号
  note?: string;           // 備考
  subtotal?: number;       // 小計（VC）
}

// ============================================================
// 売上明細
// ============================================================
export interface SalesRecord {
  _rowNumber?: number;
  id: string;              // ID売上
  paymentId?: string;      // 決済ID
  paymentDateTime?: string; // 決済日時
  reservationId: string;   // ID予約
  productName: string;     // 商品名
  category: string;        // 区分
  amount: number;          // 金額
  staffId?: string;        // 担当者
  staffName?: string;
}

// ============================================================
// 商品
// ============================================================
export interface Product {
  _rowNumber?: number;
  id: string;            // ID商品
  name: string;          // 商品名
  price: number;         // 単価
  image?: string;        // 商品画像
  description?: string;  // 説明
  isActive: boolean;     // 有効
}

// ============================================================
// フォーム送信データ
// ============================================================
export interface ReservationFormData {
  scene: ShootingScene;
  otherSceneNote?: string;
  planId: string;
  date: string;
  timeSlot: TimeSlot;
  // 顧客情報
  customerName: string;
  furigana: string;
  zipCode: string;
  address: string;
  phone: string;
  email?: string;
  // 撮影情報
  peopleCount: string;
  childrenCount?: number;
  adultCount?: string;
  childrenDetail: string;
  // オプション
  selectedOptions: { optionId: string; quantity: number }[];
  // 確認
  phoneCallPreference?: string;
  note?: string;
  cancelPolicyAgreed: boolean;
  // LIFF
  lineUserId?: string;
  lineName?: string;
}

// ============================================================
// API レスポンス
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 空き枠
// ============================================================
export interface AvailableSlot {
  date: string;         // YYYY-MM-DD
  slots: {
    time: TimeSlot;
    available: boolean;
  }[];
  isWeekend: boolean;   // 土日祝判定
  isHoliday: boolean;   // カレンダーブロック
}
