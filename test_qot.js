const { scrapeEpisodePage } = require('./api/src/scraper/index.js');

async function test() {
    console.log("Fetching Queen of Tears Episode 1...");
    const data = await scrapeEpisodePage('queen-of-tears-episode-1');
    const servers = data.streamLinks.map(l => l.server);
    console.log(`Servers found: ${servers.join(', ')}`);

    const fileLionsLink = data.streamLinks.find(l => l.server.includes('FileLions'));
    if (fileLionsLink) {
        console.log(`FileLions URL: ${fileLionsLink.url}`);
    }
}

test();
