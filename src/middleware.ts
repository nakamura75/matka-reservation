import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// ============================================================
// IPベース簡易レートリミット（メモリ内Map）
// Vercelサーバーレス環境では関数インスタンス単位で有効
// ============================================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
const RATE_LIMIT_MAX = 5; // 1分あたり最大5回

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// 古いエントリを定期的にクリーンアップ（メモリリーク防止）
function cleanupRateLimitMap() {
  const now = Date.now();
  rateLimitMap.forEach((entry, ip) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  });
}

export async function middleware(request: NextRequest) {
  // POST /api/reservations へのレートリミット
  if (
    request.method === 'POST' &&
    request.nextUrl.pathname === '/api/reservations'
  ) {
    // 100エントリ超でクリーンアップ
    if (rateLimitMap.size > 100) {
      cleanupRateLimitMap();
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
        { status: 429 }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
