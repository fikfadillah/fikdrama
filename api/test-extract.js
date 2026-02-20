const { extractStream } = require('./src/scraper/extractor');

async function test() {
    console.log("Testing Hydrax fast-path bypass extraction...");
    const url = 'https://short.icu/w/239719h'; // Sample hydrax short url

    console.log(`Testing URL: ${url}`);
    const timeStart = Date.now();
    const result = await extractStream(url);
    const timeEnd = Date.now();

    console.log(`Extraction took ${timeEnd - timeStart}ms`);
    console.log(JSON.stringify(result, null, 2));
}

test();
