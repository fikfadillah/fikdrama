const axios = require('axios');
const cheerio = require('cheerio');

axios.get('http://45.11.57.31/series/')
    .then(res => {
        const $ = cheerio.load(res.data);
        console.log($('.filter').html() || $('.filters').html() || $('form').html());
    })
    .catch(console.error);
