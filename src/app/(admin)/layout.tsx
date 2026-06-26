import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';
import { getMode } from '@/lib/mode.server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // モード未選択なら選択画面へ
  const mode = getMode();
  if (!mode) {
    redirect('/select');
  }

  return <AppShell mode={mode}>{children}</AppShell>;
}
