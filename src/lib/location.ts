import type { Reservation } from '@/types';
import { isWeekend } from './utils';

// ============================================================
// ロケーション撮影 — 料金・稼働の定数とヘルパー
// （route / [id] / cron で共通利用。定数の二重定義を解消）
// ============================================================

export const LOC_BASIC = 77000;            // ベーシックプラン（平日）
export const LOC_HOLIDAY_SURCHARGE = 5500; // 土日祝の追加料金
export const LOC_INSURANCE = 5500;         // キャンセル保険
export const LOC_VISIT_TIME = '16:30';     // 見学の固定時刻（WEB予約）

/**
 * ロケの担当割り当て内訳（税込）。スタジオの PLAN_STAFF_BREAKDOWN とは別体系で、
 * 着付け・キャンセル保険の担当がある。
 * insurance は「加入する」のときだけ計上し、割引対象外（合計の扱いと揃える）。
 * photo〜kitsuke の合計 61,000 で、残りはベーシックプランの店舗取り分。
 */
export const LOC_STAFF_BREAKDOWN = {
  photo: 33000,
  assistant: 4400,
  hair: 6600,
  makeup: 6600,
  kitsuke: 11000,
  insurance: LOC_INSURANCE,
} as const;

/**
 * ロケ本番の撮影枠。timeSlot と「撮影可能日」の午前(am)/午後(pm)フラグの対応を1か所で持つ。
 * 予約フォームの時間帯ボタン、サーバー側の受付チェック、管理画面の表示すべてがこれを見る。
 * 時刻を直書きせず必ずここから引くこと（変更が漏れると重複判定や所要時間の表示がずれる）。
 *
 * 2026-08 に集合時刻を後ろへずらした。施設の開放が9:00で午前は準備が10分しか取れず、
 * 午後のみ稼働の日は入館13:00とお客様の受け入れが重なって準備できなかったため。
 * 終了時刻は据え置き。
 */
export const LOC_SHOOT_TIMES = [
  { value: '9:20', half: 'am' as const, end: '12:00', label: '午前の部　9:20〜12:00' },
  { value: '13:20', half: 'pm' as const, end: '16:00', label: '午後の部　13:20〜16:00' },
];

/** timeSlot → 撮影可能日の午前/午後。ロケ本番の枠でなければ null */
export function locationSlotHalf(timeSlot: string): 'am' | 'pm' | null {
  return LOC_SHOOT_TIMES.find((t) => t.value === timeSlot)?.half ?? null;
}

/** 撮影日のプラン料金（平日/休日で自動加算） */
export function locationPlanPrice(dateStr: string): number {
  return LOC_BASIC + (dateStr && isWeekend(dateStr) ? LOC_HOLIDAY_SURCHARGE : 0);
}

/**
 * ロケ撮影の合計（プラン＋オプション＋保険）。
 * planPrice を渡せば選択プランの実額で計算。省略時は日付ベースの基本料金にフォールバック。
 */
export function locationShootTotal(
  reservation: Pick<Reservation, 'date' | 'cancelInsurance'>,
  options: { price: number; quantity: number }[],
  planPrice?: number
): number {
  const optTotal = options.reduce((s, o) => s + o.price * o.quantity, 0);
  const ins = reservation.cancelInsurance === '加入する' ? LOC_INSURANCE : 0;
  const base = planPrice ?? locationPlanPrice(reservation.date ?? '');
  return base + optTotal + ins;
}

/** ロケ予約が「見学」か（WEB見学は LOC_VISIT_TIME 固定で撮影枠と重ならないため時刻で判別可能） */
export function isLocationVisit(
  r: Pick<Reservation, 'shootType' | 'timeSlot'>
): boolean {
  return r.shootType === 'location' && (r.timeSlot as string) === LOC_VISIT_TIME;
}
