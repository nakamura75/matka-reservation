/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // 開発時のwebpackファイルシステムキャッシュを無効化
      // チャンクID不整合（Cannot find module './XXXX.js'）を防止
      config.cache = false;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
