/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@libsql/linux-x64-musl/**',
      'node_modules/@libsql/linux-x64-gnu/**',
      'node_modules/@libsql/linux-arm64-musl/**',
      'node_modules/@libsql/linux-arm64-gnu/**',
      'node_modules/@libsql/darwin-*/**',
      'node_modules/@libsql/win32-*/**'
    ]
  },
  // Sin Cache-Control global: el HTML no tiene datos de sesión y los chunks
  // de /_next/static llevan hash. Un no-store acá obligaba a Vercel a
  // reenviar todo el JS en cada visita (Fast Origin Transfer del plan Hobby).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;