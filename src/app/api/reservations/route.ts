import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// 簡易レート制限（IPベース、1分あたり10リクエスト）
// ※ サーバーレスではインスタンス単位のため完全ではない。本格対応はUpstash等を推奨
// ============================================================
const RATE_LIMIT_WINDOW = 60_000; // 1分
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// 定期的に古いエントリを掃除（メモリリーク防止）
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitMap.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) rateLimitMap.delete(key);
  });
}, 60_000);
import {
  getReservations,
  createReservation,
  createReservationOption,
  createCustomer,
  updateCustomer,
  checkSlotConflict,
  checkVisitSlotConflict,
  getPlans,
  getOptions,
  getCustomers,
} from '@/lib/db';
import { sendLinePush, buildTentativeMessage } from '@/lib/line';
import { getActiveCampaign, isCampaignScene } from '@/lib/campaign';
import { generateId, generateReservationNumber } from '@/lib/utils';
import type { ReservationFormData, Reservation } from '@/types';

/** GET /api/reservations - 予約一覧 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const reservations = await getReservations();
    return NextResponse.json({ success: true, data: reservations });
  } catch (error) {
    console.error('GET /api/reservations error:', error);
    return NextResponse.json({ success: false, error: '予約一覧の取得に失敗しました' }, { status: 500 });
  }
}

/** POST /api/reservations - 予約作成（フォーム送信） */
export async function POST(req: NextRequest) {
  try {
    // レート制限チェック
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' }, { status: 429 });
    }

    const body: ReservationFormData & { isVisit?: boolean; shootType?: string; existingCustomerId?: string; _hp?: string } = await req.json();

    // Honeypotチェック: 値が入っていたらBotと判定
    if (body._hp) {
      return NextResponse.json({ success: true, data: { reservationId: '', reservationNumber: 'BOT', customerId: '' } });
    }

    // 入力文字列長の上限チェック
    const MAX_LEN = 500;
    const MAX_NOTE_LEN = 2000;
    if ((body.customerName && body.customerName.length > MAX_LEN) ||
        (body.furigana && body.furigana.length > MAX_LEN) ||
        (body.phone && body.phone.length > 20) ||
        (body.email && body.email.length > MAX_LEN) ||
        (body.address && body.address.length > MAX_LEN) ||
        (body.note && body.note.length > MAX_NOTE_LEN)) {
      return NextResponse.json({ error: '入力値が長すぎます' }, { status: 400 });
    }

    const isVisit = body.isVisit === true;
    const shootType: 'studio' | 'location' = body.shootType === 'location' ? 'location' : 'studio';
    const isLocation = shootType === 'location';
    // ロケ本番はプラン未確定で受け付ける（プラン必須はスタジオ撮影のみ）
    const needsPlan = !isVisit && !isLocation;

    // --- 入力バリデーション（見学以外） ---
    if (!isVisit) {
      if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: '日付が不正です' }, { status: 400 });
      }
      if (!body.timeSlot) {
        return NextResponse.json({ error: '時間帯が指定されていません' }, { status: 400 });
      }
      if ((needsPlan && !body.planId) || !body.customerName || !body.phone) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
      }
      // 日付の範囲チェックは JST 基準の YYYY-MM-DD 文字列比較で行う。
      // （サーバーはUTC稼働のため new Date() ベースだと境界がJSTと最大1日ズレ、
      //   空き枠カレンダー[JST]では選べる90日目ちょうどの日を弾く不具合が出る。
      //   空き枠生成 lib/slots.ts と同じJST基準に揃える）
      const jstDateStr = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const nowMs = Date.now();
      const todayJST = jstDateStr(nowMs);                          // JSTの今日
      const maxJST = jstDateStr(nowMs + 90 * 24 * 60 * 60 * 1000); // JSTの90日後（カレンダーの最終日と一致）
      if (body.date < todayJST) {
        return NextResponse.json({ error: '過去の日付には予約できません' }, { status: 400 });
      }
      if (body.date > maxJST) {
        return NextResponse.json({ error: '予約は90日先までです' }, { status: 400 });
      }
      // キャンペーン予約はサーバ側でも「期間内＆許可枠のみ」を強制（フォーム迂回POST対策）
      if (isCampaignScene(body.scene)) {
        const campaign = getActiveCampaign(body.date);
        if (!campaign) {
          return NextResponse.json({ error: 'キャンペーン期間外のため予約できません' }, { status: 400 });
        }
        if (!campaign.allowedTimeSlots.includes(body.timeSlot)) {
          return NextResponse.json({ error: 'キャンペーンは指定の時間枠のみ予約可能です' }, { status: 400 });
        }
      }
    }

    // プラン情報取得（見学・ロケ本番はスキップ）
    const plans = await getPlans();
    const plan = needsPlan ? plans.find((p) => p.id === body.planId) : null;
    if (needsPlan && !plan) {
      return NextResponse.json({ error: 'プランが見つかりません' }, { status: 400 });
    }

    // --- 二重予約防止: 予約作成直前にスロットの空きを再確認 ---
    if (!isVisit && !isLocation) {
      // スタジオ撮影の重複チェック（ロケ本番は会場・スタッフが別のため対象外）
      const conflict = await checkSlotConflict(body.date, body.timeSlot);
      if (conflict) {
        return NextResponse.json({ error: 'この日時はすでに予約が入っています。別の日時をお選びください。' }, { status: 409 });
      }
    } else if (isVisit && body.date && body.timeSlot) {
      // 見学枠の重複防止: 見学1件=1時間占有。前後60分に既存の見学があれば不可（撮影枠とは独立）
      const visitConflict = await checkVisitSlotConflict(body.date, body.timeSlot);
      if (visitConflict) {
        return NextResponse.json({ error: 'この時間帯はすでに見学予約が入っています（前後1時間は重複できません）。別の時間をお選びください。' }, { status: 409 });
      }
    }

    // 顧客の重複チェック（電話番号で検索）
    const allCustomers = await getCustomers();
    let customer = allCustomers.find((c) => c.phone === body.phone);

    const now = new Date().toLocaleDateString('ja-JP');
    const reservationId = generateId();
    const reservationNumber = generateReservationNumber(body.date);

    if (!customer) {
      // 新規顧客登録（予約の入口＝撮影区分をそのまま顧客の利用区分に）
      const customerId = generateId();
      customer = {
        id: customerId,
        name: body.customerName,
        furigana: body.furigana,
        phone: body.phone,
        email: body.email,
        zipCode: body.zipCode,
        address: body.address,
        lineName: body.lineName,
        shootType, // 'studio' | 'location'
        createdAt: now,
      };
      await createCustomer(customer);
    } else {
      // 既存顧客が別モードで予約したら「両方」に更新（見学のみでも利用実績として扱う）
      const current = customer.shootType ?? 'studio';
      if (current !== 'both' && current !== shootType) {
        await updateCustomer({ ...customer, shootType: 'both' });
      }
    }

    // 予約作成
    const reservation = {
      id: reservationId,
      customerId: customer.id,
      customerName: customer.name,
      planId: body.planId ?? '',
      planName: plan?.name ?? '',
      paymentStatus: false,
      date: body.date,
      timeSlot: body.timeSlot,
      childrenCount: body.childrenCount,
      adultCount: body.adultCount,
      familyNote: body.childrenDetail,
      status: (isVisit ? '見学' : '予約済') as import('@/types').ReservationStatus,
      shootType,
      visitDate: body.visitDate,
      cancelInsurance: body.cancelInsurance,
      customerNote: body.note,
      otherSceneNote: body.otherSceneNote,
      createdAt: new Date().toISOString(),
      lineUserId: body.lineUserId ?? '',
      flag: false,
      phonePreference: body.phoneCallPreference,
      scene: body.scene,
      reservationNumber,
    };
    await createReservation(reservation);

    // 予約オプション作成
    for (const opt of body.selectedOptions) {
      await createReservationOption({
        id: generateId(),
        reservationId,
        optionId: opt.optionId,
        quantity: opt.quantity,
      });
    }

    // LIFF経由でlineUserIdがある場合、仮予約LINEを送信（見学・ロケ本番はスキップ）
    if (!isVisit && !isLocation && body.lineUserId) {
      const allOptions = await getOptions().catch((e) => { console.error('[DB Error]', e.message ?? e); return []; });
      const optionsWithInfo = body.selectedOptions.map((sel) => {
        const opt = allOptions.find((o) => o.id === sel.optionId);
        return opt ? { name: opt.name, price: opt.price, quantity: sel.quantity } : null;
      }).filter((o): o is { name: string; price: number; quantity: number } => o !== null);

      await sendLinePush(body.lineUserId, [
        buildTentativeMessage(reservation as Reservation, plan!.name, plan!.price, optionsWithInfo),
      ]).catch((e) => console.error('LINE Push failed:', e));
    }

    return NextResponse.json({
      success: true,
      data: {
        reservationId,
        reservationNumber,
        customerId: customer.id,
      },
    });
  } catch (error) {
    console.error('POST /api/reservations error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
