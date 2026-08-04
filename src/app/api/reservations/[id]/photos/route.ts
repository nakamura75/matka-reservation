import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReservationById, addReservationPhoto, RESERVATION_PHOTO_BUCKET } from '@/lib/db';
import { generateId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Vercel のリクエストボディ上限(約4.5MB)に収まるよう、クライアント側で縮小した画像を受け取る。
// ここでは保険として上限をチェックする。
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** POST /api/reservations/[id]/photos - 画像をアップロード（multipart/form-data, フィールド名 "file"） */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const reservation = await getReservationById(params.id);
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: '画像ファイル（JPEG/PNG/WebP/GIF）のみアップロードできます' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（上限4MB）' }, { status: 400 });
    }

    const path = `${params.id}/${generateId()}.${ext}`;
    const admin = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(RESERVATION_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: file.type });
    if (uploadError) {
      console.error('photo upload failed:', uploadError);
      return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 });
    }

    await addReservationPhoto({ reservationId: params.id, path, fileName: file.name });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('POST /photos error:', e);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
