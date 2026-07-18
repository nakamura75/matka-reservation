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

/** ロケ予約が「見学」か（WEB見学は16:30固定・撮影枠は9:10/13:00なので時刻で判別可能） */
export function isLocationVisit(
  r: Pick<Reservation, 'shootType' | 'timeSlot'>
): boolean {
  return r.shootType === 'location' && (r.timeSlot as string) === LOC_VISIT_TIME;
}
