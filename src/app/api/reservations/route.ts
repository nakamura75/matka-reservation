import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReservations,
  createReservation,
  createReservationOption,
  createCustomer,
  checkSlotConflict,
  getPlans,
  getOptions,
  getCustomers,
} from '@/lib/db';
import { sendLinePush, buildTentativeMessage } from '@/lib/line';
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
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

/** POST /api/reservations - 予約作成（フォーム送信） */
export async function POST(req: import('next/server').NextRequest) {
  try {
    const body: ReservationFormData & { isVisit?: boolean; existingCustomerId?: string; _hp?: string } = await req.json();

    // Honeypotチェック: 値が入っていたらBotと判定
    if (body._hp) {
      return NextResponse.json({ success: true, data: { reservationId: '', reservationNumber: 'BOT', customerId: '' } });
    }

    const isVisit = body.isVisit === true;

    // --- 入力バリデーション（見学以外） ---
    if (!isVisit) {
      if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: '日付が不正です' }, { status: 400 });
      }
      if (!body.timeSlot) {
        return NextResponse.json({ error: '時間帯が指定されていません' }, { status: 400 });
      }
      if (!body.planId || !body.customerName || !body.phone) {
        return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
      }
      // 日付が過去でないか確認
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestedDate = new Date(body.date);
      if (requestedDate < today) {
        return NextResponse.json({ error: '過去の日付には予約できません' }, { status: 400 });
      }
      // 60日以内か確認
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 60);
      if (requestedDate > maxDate) {
        return NextResponse.json({ error: '予約は60日先までです' }, { status: 400 });
      }
    }

    // プラン情報取得（見学の場合はスキップ）
    const plans = await getPlans();
    const plan = isVisit ? null : plans.find((p) => p.id === body.planId);
    if (!isVisit && !plan) {
      return NextResponse.json({ error: 'プランが見つかりません' }, { status: 400 });
    }

    // --- 二重予約防止: 予約作成直前にスロットの空きを再確認 ---
    if (!isVisit) {
      const conflict = await checkSlotConflict(body.date, body.timeSlot);
      if (conflict) {
        return NextResponse.json({ error: 'この日時はすでに予約が入っています。別の日時をお選びください。' }, { status: 409 });
      }
    }

    // 顧客の重複チェック（電話番号で検索）
    const allCustomers = await getCustomers();
    let customer = allCustomers.find((c) => c.phone === body.phone);

    const now = new Date().toLocaleDateString('ja-JP');
    const reservationId = generateId();
    const reservationNumber = generateReservationNumber(body.date);

    if (!customer) {
      // 新規顧客登録
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
        createdAt: now,
      };
      await createCustomer(customer);
    }

    // 重複チェック（見学以外）
    if (!isVisit) {
      const conflict = await checkSlotConflict(body.date, body.timeSlot);
      if (conflict) {
        return NextResponse.json(
          { error: 'この日時は既に予約が入っています' },
          { status: 409 }
        );
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

    // LIFF経由でlineUserIdがある場合、仮予約LINEを送信（見学はスキップ）
    if (!isVisit && body.lineUserId) {
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
