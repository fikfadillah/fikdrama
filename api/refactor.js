const fs = require('fs');
const appJs = fs.readFileSync('src/app.js', 'utf8');

const routesStart = appJs.indexOf('// ── Routes ──────────────────────────────────────────────────');
const startMatch = appJs.indexOf('// ── Start ───────────────────────────────────────────────────');

if (routesStart > -1 && startMatch > -1) {
    let routesStr = appJs.substring(routesStart, startMatch);

    // Replace app.get and app.use with router.get and router.use
    routesStr = routesStr.replace(/app\.get\(/g, 'router.get(');
    routesStr = routesStr.replace(/app\.use\(\(req, res\) => err\(/g, 'router.use((req, res) => err(');

    const content = `
const express = require('express');
const router = express.Router();
const scraper = require('../scraper/index');
const { cached, err } = require('../utils/response');
const { cacheStats } = require('../middleware/cache');

// For extractLimiter we need to recreate it if used
const rateLimit = require('express-rate-limit');
const extractLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

${routesStr}

module.exports = router;
`;
    fs.writeFileSync('src/routes/api.routes.js', content);
    console.log('Created src/routes/api.routes.js');
} else {
    console.log('Could not find markers');
}
