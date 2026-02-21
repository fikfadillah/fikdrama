const axios = require('axios');
const cheerio = require('cheerio');

axios.get('http://45.11.57.31/series/')
    .then(res => {
        const $ = cheerio.load(res.data);
        console.log('--- Countries in Filter Dropdown ---');
        $('[name="country[]"] option, [name="country"] option').each((i, el) => {
            console.log($(el).attr('value'), ':', $(el).text());
        });
    })
    .catch(console.error);
