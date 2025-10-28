import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Для Docker контейнеров
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.telegram.org',
        pathname: '/file/**',
      },
    ],
  },
};

export default nextConfig;
