import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-fallback-secret-change-in-production',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'not-configured',
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email;
      if (!email) return false;
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      if (allowedDomain && email.endsWith(`@${allowedDomain}`)) return true;
      if (allowedEmails.includes(email)) return true;
      return false;
    },
  },
};

/** サーバーコンポーネント・API Route でセッションを取得 */
export async function getSession() {
  return getServerSession(authOptions);
}

/** 未認証の場合は null を返す */
export async function requireAuth() {
  const session = await getSession();
  return session;
}
