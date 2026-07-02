// スタジオ/ロケのモード（撮影区分）に関する共通定義。
// next/headers や react に依存しないため、サーバー/クライアント両方から import 可能。

export type ShootMode = 'studio' | 'location';

export const MODE_COOKIE = 'shoot_mode';

export const MODES: { value: ShootMode; label: string }[] = [
  { value: 'studio', label: 'スタジオ' },
  { value: 'location', label: 'ロケーション' },
];

export function isValidMode(v: string | undefined | null): v is ShootMode {
  return v === 'studio' || v === 'location';
}

export function modeLabel(mode: ShootMode): string {
  return MODES.find((m) => m.value === mode)?.label ?? mode;
}
