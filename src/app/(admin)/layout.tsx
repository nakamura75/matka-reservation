import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // ローカル開発用バイパス
  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true') {
    return <AppShell>{children}</AppShell>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}
