/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://cdn.jsdelivr.net',
    'https://cdn.plyr.io',
];

if (isDev) {
    scriptSrc.push("'unsafe-eval'");
}

const appCsp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: http://localhost:3001 http://localhost:5173",
    "media-src 'self' blob: https: http:",
    "frame-src 'self' https: http:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');

const playerCsp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.plyr.io",
    "style-src 'self' 'unsafe-inline' https://cdn.plyr.io",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: https: http:",
    "connect-src 'self' https: http://localhost:3001",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
].join('; ');

const commonSecurityHeaders = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'Origin-Agent-Cluster', value: '?1' },
];

const nextConfig = {
    productionBrowserSourceMaps: true,
    async headers() {
        return [
            {
                source: '/player.html',
                headers: [
                    ...commonSecurityHeaders,
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Content-Security-Policy', value: playerCsp },
                ],
            },
            {
                source: '/((?!player\\.html).*)',
                headers: [
                    ...commonSecurityHeaders,
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Content-Security-Policy', value: appCsp },
                ],
            },
        ];
    },
};

export default nextConfig;

