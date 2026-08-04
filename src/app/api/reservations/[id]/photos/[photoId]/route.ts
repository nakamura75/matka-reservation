import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReservationPhotoById, deleteReservationPhoto, RESERVATION_PHOTO_BUCKET } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** DELETE /api/reservations/[id]/photos/[photoId] - 画像を削除（storage本体とメタデータの両方） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const photo = await getReservationPhotoById(params.photoId);
    if (!photo || photo.reservationId !== params.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { error: removeError } = await admin.storage
      .from(RESERVATION_PHOTO_BUCKET)
      .remove([photo.path]);
    if (removeError) console.error('photo storage remove failed:', removeError);

    await deleteReservationPhoto(params.photoId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /photos error:', e);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
