import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateOrderItemComponent } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** PATCH /api/orders/[id]/items/components - コンポーネントのステータス更新 */
export async function PATCH(
  req: NextRequest,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { componentId, ...fields } = body;
    if (!componentId) return NextResponse.json({ error: 'componentId is required' }, { status: 400 });

    await updateOrderItemComponent(componentId, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH components error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
