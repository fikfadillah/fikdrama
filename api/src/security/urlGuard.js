const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');

const DEFAULT_PROXY_ALLOWLIST = [
    '*.turboplay.stream',
    '*.turbovip.fun',
    '*.emturbovid.com',
    '*.turbovid.com',
    '*.hydrax.net',
    '*.short.icu',
    '*.filelions.live',
    '*.filelions.to',
    '*.vidhide.com',
    '*.streamtape.com',
    '*.doodstream.com',
    '*.mp4upload.com',
];

function parseCsv(value) {
    if (!value || typeof value !== 'string') return [];
    return value
        .split(',')
        .map((v) => normalizeDomainPattern(v))
        .filter(Boolean);
}

function normalizeDomainPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') return '';
    return pattern.trim().toLowerCase();
}

function getHostnameFromUrl(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function getProxyAllowlist() {
    const targetHost = getHostnameFromUrl(process.env.TARGET_BASE_URL || '');
    const envAllowlist = parseCsv(process.env.PROXY_ALLOWLIST_DOMAINS);

    const base = envAllowlist.length > 0
        ? envAllowlist
        : [...DEFAULT_PROXY_ALLOWLIST, targetHost].filter(Boolean);

    return [...new Set(base.map(normalizeDomainPattern).filter(Boolean))];
}

function matchesAllowlist(hostname, pattern) {
    if (!hostname || !pattern) return false;
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(2);
        return hostname === suffix || hostname.endsWith(`.${suffix}`);
    }
    return hostname === pattern;
}

function isHostnameAllowlisted(hostname, allowlist = getProxyAllowlist()) {
    const host = (hostname || '').toLowerCase();
    return allowlist.some((pattern) => matchesAllowlist(host, normalizeDomainPattern(pattern)));
}

function isInternalHostname(hostname) {
    const host = (hostname || '').toLowerCase();
    return (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal')
    );
}

function isPrivateIPv4(ip) {
    const parts = ip.split('.').map((x) => Number.parseInt(x, 10));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;

    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 0) return true;
    if (a >= 224) return true;

    return false;
}

function isPrivateIPv6(ip) {
    const normalized = (ip || '').toLowerCase().split('%')[0];

    if (!normalized) return true;
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
        return true; // Link local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // Multicast

    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped && mapped[1]) return isPrivateIPv4(mapped[1]);

    return false;
}

function isPrivateOrInternalIp(ip) {
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIPv4(ip);
    if (version === 6) return isPrivateIPv6(ip);
    return true;
}

async function resolveHostAddresses(hostname) {
    if (net.isIP(hostname)) return [hostname];
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return [...new Set(records.map((r) => r.address).filter(Boolean))];
}

async function assertPublicHost(hostname, context = 'url') {
    if (isInternalHostname(hostname)) {
        throw new Error(`${context}: internal hostname blocked`);
    }

    const addresses = await resolveHostAddresses(hostname);
    if (!addresses.length) {
        throw new Error(`${context}: host could not be resolved`);
    }

    for (const address of addresses) {
        if (isPrivateOrInternalIp(address)) {
            throw new Error(`${context}: resolved to private/internal IP`);
        }
    }
}

async function validateOutboundUrl(rawUrl, options = {}) {
    const {
        allowlist = getProxyAllowlist(),
        context = 'url',
        allowHttp = true,
    } = options;

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(`${context}: invalid URL`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`${context}: only http/https URLs are allowed`);
    }
    if (!allowHttp && parsed.protocol !== 'https:') {
        throw new Error(`${context}: only https URLs are allowed`);
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!isHostnameAllowlisted(hostname, allowlist)) {
        throw new Error(`${context}: domain "${hostname}" is not allowlisted`);
    }

    await assertPublicHost(hostname, context);
    return parsed;
}

function redactUrlForLogs(rawUrl) {
    try {
        const u = new URL(rawUrl);
        return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
        return '[invalid-url]';
    }
}

function sanitizeRequestUrlForLogs(rawPathOrUrl) {
    try {
        const parsed = new URL(rawPathOrUrl, 'http://localhost');
        const sensitiveParams = ['url', 'token', 'sig', 'signature', 'auth', 'expires', 'key'];
        for (const key of sensitiveParams) {
            if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '[redacted]');
        }
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return rawPathOrUrl || '';
    }
}

async function requestWithValidatedRedirects(requestOptions, guardOptions = {}) {
    const maxRedirects = Number.isInteger(requestOptions.maxRedirects) ? requestOptions.maxRedirects : 5;
    const callerValidateStatus = requestOptions.validateStatus;
    const axiosOptions = { ...requestOptions };
    delete axiosOptions.maxRedirects;
    delete axiosOptions.url;

    let currentUrl = requestOptions.url;
    const visited = new Set();

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
        const parsed = await validateOutboundUrl(currentUrl, guardOptions);
        currentUrl = parsed.toString();

        if (visited.has(currentUrl)) {
            throw new Error('Redirect loop detected');
        }
        visited.add(currentUrl);

        const response = await axios.request({
            ...axiosOptions,
            url: currentUrl,
            maxRedirects: 0,
            validateStatus: (status) => {
                if (status >= 300 && status < 400) return true;
                if (typeof callerValidateStatus === 'function') return callerValidateStatus(status);
                return status >= 200 && status < 300;
            },
        });

        const location = response.headers?.location;
        if (response.status >= 300 && response.status < 400) {
            if (!location) throw new Error(`Redirect without location header (status ${response.status})`);
            currentUrl = new URL(location, parsed).toString();
            continue;
        }

        return { response, finalUrl: currentUrl };
    }

    throw new Error(`Too many redirects (max ${maxRedirects})`);
}

module.exports = {
    getProxyAllowlist,
    isHostnameAllowlisted,
    validateOutboundUrl,
    requestWithValidatedRedirects,
    redactUrlForLogs,
    sanitizeRequestUrlForLogs,
};

