import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  headers: async()=>{
    const workerHeaders=[{key:'Content-Security-Policy',value:"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'"},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'}];
    return [...['/artifact-compiler.worker.mjs','/artifact-runtime.worker.mjs'].map(source=>({source,headers:[...workerHeaders,{key:'Cache-Control',value:'no-store'}]})),{source:'/artifact-:kind(compiler|runtime).:digest([a-f0-9]{64}).worker.mjs',headers:[...workerHeaders,{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/artifact-workers.json',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'}]}];
  },
  reactStrictMode: true,
  ...(process.env.PAPERPLAY_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: { '/*': ['./.env*', './.paperplay/**'] },
};
export default config;
