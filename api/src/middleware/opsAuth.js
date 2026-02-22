function getTokenFromRequest(req) {
    const direct = req.get('x-ops-token');
    if (direct) return direct.trim();

    const auth = req.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) return match[1].trim();

    return '';
}

function requireOpsAccess(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) return next();

    const expectedToken = (process.env.OPS_ACCESS_TOKEN || '').trim();
    if (!expectedToken) {
        return res.status(404).json({ success: false, error: 'Not found' });
    }

    const suppliedToken = getTokenFromRequest(req);
    if (suppliedToken && suppliedToken === expectedToken) return next();

    return res.status(403).json({ success: false, error: 'Forbidden' });
}

module.exports = {
    requireOpsAccess,
};

