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
};

export default nextConfig;
