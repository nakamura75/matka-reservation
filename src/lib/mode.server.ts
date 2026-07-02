import { cookies } from 'next/headers';
import { MODE_COOKIE, isValidMode, type ShootMode } from './mode';

// サーバーコンポーネント／API から現在のモードを取得する。
// 未設定（cookie 無し or 不正値）の場合は null。
export function getMode(): ShootMode | null {
  const v = cookies().get(MODE_COOKIE)?.value;
  return isValidMode(v) ? v : null;
}
