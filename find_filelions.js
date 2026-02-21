const { scrapeHomepage, scrapeEpisodePage } = require('./api/src/scraper/index.js');

async function test() {
    console.log("Fetching homepage...");
    const home = await scrapeHomepage();
    const items = [...home.featured, ...home.latest].slice(0, 5);
    for (const item of items) {
        console.log(`Checking ${item.slug}...`);
        const epData = await scrapeEpisodePage(item.slug);
        const servers = epData.streamLinks.map(l => l.server);
        console.log(`- Servers: ${servers.join(', ')}`);
        if (servers.includes('FileLions')) {
            console.log(`=> FOUND FILELIONS IN ${item.slug}!`);
            return;
        }
    }
}
test();
