/** @type {import('next').NextConfig} */
const NO_STORE_HEADERS = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
  { key: 'Surrogate-Control', value: 'no-store' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
];

const nextConfig = {
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },

  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },

  async headers() {
    return [
      {
        // Fluxo de pagamento (planos, checkout, success, pending, analysis):
        // NUNCA cacheado — nem pelo browser, nem por CDN/edge (EdgeOne).
        source: '/main/plans/:path*',
        headers: NO_STORE_HEADERS,
      },
      {
        source: '/main/plans',
        headers: NO_STORE_HEADERS,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;