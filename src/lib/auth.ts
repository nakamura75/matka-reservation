import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ profile }) {
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (allowedDomain && profile?.email) {
        return profile.email.endsWith(`@${allowedDomain}`);
      }
      return true;
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
