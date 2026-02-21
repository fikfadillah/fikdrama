const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
    const html = await axios.get('http://45.11.57.31/queen-of-tears-special-episode-1/').then(r => r.data);
    fs.writeFileSync('output.html', html);
    console.log('Saved to output.html');
}
test();
