import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  headers: async()=>[{source:'/artifact-compiler.worker.mjs',headers:[{key:'Content-Security-Policy',value:"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'"},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'no-store'}]}],
  reactStrictMode: true,
  ...(process.env.PAPERPLAY_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: { '/*': ['./.env*', './.paperplay/**'] },
};
export default config;
