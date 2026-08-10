import type { ReservationOption } from '@/types';

// ============================================================
// 予約オプションの単価解決
//
// reservation_options.unit_price が入っていればそれを、
// 入っていなければオプションマスターの価格を使う。
// ロケの「ご主役のお支度」はプラン料金に含まれるため単価0で登録される
// （日本髪だけは課金対象なので実額が入る）。
// ============================================================

/** この予約でのオプション単価。unitPrice 未設定ならマスター価格にフォールバック */
export function resolveOptionPrice(
  ro: Pick<ReservationOption, 'unitPrice'>,
  masterPrice: number
): number {
  return ro.unitPrice ?? masterPrice;
}

/**
 * プラン料金に含まれる「ご主役のお支度」の行か。
 *
 * 支度内容の確認用に管理画面のオプション欄へは ¥0 で表示するが、
 * 配分する金額が無いので担当割り当て・売上集計からは外し、
 * お客様向けの明細（LINE・領収書）にも並べない。
 * 日本髪のように課金される主役の支度は対象外＝通常のオプションと同じ扱いになる。
 */
export function isPlanIncludedPrep(
  ro: Pick<ReservationOption, 'isMainPrep'>,
  price: number
): boolean {
  return !!ro.isMainPrep && price === 0;
}
