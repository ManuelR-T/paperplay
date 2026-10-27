import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.PAPERPLAY_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: { '/*': ['./.env*', './.paperplay/**'] },
};
export default config;
